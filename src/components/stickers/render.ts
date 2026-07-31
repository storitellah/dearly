/**
 * Drawing stickers.
 *
 * On screen a sticker is an inline SVG element, built node by node — no markup
 * string, no `innerHTML`, nothing that could carry script. For print and PDF the
 * same vector art is rasterised at the requested resolution, so a sticker that
 * looks crisp on screen is crisp on paper at 300 DPI rather than a blurry
 * screenshot of itself.
 */

import { getShape } from './shapes';
import { getSticker } from './library';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Builds the SVG element for a sticker. Returns null for an unknown id. */
export function renderSticker(stickerId: string, colourOverrides: string[] = []): SVGSVGElement | null {
  const sticker = getSticker(stickerId);
  if (!sticker) return null;
  const shape = getShape(sticker.shape);
  if (!shape) return null;

  const colours = sticker.colours.map((colour, index) => colourOverrides[index] ?? colour);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('role', 'img');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('aria-label', sticker.name);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  for (const path of shape.paths) {
    const node = document.createElementNS(SVG_NS, 'path');
    node.setAttribute('d', path.d);
    const colour = colours[path.slot] ?? colours[0] ?? '#111827';
    if (path.stroke) {
      node.setAttribute('fill', 'none');
      node.setAttribute('stroke', colour);
      node.setAttribute('stroke-width', String(path.strokeWidth ?? 4));
      if (path.round) {
        node.setAttribute('stroke-linecap', 'round');
        node.setAttribute('stroke-linejoin', 'round');
      }
    } else {
      node.setAttribute('fill', colour);
    }
    if (path.opacity !== undefined) node.setAttribute('opacity', String(path.opacity));
    svg.append(node);
  }

  return svg;
}

/**
 * Serialises a sticker to an SVG string for rasterising. The string is built
 * from validated shape data and hex colours only, and is used solely as the
 * source of an offscreen image — it is never inserted into the page.
 */
export function stickerToSvgSource(stickerId: string, colourOverrides: string[] = []): string | null {
  const sticker = getSticker(stickerId);
  if (!sticker) return null;
  const shape = getShape(sticker.shape);
  if (!shape) return null;

  const colours = sticker.colours.map((colour, index) => colourOverrides[index] ?? colour);
  const safe = (value: string): string => (/^#[0-9a-f]{3,6}$/i.test(value) ? value : '#111827');

  const paths = shape.paths
    .map((path) => {
      const colour = safe(colours[path.slot] ?? colours[0] ?? '#111827');
      const attributes = path.stroke
        ? `fill="none" stroke="${colour}" stroke-width="${path.strokeWidth ?? 4}"${
            path.round ? ' stroke-linecap="round" stroke-linejoin="round"' : ''
          }`
        : `fill="${colour}"`;
      const opacity = path.opacity !== undefined ? ` opacity="${path.opacity}"` : '';
      // The `d` values come from this repository's own shape table.
      return `<path d="${path.d}" ${attributes}${opacity}/>`;
    })
    .join('');

  return `<svg xmlns="${SVG_NS}" viewBox="0 0 100 100">${paths}</svg>`;
}

const rasterCache = new Map<string, HTMLCanvasElement>();

/**
 * Rasterises a sticker at a given pixel size, for print and PDF output.
 * Rendering from vector at the target size keeps edges sharp at any DPI.
 */
export async function rasteriseSticker(
  stickerId: string,
  colourOverrides: string[],
  pixels: number,
): Promise<HTMLCanvasElement | null> {
  const key = `${stickerId}|${colourOverrides.join(',')}|${pixels}`;
  const cached = rasterCache.get(key);
  if (cached) return cached;

  const source = stickerToSvgSource(stickerId, colourOverrides);
  if (!source) return null;

  const blob = new Blob([source], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => resolve(null);
      element.src = url;
    });
    if (!image) return null;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(pixels));
    canvas.height = Math.max(1, Math.round(pixels));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    if (rasterCache.size > 200) rasterCache.clear();
    rasterCache.set(key, canvas);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function clearStickerRasterCache(): void {
  rasterCache.clear();
}
