/**
 * Typography.
 *
 * Dearly loads no remote fonts. Every family below is a stack of fonts the
 * operating system already provides, with a generic fallback, so text renders
 * identically online, offline and inside an installed app — and no third party
 * ever learns that a letter was opened.
 *
 * To bundle a self-hosted font instead, drop the files into `public/fonts/`,
 * add an `@font-face` rule to `src/styles/fonts.css`, and add an entry here.
 * See `public/fonts/README.md`.
 */

export interface FontChoice {
  id: string;
  name: string;
  description: string;
  stack: string;
  /** Rough width factor used by the canvas exporter as a measurement fallback. */
  widthFactor: number;
}

const SERIF =
  'Literata, "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif';
const HUMANIST =
  '"Iowan Old Style", Charter, "Bitstream Charter", Cambria, Georgia, serif';
const SANS =
  '"Inter", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
const SCRIPT =
  '"Segoe Script", "Bradley Hand", "Apple Chancery", "URW Chancery L", "Comic Sans MS", cursive';
const MONO =
  '"SF Mono", "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const FONTS: FontChoice[] = [
  {
    id: 'literata',
    name: 'Book serif',
    description: 'A steady reading serif. Prints cleanly at small sizes.',
    stack: SERIF,
    widthFactor: 0.5,
  },
  {
    id: 'humanist',
    name: 'Old style',
    description: 'Slightly narrower, with a older-letterpress feel.',
    stack: HUMANIST,
    widthFactor: 0.49,
  },
  {
    id: 'plain',
    name: 'Plain sans',
    description: 'Modern and highly legible. A good choice for screen reading.',
    stack: SANS,
    widthFactor: 0.52,
  },
  {
    id: 'hand',
    name: 'Handwritten',
    description: 'A casual hand. Check the print preview before a long letter.',
    stack: SCRIPT,
    widthFactor: 0.46,
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    description: 'Fixed width, like a typed page.',
    stack: MONO,
    widthFactor: 0.6,
  },
];

export const DEFAULT_FONT_ID = 'literata';

export function getFont(id: string): FontChoice {
  return FONTS.find((font) => font.id === id) ?? FONTS[0]!;
}

/** Points to millimetres, for print layout maths. */
export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}

/** Millimetres to CSS pixels at 96 dpi, for on-screen previews. */
export function mmToPx(mm: number): number {
  return (mm / 25.4) * 96;
}

export function ptToPx(pt: number): number {
  return (pt / 72) * 96;
}

export const TEXT_SIZES = [9, 10, 10.5, 11, 11.5, 12, 13, 14, 16] as const;
export const LINE_HEIGHTS = [1.35, 1.5, 1.65, 1.8, 2] as const;
