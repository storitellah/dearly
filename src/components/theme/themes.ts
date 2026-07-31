/**
 * Dearly's colour system.
 *
 * Twelve complete themes. Each one carries every colour the interface, the
 * paper, the stickers and the envelopes need, plus a print-safe variation —
 * because a screen colour that looks joyful can waste an entire ink cartridge
 * or print as mud.
 *
 * Every foreground/background pair used for text is checked against WCAG 2.2 AA
 * by `tests/theme.test.ts`, so a theme cannot ship looking pretty and reading
 * badly.
 */

export interface ThemePalette {
  /** Main brand colour for this theme: primary buttons, active states. */
  primary: string;
  /** Text that sits on `primary`. */
  onPrimary: string;
  /** Supporting colour: secondary buttons, tabs, chips. */
  secondary: string;
  onSecondary: string;
  /** The loud one. Used sparingly: highlights, badges, the mailbox flag. */
  accent: string;
  onAccent: string;
  /** Application background, behind the cards. */
  background: string;
  /** Raised surfaces: cards, drawers, sheets. */
  surface: string;
  /** The paper itself. */
  paper: string;
  /** Ink on the paper. */
  paperInk: string;
  /** Body text on `background` and `surface`. */
  text: string;
  /** Quieter text: captions, hints. */
  textSoft: string;
  /** Hairlines and dividers. */
  line: string;
  /** Sticker palette: five colours that work together. */
  stickers: [string, string, string, string, string];
  /** Envelope body and its lining. */
  envelope: string;
  envelopeLining: string;
  /** Focus ring. Always high contrast against both background and surface. */
  focus: string;
}

