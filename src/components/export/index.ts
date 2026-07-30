/**
 * Export and backup orchestration.
 *
 * Every function here runs entirely in the browser and returns a real file. This
 * module is loaded lazily, so a first visit does not pay for the export pipeline.
 */

import { layoutLetter } from '../printing/layout';
import { canvasToBlob, releasePage, renderLayoutToCanvases } from './canvas-pages';
import { buildPdf, type PdfPageInput } from './pdf';
import { letterToHtml, letterToPlainText } from './text-export';
import { archiveFileName, buildArchive, openArchive } from './archive';
import { triggerDownload, type DownloadResult } from './download';
import { getAttachmentsForLetter, putAttachment } from '../storage/attachments-repo';
import { getAllLetters, putLetter } from '../storage/letters-repo';
import { saveSnapshot } from '../storage/snapshots';
import { base64ToBlob } from '../utilities/bytes';
import { safeFileName } from '../utilities/format';
import { assertAcceptableArchiveFile, MAX_ARCHIVE_BYTES } from '../security/validate-import';
import type { LetterRecord } from '../storage/schema';
import type { StoredAttachment } from '../storage/attachments-repo';

export interface ExportOptions {
  paperId: string;
  includePhotographs: boolean;
  showPageNumbers: boolean;
  showFoldGuides?: boolean;
  withStationery?: boolean;
  dpi?: number;
  onProgress?: (page: number, total: number) => void;
}

function baseName(letter: LetterRecord): string {
  return safeFileName(letter.title || letter.recipient || 'letter', 'letter');
}

async function renderPages(
  letter: LetterRecord,
  attachments: StoredAttachment[],
  options: ExportOptions,
): Promise<ReturnType<typeof renderLayoutToCanvases>> {
  const layout = layoutLetter(letter, {
    paperId: options.paperId,
    showPageNumbers: options.showPageNumbers,
    showFoldGuides: options.showFoldGuides ?? false,
    showCutGuides: false,
    includePhotographs: options.includePhotographs,
  });
  return renderLayoutToCanvases(layout, {
    dpi: options.dpi ?? 200,
    withStationery: options.withStationery !== false,
    attachments,
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
  });
}

/** Print-ready PDF, one image-backed page per sheet, at the true paper size. */
export async function exportPdf(
  letter: LetterRecord,
  attachments: StoredAttachment[],
  options: ExportOptions,
): Promise<DownloadResult> {
  const pages = await renderPages(letter, attachments, { ...options, dpi: options.dpi ?? 220 });
  const pdfPages: PdfPageInput[] = [];
  try {
    for (const page of pages) {
      const jpeg = await canvasToBlob(page.canvas, 'image/jpeg', 0.9);
      pdfPages.push({
        jpeg: new Uint8Array(await jpeg.arrayBuffer()),
        widthMm: page.widthMm,
        heightMm: page.heightMm,
        pixelWidth: page.canvas.width,
        pixelHeight: page.canvas.height,
      });
    }
    const blob = buildPdf(pdfPages, {
      title: letter.title || 'A letter',
      subject: letter.recipient ? `A letter for ${letter.recipient}` : undefined,
    });
    return triggerDownload(blob, `${baseName(letter)}.pdf`);
  } finally {
    for (const page of pages) releasePage(page);
  }
}

/** One image file per page. Multiple pages download as separate files. */
export async function exportImages(
  letter: LetterRecord,
  attachments: StoredAttachment[],
  format: 'image/png' | 'image/jpeg',
  options: ExportOptions,
): Promise<DownloadResult[]> {
  const pages = await renderPages(letter, attachments, options);
  const results: DownloadResult[] = [];
  const extension = format === 'image/png' ? 'png' : 'jpg';
  try {
    for (const [index, page] of pages.entries()) {
      const blob = await canvasToBlob(page.canvas, format, 0.92);
      const suffix = pages.length > 1 ? `-page-${index + 1}` : '';
      results.push(triggerDownload(blob, `${baseName(letter)}${suffix}.${extension}`));
    }
    return results;
  } finally {
    for (const page of pages) releasePage(page);
  }
}

