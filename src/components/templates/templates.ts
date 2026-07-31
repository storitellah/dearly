/**
 * The template catalogue.
 *
 * A template is data, not a picture: paper design, palette, typography, margins,
 * border, suggested stickers, envelope and a starting document. That is what
 * lets a template be applied *without* touching what someone has already
 * written, and what lets every template reflow across pages and paper sizes.
 *
 * Forty-eight templates at launch, in the categories people actually write for.
 */

import type { BorderId, PaperPatternId } from './papers';
import type { Align } from '../document/model';

export type TemplateCategory =
  | 'fun'
  | 'romantic'
  | 'friendship'
  | 'celebration'
  | 'nostalgic'
  | 'creative'
  | 'quiet';

export interface TemplateTypography {
  headingFont: string;
  bodyFont: string;
  sizePt: number;
  lineHeight: number;
  align: Align;
}

export interface LetterTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  /** One line for the gallery card. */
  occasion: string;
  /** Theme id supplying the palette. */
  themeId: string;
  paper: PaperPatternId;
  border: BorderId;
  /** Pattern spacing in millimetres. */
  patternStepMm: number;
  patternOpacity?: number;
  typography: TemplateTypography;
  margins: { top: number; right: number; bottom: number; left: number };
  /** Default paper size for this template. */
  paperSize: 'a4' | 'letter' | 'a5' | 'a6' | 'square' | 'postcard';
  /** Sticker categories this template suggests. */
  stickerPacks: string[];
  envelope: { size: 'dl' | 'c5' | 'c6' | 'us-10'; seal: 'none' | 'wax' | 'sticker' | 'ribbon' };
  /** Photograph treatment this template is designed around. */
  photoStyle: 'polaroid' | 'scrapbook' | 'plain' | 'circle' | 'torn' | 'postcard';
  /** True when the design leans decorative rather than minimal. */
  decorative: boolean;
  /** True for the retro-referencing designs. */
  retro: boolean;
  /** Prefilled opening and closing, which the writer can change or delete. */
  starter: { greeting?: string; closing?: string; body?: string };
}

const serif = { headingFont: 'literata', bodyFont: 'literata', sizePt: 11.5, lineHeight: 1.65, align: 'left' as Align };
const marker = { headingFont: 'marker', bodyFont: 'plain', sizePt: 11.5, lineHeight: 1.7, align: 'left' as Align };
const hand = { headingFont: 'hand', bodyFont: 'hand', sizePt: 12.5, lineHeight: 1.75, align: 'left' as Align };
const typewriter = { headingFont: 'typewriter', bodyFont: 'typewriter', sizePt: 11, lineHeight: 1.7, align: 'left' as Align };
const modern = { headingFont: 'plain', bodyFont: 'plain', sizePt: 11, lineHeight: 1.7, align: 'left' as Align };

const wide = { top: 24, right: 22, bottom: 24, left: 22 };
const roomy = { top: 28, right: 26, bottom: 28, left: 26 };
const tight = { top: 18, right: 16, bottom: 18, left: 16 };
const notebookMargins = { top: 22, right: 18, bottom: 22, left: 30 };

type Row = [
  id: string,
  name: string,
  category: TemplateCategory,
  occasion: string,
  themeId: string,
  paper: PaperPatternId,
  border: BorderId,
  typography: TemplateTypography,
  margins: { top: number; right: number; bottom: number; left: number },
  stickerPacks: string[],
  extras?: Partial<LetterTemplate>,
];

