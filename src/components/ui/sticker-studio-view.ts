/**
 * The sticker studio.
 *
 * Browse the built-in library, keep favourites, upload your own, or make one
 * from text and a shape and export it as a transparent PNG. Everything happens
 * on the device: an uploaded sticker is re-encoded locally, and a made sticker is
 * drawn on a canvas here and saved straight to your downloads.
 */

import { el, clear } from '../utilities/dom';
import {
  STICKER_CATEGORIES,
  STICKERS,
  searchStickers,
  stickersInCategory,
  type Sticker,
} from '../stickers/library';
import { renderSticker, rasteriseSticker } from '../stickers/render';
import { getPreferences, setPreferences } from '../storage/preferences';
import { getTheme, THEMES } from '../theme/themes';
import { FONTS, getFont } from '../stationery/typography';
import { triggerDownload } from '../export/download';
import { processImage, ImageError } from '../security/image-validate';
import { focusHeading } from '../accessibility/focus';
import { announce } from '../accessibility/announce';
import { toast } from './toast';
import { describe } from '../utilities/events';

export interface StickerStudioView {
  element: HTMLElement;
}

export function createStickerStudioView(): StickerStudioView {
  const element = el('section', { class: 'view view--stickers', 'aria-labelledby': 'stickers-title' });

  let category: string | 'favourites' = STICKER_CATEGORIES[0]!.id;
  let query = '';

  const results = el('div', { class: 'sticker-grid sticker-grid--large' });
  const summary = el('p', { class: 'view__intro', role: 'status' });

  const search = el('input', {
    type: 'search',
    class: 'input',
    id: 'sticker-search',
    placeholder: 'Search by name or keyword, e.g. "birthday" or "rainbow"',
  }) as HTMLInputElement;
  search.addEventListener('input', () => {
    query = search.value.trim();
    paint();
  });

  const categoryRow = el('div', { class: 'chip-row chip-row--scroll', role: 'group', 'aria-label': 'Sticker categories' });
  const addChip = (id: string, label: string): void => {
    const chip = el('button', {
      type: 'button',
      class: `chip${category === id ? ' chip--active' : ''}`,
      text: label,
    });
    chip.addEventListener('click', () => {
      category = id;
      for (const other of categoryRow.children) other.classList.remove('chip--active');
      chip.classList.add('chip--active');
      paint();
    });
    categoryRow.append(chip);
  };
  addChip('favourites', 'Favourites');
  for (const item of STICKER_CATEGORIES) addChip(item.id, item.name);

  element.append(
    el('div', { class: 'view__header' }, [
      el('div', {}, [
        el('h1', { class: 'view__title', id: 'stickers-title', text: 'Sticker studio' }),
        summary,
      ]),
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'label', for: 'sticker-search', text: 'Search' }),
      search,
    ]),
    categoryRow,
    results,
    buildMaker(),
    buildUpload(),
  );

  function currentStickers(): Sticker[] {
    if (query.length > 0) return searchStickers(query);
    if (category === 'favourites') {
      const favourites = getPreferences().favouriteStickers;
      return STICKERS.filter((sticker) => favourites.includes(sticker.id));
    }
    return stickersInCategory(category);
  }

  function paint(): void {
    const items = currentStickers();
    summary.textContent =
      query.length > 0
        ? `${items.length} stickers match “${query}”.`
        : `${STICKERS.length} stickers, all drawn as vectors so they print sharply.`;

    clear(results);
    if (items.length === 0) {
      results.append(
        el('p', {
          class: 'tray__hint',
          text: category === 'favourites' ? 'No favourites yet. Tap the star on any sticker.' : 'Nothing matches that.',
        }),
      );
      return;
    }

    const favourites = getPreferences().favouriteStickers;
    for (const sticker of items) {
      const card = el('figure', { class: 'sticker-card' });
      const art = renderSticker(sticker.id);
      if (art) card.append(art);
      card.append(el('figcaption', { class: 'sticker-card__name', text: sticker.name }));

      const star = el('button', {
        type: 'button',
        class: `sticker-card__star${favourites.includes(sticker.id) ? ' sticker-card__star--on' : ''}`,
        'aria-label': favourites.includes(sticker.id)
          ? `Remove ${sticker.name} from favourites`
          : `Add ${sticker.name} to favourites`,
        'aria-pressed': favourites.includes(sticker.id) ? 'true' : 'false',
        text: favourites.includes(sticker.id) ? '★' : '☆',
      });
      star.addEventListener('click', () => {
        const current = getPreferences().favouriteStickers;
        const next = current.includes(sticker.id)
          ? current.filter((id) => id !== sticker.id)
          : [...current, sticker.id];
        setPreferences({ favouriteStickers: next });
        announce(next.includes(sticker.id) ? 'Added to favourites.' : 'Removed from favourites.');
        paint();
      });

      const save = el('button', { type: 'button', class: 'chip chip--small', text: 'Save PNG' });
      save.addEventListener('click', () => void saveSticker(sticker));

      card.append(el('div', { class: 'sticker-card__actions' }, [star, save]));
      results.append(card);
    }
  }

  async function saveSticker(sticker: Sticker): Promise<void> {
    try {
      // 300 DPI at the sticker's placed size, so it prints as crisply as it looks.
      const pixels = Math.round((sticker.sizeMm / 25.4) * 300);
      const canvas = await rasteriseSticker(sticker.id, [], Math.max(256, pixels));
      if (!canvas) throw new Error('The sticker could not be drawn.');
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('The sticker could not be encoded.');
      triggerDownload(blob, `${sticker.id}.png`);
      toast('Sticker saved as a transparent PNG.', 'success');
    } catch (error) {
      toast(`That sticker could not be saved: ${describe(error)}`, 'error');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Make your own                                                       */
  /* ------------------------------------------------------------------ */

  function buildMaker(): HTMLElement {
    const section = el('section', { class: 'studio-panel', 'aria-labelledby': 'maker-title' });
    section.append(
      el('h2', { class: 'view__subtitle', id: 'maker-title', text: 'Make a sticker' }),
      el('p', { class: 'tray__hint', text: 'Type a word, pick a shape and a colour, then save it as a transparent PNG.' }),
    );

    const text = el('input', {
      type: 'text',
      class: 'input',
      id: 'maker-text',
      value: 'hello!',
      maxlength: '24',
    }) as HTMLInputElement;

    const shape = el('select', { class: 'input', id: 'maker-shape' }) as HTMLSelectElement;
    for (const [value, label] of [
      ['circle', 'Circle'],
      ['rounded', 'Rounded badge'],
      ['banner', 'Banner'],
      ['cloud', 'Cloud'],
      ['none', 'No background'],
    ] as const) {
      shape.append(el('option', { value, text: label }));
    }

    const font = el('select', { class: 'input', id: 'maker-font' }) as HTMLSelectElement;
    for (const item of FONTS) font.append(el('option', { value: item.id, text: item.name }));

    const fill = el('input', { type: 'color', class: 'input input--colour', id: 'maker-fill', value: '#f472b6' }) as HTMLInputElement;
    const ink = el('input', { type: 'color', class: 'input input--colour', id: 'maker-ink', value: '#ffffff' }) as HTMLInputElement;

    const outline = el('input', { type: 'checkbox', class: 'checkbox', id: 'maker-outline' }) as HTMLInputElement;
    outline.checked = true;
    const shadow = el('input', { type: 'checkbox', class: 'checkbox', id: 'maker-shadow' }) as HTMLInputElement;
    shadow.checked = true;

    const canvas = el('canvas', {
      class: 'maker__canvas',
      width: '600',
      height: '600',
      'aria-label': 'Preview of the sticker you are making',
      role: 'img',
    }) as HTMLCanvasElement;

    const draw = (): void => {
      const context = canvas.getContext('2d');
      if (!context) return;
      const size = canvas.width;
      context.clearRect(0, 0, size, size);

      const background = fill.value;
      const foreground = ink.value;
      const label = text.value.trim() || 'hello';

      if (shadow.checked) {
        context.shadowColor = 'rgba(0,0,0,0.28)';
        context.shadowBlur = size * 0.04;
        context.shadowOffsetY = size * 0.02;
      }

      context.fillStyle = background;
      const inset = size * 0.08;
      const chosen = shape.value;

      if (chosen === 'circle') {
        context.beginPath();
        context.arc(size / 2, size / 2, size / 2 - inset, 0, Math.PI * 2);
        context.fill();
      } else if (chosen === 'rounded') {
        roundRect(context, inset, size * 0.26, size - inset * 2, size * 0.48, size * 0.1);
        context.fill();
      } else if (chosen === 'banner') {
        context.beginPath();
        context.moveTo(inset, size * 0.32);
        context.lineTo(size - inset, size * 0.3);
        context.lineTo(size - inset, size * 0.68);
        context.lineTo(inset, size * 0.7);
        context.closePath();
        context.fill();
      } else if (chosen === 'cloud') {
        for (const [x, y, r] of [
          [0.34, 0.52, 0.18],
          [0.5, 0.44, 0.22],
          [0.66, 0.52, 0.18],
          [0.5, 0.58, 0.2],
        ] as const) {
          context.beginPath();
          context.arc(size * x, size * y, size * r, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;

      const fontSize = Math.min(size * 0.2, (size * 1.5) / Math.max(4, label.length));
      context.font = `700 ${fontSize}px ${getFont(font.value).stack}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      if (outline.checked) {
        context.lineWidth = fontSize * 0.18;
        context.strokeStyle = chosen === 'none' ? background : '#00000055';
        context.lineJoin = 'round';
        context.strokeText(label, size / 2, size / 2);
      }
      context.fillStyle = chosen === 'none' ? background : foreground;
      context.fillText(label, size / 2, size / 2);
    };

    for (const control of [text, shape, font, fill, ink, outline, shadow]) {
      control.addEventListener('input', draw);
      control.addEventListener('change', draw);
    }

    const save = el('button', { type: 'button', class: 'chip chip--primary', text: 'Save as transparent PNG' });
    save.addEventListener('click', () => {
      canvas.toBlob((blob) => {
        if (!blob) {
          toast('That sticker could not be saved.', 'error');
          return;
        }
        triggerDownload(blob, `sticker-${text.value.trim() || 'made'}.png`);
        toast('Saved. Add it from the sticker drawer with “your own stickers”.', 'success');
      }, 'image/png');
    });

    const controls = el('div', { class: 'field-grid' }, [
      labelled('maker-text', 'Words', text),
      labelled('maker-shape', 'Shape', shape),
      labelled('maker-font', 'Font', font),
      labelled('maker-fill', 'Background', fill),
      labelled('maker-ink', 'Text colour', ink),
      el('div', { class: 'field field--checkbox' }, [outline, el('label', { class: 'label', for: 'maker-outline', text: 'Outline' })]),
      el('div', { class: 'field field--checkbox' }, [shadow, el('label', { class: 'label', for: 'maker-shadow', text: 'Shadow' })]),
    ]);

    section.append(el('div', { class: 'maker' }, [controls, canvas]), el('div', { class: 'button-row' }, [save]));
    draw();
    return section;
  }

  function buildUpload(): HTMLElement {
    const section = el('section', { class: 'studio-panel', 'aria-labelledby': 'upload-title' });
    const input = el('input', {
      type: 'file',
      class: 'input input--file',
      id: 'sticker-upload',
      accept: 'image/png,image/jpeg,image/webp',
    }) as HTMLInputElement;

    const status = el('p', { class: 'tray__hint', role: 'status' });

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      void (async () => {
        try {
          // Validated by content and re-encoded locally before it is ever shown.
          const processed = await processImage(file, { letterId: 'preview', fileName: file.name, role: 'signature' });
          status.textContent = `“${processed.name}” is a safe ${processed.type} at ${processed.width}×${processed.height}. Add it to a letter from the sticker drawer.`;
          announce('Sticker checked and converted.');
        } catch (error) {
          status.textContent = error instanceof ImageError ? error.message : describe(error);
        }
      })();
    });

    section.append(
      el('h2', { class: 'view__subtitle', id: 'upload-title', text: 'Use your own' }),
      el('p', {
        class: 'tray__hint',
        text: 'PNG, JPEG or WebP. Dearly checks the file contents rather than the name, and converts it into a safe local image. SVG files are refused, because they can carry scripts.',
      }),
      input,
      status,
    );
    return section;
  }

  function labelled(id: string, label: string, control: HTMLElement): HTMLElement {
    return el('div', { class: 'field' }, [el('label', { class: 'label', for: id, text: label }), control]);
  }

  paint();
  setPreferences({ lastSection: 'stickers' });
  focusHeading(element);
  void getTheme(THEMES[0]!.id);

  return { element };
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