export interface Theme {
  id: string;
  name: string;
  /** One line shown in the theme picker. */
  mood: string;
  /** True for themes designed to be read in the dark. */
  dark: boolean;
  palette: ThemePalette;
  /**
   * Print-safe variation. Screens are lit; paper is not. These are the values
   * used when a decorative background is printed, so a Midnight Neon letter
   * does not empty a toner cartridge.
   */
  print: {
    paper: string;
    ink: string;
    accent: string;
    /** Ink-saving version of the paper: white, but keeps the accents. */
    paperInkSaving: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: 'sunshine-yellow',
    name: 'Sunshine Yellow',
    mood: 'Bright as a kitchen window in the morning',
    dark: false,
    palette: {
      primary: '#a15c00',
      onPrimary: '#ffffff',
      secondary: '#7a4b8a',
      onSecondary: '#ffffff',
      accent: '#c2410c',
      onAccent: '#ffffff',
      background: '#fff8e1',
      surface: '#fffdf5',
      paper: '#fffbeb',
      paperInk: '#3b2f14',
      text: '#3b2f14',
      textSoft: '#6b5a2e',
      line: '#e8d9a8',
      stickers: ['#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#16a34a'],
      envelope: '#fde68a',
      envelopeLining: '#fca5a5',
      focus: '#1d4ed8',
    },
    print: { paper: '#fffdf2', ink: '#2b2416', accent: '#b45309', paperInkSaving: '#ffffff' },
  },
  {
    id: 'bubblegum-pink',
    name: 'Bubblegum Pink',
    mood: 'Sticker albums and gel pens',
    dark: false,
    palette: {
      primary: '#be185d',
      onPrimary: '#ffffff',
      secondary: '#7c3aed',
      onSecondary: '#ffffff',
      accent: '#0e7490',
      onAccent: '#ffffff',
      background: '#fff1f6',
      surface: '#fffafc',
      paper: '#fff5f8',
      paperInk: '#4a1130',
      text: '#4a1130',
      textSoft: '#8a3a63',
      line: '#f6cddc',
      stickers: ['#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e'],
      envelope: '#fbcfe8',
      envelopeLining: '#a5f3fc',
      focus: '#1d4ed8',
    },
    print: { paper: '#fff8fa', ink: '#3d0f28', accent: '#be185d', paperInkSaving: '#ffffff' },
  },
  {
    id: 'sky-blue',
    name: 'Sky Blue',
    mood: 'Clouds, paper planes, open windows',
    dark: false,
    palette: {
      primary: '#0369a1',
      onPrimary: '#ffffff',
      secondary: '#4338ca',
      onSecondary: '#ffffff',
      accent: '#c2410c',
      onAccent: '#ffffff',
      background: '#eff8ff',
      surface: '#fbfdff',
      paper: '#f7fbff',
      paperInk: '#0f2a3d',
      text: '#0f2a3d',
      textSoft: '#3c5b70',
      line: '#c3e0f5',
      stickers: ['#0ea5e9', '#f59e0b', '#ec4899', '#22c55e', '#8b5cf6'],
      envelope: '#bae6fd',
      envelopeLining: '#fed7aa',
      focus: '#1d4ed8',
    },
    print: { paper: '#fbfdff', ink: '#0d2334', accent: '#0369a1', paperInkSaving: '#ffffff' },
  },
  {
    id: 'mint-green',
    name: 'Mint Green',
    mood: 'Fresh notebooks and new starts',
    dark: false,
    palette: {
      primary: '#047857',
      onPrimary: '#ffffff',
      secondary: '#0e7490',
      onSecondary: '#ffffff',
      accent: '#be185d',
      onAccent: '#ffffff',
      background: '#effaf4',
      surface: '#fafffc',
      paper: '#f5fdf8',
      paperInk: '#0d2f22',
      text: '#0d2f22',
      textSoft: '#3a5f4f',
      line: '#c2e8d5',
      stickers: ['#10b981', '#f59e0b', '#ec4899', '#6366f1', '#ef4444'],
      envelope: '#a7f3d0',
      envelopeLining: '#fbcfe8',
      focus: '#1d4ed8',
    },
    print: { paper: '#fafffc', ink: '#0b271d', accent: '#047857', paperInkSaving: '#ffffff' },
  },
  {
    id: 'lavender-dream',
    name: 'Lavender Dream',
    mood: 'Quiet evenings and long letters',
    dark: false,
    palette: {
      primary: '#6d28d9',
      onPrimary: '#ffffff',
      secondary: '#be185d',
      onSecondary: '#ffffff',
      accent: '#0e7490',
      onAccent: '#ffffff',
      background: '#f5f2ff',
      surface: '#fdfbff',
      paper: '#faf8ff',
      paperInk: '#2c1a4d',
      text: '#2c1a4d',
      textSoft: '#584080',
      line: '#ddd2f5',
      stickers: ['#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16'],
      envelope: '#ddd6fe',
      envelopeLining: '#fef3c7',
      focus: '#1d4ed8',
    },
    print: { paper: '#fdfbff', ink: '#241541', accent: '#6d28d9', paperInkSaving: '#ffffff' },
  },
  {
    id: 'orange-pop',
    name: 'Orange Pop',
    mood: 'Loud, warm and impossible to ignore',
    dark: false,
    palette: {
      primary: '#c2410c',
      onPrimary: '#ffffff',
      secondary: '#7c3aed',
      onSecondary: '#ffffff',
      accent: '#0f766e',
      onAccent: '#ffffff',
      background: '#fff5ed',
      surface: '#fffbf7',
      paper: '#fff8f1',
      paperInk: '#431a08',
      text: '#431a08',
      textSoft: '#7c4327',
      line: '#f8d3b8',
      stickers: ['#f97316', '#0ea5e9', '#a855f7', '#22c55e', '#e11d48'],
      envelope: '#fed7aa',
      envelopeLining: '#bae6fd',
      focus: '#1d4ed8',
    },
    print: { paper: '#fffaf5', ink: '#3a1607', accent: '#c2410c', paperInkSaving: '#ffffff' },
  },
  {
    id: 'cherry-red',
    name: 'Cherry Red',
    mood: 'Bold, certain, a little dramatic',
    dark: false,
    palette: {
      primary: '#b91c1c',
      onPrimary: '#ffffff',
      secondary: '#1d4ed8',
      onSecondary: '#ffffff',
      accent: '#a16207',
      onAccent: '#ffffff',
      background: '#fff2f2',
      surface: '#fffafa',
      paper: '#fff6f5',
      paperInk: '#450a0a',
      text: '#450a0a',
      textSoft: '#7f2d2d',
      line: '#f7cccc',
      stickers: ['#ef4444', '#f59e0b', '#3b82f6', '#16a34a', '#a855f7'],
      envelope: '#fecaca',
      envelopeLining: '#fde68a',
      focus: '#1d4ed8',
    },
    print: { paper: '#fffaf9', ink: '#3d0a0a', accent: '#b91c1c', paperInkSaving: '#ffffff' },
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    mood: 'Deep water, postcards from far away',
    dark: false,
    palette: {
      primary: '#1e40af',
      onPrimary: '#ffffff',
      secondary: '#0f766e',
      onSecondary: '#ffffff',
      accent: '#c2410c',
      onAccent: '#ffffff',
      background: '#eef2ff',
      surface: '#fafbff',
      paper: '#f6f8ff',
      paperInk: '#111c44',
      text: '#111c44',
      textSoft: '#3f4d80',
      line: '#c9d3f5',
      stickers: ['#2563eb', '#14b8a6', '#f97316', '#ec4899', '#eab308'],
      envelope: '#c7d2fe',
      envelopeLining: '#99f6e4',
      focus: '#1d4ed8',
    },
    print: { paper: '#fafbff', ink: '#0e1838', accent: '#1e40af', paperInkSaving: '#ffffff' },
  },
  {
    id: 'peach-glow',
    name: 'Peach Glow',
    mood: 'Soft light, late afternoon',
    dark: false,
    palette: {
      primary: '#b45309',
      onPrimary: '#ffffff',
      secondary: '#9d174d',
      onSecondary: '#ffffff',
      accent: '#4338ca',
      onAccent: '#ffffff',
      background: '#fff4ee',
      surface: '#fffaf7',
      paper: '#fff7f2',
      paperInk: '#43241a',
      text: '#43241a',
      textSoft: '#7a4a38',
      line: '#f6d5c4',
      stickers: ['#fb923c', '#f472b6', '#818cf8', '#34d399', '#facc15'],
      envelope: '#fed7c3',
      envelopeLining: '#ddd6fe',
      focus: '#1d4ed8',
    },
    print: { paper: '#fffaf7', ink: '#3a1f16', accent: '#b45309', paperInkSaving: '#ffffff' },
  },
  {
    id: 'lime-splash',
    name: 'Lime Splash',
    mood: 'Highlighter pens and good news',
    dark: false,
    palette: {
      primary: '#3f6212',
      onPrimary: '#ffffff',
      secondary: '#0e7490',
      onSecondary: '#ffffff',
      accent: '#c026d3',
      onAccent: '#ffffff',
      background: '#f4fbe8',
      surface: '#fbfff5',
      paper: '#f8fdef',
      paperInk: '#1f2b0c',
      text: '#1f2b0c',
      textSoft: '#4b5d24',
      line: '#d5ecb4',
      stickers: ['#84cc16', '#06b6d4', '#f43f5e', '#f59e0b', '#8b5cf6'],
      envelope: '#d9f99d',
      envelopeLining: '#f5d0fe',
      focus: '#1d4ed8',
    },
    print: { paper: '#fbfff5', ink: '#1a250a', accent: '#3f6212', paperInkSaving: '#ffffff' },
  },
  {
    id: 'rainbow-mix',
    name: 'Rainbow Mix',
    mood: 'Everything, all at once, on purpose',
    dark: false,
    palette: {
      primary: '#7c3aed',
      onPrimary: '#ffffff',
      secondary: '#0e7490',
      onSecondary: '#ffffff',
      accent: '#db2777',
      onAccent: '#ffffff',
      background: '#fdf6ff',
      surface: '#fffdff',
      paper: '#fffcfd',
      paperInk: '#2b1436',
      text: '#2b1436',
      textSoft: '#5c3a6b',
      line: '#ecd6f5',
      stickers: ['#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#a855f7'],
      envelope: '#f5d0fe',
      envelopeLining: '#bbf7d0',
      focus: '#1d4ed8',
    },
    print: { paper: '#fffdfe', ink: '#24102e', accent: '#7c3aed', paperInkSaving: '#ffffff' },
  },
  {
    id: 'midnight-neon',
    name: 'Midnight Neon',
    mood: 'Writing after everyone else is asleep',
    dark: true,
    palette: {
      primary: '#22d3ee',
      onPrimary: '#04141a',
      secondary: '#f472b6',
      onSecondary: '#2b0716',
      accent: '#facc15',
      onAccent: '#231c02',
      background: '#0b1020',
      surface: '#151b30',
      paper: '#171d33',
      paperInk: '#f0f4ff',
      text: '#f0f4ff',
      textSoft: '#b3bede',
      line: '#2c3454',
      stickers: ['#22d3ee', '#f472b6', '#facc15', '#a78bfa', '#4ade80'],
      envelope: '#242c4a',
      envelopeLining: '#3b2a55',
      focus: '#93c5fd',
    },
    // Printing a dark theme as-is is a toner disaster, so print flips to paper.
    print: { paper: '#ffffff', ink: '#12172b', accent: '#0e7490', paperInkSaving: '#ffffff' },
  },
];

