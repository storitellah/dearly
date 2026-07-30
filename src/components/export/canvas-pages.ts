/**
 * Renders paginated letters onto canvases.
 *
 * The same `LetterLayout` that drives printing is drawn here, so a PNG, a JPEG
 * and a printed sheet break in the same places. Everything happens on the
 * device: no server rendering, no remote fonts, no network access.
 */

import type { LetterLayout, TextLine } from '../printing/layout';
import { foldGuides } from '../printing/paper';
import { getFont } from '../stationery/typography';
import { assetUrl } from '../utilities/assets';
import { describe } from '../utilities/events';
import type { StoredAttachment } from '../storage/attachments-repo';

export interface RenderPagesOptions {
  /** Output resolution. 300 is print quality, 150 is plenty for the screen. */
  dpi?: number;
  /** Draw the paper colour and texture. Turn off for a plain white page. */
  withStationery?: boolean;
  attachments?: StoredAttachment[];
  /** Progress callback: page index and total. */
  onProgress?: (page: number, total: number) => void;
}

const MM_PER_INCH = 25.4;

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  widthMm: number;
  heightMm: number;
}

function pxPerMm(dpi: number): number {
  return dpi / MM_PER_INCH;
}

async function loadImage(blob: Blob): Promise<CanvasImageSource | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const textureCache = new Map<string, CanvasImageSource | null>();

async function loadTexture(path: string): Promise<CanvasImageSource | null> {
  const href = assetUrl(path);
  if (textureCache.has(href)) return textureCache.get(href) ?? null;
  try {
    const response = await fetch(href, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`texture ${response.status}`);
    const blob = await response.blob();
    const image = await loadImage(blob);
    textureCache.set(href, image);
    return image;
  } catch (error) {
    // A missing texture must never stop an export.
    console.warn('Dearly: a stationery texture could not be loaded for export.', describe(error));
    textureCache.set(href, null);
    return null;
  }
}

function drawJustified(
  ctx: CanvasRenderingContext2D,
  line: TextLine,
  xPx: number,
  yPx: number,
  widthPx: number,
): void {
  const words = line.text.split(' ').filter((word) => word.length > 0);
  if (words.length <= 1) {
    ctx.fillText(line.text, xPx, yPx);
    return;
  }
  const wordsWidth = words.reduce((total, word) => total + ctx.measureText(word).width, 0);
  const gap = (widthPx - wordsWidth) / (words.length - 1);
  let cursor = xPx;
  for (const word of words) {
    ctx.fillText(word, cursor, yPx);
    cursor += ctx.measureText(word).width + gap;
  }
}