const ROWS: Row[] = [
  /* ----------------------------- Fun and colourful ---------------------- */
  ['confetti-party', 'Confetti Party', 'fun', 'Any excuse at all', 'rainbow-mix', 'confetti', 'rounded', marker, wide, ['celebration', 'birthday'], { starter: { greeting: 'Dear', closing: 'Love always,' } }],
  ['rainbow-notes', 'Rainbow Notes', 'fun', 'Cheerful catch-ups', 'sky-blue', 'stripes', 'hairline', modern, wide, ['weather', 'stars']],
  ['bubblegum-dreams', 'Bubblegum Dreams', 'fun', 'Silly, sweet and pink', 'bubblegum-pink', 'dots', 'scallop', marker, wide, ['hearts', 'food']],
  ['sunshine-letter', 'Sunshine Letter', 'fun', 'Good news', 'sunshine-yellow', 'sunburst', 'rounded', modern, wide, ['seasonal', 'motivation']],
  ['happy-doodles', 'Happy Doodles', 'fun', 'A letter with drawings', 'mint-green', 'plain', 'dashed', hand, wide, ['doodles', 'stars']],
  ['sticker-explosion', 'Sticker Explosion', 'fun', 'Maximum decoration', 'orange-pop', 'confetti', 'tape-corners', marker, tight, ['celebration', 'doodles'], { decorative: true }],
  ['colour-block', 'Colour Block', 'fun', 'Bold and graphic', 'ocean-blue', 'diagonal', 'rounded', modern, wide, ['stars', 'motivation']],
  ['candy-pop', 'Candy Pop', 'fun', 'Bright and sugary', 'cherry-red', 'checks', 'scallop', marker, wide, ['food', 'hearts']],
  ['smiley-mail', 'Smiley Mail', 'fun', 'Make someone laugh', 'sunshine-yellow', 'dots', 'rounded', marker, wide, ['friendship', 'doodles']],
  ['joyful-shapes', 'Joyful Shapes', 'fun', 'Playful and modern', 'lime-splash', 'diagonal', 'hairline', modern, wide, ['celebration', 'stars']],

  /* --------------------------------- Romantic --------------------------- */
  ['love-notes', 'Love Notes', 'romantic', 'For someone you love', 'bubblegum-pink', 'hearts', 'hairline', serif, roomy, ['love', 'flowers'], { envelope: { size: 'c6', seal: 'wax' }, starter: { greeting: 'My dearest', closing: 'All my love,' } }],
  ['soft-roses', 'Soft Roses', 'romantic', 'Tender and quiet', 'peach-glow', 'clouds', 'deckled', serif, roomy, ['flowers', 'love']],
  ['heart-confetti', 'Heart Confetti', 'romantic', 'Giddy and new', 'bubblegum-pink', 'confetti', 'rounded', marker, wide, ['hearts', 'celebration']],
  ['midnight-love', 'Midnight Love', 'romantic', 'Written late at night', 'midnight-neon', 'stars', 'hairline', serif, roomy, ['stars', 'love'], { envelope: { size: 'c6', seal: 'wax' } }],
  ['pink-envelope', 'Pink Envelope', 'romantic', 'Simple and sincere', 'bubblegum-pink', 'plain', 'double', serif, roomy, ['love', 'paper']],
  ['vintage-romance', 'Vintage Romance', 'romantic', 'Old-fashioned devotion', 'peach-glow', 'plain', 'deckled', serif, roomy, ['flowers', 'paper'], { retro: true }],
  ['our-story', 'Our Story', 'romantic', 'Anniversaries', 'cherry-red', 'plain', 'double', serif, roomy, ['love', 'photography'], { photoStyle: 'polaroid' }],
  ['love-across-distance', 'Love Across Distance', 'romantic', 'Far apart, still here', 'ocean-blue', 'clouds', 'airmail', serif, roomy, ['missing-you', 'travel'], { envelope: { size: 'dl', seal: 'sticker' } }],

  /* -------------------------------- Friendship -------------------------- */
  ['best-friend-forever', 'Best Friend Forever', 'friendship', 'The oldest friendship', 'lavender-dream', 'stars', 'rounded', marker, wide, ['friendship', 'hearts']],
  ['inside-jokes', 'Inside Jokes', 'friendship', 'Only you two will get it', 'lime-splash', 'plain', 'dashed', hand, wide, ['doodles', 'friendship']],
  ['memory-lane', 'Memory Lane', 'friendship', 'Remembering together', 'peach-glow', 'plain', 'tape-corners', serif, wide, ['photography', 'friendship'], { photoStyle: 'scrapbook' }],
  ['you-make-life-better', 'You Make Life Better', 'friendship', 'Just because', 'mint-green', 'dots', 'rounded', modern, wide, ['friendship', 'motivation']],
  ['friendship-postcard', 'Friendship Postcard', 'friendship', 'Short and warm', 'sky-blue', 'plain', 'hairline', modern, tight, ['travel', 'friendship'], { paperSize: 'postcard', photoStyle: 'postcard' }],
  ['colourful-catch-up', 'Colourful Catch-Up', 'friendship', 'Everything that happened', 'rainbow-mix', 'stripes', 'rounded', modern, wide, ['friendship', 'food']],

  /* ------------------------- Birthday and celebration ------------------- */
  ['birthday-blast', 'Birthday Blast', 'celebration', 'Birthdays', 'orange-pop', 'confetti', 'rounded', marker, wide, ['birthday', 'celebration'], { starter: { greeting: 'Happy birthday,', closing: 'With love and cake,' } }],
  ['cake-and-confetti', 'Cake and Confetti', 'celebration', 'Parties', 'bubblegum-pink', 'confetti', 'scallop', marker, wide, ['birthday', 'food']],
  ['congratulations', 'Congratulations', 'celebration', 'Achievements', 'sunshine-yellow', 'sunburst', 'double', serif, wide, ['congratulations', 'celebration']],
  ['new-chapter', 'New Chapter', 'celebration', 'New job, new home, new start', 'mint-green', 'plain', 'hairline', modern, roomy, ['motivation', 'travel']],
  ['big-news', 'Big News', 'celebration', 'Announcements', 'cherry-red', 'diagonal', 'rounded', modern, wide, ['celebration', 'stars']],
  ['celebration-letter', 'Celebration Letter', 'celebration', 'Weddings and milestones', 'lavender-dream', 'plain', 'double', serif, roomy, ['congratulations', 'flowers'], { envelope: { size: 'c5', seal: 'wax' } }],

  /* -------------------------------- Nostalgic --------------------------- */
  ['nineties-notebook', '1990s School Notebook', 'nostalgic', 'Passed under the desk', 'sky-blue', 'notebook', 'none', hand, notebookMargins, ['nineties', 'school'], { retro: true }],
  ['internet-cafe', 'Internet Café', 'nostalgic', 'Dial-up era', 'ocean-blue', 'grid', 'hairline', typewriter, wide, ['retro-web', 'noughties'], { retro: true }],
  ['early-2000s-desktop', 'Early 2000s Desktop', 'nostalgic', 'Messenger nostalgia', 'sky-blue', 'checks', 'rounded', modern, wide, ['noughties', 'retro-web'], { retro: true }],
  ['minimal-blog', '2010s Minimal Blog', 'nostalgic', 'Clean and quiet', 'mint-green', 'plain', 'none', modern, roomy, ['twenty-tens', 'photography'], { retro: true }],
  ['pen-pal-club', 'Pen Pal Club', 'nostalgic', 'Writing to a stranger', 'lime-splash', 'dots', 'dashed', hand, wide, ['travel', 'friendship'], { retro: true }],
  ['air-mail', 'Air Mail', 'nostalgic', 'Overseas post', 'ocean-blue', 'plain', 'airmail', typewriter, wide, ['travel', 'paper'], { retro: true, envelope: { size: 'dl', seal: 'sticker' } }],
  ['typewriter-page', 'Typewriter Page', 'nostalgic', 'Plain and deliberate', 'peach-glow', 'plain', 'none', typewriter, roomy, ['paper', 'books'], { retro: true }],
  ['diary-entry', 'Diary Entry', 'nostalgic', 'Writing to yourself', 'lavender-dream', 'lined', 'none', hand, notebookMargins, ['future-self', 'doodles'], { retro: true }],
  ['photo-album-letter', 'Photo Album Letter', 'nostalgic', 'Pictures with words', 'peach-glow', 'plain', 'tape-corners', serif, wide, ['photography', 'family'], { photoStyle: 'polaroid', retro: true }],

  /* ---------------------------- Creative and artistic ------------------- */
  ['collage-letter', 'Collage Letter', 'creative', 'Cut, stick, send', 'rainbow-mix', 'plain', 'tape-corners', marker, tight, ['doodles', 'paper'], { photoStyle: 'torn', decorative: true }],
  ['scrapbook-page', 'Scrapbook Page', 'creative', 'Keepsakes on paper', 'sunshine-yellow', 'plain', 'deckled', hand, tight, ['photography', 'paper'], { photoStyle: 'scrapbook', decorative: true }],
  ['photo-story', 'Photo Story', 'creative', 'Told in pictures', 'ocean-blue', 'plain', 'hairline', modern, wide, ['photography', 'travel'], { photoStyle: 'polaroid' }],
  ['magazine-style', 'Magazine Style', 'creative', 'Bold headings', 'cherry-red', 'plain', 'none', modern, wide, ['music', 'photography']],
  ['zine-letter', 'Zine Letter', 'creative', 'Photocopied energy', 'lime-splash', 'graph-tint', 'dashed', typewriter, tight, ['doodles', 'music'], { decorative: true }],
  ['cut-and-paste', 'Cut and Paste', 'creative', 'Ransom-note charm', 'orange-pop', 'plain', 'tape-corners', marker, tight, ['paper', 'doodles'], { decorative: true }],
  ['painted-paper', 'Painted Paper', 'creative', 'Soft washes of colour', 'peach-glow', 'clouds', 'deckled', serif, roomy, ['flowers', 'nature']],
  ['marker-doodles', 'Marker Doodles', 'creative', 'Drawn in the margins', 'mint-green', 'dots', 'dashed', marker, notebookMargins, ['doodles', 'school'], { decorative: true }],

  /* --------------------------- Personal and quiet ----------------------- */
  ['future-self', 'Future Self', 'quiet', 'To open years from now', 'lavender-dream', 'stars', 'hairline', serif, roomy, ['future-self', 'stars'], { starter: { greeting: 'Dear me,', closing: 'From then,' } }],
  ['thank-you', 'Thank You', 'quiet', 'Gratitude', 'mint-green', 'plain', 'double', serif, roomy, ['thank-you', 'flowers'], { paperSize: 'a5' }],
  ['i-miss-you', 'I Miss You', 'quiet', 'Distance', 'ocean-blue', 'clouds', 'hairline', serif, roomy, ['missing-you', 'weather']],
  ['an-apology', 'An Apology', 'quiet', 'Saying it properly', 'sky-blue', 'plain', 'hairline', serif, roomy, ['apology'], { paperSize: 'a5' }],
  ['unsent-letter', 'Unsent Letter', 'quiet', 'For you, not for them', 'midnight-neon', 'plain', 'none', serif, roomy, ['future-self', 'missing-you']],
  ['remember-this-day', 'Remember This Day', 'quiet', 'Marking a moment', 'sunshine-yellow', 'plain', 'deckled', serif, roomy, ['photography', 'family'], { photoStyle: 'polaroid' }],
  ['letter-to-someone-i-lost', 'A Letter to Someone I Lost', 'quiet', 'Grief, in your own time', 'lavender-dream', 'plain', 'none', serif, roomy, ['missing-you', 'flowers']],
];