export const DEFAULT_THEME_ID = 'bubblegum-pink';

export function getTheme(id: string): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[1]!;
}

/* -------------------------------------------------------------------------- */
/* Contrast                                                                   */
/* -------------------------------------------------------------------------- */

export function parseHex(hex: string): [number, number, number] {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function channel(value: number): number {
  const sRGB = value / 255;
  return sRGB <= 0.04045 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.2 contrast ratio, 1–21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsAA(foreground: string, background: string, large = false): boolean {
  return contrastRatio(foreground, background) >= (large ? 3 : 4.5);
}

/** Pairs that must pass AA in every theme. Used by the interface and the tests. */
export function contrastPairs(theme: Theme): Array<{ label: string; fg: string; bg: string }> {
  const p = theme.palette;
  return [
    { label: 'body text on background', fg: p.text, bg: p.background },
    { label: 'body text on surface', fg: p.text, bg: p.surface },
    { label: 'quiet text on background', fg: p.textSoft, bg: p.background },
    { label: 'quiet text on surface', fg: p.textSoft, bg: p.surface },
    { label: 'ink on paper', fg: p.paperInk, bg: p.paper },
    { label: 'label on primary button', fg: p.onPrimary, bg: p.primary },
    { label: 'label on secondary button', fg: p.onSecondary, bg: p.secondary },
    { label: 'label on accent', fg: p.onAccent, bg: p.accent },
    { label: 'printed ink on printed paper', fg: theme.print.ink, bg: theme.print.paper },
  ];
}

/* -------------------------------------------------------------------------- */
/* Applying a theme                                                            */
/* -------------------------------------------------------------------------- */

const VARIABLES: Array<[string, keyof ThemePalette]> = [
  ['--primary', 'primary'],
  ['--on-primary', 'onPrimary'],
  ['--secondary', 'secondary'],
  ['--on-secondary', 'onSecondary'],
  ['--accent', 'accent'],
  ['--on-accent', 'onAccent'],
  ['--background', 'background'],
  ['--surface', 'surface'],
  ['--paper', 'paper'],
  ['--paper-ink', 'paperInk'],
  ['--text', 'text'],
  ['--text-soft', 'textSoft'],
  ['--line', 'line'],
  ['--envelope', 'envelope'],
  ['--envelope-lining', 'envelopeLining'],
  ['--focus', 'focus'],
];

/**
 * Writes the theme onto the document root as custom properties. Custom
 * properties in a style attribute are values, not code, so this stays inside a
 * Content-Security-Policy that forbids inline `<style>` elements.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [variable, key] of VARIABLES) {
    const value = theme.palette[key];
    if (typeof value === 'string') root.style.setProperty(variable, value);
  }
  theme.palette.stickers.forEach((colour, index) => {
    root.style.setProperty(`--sticker-${index + 1}`, colour);
  });
  root.style.setProperty('--print-paper', theme.print.paper);
  root.style.setProperty('--print-ink', theme.print.ink);
  root.style.setProperty('--print-accent', theme.print.accent);
  root.dataset.themeId = theme.id;
  root.dataset.themeMode = theme.dark ? 'dark' : 'light';
  root.style.setProperty('color-scheme', theme.dark ? 'dark' : 'light');

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme.palette.background;
}
