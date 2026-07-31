/**
 * The template gallery.
 *
 * Every card shows a real miniature of the paper it will produce — same pattern,
 * same palette, same margins, same typography — because a template preview that
 * is a stock photograph is a lie you find out about after you start writing.
 */

import { el, clear } from '../utilities/dom';
import { navigate } from './router';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  filterTemplates,
  type LetterTemplate,
  type TemplateCategory,
} from '../templates/templates';
import { getPaper } from '../templates/papers';
import { applyTheme, getTheme, THEMES } from '../theme/themes';
import { PAGE_SIZES } from '../editor/wysiwyg/page-view';
import { getFont } from '../stationery/typography';
import { stickerPack } from '../stickers/library';
import { renderSticker } from '../stickers/render';
import { createLetter } from '../storage/schema';
import { putLetter } from '../storage/letters-repo';
import { documentFromPlainText } from '../document/model';
import { getPreferences, setPreferences } from '../storage/preferences';
import { openDialog } from '../accessibility/dialog';
import { focusHeading } from '../accessibility/focus';
import { announce } from '../accessibility/announce';
import { toast } from './toast';
import { describe } from '../utilities/events';

export interface TemplatesView {
  element: HTMLElement;
}

export function createTemplatesView(): TemplatesView {
  const element = el('section', { class: 'view view--templates', 'aria-labelledby': 'templates-title' });

  const state = {
    category: 'all' as TemplateCategory | 'all',
    themeId: 'all',
    paperSize: 'all',
    photos: false,
    decorative: 'all' as 'all' | 'decorative' | 'minimal',
    era: 'all' as 'all' | 'retro' | 'modern',
    search: '',
  };

  const grid = el('div', { class: 'template-gallery' });
  const count = el('p', { class: 'view__intro', role: 'status' });

  const search = el('input', {
    type: 'search',
    class: 'input',
    id: 'template-search',
    placeholder: 'Search templates',
  }) as HTMLInputElement;
  search.addEventListener('input', () => {
    state.search = search.value;
    paint();
  });

  const categoryRow = el('div', { class: 'chip-row chip-row--scroll', role: 'group', 'aria-label': 'Category' });
  const addCategoryChip = (id: TemplateCategory | 'all', label: string): void => {
    const chip = el('button', {
      type: 'button',
      class: `chip${state.category === id ? ' chip--active' : ''}`,
      text: label,
    });
    chip.addEventListener('click', () => {
      state.category = id;
      for (const other of categoryRow.children) other.classList.remove('chip--active');
      chip.classList.add('chip--active');
      paint();
    });
    categoryRow.append(chip);
  };
  addCategoryChip('all', 'Everything');
  for (const category of TEMPLATE_CATEGORIES) addCategoryChip(category.id, category.name);

  const select = (label: string, options: Array<[string, string]>, onChange: (value: string) => void): HTMLElement => {
    const id = `filter-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const node = el('select', { class: 'input input--small', id }) as HTMLSelectElement;
    for (const [value, text] of options) node.append(el('option', { value, text }));
    node.addEventListener('change', () => onChange(node.value));
    return el('div', { class: 'field field--inline' }, [
      el('label', { class: 'label label--inline', for: id, text: label }),
      node,
    ]);
  };

  const filters = el('div', { class: 'template-filters' }, [
    select('Colour', [['all', 'Any colour'], ...THEMES.map((theme) => [theme.id, theme.name] as [string, string])], (value) => {
      state.themeId = value;
      paint();
    }),
    select(
      'Paper',
      [['all', 'Any size'], ...Object.entries(PAGE_SIZES).map(([id, size]) => [id, size.name] as [string, string])],
      (value) => {
        state.paperSize = value;
        paint();
      },
    ),
    select('Style', [['all', 'Any style'], ['decorative', 'Decorative'], ['minimal', 'Minimal']], (value) => {
      state.decorative = value as typeof state.decorative;
      paint();
    }),
    select('Era', [['all', 'Any era'], ['retro', 'Retro'], ['modern', 'Modern']], (value) => {
      state.era = value as typeof state.era;
      paint();
    }),
    select('Photos', [['all', 'Any'], ['photos', 'Designed for photographs']], (value) => {
      state.photos = value === 'photos';
      paint();
    }),
  ]);

  element.append(
    el('div', { class: 'view__header' }, [
      el('div', {}, [
        el('h1', { class: 'view__title', id: 'templates-title', text: 'Templates' }),
        count,
      ]),
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'label', for: 'template-search', text: 'Search' }),
      search,
    ]),
    categoryRow,
    filters,
    grid,
  );

  /* ------------------------------------------------------------------ */

  function paint(): void {
    const matches = filterTemplates({
      category: state.category,
      themeId: state.themeId,
      paperSize: state.paperSize,
      photos: state.photos,
      decorative: state.decorative,
      era: state.era,
      search: state.search,
    });

    count.textContent =
      matches.length === TEMPLATES.length
        ? `${TEMPLATES.length} templates, all customisable after you start writing.`
        : `${matches.length} of ${TEMPLATES.length} templates.`;

    clear(grid);
    if (matches.length === 0) {
      grid.append(el('p', { class: 'tray__hint', text: 'Nothing matches those filters yet.' }));
      return;
    }
    for (const template of matches) grid.append(card(template));
  }

  function card(template: LetterTemplate): HTMLElement {
    const favourites = getPreferences().favouriteTemplates;
    const isFavourite = favourites.includes(template.id);

    const node = el('article', { class: 'template-card' });
    node.append(preview(template));

    node.append(
      el('h2', { class: 'template-card__name', text: template.name }),
      el('p', { class: 'template-card__meta', text: `${categoryName(template.category)} · ${template.occasion}` }),
    );

    const palette = el('div', { class: 'template-card__palette', 'aria-hidden': 'true' });
    const theme = getTheme(template.themeId);
    for (const colour of [theme.palette.primary, theme.palette.accent, theme.palette.secondary, theme.palette.paper]) {
      const dot = el('span', { class: 'palette-dot' });
      dot.style.setProperty('background', colour);
      palette.append(dot);
    }
    node.append(palette);

    node.append(
      el('p', {
        class: 'template-card__format',
        text: `${PAGE_SIZES[template.paperSize]?.name ?? 'A4'} · ${theme.name}${
          template.photoStyle !== 'plain' ? ' · photo layouts' : ''
        }`,
      }),
    );

    const actions = el('div', { class: 'template-card__actions' });

    const use = el('button', { type: 'button', class: 'chip chip--primary', text: 'Use template' });
    use.addEventListener('click', () => void start(template));

    const preview2 = el('button', { type: 'button', class: 'chip', text: 'Preview' });
    preview2.addEventListener('click', () => showPreview(template));

    const favourite = el('button', {
      type: 'button',
      class: `chip chip--icon${isFavourite ? ' chip--active' : ''}`,
      'aria-label': isFavourite ? `Remove ${template.name} from favourites` : `Add ${template.name} to favourites`,
      'aria-pressed': isFavourite ? 'true' : 'false',
      text: isFavourite ? '★' : '☆',
    });
    favourite.addEventListener('click', () => {
      const current = getPreferences().favouriteTemplates;
      const next = current.includes(template.id)
        ? current.filter((id) => id !== template.id)
        : [...current, template.id];
      setPreferences({ favouriteTemplates: next });
      announce(next.includes(template.id) ? 'Added to favourites.' : 'Removed from favourites.');
      paint();
    });

    actions.append(use, preview2, favourite);
    node.append(actions);
    return node;
  }

  /** A true miniature: the same paper pattern, palette, margins and type. */
  // 0.26 keeps a miniature inside the narrowest card the gallery ever draws.
  function preview(template: LetterTemplate, scale = 0.26): HTMLElement {
    const theme = getTheme(template.themeId);
    const size = PAGE_SIZES[template.paperSize] ?? PAGE_SIZES.a4!;
    const paper = getPaper(template.paper);

    const holder = el('div', { class: 'mini-page', role: 'img', 'aria-label': `${template.name} paper preview` });
    holder.style.setProperty('--mini-width', `${size.widthMm * scale}mm`);
    holder.style.setProperty('--mini-height', `${size.heightMm * scale}mm`);
    holder.style.setProperty('--paper-colour', theme.palette.paper);
    holder.style.setProperty('--paper-ink', theme.palette.paperInk);
    holder.style.setProperty('--border-colour', theme.palette.primary);
    holder.style.setProperty(
      '--paper-pattern',
      paper.background(theme.palette.stickers[3] ?? theme.palette.line, theme.palette.accent),
    );
    holder.style.setProperty('--paper-pattern-size', paper.size(template.patternStepMm * scale));
    holder.style.setProperty('--paper-pattern-opacity', String(template.patternOpacity ?? paper.defaultOpacity));
    holder.dataset.border = template.border;

    const lines = el('div', { class: 'mini-page__lines' });
    lines.style.setProperty('--mini-margin', `${template.margins.left * scale}mm`);
    lines.style.setProperty('font-family', getFont(template.typography.bodyFont).stack);

    const heading = el('span', { class: 'mini-page__heading', text: template.starter.greeting ?? 'Dear you,' });
    lines.append(heading);
    for (let index = 0; index < 7; index += 1) {
      const line = el('span', { class: 'mini-page__line' });
      line.style.setProperty('width', `${55 + ((index * 37) % 40)}%`);
      lines.append(line);
    }
    lines.append(el('span', { class: 'mini-page__sign', text: template.starter.closing ?? 'With love,' }));
    holder.append(lines);

    // A suggested sticker, placed the way the template suggests.
    const suggestion = stickerPack(template.stickerPacks[0] ?? 'hearts', 1)[0];
    if (suggestion) {
      const art = renderSticker(suggestion.id);
      if (art) {
        const badge = el('span', { class: 'mini-page__sticker' });
        badge.append(art);
        holder.append(badge);
      }
    }
    return holder;
  }

  function showPreview(template: LetterTemplate): void {
    const content = el('div', { class: 'template-preview' });
    const views = el('div', { class: 'chip-row' });
    const stage = el('div', { class: 'template-preview__stage' });

    const modes: Array<[string, () => HTMLElement]> = [
      ['Letter page', () => preview(template, 0.55)],
      ['Printed page', () => {
        const wrapper = el('div', { class: 'template-preview__print' });
        wrapper.append(preview(template, 0.5));
        wrapper.append(el('p', { class: 'tray__hint', text: 'Shown at the true paper proportions with the template margins.' }));
        return wrapper;
      }],
      ['Folded letter', () => {
        const fold = el('div', { class: 'template-preview__fold' });
        fold.append(preview(template, 0.34));
        return fold;
      }],
      ['Sealed envelope', () => envelopePreview(template)],
      ['On a phone', () => {
        const phone = el('div', { class: 'template-preview__phone' });
        phone.append(preview(template, 0.3));
        return phone;
      }],
    ];

    const show = (index: number): void => {
      clear(stage);
      stage.append(modes[index]![1]());
      for (const [position, child] of Array.from(views.children).entries()) {
        child.classList.toggle('chip--active', position === index);
      }
    };

    modes.forEach(([label], index) => {
      const chip = el('button', { type: 'button', class: 'chip', text: label });
      chip.addEventListener('click', () => show(index));
      views.append(chip);
    });

    content.append(views, stage);
    show(0);

    const dialog = openDialog({
      title: template.name,
      body: [`${categoryName(template.category)} · ${template.occasion}`],
      content,
      buttons: [
        { label: 'Close', value: 'cancel', variant: 'quiet' },
        { label: 'Use this template', value: 'use', variant: 'primary' },
      ],
      dismissValue: 'cancel',
    });

    void dialog.result.then((value) => {
      if (value === 'use') void start(template);
    });
  }

  function envelopePreview(template: LetterTemplate): HTMLElement {
    const theme = getTheme(template.themeId);
    const wrapper = el('div', { class: 'envelope-mini', role: 'img', 'aria-label': 'Envelope preview' });
    wrapper.style.setProperty('--envelope', theme.palette.envelope);
    wrapper.style.setProperty('--lining', theme.palette.envelopeLining);
    wrapper.style.setProperty('--ink', theme.palette.paperInk);
    wrapper.append(
      el('span', { class: 'envelope-mini__flap' }),
      el('span', { class: 'envelope-mini__address', text: 'To someone who matters' }),
    );
    if (template.envelope.seal !== 'none') {
      const seal = el('span', { class: `envelope-mini__seal envelope-mini__seal--${template.envelope.seal}` });
      seal.style.setProperty('background', theme.palette.accent);
      wrapper.append(seal);
    }
    return wrapper;
  }

  async function start(template: LetterTemplate): Promise<void> {
    try {
      const preferences = getPreferences();
      const theme = getTheme(template.themeId);
      const letter = createLetter({
        sender: preferences.senderName,
        senderLocation: preferences.senderLocation,
        templateId: template.id,
        themeId: template.themeId,
        paperSize: template.paperSize,
        typography: {
          family: template.typography.bodyFont,
          sizePt: template.typography.sizePt,
          lineHeight: template.typography.lineHeight,
          indentMm: 0,
          align: template.typography.align === 'justify' ? 'justify' : 'left',
          colour: theme.palette.paperInk,
        },
        envelope: { ...createLetter().envelope, size: template.envelope.size, sealStyle: template.envelope.seal },
        doc: documentFromPlainText('', {
          closing: template.starter.closing ?? 'With love,',
          signature: preferences.senderName,
          meta: preferences.senderLocation,
        }),
      });
      await putLetter(letter);
      applyTheme(theme);
      toast(`${template.name}. You can change any of it later.`, 'success');
      navigate({ name: 'write', id: letter.id });
    } catch (error) {
      toast(`That template could not be opened: ${describe(error)}`, 'error');
    }
  }

  function categoryName(id: TemplateCategory): string {
    return TEMPLATE_CATEGORIES.find((category) => category.id === id)?.name ?? id;
  }

  paint();
  setPreferences({ lastSection: 'templates' });
  focusHeading(element);

  return { element };
}
