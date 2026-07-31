/**
 * Print controller.
 *
 * Printing uses the browser's own print pipeline — no server, no PDF service —
 * and therefore works offline. The controller builds a print subtree, swaps in
 * the stylesheet that declares the physical page size, waits for images to
 * decode, calls `window.print()` and then removes everything it created.
 */

import { layoutLetter, type LayoutOptions } from './layout';
import { renderLetterPages } from './print-render';
import { renderDocumentPages } from './document-print';
import { layoutEnvelope } from '../envelope/envelope-layout';
import { renderEnvelopePage } from '../envelope/envelope-render';
import { getPaper } from './paper';
import type { LetterRecord } from '../storage/schema';
import type { StoredAttachment } from '../storage/attachments-repo';
import { assetUrl } from '../utilities/assets';
import { describe } from '../utilities/events';

export type PrintScope = 'letter' | 'envelope' | 'letter-and-envelope';

export interface PrintRequest {
  scope: PrintScope;
  paperId: string;
  /** Millimetre margins; omit to use the stationery's own margins. */
  margins?: { top: number; right: number; bottom: number; left: number };
  showPageNumbers: boolean;
  showFoldGuides: boolean;
  showCutGuides: boolean;
  includePhotographs: boolean;
  /** Duplex hint. Blank sheets are inserted so each letter starts on a front. */
  duplex: boolean;
  /** Print the envelope on its own envelope-sized page, or on a sheet. */
  envelopeTarget: 'envelope' | 'sheet';
}

export const DEFAULT_PRINT_REQUEST: PrintRequest = {
  scope: 'letter',
  paperId: 'a4',
  showPageNumbers: true,
  showFoldGuides: false,
  showCutGuides: false,
  includePhotographs: true,
  duplex: false,
  envelopeTarget: 'sheet',
};

const PRINT_ROOT_ID = 'dearly-print-root';
const PAGE_STYLE_ID = 'dearly-page-size';

export interface PrintOutcome {
  pages: number;
  /** Resolves once the print dialog has been dismissed, where the browser says so. */
  completed: boolean;
}

function ensurePrintRoot(): HTMLElement {
  const existing = document.getElementById(PRINT_ROOT_ID);
  if (existing) existing.remove();
  const root = document.createElement('div');
  root.id = PRINT_ROOT_ID;
  root.className = 'print-root';
  root.setAttribute('aria-hidden', 'true');
  document.body.append(root);
  return root;
}

/**
 * `@page { size: … }` cannot be driven by a CSS variable, so each physical size
 * has its own small stylesheet in `public/print/`. Loading a same-origin file
 * keeps `style-src 'self'` intact — no inline `<style>`, no `unsafe-inline`.
 */
function applyPageSize(sizeId: string): void {
  const href = assetUrl(`print/page-${sizeId}.css`);
  let link = document.getElementById(PAGE_STYLE_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = PAGE_STYLE_ID;
    link.rel = 'stylesheet';
    link.media = 'print';
    document.head.append(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) return;
      await new Promise<void>((resolve) => {
        const done = (): void => resolve();
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
      });
      if (typeof image.decode === 'function') {
        try {
          await image.decode();
        } catch {
          /* a failed decode must not block printing the text */
        }
      }
    }),
  );
}

/**
 * Prepares the print tree and opens the browser's print preview.
 * Resolves after the dialog closes (or immediately, in browsers that do not
 * report it), having removed every temporary node and object URL.
 */
export async function printLetter(
  letter: LetterRecord,
  attachments: StoredAttachment[],
  request: PrintRequest = DEFAULT_PRINT_REQUEST,
): Promise<PrintOutcome> {
  const paper = getPaper(request.paperId);
  const layoutOptions: LayoutOptions = {
    paperId: paper.id,
    showPageNumbers: request.showPageNumbers,
    showFoldGuides: request.showFoldGuides,
    showCutGuides: request.showCutGuides,
    includePhotographs: request.includePhotographs,
  };
  if (request.margins) layoutOptions.margins = request.margins;

  const root = ensurePrintRoot();
  const urls: string[] = [];

  try {
    const imageUrls = new Map<string, string>();
    const photoUrls = new Map<string, string>();
    const stickerUrls = new Map<string, string>();
    if (request.scope !== 'envelope') {
      for (const attachment of attachments) {
        const url = URL.createObjectURL(attachment.original);
        urls.push(url);
        imageUrls.set(attachment.id, url);
        if (attachment.role === 'photo') photoUrls.set(attachment.id, url);
        else stickerUrls.set(attachment.id, url);
      }
    }

    let pages = 0;
    let letterPages = 0;

    if (request.scope !== 'envelope') {
      // The document is the letter. The older line layout is kept for records
      // that have none — a letter locked or imported before the page existed.
      const useDocument = letter.doc.blocks.length > 0 || letter.doc.decorations.length > 0;

      if (useDocument) {
        const printed = renderDocumentPages(letter, letter.doc, {
          photoUrls: request.includePhotographs ? photoUrls : new Map(),
          stickerUrls,
          showPageNumbers: request.showPageNumbers,
          paperWidthMm: paper.widthMm,
          paperHeightMm: paper.heightMm,
        });
        for (const page of printed.pages) root.append(page);
        letterPages = printed.pages.length;
      } else {
        const layout = layoutLetter(letter, layoutOptions);
        root.append(renderLetterPages(layout, { imageUrls }, letter.envelope.size));
        letterPages = layout.pages.length;
      }

      pages += letterPages;
      if (request.duplex && letterPages % 2 === 1 && request.scope !== 'letter') {
        // Keep the envelope on a fresh sheet when printing double-sided.
        const filler = document.createElement('section');
        filler.className = 'print-page print-page--blank';
        filler.style.setProperty('width', `${paper.widthMm}mm`);
        filler.style.setProperty('height', `${paper.heightMm}mm`);
        root.append(filler);
        pages += 1;
      }
    }

    if (request.scope !== 'letter') {
      const envelopeLayout = layoutEnvelope(letter, {
        target: request.envelopeTarget,
        sheetId: paper.id,
        showGuides: request.envelopeTarget === 'sheet',
      });
      root.append(renderEnvelopePage(envelopeLayout));
      pages += 1;
    }

    // With both a letter and an envelope in one job the page size must be the
    // sheet, because a print job carries one physical size.
    const sizeId =
      request.scope === 'envelope' && request.envelopeTarget === 'envelope'
        ? letter.envelope.size
        : paper.id;
    applyPageSize(sizeId);

    document.body.classList.add('is-printing');
    document.body.setAttribute('data-print-scope', request.scope);
    await waitForImages(root);

    const completed = await triggerPrint();
    return { pages, completed };
  } catch (error) {
    console.error('Dearly: printing failed.', describe(error));
    throw error;
  } finally {
    document.body.classList.remove('is-printing');
    document.body.removeAttribute('data-print-scope');
    root.remove();
    for (const url of urls) URL.revokeObjectURL(url);
  }
}

function triggerPrint(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener('afterprint', afterPrint);
      resolve(value);
    };
    const afterPrint = (): void => finish(true);
    window.addEventListener('afterprint', afterPrint);

    try {
      window.print();
    } catch (error) {
      console.error('Dearly: the browser refused to open the print dialog.', describe(error));
      finish(false);
      return;
    }
    // Safari does not always fire `afterprint`; fall back after a short wait so
    // the temporary print tree is never left behind.
    window.setTimeout(() => finish(true), 1200);
  });
}
