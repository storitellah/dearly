/**
 * The sticker library.
 *
 * Every sticker is a shape plus a colourway plus keywords. They are grouped into
 * the categories a person actually reaches for when writing a letter, and all of
 * them are searchable, favouritable and printable at full quality.
 */

import { SHAPES } from './shapes';

export interface Sticker {
  id: string;
  name: string;
  category: string;
  shape: string;
  colours: string[];
  keywords: string[];
  /** Suggested placed size, in millimetres. */
  sizeMm: number;
}

export interface StickerCategory {
  id: string;
  name: string;
  /** Emoji-free label icon: the id of a shape used as the tab's own mark. */
  shape: string;
}

export const STICKER_CATEGORIES: StickerCategory[] = [
  { id: 'love', name: 'Love', shape: 'heart' },
  { id: 'friendship', name: 'Friendship', shape: 'chat' },
  { id: 'birthday', name: 'Birthday', shape: 'cake' },
  { id: 'celebration', name: 'Celebration', shape: 'balloon' },
  { id: 'travel', name: 'Travel', shape: 'plane' },
  { id: 'nature', name: 'Nature', shape: 'leaf' },
  { id: 'flowers', name: 'Flowers', shape: 'flower' },
  { id: 'stars', name: 'Stars', shape: 'star' },
  { id: 'hearts', name: 'Hearts', shape: 'heart' },
  { id: 'weather', name: 'Weather', shape: 'cloud' },
  { id: 'food', name: 'Food', shape: 'donut' },
  { id: 'music', name: 'Music', shape: 'music' },
  { id: 'photography', name: 'Photography', shape: 'camera' },
  { id: 'books', name: 'Books', shape: 'book' },
  { id: 'school', name: 'School', shape: 'pencil' },
  { id: 'family', name: 'Family', shape: 'house' },
  { id: 'pets', name: 'Pets', shape: 'paw' },
  { id: 'motivation', name: 'Motivation', shape: 'bulb' },
  { id: 'thank-you', name: 'Thank you', shape: 'ribbon' },
  { id: 'missing-you', name: 'Missing you', shape: 'moon' },
  { id: 'apology', name: 'Apology', shape: 'cloud' },
  { id: 'congratulations', name: 'Congratulations', shape: 'medal' },
  { id: 'future-self', name: 'Future self', shape: 'clock' },
  { id: 'seasonal', name: 'Seasonal', shape: 'sun' },
  { id: 'kenyan', name: 'Kenyan patterns', shape: 'beads' },
  { id: 'african', name: 'African patterns', shape: 'kente' },
  { id: 'doodles', name: 'Doodles', shape: 'arrow' },
  { id: 'retro-web', name: 'Retro internet', shape: 'monitor' },
  { id: 'nineties', name: '1990s stationery', shape: 'cassette' },
  { id: 'noughties', name: 'Early 2000s', shape: 'floppy' },
  { id: 'twenty-tens', name: '2010s nostalgia', shape: 'phone' },
  { id: 'paper', name: 'Paper and tape', shape: 'tape' },
];

/* A compact way to declare a lot of stickers without repeating the shape data. */
type Definition = [name: string, shape: string, colours: string[], keywords: string, sizeMm?: number];

