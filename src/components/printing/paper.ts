/** Physical paper and envelope sizes, in millimetres. */

export interface PaperSpec {
  id: 'a4' | 'letter' | 'a5';
  name: string;
  widthMm: number;
  heightMm: number;
  /** The value used in the `@page { size: … }` rule. */
  cssSize: string;
}

export const PAPERS: PaperSpec[] = [
  { id: 'a4', name: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297, cssSize: 'A4 portrait' },
  {
    id: 'letter',
    name: 'US Letter (8.5 × 11 in)',
    widthMm: 215.9,
    heightMm: 279.4,
    cssSize: 'Letter portrait',
  },
  { id: 'a5', name: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210, cssSize: 'A5 portrait' },
];

export function getPaper(id: string): PaperSpec {
  return PAPERS.find((paper) => paper.id === id) ?? PAPERS[0]!;
}

export interface EnvelopeSpec {
  id: 'dl' | 'c5' | 'c6' | 'us-10';
  name: string;
  widthMm: number;
  heightMm: number;
  /** Which sheet the envelope is printed on. */
  sheet: 'a4' | 'letter';
}

export const ENVELOPES: EnvelopeSpec[] = [
  { id: 'dl', name: 'DL (220 × 110 mm)', widthMm: 220, heightMm: 110, sheet: 'a4' },
  { id: 'c5', name: 'C5 (229 × 162 mm)', widthMm: 229, heightMm: 162, sheet: 'a4' },
  { id: 'c6', name: 'C6 (162 × 114 mm)', widthMm: 162, heightMm: 114, sheet: 'a4' },
  { id: 'us-10', name: 'US #10 (9.5 × 4.125 in)', widthMm: 241.3, heightMm: 104.8, sheet: 'letter' },
];

export function getEnvelope(id: string): EnvelopeSpec {
  return ENVELOPES.find((envelope) => envelope.id === id) ?? ENVELOPES[0]!;
}

export const MM_PER_INCH = 25.4;
export const POINTS_PER_INCH = 72;

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * POINTS_PER_INCH;
}

/**
 * Fold positions for a sheet, as fractions of the page height. A letter folded
 * in three fits a DL or US #10 envelope; folded in half it fits C5.
 */
export function foldGuides(paperId: string, envelopeId: string): number[] {
  const envelope = getEnvelope(envelopeId);
  if (envelope.id === 'c5') return [0.5];
  if (paperId === 'a5') return [0.5];
  return [1 / 3, 2 / 3];
}