export const TEMPLATES: LetterTemplate[] = ROWS.map(
  ([id, name, category, occasion, themeId, paper, border, typography, margins, stickerPacks, extras]) => ({
    id,
    name,
    category,
    occasion,
    themeId,
    paper,
    border,
    patternStepMm: 6,
    typography,
    margins,
    paperSize: 'a4',
    stickerPacks,
    envelope: { size: 'dl', seal: 'none' },
    photoStyle: 'plain',
    decorative: false,
    retro: false,
    starter: {},
    ...extras,
  }),
);

export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory; name: string; blurb: string }> = [
  { id: 'fun', name: 'Fun and colourful', blurb: 'Loud, bright and cheerful' },
  { id: 'romantic', name: 'Romantic', blurb: 'For the people you love' },
  { id: 'friendship', name: 'Friendship', blurb: 'The ones who stayed' },
  { id: 'celebration', name: 'Birthday and celebration', blurb: 'Good news, said properly' },
  { id: 'nostalgic', name: 'Nostalgic', blurb: 'Notebooks, dial-up and air mail' },
  { id: 'creative', name: 'Creative and artistic', blurb: 'Cut, paste, decorate' },
  { id: 'quiet', name: 'Personal and quiet', blurb: 'The letters that take longer' },
];

export function getTemplate(id: string): LetterTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function templatesInCategory(category: TemplateCategory): LetterTemplate[] {
  return TEMPLATES.filter((template) => template.category === category);
}