export function exportPlainText(letter: LetterRecord): DownloadResult {
  const blob = new Blob([letterToPlainText(letter)], { type: 'text/plain;charset=utf-8' });
  return triggerDownload(blob, `${baseName(letter)}.txt`);
}

export async function exportHtml(
  letter: LetterRecord,
  attachments: StoredAttachment[],
): Promise<DownloadResult> {
  const html = await letterToHtml(letter, attachments);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return triggerDownload(blob, `${baseName(letter)}.html`);
}

/** One letter as a `.dearly` archive, optionally encrypted. */
export async function exportLetterArchive(
  letter: LetterRecord,
  attachments: StoredAttachment[],
  password?: string,
): Promise<DownloadResult> {
  const archive = await buildArchive({
    letters: [letter],
    attachments,
    kind: 'letter',
    ...(password ? { password } : {}),
  });
  return triggerDownload(archive.blob, archiveFileName('letter', baseName(letter)));
}

/** The whole memory box as one `.dearly` archive, optionally encrypted. */
export async function exportLibraryArchive(password?: string): Promise<DownloadResult> {
  const rows = await getAllLetters();
  const letters = rows.map((row) => row.letter);
  const attachments: StoredAttachment[] = [];
  for (const letter of letters) {
    attachments.push(...(await getAttachmentsForLetter(letter.id)));
  }
  const archive = await buildArchive({
    letters,
    attachments,
    kind: 'library',
    ...(password ? { password } : {}),
  });
  return triggerDownload(archive.blob, archiveFileName('library', 'dearly-library'));
}

export interface ImportSummary {
  imported: number;
  replaced: number;
  skipped: number;
  images: number;
  warnings: string[];
  wasEncrypted: boolean;
}

export type ImportMode = 'merge-keep-existing' | 'merge-replace-existing';

/**
 * Reads an archive file and writes its letters into local storage.
 *
 * The file is validated before anything is written, existing letters are
 * snapshotted before being replaced, and a letter that fails validation is
 * skipped rather than allowed to abort the whole import.
 */
export async function importArchiveFile(
  file: File,
  options: { password?: string; mode?: ImportMode } = {},
): Promise<ImportSummary> {
  assertAcceptableArchiveFile({ name: file.name, size: file.size, type: file.type });
  if (file.size > MAX_ARCHIVE_BYTES) {
    throw new Error('That backup is too large to open.');
  }
  const text = await file.text();
  const result = await openArchive(text, options.password);
  const mode = options.mode ?? 'merge-keep-existing';

  const existing = new Map((await getAllLetters()).map((row) => [row.letter.id, row.letter]));

  const summary: ImportSummary = {
    imported: 0,
    replaced: 0,
    skipped: 0,
    images: 0,
    warnings: [...result.warnings],
    wasEncrypted: result.wasEncrypted,
  };

  for (const letter of result.letters) {
    const previous = existing.get(letter.id);
    if (previous && mode === 'merge-keep-existing') {
      summary.skipped += 1;
      continue;
    }
    if (previous) {
      // Never overwrite without a way back.
      await saveSnapshot(previous, 'pre-import', { force: true });
      summary.replaced += 1;
    } else {
      summary.imported += 1;
    }
    await putLetter(letter, { touch: false });
  }

  const acceptedIds = new Set(
    result.letters
      .filter((letter) => {
        const previous = existing.get(letter.id);
        return !(previous && mode === 'merge-keep-existing');
      })
      .map((letter) => letter.id),
  );

  for (const attachment of result.attachments) {
    if (!acceptedIds.has(attachment.letterId)) continue;
    try {
      const original = base64ToBlob(attachment.originalBase64, attachment.type);
      const preview = attachment.previewBase64
        ? base64ToBlob(attachment.previewBase64, attachment.type)
        : original;
      await putAttachment({
        id: attachment.id,
        letterId: attachment.letterId,
        name: attachment.name,
        type: attachment.type,
        bytes: original.size,
        width: attachment.width,
        height: attachment.height,
        caption: attachment.caption,
        role: attachment.role,
        createdAt: attachment.createdAt,
        original,
        preview,
      });
      summary.images += 1;
    } catch {
      summary.warnings.push('An image in the backup could not be restored and was skipped.');
    }
  }

  return summary;
}

export { openArchive, buildArchive };