/** Renders every page of a layout. Each canvas is returned in page order. */
export async function renderLayoutToCanvases(
  layout: LetterLayout,
  options: RenderPagesOptions = {},
): Promise<RenderedPage[]> {
  const dpi = options.dpi ?? 200;
  const scale = pxPerMm(dpi);
  const withStationery = options.withStationery !== false;
  const attachments = options.attachments ?? [];

  const imageSources = new Map<string, CanvasImageSource>();
  for (const attachment of attachments) {
    const source = await loadImage(attachment.original);
    if (source) imageSources.set(attachment.id, source);
  }

  const texture =
    withStationery && layout.stationery.texture ? await loadTexture(layout.stationery.texture) : null;

  const pages: RenderedPage[] = [];
  const font = getFont(layout.fontId);

  for (const [index, page] of layout.pages.entries()) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(layout.paper.widthMm * scale);
    canvas.height = Math.round(layout.paper.heightMm * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot render pages to a canvas.');

    ctx.fillStyle = withStationery ? layout.stationery.paper : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (texture) {
      const tile = Math.max(4, layout.stationery.textureTileMm) * scale;
      const pattern = document.createElement('canvas');
      pattern.width = Math.round(tile);
      pattern.height = Math.round(tile);
      const patternCtx = pattern.getContext('2d');
      if (patternCtx) {
        patternCtx.drawImage(texture, 0, 0, pattern.width, pattern.height);
        const fill = ctx.createPattern(pattern, 'repeat');
        if (fill) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = fill;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
        }
      }
    }

    if (withStationery && layout.stationery.ruling !== 'none') {
      drawRuling(ctx, layout, scale, canvas.width, canvas.height);
    }
    if (withStationery && layout.stationery.border !== 'none') {
      drawBorder(ctx, layout, scale, canvas.width, canvas.height);
    }

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = layout.inkColour;

    for (const item of page.items) {
      if (item.kind === 'image') {
        const source = imageSources.get(item.attachmentId);
        if (!source) continue;
        ctx.drawImage(
          source,
          item.xMm * scale,
          item.yMm * scale,
          item.widthMm * scale,
          item.heightMm * scale,
        );
        continue;
      }

      const sizePx = (item.sizePt / 72) * dpi;
      ctx.font = `${item.italic ? 'italic ' : ''}${item.weight} ${sizePx}px ${font.stack}`;
      ctx.fillStyle = layout.inkColour;
      // Text sits on the baseline: about 78% down the line box for most serifs.
      const baseline = item.yMm * scale + sizePx * 0.82;
      const left = item.xMm * scale;
      const widthPx = item.widthMm * scale;

      if (item.align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(item.text, left + widthPx, baseline);
      } else if (item.align === 'centre') {
        ctx.textAlign = 'center';
        ctx.fillText(item.text, left + widthPx / 2, baseline);
      } else if (item.align === 'justify') {
        ctx.textAlign = 'left';
        drawJustified(ctx, item, left, baseline, widthPx);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(item.text, left, baseline);
      }
    }

    if (layout.showPageNumbers) {
      const sizePx = (8.5 / 72) * dpi;
      ctx.font = `400 ${sizePx}px ${font.stack}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = layout.inkColour;
      ctx.globalAlpha = 0.7;
      ctx.fillText(
        `${index + 1} / ${layout.pages.length}`,
        canvas.width / 2,
        canvas.height - Math.max(6, layout.margins.bottom / 2) * scale,
      );
      ctx.globalAlpha = 1;
    }

    if (layout.showFoldGuides) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(1, scale * 0.15);
      ctx.setLineDash([scale * 2, scale * 2]);
      for (const fraction of foldGuides(layout.paper.id, 'dl')) {
        const y = canvas.height * fraction;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(scale * 6, y);
        ctx.moveTo(canvas.width - scale * 6, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    pages.push({ canvas, widthMm: layout.paper.widthMm, heightMm: layout.paper.heightMm });
    options.onProgress?.(index + 1, layout.pages.length);
  }

  for (const source of imageSources.values()) {
    if (typeof (source as ImageBitmap).close === 'function') (source as ImageBitmap).close();
  }

  return pages;
}

function drawRuling(
  ctx: CanvasRenderingContext2D,
  layout: LetterLayout,
  scale: number,
  width: number,
  height: number,
): void {
  ctx.strokeStyle = layout.stationery.rulingColour;
  ctx.lineWidth = Math.max(1, scale * 0.12);
  const step = layout.lineHeightMm * scale;
  const top = layout.margins.top * scale;
  const left = layout.margins.left * scale;
  const right = width - layout.margins.right * scale;
  const bottom = height - layout.margins.bottom * scale;

  if (layout.stationery.ruling === 'lined' || layout.stationery.ruling === 'grid') {
    for (let y = top + step; y < bottom; y += step) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
  }
  if (layout.stationery.ruling === 'grid') {
    for (let x = left; x < right; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
  }
  if (layout.stationery.ruling === 'dotted') {
    ctx.fillStyle = layout.stationery.rulingColour;
    const dot = Math.max(1, scale * 0.35);
    for (let y = top + step; y < bottom; y += step) {
      for (let x = left; x < right; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, dot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawBorder(
  ctx: CanvasRenderingContext2D,
  layout: LetterLayout,
  scale: number,
  width: number,
  height: number,
): void {
  const inset = Math.min(layout.margins.left, layout.margins.top) * scale * 0.45;
  ctx.strokeStyle = layout.stationery.borderColour;
  ctx.lineWidth = Math.max(1, scale * 0.2);
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  if (layout.stationery.border === 'double') {
    const gap = scale * 1.6;
    ctx.lineWidth = Math.max(1, scale * 0.1);
    ctx.strokeRect(inset + gap, inset + gap, width - (inset + gap) * 2, height - (inset + gap) * 2);
  }
  if (layout.stationery.border === 'deckled') {
    ctx.setLineDash([scale * 1.2, scale * 0.9]);
    ctx.strokeRect(inset * 0.6, inset * 0.6, width - inset * 1.2, height - inset * 1.2);
    ctx.setLineDash([]);
  }
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/png' | 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The page could not be encoded.'))),
      type,
      quality,
    );
  });
}

/** Frees a canvas promptly, which matters on memory-constrained phones. */
export function releasePage(page: RenderedPage): void {
  page.canvas.width = 0;
  page.canvas.height = 0;
}
