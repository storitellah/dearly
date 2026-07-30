/**
 * Text measurement.
 *
 * One measurement function drives print pagination, PNG/JPEG export and PDF
 * export, so all three agree on where a page ends. When a real canvas is
 * available the browser's own metrics are used; otherwise a deterministic
 * estimate keeps layout code testable outside a browser.
 */

import { getFont } from '../stationery/typography';

export interface TextStyle {
  fontId: string;
  sizePx: number;
  italic?: boolean;
  weight?: number;
}

export type Measurer = (text: string, style: TextStyle) => number;

export function fontString(style: TextStyle): string {
  const font = getFont(style.fontId);
  const parts = [
    style.italic ? 'italic' : 'normal',
    String(style.weight ?? 400),
    `${style.sizePx}px`,
    font.stack,
  ];
  return parts.join(' ');
}

let sharedContext: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (sharedContext !== undefined) return sharedContext;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    // jsdom returns a context without a usable measureText implementation.
    sharedContext = ctx && typeof ctx.measureText === 'function' ? ctx : null;
    if (sharedContext) {
      const probe = sharedContext.measureText('probe');
      if (!probe || !Number.isFinite(probe.width) || probe.width === 0) sharedContext = null;
    }
  } catch {
    sharedContext = null;
  }
  return sharedContext;
}

/** Deterministic fallback: average character width × length. */
export function estimateWidth(text: string, style: TextStyle): number {
  const font = getFont(style.fontId);
  let units = 0;
  for (const character of text) {
    if (character === ' ') units += 0.42;
    else if (/[ijltfrI.,;:'|!]/.test(character)) units += 0.62;
    else if (/[mwMW@]/.test(character)) units += 1.38;
    else if (/[A-Z0-9]/.test(character)) units += 1.12;
    else units += 1;
  }
  return units * font.widthFactor * style.sizePx;
}

export const measureText: Measurer = (text, style) => {
  if (text.length === 0) return 0;
  const ctx = context();
  if (!ctx) return estimateWidth(text, style);
  ctx.font = fontString(style);
  return ctx.measureText(text).width;
};

/** Test hook: force the deterministic path. */
export function useEstimatedMeasurement(): void {
  sharedContext = null;
}

export function resetMeasurementCache(): void {
  sharedContext = undefined;
}
