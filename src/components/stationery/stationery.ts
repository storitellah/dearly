/**
 * Stationery definitions.
 *
 * A stationery choice is data, not markup: paper colour, optional texture file,
 * ruling, border and default ink. Textures are ordinary image files under
 * `public/stationery/` and are fetched only when a stationery is first used, so
 * the initial load stays small.
 */

export interface Stationery {
  id: string;
  name: string;
  description: string;
  /** Paper colour, also used as the print background where printing allows it. */
  paper: string;
  /** Default ink colour for this paper. */
  ink: string;
  /** Optional texture, relative to the application base path. */
  texture: string | null;
  /** Texture tile size in millimetres, for print fidelity. */
  textureTileMm: number;
  ruling: 'none' | 'lined' | 'dotted' | 'grid';
  rulingColour: string;
  border: 'none' | 'hairline' | 'double' | 'deckled';
  borderColour: string;
  /** Print margins in millimetres. */
  margins: { top: number; right: number; bottom: number; left: number };
}

export const STATIONERY: Stationery[] = [
  {
    id: 'ivory-laid',
    name: 'Ivory laid',
    description: 'Warm ivory paper with a soft laid grain. The default.',
    paper: '#fbf6ec',
    ink: '#2b2118',
    texture: 'stationery/laid-ivory.svg',
    textureTileMm: 12,
    ruling: 'none',
    rulingColour: '#d8cbb4',
    border: 'none',
    borderColour: '#d8cbb4',
    margins: { top: 22, right: 20, bottom: 22, left: 20 },
  },
  {
    id: 'letter-lined',
    name: 'Ruled writing paper',
    description: 'Classic ruled paper for a steady, even hand.',
    paper: '#fdfcf7',
    ink: '#20304a',
    texture: null,
    textureTileMm: 0,
    ruling: 'lined',
    rulingColour: '#c9d6e3',
    border: 'none',
    borderColour: '#c9d6e3',
    margins: { top: 20, right: 18, bottom: 20, left: 24 },
  },
  {
    id: 'linen-blush',
    name: 'Linen blush',
    description: 'Pale rose paper with a woven linen texture.',
    paper: '#fdf0ee',
    ink: '#5b2b34',
    texture: 'stationery/linen-blush.svg',
    textureTileMm: 8,
    ruling: 'none',
    rulingColour: '#e8cdc9',
    border: 'hairline',
    borderColour: '#dcb3ad',
    margins: { top: 24, right: 22, bottom: 24, left: 22 },
  },
  {
    id: 'airmail',
    name: 'Airmail',
    description: 'Thin airmail paper with a red and blue border.',
    paper: '#fffdf8',
    ink: '#1d2b3a',
    texture: null,
    textureTileMm: 0,
    ruling: 'none',
    rulingColour: '#cfd8e3',
    border: 'double',
    borderColour: '#8c2f39',
    margins: { top: 26, right: 22, bottom: 26, left: 22 },
  },
  {
    id: 'botanical',
    name: 'Pressed botanical',
    description: 'Cream paper with a faint pressed-fern watermark.',
    paper: '#f7f5ea',
    ink: '#2f3a2c',
    texture: 'stationery/botanical.svg',
    textureTileMm: 24,
    ruling: 'none',
    rulingColour: '#d6d9c4',
    border: 'hairline',
    borderColour: '#b9c0a4',
    margins: { top: 24, right: 20, bottom: 24, left: 20 },
  },
  {
    id: 'graph-slate',
    name: 'Slate grid',
    description: 'Cool grey paper with a light grid, good for lists and plans.',
    paper: '#f4f5f7',
    ink: '#242a33',
    texture: null,
    textureTileMm: 0,
    ruling: 'grid',
    rulingColour: '#dbe0e6',
    border: 'none',
    borderColour: '#dbe0e6',
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
  },
  {
    id: 'kraft',
    name: 'Kraft',
    description: 'Recycled kraft paper with visible fibres and a deckled edge.',
    paper: '#efe2cd',
    ink: '#3a2b1c',
    texture: 'stationery/kraft.svg',
    textureTileMm: 10,
    ruling: 'none',
    rulingColour: '#d3bd9c',
    border: 'deckled',
    borderColour: '#c8ad86',
    margins: { top: 22, right: 20, bottom: 22, left: 20 },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep blue paper for pale ink. Uses more toner when printed.',
    paper: '#1b2333',
    ink: '#f2ece0',
    texture: null,
    textureTileMm: 0,
    ruling: 'none',
    rulingColour: '#2c3346',
    border: 'hairline',
    borderColour: '#3b4557',
    margins: { top: 22, right: 20, bottom: 22, left: 20 },
  },
];

export const DEFAULT_STATIONERY_ID = 'ivory-laid';

export function getStationery(id: string): Stationery {
  return STATIONERY.find((item) => item.id === id) ?? STATIONERY[0]!;
}

export function stationeryExists(id: string): boolean {
  return STATIONERY.some((item) => item.id === id);
}

/** Ruling line spacing in millimetres for a given body size in points. */
export function rulingSpacingMm(sizePt: number, lineHeight: number): number {
  const lineHeightPt = sizePt * lineHeight;
  return Number(((lineHeightPt * 25.4) / 72).toFixed(2));
}

const loadedTextures = new Set<string>();

/**
 * Warms a stationery texture so switching paper does not flash. Called on demand
 * only — textures are never part of the initial page load.
 */
export function preloadTexture(stationery: Stationery, basePath: string): void {
  if (!stationery.texture) return;
  const href = `${basePath}${stationery.texture}`;
  if (loadedTextures.has(href)) return;
  loadedTextures.add(href);
  const image = new Image();
  image.decoding = 'async';
  image.src = href;
}