const BY_CATEGORY: Record<string, Definition[]> = {
  love: [
    ['Red heart', 'heart', ['#ef4444', '#7f1d1d'], 'love heart red romance', 22],
    ['Pink heart', 'heart', ['#f472b6', '#9d174d'], 'love heart pink soft', 20],
    ['Outline heart', 'heart-outline', ['#be185d'], 'love heart outline simple', 20],
    ['Heart stamp', 'stamp', ['#fecdd3', '#fff1f2', '#e11d48'], 'love stamp postage romance', 26],
    ['Love letter', 'envelope', ['#fda4af', '#9f1239', '#881337'], 'love letter envelope mail', 26],
    ['Two hearts', 'pixel-heart', ['#f43f5e'], 'love pixel heart retro', 18],
  ],
  friendship: [
    ['Chat bubble', 'chat', ['#38bdf8', '#0c4a6e'], 'friendship talk chat message', 24],
    ['Say hello', 'speech', ['#fcd34d', '#92400e'], 'friendship hello speech bubble', 24],
    ['Best friends medal', 'medal', ['#fbbf24', '#b45309', '#fff7ed'], 'friendship medal best award', 24],
    ['Paw high five', 'paw', ['#a78bfa', '#4c1d95'], 'friendship paw pet fun', 20],
    ['Kite day', 'kite', ['#34d399', '#065f46', '#f59e0b'], 'friendship kite play memory', 26],
  ],
  birthday: [
    ['Birthday cake', 'cake', ['#fda4af', '#fde68a', '#ef4444'], 'birthday cake candles party', 28],
    ['Party balloon', 'balloon', ['#f97316', '#7c2d12'], 'birthday balloon party', 22],
    ['Wrapped gift', 'gift', ['#a78bfa', '#c026d3', '#fef08a'], 'birthday gift present', 24],
    ['Birthday crown', 'crown', ['#facc15', '#a16207'], 'birthday crown king queen', 24],
    ['Confetti star', 'sparkle', ['#f472b6', '#fcd34d'], 'birthday confetti sparkle', 18],
  ],
  celebration: [
    ['Gold star', 'star', ['#fbbf24', '#92400e'], 'celebration star gold well done', 22],
    ['Sparkles', 'sparkle', ['#a855f7', '#f0abfc'], 'celebration sparkle magic', 18],
    ['Winner medal', 'medal', ['#fde047', '#a16207', '#fffbeb'], 'celebration medal winner', 24],
    ['Flag up', 'flag', ['#334155', '#22c55e'], 'celebration flag milestone', 24],
    ['Rainbow', 'rainbow', ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'], 'celebration rainbow joy', 30],
  ],
  travel: [
    ['Paper plane', 'plane', ['#38bdf8', '#0369a1'], 'travel plane journey air mail', 26],
    ['Little globe', 'globe', ['#22c55e', '#065f46'], 'travel globe world far', 24],
    ['Mountains', 'mountain', ['#64748b', '#f8fafc'], 'travel mountain hike view', 26],
    ['Sea wave', 'wave', ['#0ea5e9'], 'travel sea wave ocean holiday', 24],
    ['Sun hat', 'sun-hat', ['#fcd34d', '#b45309'], 'travel hat summer holiday', 24],
    ['Air mail stamp', 'stamp', ['#dbeafe', '#ffffff', '#1d4ed8'], 'travel stamp air mail post', 26],
  ],
  nature: [
    ['Green leaf', 'leaf', ['#22c55e', '#14532d'], 'nature leaf plant green', 20],
    ['Little plant', 'plant', ['#f97316', '#16a34a', '#7c2d12'], 'nature plant pot grow', 24],
    ['Sunshine', 'sun', ['#fbbf24', '#f59e0b'], 'nature sun warm day', 24],
    ['Mountain view', 'mountain', ['#0f766e', '#ecfeff'], 'nature mountain outdoors', 26],
  ],
  flowers: [
    ['Pink bloom', 'flower', ['#f472b6', '#fde047'], 'flower bloom pink spring', 22],
    ['Blue bloom', 'flower', ['#60a5fa', '#fef3c7'], 'flower bloom blue calm', 22],
    ['Sunny bloom', 'flower', ['#fbbf24', '#b45309'], 'flower bloom yellow sunny', 22],
    ['Lilac bloom', 'flower', ['#c084fc', '#fdf4ff'], 'flower bloom purple lilac', 22],
  ],
  stars: [
    ['Bright star', 'star', ['#facc15', '#a16207'], 'star bright gold', 20],
    ['Night star', 'star', ['#c7d2fe', '#3730a3'], 'star night sky', 18],
    ['Star outline', 'star-outline', ['#8b5cf6'], 'star outline simple', 20],
    ['Sparkle burst', 'sparkle', ['#fef08a', '#f59e0b'], 'star sparkle shine', 18],
  ],
  hearts: [
    ['Big heart', 'heart', ['#e11d48', '#4c0519'], 'heart big love', 26],
    ['Mint heart', 'heart', ['#5eead4', '#0f766e'], 'heart mint fresh', 20],
    ['Lavender heart', 'heart', ['#c4b5fd', '#5b21b6'], 'heart lavender soft', 20],
    ['Pixel heart', 'pixel-heart', ['#f43f5e'], 'heart pixel retro game', 18],
  ],
  weather: [
    ['Fluffy cloud', 'cloud', ['#e0f2fe', '#0284c7'], 'weather cloud sky soft', 24],
    ['Rainbow sky', 'rainbow', ['#f87171', '#fbbf24', '#4ade80', '#60a5fa'], 'weather rainbow after rain', 30],
    ['Warm sun', 'sun', ['#fdba74', '#ea580c'], 'weather sun warm', 24],
    ['Crescent moon', 'moon', ['#fde68a', '#fffbeb'], 'weather moon night late', 22],
  ],
  food: [
    ['Pink donut', 'donut', ['#f9a8d4', '#be185d'], 'food donut sweet treat', 22],
    ['Ice cream', 'ice-cream', ['#fcd34d', '#fda4af'], 'food ice cream summer', 24],
    ['Hot cup', 'cup', ['#fca5a5', '#7f1d1d', '#fecaca'], 'food tea coffee cup warm', 24],
    ['Birthday slice', 'cake', ['#fecdd3', '#fef3c7', '#f43f5e'], 'food cake slice sweet', 24],
  ],
  music: [
    ['Music note', 'music', ['#8b5cf6'], 'music note song melody', 22],
    ['Mixtape', 'cassette', ['#1f2937', '#f97316', '#e5e7eb'], 'music cassette mixtape retro', 26],
  ],
  photography: [
    ['Camera', 'camera', ['#334155', '#94a3b8', '#f8fafc'], 'photography camera photo memory', 26],
    ['Photo stamp', 'stamp', ['#e0e7ff', '#ffffff', '#4338ca'], 'photography stamp postage', 26],
  ],
  books: [
    ['Favourite book', 'book', ['#0e7490', '#164e63', '#ecfeff'], 'books reading story novel', 24],
    ['Bright idea', 'bulb', ['#fde047', '#a16207', '#fffbeb'], 'books idea thought learn', 22],
  ],
  school: [
    ['Yellow pencil', 'pencil', ['#facc15', '#f472b6', '#78350f'], 'school pencil write note', 24],
    ['Tick box', 'tick', ['#64748b', '#22c55e'], 'school tick done list', 20],
    ['Notebook doodle', 'zigzag', ['#3b82f6'], 'school doodle scribble margin', 22],
  ],
  family: [
    ['Home', 'house', ['#fca5a5', '#7f1d1d', '#fef3c7'], 'family home house together', 26],
    ['Family cat', 'cat', ['#fbbf24', '#78350f', '#7c2d12'], 'family cat pet', 24],
    ['Warm cup', 'cup', ['#fdba74', '#7c2d12', '#fed7aa'], 'family tea kitchen home', 24],
  ],
  pets: [
    ['Paw print', 'paw', ['#78350f', '#fbbf24'], 'pets paw dog cat', 20],
    ['Cat face', 'cat', ['#e5e7eb', '#111827', '#374151'], 'pets cat kitten', 24],
  ],
  motivation: [
    ['Keep going', 'arrow', ['#16a34a'], 'motivation arrow forward keep going', 26],
    ['Bright idea', 'bulb', ['#fbbf24', '#b45309', '#fffbeb'], 'motivation idea light', 22],
    ['Gold star', 'star', ['#f59e0b', '#78350f'], 'motivation star well done', 20],
  ],
  'thank-you': [
    ['Thank you bow', 'ribbon', ['#f472b6', '#fdf2f8'], 'thank you bow ribbon gift', 24],
    ['Grateful heart', 'heart', ['#fb923c', '#7c2d12'], 'thank you heart grateful', 22],
    ['Little gift', 'gift', ['#34d399', '#065f46', '#fef08a'], 'thank you gift present', 24],
  ],
  'missing-you': [
    ['Night moon', 'moon', ['#e0e7ff', '#c7d2fe'], 'missing you moon night far', 22],
    ['Far away plane', 'plane', ['#94a3b8', '#334155'], 'missing you plane distance', 24],
    ['Waiting clock', 'clock', ['#cbd5e1', '#334155'], 'missing you clock time waiting', 22],
  ],
  apology: [
    ['Small cloud', 'cloud', ['#cbd5e1', '#475569'], 'apology cloud sorry quiet', 22],
    ['Soft heart', 'heart-outline', ['#94a3b8'], 'apology heart sorry gentle', 20],
    ['Peace flower', 'flower', ['#e2e8f0', '#94a3b8'], 'apology flower peace', 20],
  ],
  congratulations: [
    ['Winner crown', 'crown', ['#fbbf24', '#92400e'], 'congratulations crown winner', 24],
    ['Big medal', 'medal', ['#f59e0b', '#78350f', '#fffbeb'], 'congratulations medal award', 26],
    ['Confetti burst', 'sparkle', ['#22d3ee', '#a855f7'], 'congratulations confetti party', 20],
    ['Celebration flag', 'flag', ['#1e293b', '#ef4444'], 'congratulations flag milestone', 24],
  ],
  'future-self': [
    ['Time capsule', 'clock', ['#a5b4fc', '#312e81'], 'future self clock time capsule', 24],
    ['Open later', 'envelope', ['#ddd6fe', '#4c1d95', '#312e81'], 'future self envelope later', 26],
    ['Small diamond', 'diamond', ['#67e8f9', '#0e7490'], 'future self diamond keep', 20],
  ],
  seasonal: [
    ['Summer sun', 'sun', ['#fbbf24', '#ea580c'], 'seasonal summer sun', 24],
    ['Autumn leaf', 'leaf', ['#ea580c', '#7c2d12'], 'seasonal autumn leaf fall', 20],
    ['Winter star', 'star', ['#bae6fd', '#0369a1'], 'seasonal winter star snow', 20],
    ['Spring bloom', 'flower', ['#fbcfe8', '#84cc16'], 'seasonal spring flower', 22],
  ],
  kenyan: [
    ['Beaded band', 'beads', ['#dc2626', '#111827'], 'kenyan beads maasai pattern', 30],
    ['Beaded band, bright', 'beads', ['#f59e0b', '#0f766e'], 'kenyan beads colourful pattern', 30],
    ['Zigzag band', 'zigzag', ['#b91c1c'], 'kenyan zigzag pattern border', 30],
    ['Sunset stripes', 'stripes', ['#ea580c'], 'kenyan stripes sunset pattern', 30],
  ],
  african: [
    ['Kente band', 'kente', ['#facc15', '#16a34a', '#111827'], 'african kente pattern woven', 32],
    ['Adinkra spiral', 'adinkra', ['#111827'], 'african adinkra symbol spiral', 26],
    ['Diamond weave', 'diamond-grid', ['#f59e0b', '#7c2d12'], 'african diamond pattern weave', 28],
    ['Earth stripes', 'stripes', ['#92400e'], 'african stripes earth pattern', 30],
  ],
  doodles: [
    ['Curved arrow', 'arrow', ['#111827'], 'doodle arrow point hand drawn', 26],
    ['Scribble', 'zigzag', ['#111827'], 'doodle scribble line hand drawn', 24],
    ['Doodle heart', 'heart-outline', ['#111827'], 'doodle heart hand drawn', 20],
    ['Doodle star', 'star-outline', ['#111827'], 'doodle star hand drawn', 20],
    ['Speech doodle', 'speech', ['#ffffff', '#111827'], 'doodle speech bubble hand drawn', 24],
  ],
  'retro-web': [
    ['Old monitor', 'monitor', ['#d1d5db', '#1e3a8a', '#9ca3af'], 'retro internet computer 90s web', 26],
    ['Under construction', 'tick', ['#f59e0b', '#111827'], 'retro internet construction 90s', 22],
    ['Guestbook heart', 'pixel-heart', ['#ec4899'], 'retro internet pixel heart guestbook', 18],
  ],
  nineties: [
    ['Mixtape', 'cassette', ['#111827', '#f59e0b', '#e5e7eb'], '1990s cassette mixtape tape', 26],
    ['Gel pen swirl', 'adinkra', ['#a855f7'], '1990s gel pen swirl doodle', 24],
    ['Sticker star', 'star', ['#f0abfc', '#7e22ce'], '1990s sticker star shiny', 20],
  ],
  noughties: [
    ['Floppy disk', 'floppy', ['#4b5563', '#e5e7eb'], '2000s floppy disk save', 24],
    ['Chat window', 'chat', ['#93c5fd', '#1e3a8a'], '2000s messenger chat window', 24],
    ['Bling diamond', 'diamond', ['#67e8f9', '#0891b2'], '2000s diamond bling shiny', 20],
  ],
  'twenty-tens': [
    ['Phone', 'phone', ['#111827', '#38bdf8', '#e5e7eb'], '2010s phone selfie social', 24],
    ['Heart like', 'heart', ['#ef4444', '#991b1b'], '2010s like heart social', 20],
    ['Filter camera', 'camera', ['#fbbf24', '#f472b6', '#1f2937'], '2010s camera filter photo', 26],
  ],
  paper: [
    ['Washi tape', 'tape', ['#fca5a5'], 'paper tape washi stick', 34],
    ['Blue tape', 'tape', ['#93c5fd'], 'paper tape blue stick', 34],
    ['Mint tape', 'tape', ['#6ee7b7'], 'paper tape mint stick', 34],
    ['Plain stamp', 'stamp', ['#fef3c7', '#ffffff', '#b45309'], 'paper stamp postage post', 26],
    ['Sealed envelope', 'envelope', ['#fde68a', '#92400e', '#78350f'], 'paper envelope mail post', 26],
    ['Ribbon bow', 'ribbon', ['#fb7185', '#fff1f2'], 'paper ribbon bow tie', 24],
  ],
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const STICKERS: Sticker[] = Object.entries(BY_CATEGORY).flatMap(([category, definitions]) =>
  definitions.map(([name, shape, colours, keywords, sizeMm]) => ({
    id: `${category}-${slug(name)}`,
    name,
    category,
    shape,
    colours,
    keywords: keywords.split(/\s+/),
    sizeMm: sizeMm ?? 22,
  })),
);

export function getSticker(id: string): Sticker | undefined {
  return STICKERS.find((sticker) => sticker.id === id);
}

export function stickersInCategory(categoryId: string): Sticker[] {
  return STICKERS.filter((sticker) => sticker.category === categoryId);
}

/** Keyword search across name, category and keywords. */
export function searchStickers(query: string): Sticker[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter((term) => term.length > 0);
  if (terms.length === 0) return STICKERS;
  return STICKERS.filter((sticker) => {
    const haystack = `${sticker.name} ${sticker.category} ${sticker.keywords.join(' ')}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** A themed pack, used by Surprise Me and by template suggestions. */
export function stickerPack(categoryId: string, count = 5): Sticker[] {
  const inCategory = stickersInCategory(categoryId);
  if (inCategory.length >= count) return inCategory.slice(0, count);
  return [...inCategory, ...STICKERS.filter((s) => s.category !== categoryId)].slice(0, count);
}

/** Every sticker must point at a shape that exists. Verified by the tests. */
export function missingShapes(): string[] {
  return [...new Set(STICKERS.filter((sticker) => !SHAPES[sticker.shape]).map((s) => s.shape))];
}
