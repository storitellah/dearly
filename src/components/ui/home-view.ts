/**
 * The home screen.
 *
 * A mailbox, some envelopes drifting past, a stack of paper, and six ways in.
 * The animation is decoration only: every button works from the first frame, and
 * all of it stops when the system asks for reduced motion.
 */

import { el } from '../utilities/dom';
import { navigate } from './router';
import { createLetter } from '../storage/schema';
import { putLetter, listLetters } from '../storage/letters-repo';
import { getPreferences, setPreferences } from '../storage/preferences';
import { applyTheme, getTheme, THEMES } from '../theme/themes';
import { TEMPLATES, randomTemplate } from '../templates/templates';
import { STICKER_CATEGORIES, stickerPack } from '../stickers/library';
import { renderSticker } from '../stickers/render';
import { documentFromPlainText } from '../document/model';
import { createId } from '../utilities/id';
import { nextPrompt } from '../prompts/prompt-library';
import { reducedMotionActive } from '../accessibility/motion';
import { focusHeading } from '../accessibility/focus';
import { announce } from '../accessibility/announce';
import { toast } from './toast';
import { describe } from '../utilities/events';
import { formatRelative } from '../utilities/format';

const GREETINGS = [
  'Write something worth keeping.',
  'Send a little joy.',
  'Some words deserve paper.',
  'Make someone smile today.',
  'Your next letter starts here.',
  'Write it. Decorate it. Print it. Keep it.',
];

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface HomeView {
  element: HTMLElement;
  refresh(): Promise<void>;
}

export function createHomeView(): HomeView {
  const element = el('section', { class: 'home', 'aria-labelledby': 'home-title' });

  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)] ?? GREETINGS[0]!;

  const hero = el('div', { class: 'home__hero' });
  hero.append(
    el('div', { class: 'home__words' }, [
      el('p', { class: 'home__eyebrow', text: 'Dearly by Storitellah' }),
      el('h1', { class: 'home__title', id: 'home-title', text: greeting }),
      el('p', {
        class: 'home__subtitle',
        text: 'A whole stationery box in your browser. Nothing you write ever leaves this device.',
      }),
    ]),
    buildMailbox(),
  );

  const actions = el('div', { class: 'home__actions' });

  const primary = bigButton('Write a letter', 'Start on fresh paper', 'primary');
  primary.addEventListener('click', () => void startLetter());

  const surprise = bigButton('Surprise me', 'A random template, palette, stickers and prompt', 'accent');
  surprise.addEventListener('click', () => void surpriseMe());

  const myLetters = bigButton('My letters', 'Your memory box', 'quiet');
  myLetters.addEventListener('click', () => navigate({ name: 'library', id: null }));

  const templates = bigButton('Templates', `${TEMPLATES.length} designs to start from`, 'quiet');
  templates.addEventListener('click', () => navigate({ name: 'templates', id: null }));

  const stickers = bigButton('Sticker studio', 'Browse and make stickers', 'quiet');
  stickers.addEventListener('click', () => navigate({ name: 'stickers', id: null }));

  const print = bigButton('Print studio', 'Check your printer before you print', 'quiet');
  print.addEventListener('click', () => navigate({ name: 'print-check', id: null }));

  actions.append(primary, surprise, myLetters, templates, stickers, print);

  const recent = el('div', { class: 'home__recent' });
  const themeStrip = buildThemeStrip();
  const stickerStrip = buildStickerStrip();

  // No footer here: the application shell already carries the tagline, the
  // Storitellah credit and the contact links, and printing them twice on one
  // screen looked like a mistake.
  element.append(hero, actions, recent, themeStrip, stickerStrip);

  /* ------------------------------------------------------------------ */

  async function startLetter(template = randomTemplate()): Promise<void> {
    try {
      const preferences = getPreferences();
      const theme = getTheme(template.themeId);
      const letter = createLetter({
        id: createId('ltr'),
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
        doc: documentFromPlainText('', {
          closing: template.starter.closing ?? 'With love,',
          signature: preferences.senderName,
          meta: preferences.senderLocation,
        }),
      });
      await putLetter(letter);
      applyTheme(theme);
      navigate({ name: 'write', id: letter.id });
    } catch (error) {
      toast(`The letter could not be started: ${describe(error)}`, 'error');
    }
  }

  async function surpriseMe(): Promise<void> {
    const template = randomTemplate();
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)] ?? THEMES[0]!;
    const packCategory =
      STICKER_CATEGORIES[Math.floor(Math.random() * STICKER_CATEGORIES.length)] ?? STICKER_CATEGORIES[0]!;
    const pack = stickerPack(packCategory.id, 4);
    const prompt = nextPrompt('everyday', null);

    announce(
      `Surprise: the ${template.name} template, ${theme.name} colours, ${packCategory.name} stickers, and a prompt.`,
    );
    toast(`${template.name} · ${theme.name} · ${packCategory.name} stickers`, 'success', 6000);

    const preferences = getPreferences();
    const letter = createLetter({
      sender: preferences.senderName,
      senderLocation: preferences.senderLocation,
      templateId: template.id,
      themeId: theme.id,
      paperSize: template.paperSize,
      typography: {
        family: template.typography.bodyFont,
        sizePt: template.typography.sizePt,
        lineHeight: template.typography.lineHeight,
        indentMm: 0,
        align: 'left',
        colour: theme.palette.paperInk,
      },
      envelope: { ...createLetter().envelope, sealStyle: template.envelope.seal, size: template.envelope.size },
      doc: documentFromPlainText('', {
        closing: template.starter.closing ?? 'With love,',
        signature: preferences.senderName,
        meta: preferences.senderLocation,
      }),
    });

    // The suggested sticker pack is placed ready to move, not forced into place.
    letter.doc.decorations = pack.map((sticker, index) => ({
      id: createId('dec'),
      kind: 'sticker' as const,
      stickerId: sticker.id,
      colours: [],
      page: 0,
      xMm: 30 + index * 34,
      yMm: 250,
      widthMm: sticker.sizeMm,
      heightMm: sticker.sizeMm,
      rotation: (index % 2 === 0 ? -1 : 1) * 5,
      opacity: 1,
      flipped: false,
      locked: false,
      layer: 4,
    }));

    try {
      await putLetter(letter);
      applyTheme(theme);
      setPreferences({ lastThemeId: theme.id, lastPrompt: prompt.text });
      navigate({ name: 'write', id: letter.id });
    } catch (error) {
      toast(`That did not work: ${describe(error)}`, 'error');
    }
  }

  function buildThemeStrip(): HTMLElement {
    const strip = el('section', { class: 'home__themes', 'aria-label': 'Colour themes' });
    strip.append(el('h2', { class: 'home__section-title', text: 'Pick a mood' }));
    const row = el('div', { class: 'theme-strip' });
    for (const theme of THEMES) {
      const button = el('button', {
        type: 'button',
        class: 'theme-chip',
        'aria-label': `${theme.name}. ${theme.mood}`,
      });
      button.style.setProperty('--a', theme.palette.primary);
      button.style.setProperty('--b', theme.palette.accent);
      button.style.setProperty('--c', theme.palette.paper);
      button.append(el('span', { class: 'theme-chip__name', text: theme.name }));
      button.addEventListener('click', () => {
        applyTheme(theme);
        setPreferences({ lastThemeId: theme.id });
        announce(`${theme.name} colours.`);
      });
      row.append(button);
    }
    strip.append(row);
    return strip;
  }

  function buildStickerStrip(): HTMLElement {
    const strip = el('section', { class: 'home__stickers', 'aria-label': 'Stickers' });
    strip.append(el('h2', { class: 'home__section-title', text: 'A few from the sticker drawer' }));
    const row = el('div', { class: 'sticker-strip' });
    for (const sticker of stickerPack('celebration', 4).concat(stickerPack('love', 3), stickerPack('nature', 3))) {
      const holder = el('span', { class: 'sticker-strip__item', title: sticker.name });
      const art = renderSticker(sticker.id);
      if (art) holder.append(art);
      row.append(holder);
    }
    strip.append(row);
    return strip;
  }

  async function refresh(): Promise<void> {
    recent.replaceChildren();
    try {
      const result = await listLetters({ pageSize: 4, sort: 'updated-desc' });
      if (result.items.length === 0) return;

      recent.append(el('h2', { class: 'home__section-title', text: 'Carry on writing' }));
      const row = el('div', { class: 'recent-row' });
      for (const item of result.items) {
        const card = el('a', { class: 'recent-card', href: `#/write/${item.id}` });
        card.append(
          el('span', { class: 'recent-card__title', text: item.title }),
          el('span', {
            class: 'recent-card__meta',
            text: `${item.locked ? 'Locked' : `${item.words} words`} · ${formatRelative(item.updatedAt)}`,
          }),
        );
        row.append(card);
      }
      recent.append(row);
    } catch {
      // A home screen that cannot list letters still lets you write one.
    }
  }

  void refresh();
  setPreferences({ lastSection: 'home' });
  focusHeading(element);

  return { element, refresh };
}