export interface TemplateFilters {
  category?: TemplateCategory | 'all';
  themeId?: string | 'all';
  paperSize?: string | 'all';
  photos?: boolean;
  decorative?: 'all' | 'decorative' | 'minimal';
  era?: 'all' | 'retro' | 'modern';
  search?: string;
}

export function filterTemplates(filters: TemplateFilters): LetterTemplate[] {
  const search = (filters.search ?? '').trim().toLowerCase();
  return TEMPLATES.filter((template) => {
    if (filters.category && filters.category !== 'all' && template.category !== filters.category) return false;
    if (filters.themeId && filters.themeId !== 'all' && template.themeId !== filters.themeId) return false;
    if (filters.paperSize && filters.paperSize !== 'all' && template.paperSize !== filters.paperSize) return false;
    if (filters.photos && template.photoStyle === 'plain') return false;
    if (filters.decorative === 'decorative' && !template.decorative) return false;
    if (filters.decorative === 'minimal' && template.decorative) return false;
    if (filters.era === 'retro' && !template.retro) return false;
    if (filters.era === 'modern' && template.retro) return false;
    if (search.length > 0) {
      const haystack = `${template.name} ${template.occasion} ${template.category}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function randomTemplate(random: () => number = Math.random): LetterTemplate {
  return TEMPLATES[Math.floor(random() * TEMPLATES.length)] ?? TEMPLATES[0]!;
}
