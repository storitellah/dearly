/**
 * Paper designs.
 *
 * Each design is generated from CSS gradients rather than an image file, which
 * means every paper is resolution-independent, prints crisply, costs nothing to
 * download, works offline, and can be recoloured to any theme instantly.
 */

export type PaperPatternId =
  | 'plain'
  | 'lined'
  | 'grid'
  | 'dots'
  | 'confetti'
  | 'hearts'
  | 'stars'
  | 'stripes'
  | 'diagonal'
  | 'checks'
  | 'clouds'
  | 'notebook'
  | 'graph-tint'
  | 'sunburst'
  | 'kente-edge';

export interface PaperDesign {
  id: PaperPatternId;
  name: string;
  /** Builds the CSS `background-image` value from two ink colours. */
  background: (primary: string, secondary: string) => string;
  /** Builds the matching `background-size`. */
  size: (stepMm: number) => string;
  /** Patterns that should be faint enough to write over. */
  defaultOpacity: number;
}

const mm = (value: number): string => `${value}mm`;

export const PAPERS: PaperDesign[] = [
  {
    id: 'plain',
    name: 'Plain',
    background: () => 'none',
    size: () => 'auto',
    defaultOpacity: 1,
  },
  {
    id: 'lined',
    name: 'Ruled',
    background: (primary) =>
      `repeating-linear-gradient(to bottom, transparent 0, transparent calc(100% - 0.25mm), ${primary} calc(100% - 0.25mm), ${primary} 100%)`,
    size: (step) => `100% ${mm(step)}`,
    defaultOpacity: 0.5,
  },
  {
    id: 'notebook',
    name: 'School notebook',
    background: (primary, secondary) =>
      `repeating-linear-gradient(to bottom, transparent 0, transparent calc(100% - 0.25mm), ${primary} calc(100% - 0.25mm), ${primary} 100%), linear-gradient(to right, transparent 0, transparent 24mm, ${secondary} 24mm, ${secondary} 24.4mm, transparent 24.4mm)`,
    size: (step) => `100% ${mm(step)}, 100% 100%`,
    defaultOpacity: 0.6,
  },
  {
    id: 'grid',
    name: 'Grid',
    background: (primary) =>
      `linear-gradient(to right, ${primary} 0.2mm, transparent 0.2mm), linear-gradient(to bottom, ${primary} 0.2mm, transparent 0.2mm)`,
    size: (step) => `${mm(step)} ${mm(step)}, ${mm(step)} ${mm(step)}`,
    defaultOpacity: 0.35,
  },
  {
    id: 'graph-tint',
    name: 'Fine graph',
    background: (primary, secondary) =>
      `linear-gradient(to right, ${primary} 0.15mm, transparent 0.15mm), linear-gradient(to bottom, ${primary} 0.15mm, transparent 0.15mm), linear-gradient(to right, ${secondary} 0.25mm, transparent 0.25mm)`,
    size: (step) => `${mm(step / 2)} ${mm(step / 2)}, ${mm(step / 2)} ${mm(step / 2)}, ${mm(step * 2.5)} 100%`,
    defaultOpacity: 0.3,
  },
  {
    id: 'dots',
    name: 'Dotted',
    background: (primary) => `radial-gradient(${primary} 0.35mm, transparent 0.35mm)`,
    size: (step) => `${mm(step)} ${mm(step)}`,
    defaultOpacity: 0.45,
  },
  {
    id: 'confetti',
    name: 'Confetti',
    background: (primary, secondary) =>
      `radial-gradient(${primary} 0.8mm, transparent 0.9mm), radial-gradient(${secondary} 0.6mm, transparent 0.7mm), radial-gradient(${primary} 0.5mm, transparent 0.6mm)`,
    size: (step) =>
      `${mm(step * 2.4)} ${mm(step * 2.1)}, ${mm(step * 1.7)} ${mm(step * 1.9)}, ${mm(step * 3.1)} ${mm(step * 2.7)}`,
    defaultOpacity: 0.55,
  },
  {
    id: 'hearts',
    name: 'Little hearts',
    background: (primary, secondary) =>
      `radial-gradient(circle at 30% 35%, ${primary} 0.7mm, transparent 0.8mm), radial-gradient(circle at 70% 35%, ${primary} 0.7mm, transparent 0.8mm), radial-gradient(circle at 50% 62%, ${secondary} 0.9mm, transparent 1mm)`,
    size: (step) => `${mm(step * 2)} ${mm(step * 2)}, ${mm(step * 2)} ${mm(step * 2)}, ${mm(step * 2)} ${mm(step * 2)}`,
    defaultOpacity: 0.4,
  },
  {
    id: 'stars',
    name: 'Star scatter',
    background: (primary, secondary) =>
      `radial-gradient(${primary} 0.5mm, transparent 0.6mm), radial-gradient(${secondary} 0.35mm, transparent 0.45mm)`,
    size: (step) => `${mm(step * 2.3)} ${mm(step * 2.6)}, ${mm(step * 1.6)} ${mm(step * 1.8)}`,
    defaultOpacity: 0.5,
  },
  {
    id: 'stripes',
    name: 'Stripes',
    background: (primary) =>
      `repeating-linear-gradient(to right, ${primary} 0, ${primary} 2mm, transparent 2mm, transparent 8mm)`,
    size: () => 'auto',
    defaultOpacity: 0.25,
  },
  {
    id: 'diagonal',
    name: 'Diagonal candy',
    background: (primary, secondary) =>
      `repeating-linear-gradient(45deg, ${primary} 0, ${primary} 3mm, transparent 3mm, transparent 6mm, ${secondary} 6mm, ${secondary} 9mm, transparent 9mm, transparent 12mm)`,
    size: () => 'auto',
    defaultOpacity: 0.22,
  },
  {
    id: 'checks',
    name: 'Gingham',
    background: (primary, secondary) =>
      `repeating-linear-gradient(to right, ${primary} 0, ${primary} 4mm, transparent 4mm, transparent 8mm), repeating-linear-gradient(to bottom, ${secondary} 0, ${secondary} 4mm, transparent 4mm, transparent 8mm)`,
    size: () => 'auto',
    defaultOpacity: 0.2,
  },
  {
    id: 'clouds',
    name: 'Soft clouds',
    background: (primary, secondary) =>
      `radial-gradient(ellipse 8mm 4mm at 25% 30%, ${primary} 60%, transparent 62%), radial-gradient(ellipse 6mm 3mm at 70% 65%, ${secondary} 60%, transparent 62%)`,
    size: (step) => `${mm(step * 5)} ${mm(step * 4)}, ${mm(step * 4)} ${mm(step * 5)}`,
    defaultOpacity: 0.35,
  },
  {
    id: 'sunburst',
    name: 'Sunburst',
    background: (primary, secondary) =>
      `repeating-conic-gradient(from 0deg at 50% 0%, ${primary} 0deg 4deg, transparent 4deg 12deg), linear-gradient(to bottom, ${secondary} 0, transparent 40%)`,
    size: () => 'auto',
    defaultOpacity: 0.18,
  },
  {
    id: 'kente-edge',
    name: 'Woven edge',
    background: (primary, secondary) =>
      `repeating-linear-gradient(to bottom, ${primary} 0, ${primary} 2mm, ${secondary} 2mm, ${secondary} 4mm)`,
    size: () => '100% 14mm',
    defaultOpacity: 0.85,
  },
];

export function getPaper(id: string): PaperDesign {
  return PAPERS.find((paper) => paper.id === id) ?? PAPERS[0]!;
}

export type BorderId =
  | 'none'
  | 'hairline'
  | 'double'
  | 'deckled'
  | 'dashed'
  | 'rounded'
  | 'airmail'
  | 'tape-corners'
  | 'scallop';

export interface BorderDesign {
  id: BorderId;
  name: string;
}

export const BORDERS: BorderDesign[] = [
  { id: 'none', name: 'No border' },
  { id: 'hairline', name: 'Hairline' },
  { id: 'double', name: 'Double rule' },
  { id: 'deckled', name: 'Deckled edge' },
  { id: 'dashed', name: 'Dashed' },
  { id: 'rounded', name: 'Rounded card' },
  { id: 'airmail', name: 'Air mail' },
  { id: 'tape-corners', name: 'Taped corners' },
  { id: 'scallop', name: 'Scalloped' },
];