function bigButton(title: string, hint: string, variant: 'primary' | 'accent' | 'quiet'): HTMLButtonElement {
  const button = el('button', { type: 'button', class: `big-button big-button--${variant}` });
  button.append(
    el('span', { class: 'big-button__title', text: title }),
    el('span', { class: 'big-button__hint', text: hint }),
  );
  return button;
}

/** The mailbox, drawn as SVG so it stays crisp and costs nothing to load. */
function buildMailbox(): HTMLElement {
  const holder = el('div', { class: 'mailbox', 'aria-hidden': 'true' });
  if (!reducedMotionActive()) holder.classList.add('mailbox--animated');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 180');
  svg.setAttribute('class', 'mailbox__art');
  svg.setAttribute('focusable', 'false');

  const shape = (d: string, className: string): SVGPathElement => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', className);
    svg.append(path);
    return path;
  };

  // Post, box, opening, flag, and three envelopes floating out.
  shape('M92 176h16V96H92z', 'mailbox__post');
  shape('M40 60h96c14 0 24 10 24 24v40H40z', 'mailbox__body');
  shape('M40 60h96c14 0 24 10 24 24H64c0-14-10-24-24-24z', 'mailbox__lid');
  shape('M58 92h44v32H58z', 'mailbox__slot');
  shape('M160 66v-26h22v18h-22z', 'mailbox__flag');

  for (const [index, d] of [
    'M18 30h40v26H18z',
    'M150 16h34v22h-34z',
    'M6 96h30v20H6z',
  ].entries()) {
    const envelope = document.createElementNS(SVG_NS, 'path');
    envelope.setAttribute('d', d);
    envelope.setAttribute('class', `mailbox__envelope mailbox__envelope--${index + 1}`);
    svg.append(envelope);
  }

  holder.append(svg);
  return holder;
}
