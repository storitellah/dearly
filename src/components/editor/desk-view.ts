/**
 * The letter desk.
 *
 * The paper sits in the middle. The trays — stationery, stickers, photographs,
 * envelope, print — sit around it on a wide screen and slide up from the bottom
 * on a phone. There is no separate editor and no separate preview: the page in
 * the middle is the letter, and it is what prints.
 */

import { el, clear } from '../utilities/dom';
import { PageView, PAGE_SIZES } from './wysiwyg/page-view';
import { FormattingToolbar } from './wysiwyg/toolbar';
import { SlashMenu, type SlashCommand } from './wysiwyg/slash-menu';
import { DecorationLayer } from './wysiwyg/decoration-layer';
import { DocumentHistory } from '../document/history';
import {
  cloneDocument,
  documentText,
  documentWordCount,
  textBlock,
  type Block,
  type LetterDocument,
  type StickerDecoration,
} from '../document/model';
import { createId } from '../utilities/id';
import { getLetter, putLetter, deleteLetter } from '../storage/letters-repo';
import { getAttachmentsForLetter, putAttachment, deleteAttachment, toMeta } from '../storage/attachments-repo';
import { saveSnapshot } from '../storage/snapshots';
import { isLetterLocked, type LetterRecord } from '../storage/schema';
import { Autosave, guardUnload, type SaveStatus } from './autosave';
import { EditorContext } from './context';
import { createLockPanel } from './lock-panel';
import { createHistoryPanel } from './history-panel';
import { createSignaturePanel } from './signature-panel';
import { createAiAssistPanel } from './ai-assist';
import { nextPrompt } from '../prompts/prompt-library';
import { getTemplate, TEMPLATES, TEMPLATE_CATEGORIES } from '../templates/templates';
import { applyTheme, getTheme, THEMES } from '../theme/themes';
import { STICKER_CATEGORIES, searchStickers, stickersInCategory, type Sticker } from '../stickers/library';
import { renderSticker } from '../stickers/render';
import { processImage, ImageError } from '../security/image-validate';
import { getPreferences, setPreferences } from '../storage/preferences';
import { navigate } from '../ui/router';
import { confirmDialog } from '../accessibility/dialog';
import { announce } from '../accessibility/announce';
import { focusHeading } from '../accessibility/focus';
import { toast } from '../ui/toast';
import { Disposables, describe } from '../utilities/events';
import { formatRelative } from '../utilities/format';

export interface DeskView {
  element: HTMLElement;
  dispose(): void;
  hasUnsavedChanges(): boolean;
  flush(): Promise<void>;
}

const CHEERS = [
  'Your letter is taking shape.',
  'That is worth keeping.',
  'You have written your first page.',
  'Add one small memory before you finish.',
  'This already feels personal.',
  'Your words are safe on this device.',
];

export async function createDeskView(letterId: string): Promise<DeskView> {
  const disposables = new Disposables();
  const urls = new Disposables();

  const loaded = await getLetter(letterId);
  if (!loaded) return missingLetterView(disposables);

  let letter: LetterRecord = loaded;
  let attachments = await getAttachmentsForLetter(letter.id);
  const history = new DocumentHistory(letter.doc);

  const photoUrls = new Map<string, string>();
  const stickerUrls = new Map<string, string>();
  const refreshUrls = (): void => {
    urls.dispose();
    photoUrls.clear();
    stickerUrls.clear();
    for (const attachment of attachments) {
      const url = urls.objectUrl(attachment.preview);
      if (attachment.role === 'photo') photoUrls.set(attachment.id, url);
      else stickerUrls.set(attachment.id, url);
    }
  };
  refreshUrls();

  const autosave = new Autosave({
    save: async (record) => putLetter(record),
    snapshot: (record) => saveSnapshot(record, 'autosave'),
    onStatus: (status) => renderStatus(status),
    delayMs: 700,
  });
  disposables.add(() => autosave.dispose());
  disposables.add(guardUnload(autosave));

  /**
   * A bridge to the panels that were written before the desk existed.
   *
   * Locking, draft history and signatures are the same code they always were —
   * they simply read the letter through this context instead of a variable in
   * this file. Everything the desk changes is pushed in with `replace`, and
   * everything a panel changes comes back through `change`, so there is still
   * exactly one letter and one autosave queue.
   */
  const context = new EditorContext(letter, attachments, autosave);

  applyTheme(getTheme(letter.themeId));

  /* ------------------------------------------------------------------ */
  /* Shell                                                               */
  /* ------------------------------------------------------------------ */

  const element = el('section', { class: 'desk', 'aria-labelledby': 'desk-title' });
  const heading = el('h1', { class: 'visually-hidden', id: 'desk-title', text: 'Writing a letter' });

  const status = el('p', { class: 'desk__status', role: 'status', 'aria-live': 'polite' });
  const cheer = el('p', { class: 'desk__cheer', 'aria-live': 'polite' });
  const pageCounter = el('p', { class: 'desk__pages', role: 'status' });

  const page = new PageView({
    getDocument: () => history.document,
    onChange: (doc, tag) => applyDoc(doc, tag, tag),
    onPages: (count) => {
      pageCounter.textContent = count === 1 ? '1 page' : `${count} pages`;
    },
    onSelection: (rect) => toolbar.showFor(rect),
    photoUrls,
    stickerUrls,
  });

  const toolbar = new FormattingToolbar({
    getDocument: () => history.document,
    apply: (doc, label) => {
      applyDoc(doc, label);
      page.render(history.document);
    },
    activeBlockId: () => activeBlockId(),
    selectedBlockIds: () => selectedBlockIds(),
    isMobile: () => window.matchMedia('(max-width: 60rem)').matches,
  });

  const slashMenu = new SlashMenu((command) => runCommand(command));

  const decorations = new DecorationLayer({
    getDocument: () => history.document,
    apply: (doc, label, tag, options) => {
      applyDoc(doc, label, tag);
      // A live drag moves the existing element itself; re-rendering here would
      // pull it out from under the finger.
      if (!options?.live) {
        page.render(history.document);
        decorations.positionHandles();
      }
    },
    refresh: () => {
      page.render(history.document);
      decorations.positionHandles();
    },
    pixelsPerMm: () => page.scale,
    sheet: () => page.sheetElement,
    layer: () => page.decorationsElement,
    onSelect: (decoration) => renderDecorationTools(decoration !== null),
  });

  /* ------------------------------------------------------------------ */
  /* State changes                                                       */
  /* ------------------------------------------------------------------ */

  /** The one place the desk's copy of the letter changes. */
  function setLetter(next: LetterRecord, queue = true): void {
    letter = next;
    if (queue) autosave.queue(letter);
    context.replace(letter, 'desk');
  }

  function applyDoc(doc: LetterDocument, label: string, tag?: string): void {
    history.commit(doc, label, tag);
    setLetter({ ...letter, doc, body: documentText(doc) });
    updateMeta();
  }

  function applyLetter(changes: Partial<LetterRecord>, label: string): void {
    setLetter({ ...letter, ...changes });
    page.setDesign(letter);
    page.render(history.document);
    announce(label);
  }

  // A panel changed the letter underneath us: take it, and redraw the page if
  // the words themselves came back (unlocking, or restoring a draft).
  context.events.on('change', ({ letter: next, source }) => {
    if (source === 'desk') return;
    const wordsChanged = next.doc !== letter.doc || next.body !== letter.body;
    letter = next;
    titleInput.value = letter.title;
    if (wordsChanged) {
      history.reset(letter.doc);
      page.setDesign(letter);
      page.render(history.document);
    }
    updateMeta();
    renderLockState();
  });

  context.events.on('attachments', (event) => {
    attachments = event.attachments;
    refreshUrls();
    page.render(history.document);
  });

  function updateMeta(): void {
    const words = documentWordCount(history.document);
    if (words > 0 && words % 60 === 0) {
      cheer.textContent = CHEERS[Math.floor((words / 60) % CHEERS.length)] ?? '';
    }
    undoButton.disabled = !history.canUndo;
    redoButton.disabled = !history.canRedo;
  }

  function activeBlockId(): string | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    let node: Node | null = selection.getRangeAt(0).startContainer;
    while (node) {
      if (node instanceof HTMLElement && node.dataset.block) return node.dataset.block;
      node = node.parentNode;
    }
    return null;
  }

  function selectedBlockIds(): string[] {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    return Array.from(page.flowElement.children)
      .filter((child) => child instanceof HTMLElement && range.intersectsNode(child))
      .map((child) => (child as HTMLElement).dataset.block ?? '')
      .filter((id) => id.length > 0);
  }

  /* ------------------------------------------------------------------ */
  /* Top bar                                                             */
  /* ------------------------------------------------------------------ */

  const backLink = el('a', { class: 'chip chip--quiet', href: '#/home', text: '← Home' });

  const titleInput = el('input', {
    type: 'text',
    class: 'desk__title',
    'aria-label': 'Letter title, for your memory box',
    placeholder: 'Untitled letter',
    value: letter.title,
  }) as HTMLInputElement;
  titleInput.addEventListener('input', () => {
    setLetter({ ...letter, title: titleInput.value });
  });

  const undoButton = iconChip('Undo', '↶', () => {
    const doc = history.undo();
    if (!doc) return;
    setLetter({ ...letter, doc, body: documentText(doc) });
    page.render(doc);
    updateMeta();
    announce('Undone.');
  });

  const redoButton = iconChip('Redo', '↷', () => {
    const doc = history.redo();
    if (!doc) return;
    setLetter({ ...letter, doc, body: documentText(doc) });
    page.render(doc);
    updateMeta();
    announce('Redone.');
  });

  const focusButton = iconChip('Focus mode', '◐', () => {
    const on = element.classList.toggle('desk--focus');
    announce(on ? 'Focus mode on. The page still looks exactly as it prints.' : 'Focus mode off.');
  });

  const hideDecoButton = iconChip('Hide decorations while writing', '👁', () => {
    page.setDecorationsHidden(!page.decorationsHidden);
    announce(page.decorationsHidden ? 'Decorations hidden.' : 'Decorations shown.');
  });

  const printButton = el('button', { type: 'button', class: 'chip chip--primary', text: 'Print' });
  printButton.addEventListener('click', () => void doPrint());

  const topBar = el('div', { class: 'desk__bar' }, [
    backLink,
    titleInput,
    el('div', { class: 'desk__bar-actions' }, [
      undoButton,
      redoButton,
      focusButton,
      hideDecoButton,
      printButton,
    ]),
  ]);

  /* ------------------------------------------------------------------ */
  /* Trays                                                               */
  /* ------------------------------------------------------------------ */

  const trayContent = el('div', { class: 'tray__content' });
  const tray = el('div', { class: 'tray', hidden: true, role: 'dialog', 'aria-label': 'Tools' });
  const trayTitle = el('h2', { class: 'tray__title', id: 'tray-title' });
  const trayClose = el('button', {
    type: 'button',
    class: 'tray__close',
    'aria-label': 'Close this tray',
    text: '×',
  });
  trayClose.addEventListener('click', () => closeTray());
  tray.setAttribute('aria-labelledby', 'tray-title');
  tray.append(el('div', { class: 'tray__head' }, [trayTitle, trayClose]), trayContent);

  let openTrayId: string | null = null;

  function openTray(id: string, title: string, build: (host: HTMLElement) => void): void {
    if (openTrayId === id) {
      closeTray();
      return;
    }
    openTrayId = id;
    trayTitle.textContent = title;
    clear(trayContent);
    build(trayContent);
    tray.hidden = false;
    element.dataset.tray = id;
    for (const button of trayButtons) {
      button.setAttribute('aria-expanded', button.dataset.tray === id ? 'true' : 'false');
    }
  }

  function closeTray(): void {
    openTrayId = null;
    tray.hidden = true;
    element.removeAttribute('data-tray');
    for (const button of trayButtons) button.setAttribute('aria-expanded', 'false');
  }

  const trayButtons: HTMLButtonElement[] = [];
  function trayButton(id: string, label: string, symbol: string, build: (host: HTMLElement) => void): HTMLButtonElement {
    const button = el('button', {
      type: 'button',
      class: 'dock__button',
      'data-tray': id,
      'aria-expanded': 'false',
    });
    button.append(
      el('span', { class: 'dock__symbol', 'aria-hidden': 'true', text: symbol }),
      el('span', { class: 'dock__label', text: label }),
    );
    button.addEventListener('click', () => openTray(id, label, build));
    trayButtons.push(button);
    return button;
  }

  const dock = el('nav', { class: 'dock', 'aria-label': 'Letter tools' }, [
    trayButton('stationery', 'Paper', '▤', buildStationeryTray),
    trayButton('stickers', 'Stickers', '★', buildStickerTray),
    trayButton('photos', 'Photos', '▣', buildPhotoTray),
    trayButton('type', 'Type', 'Aa', buildTypeTray),
    trayButton('envelope', 'Envelope', '✉', buildEnvelopeTray),
    trayButton('export', 'Export', '↧', buildExportTray),
    trayButton('ideas', 'Ideas', '✎', buildIdeasTray),
    trayButton('keep', 'Keeping', '🔒', buildKeepingTray),
  ]);

  /* ------------------------------ Ideas ------------------------------- */

  /** Adds a paragraph at the end of the letter and shows it. */
  function appendParagraph(text: string): void {
    const doc = cloneDocument(history.document);
    doc.blocks.push(textBlock('paragraph', text));
    applyDoc(doc, 'added a paragraph');
    page.render(history.document);
    page.focusBlock(doc.blocks.length - 1, true);
  }

  let promptId: string | null = null;

  function buildIdeasTray(host: HTMLElement): void {
    const promptText = el('p', { class: 'tray__prompt' });
    const show = (): void => {
      const prompt = nextPrompt(letter.category, promptId);
      promptId = prompt.id;
      promptText.textContent = prompt.text;
    };
    show();

    const another = el('button', { type: 'button', class: 'chip', text: 'Another idea' });
    another.addEventListener('click', () => {
      show();
      announce('New prompt.');
    });

    const use = el('button', { type: 'button', class: 'chip chip--primary', text: 'Start a paragraph' });
    use.addEventListener('click', () => {
      // The prompt is a nudge, not text to keep: it opens an empty paragraph.
      appendParagraph('');
      closeTray();
      announce('New paragraph ready. The prompt is yours to answer in your own words.');
    });

    host.append(
      el('p', { class: 'tray__hint', text: 'For when the first line will not come. Nothing here is written for you.' }),
      promptText,
      el('div', { class: 'chip-row' }, [use, another]),
      assistPanel.element,
    );
  }

  const assistPanel = createAiAssistPanel(
    context,
    () => {
      const selection = window.getSelection();
      const text = selection && !selection.isCollapsed ? selection.toString() : documentText(history.document);
      return { text, whole: !selection || selection.isCollapsed };
    },
    (text) => appendParagraph(text),
  );

  /* ----------------------------- Keeping ------------------------------ */

  /**
   * Locking, draft history and signatures.
   *
   * These are built once and kept, because the lock panel holds the unlock
   * prompt that a locked letter needs the moment it is opened.
   */
  const lockPanel = createLockPanel(context);
  const historyPanel = createHistoryPanel(context);
  const signaturePanel = createSignaturePanel(context);

  function buildKeepingTray(host: HTMLElement): void {
    host.append(
      el('p', {
        class: 'tray__hint',
        text: 'Locking encrypts this letter on this device. There is no way to recover a forgotten password.',
      }),
      lockPanel.element,
      historyPanel.element,
      signaturePanel.element,
    );
  }

  function renderLockState(): void {
    const locked = isLetterLocked(letter);
    element.dataset.locked = locked ? 'true' : 'false';
    page.setReadOnly(locked);
  }

  /* ---------------------------- Stationery ---------------------------- */

  function buildStationeryTray(host: HTMLElement): void {
    host.append(el('p', { class: 'tray__hint', text: 'Changing the design never changes your words.' }));

    const themeRow = el('div', { class: 'swatch-row', role: 'radiogroup', 'aria-label': 'Colour theme' });
    for (const theme of THEMES) {
      const swatch = el('button', {
        type: 'button',
        class: `swatch${theme.id === letter.themeId ? ' swatch--active' : ''}`,
        'aria-label': `${theme.name}. ${theme.mood}`,
        title: theme.name,
        role: 'radio',
        'aria-checked': theme.id === letter.themeId ? 'true' : 'false',
      });
      swatch.style.setProperty('--a', theme.palette.primary);
      swatch.style.setProperty('--b', theme.palette.accent);
      swatch.style.setProperty('--c', theme.palette.paper);
      swatch.addEventListener('click', () => {
        applyTheme(getTheme(theme.id));
        applyLetter({ themeId: theme.id }, `${theme.name} theme`);
        setPreferences({ lastThemeId: theme.id });
        buildStationeryTray(host);
      });
      themeRow.append(swatch);
    }
    host.append(el('h3', { class: 'tray__subtitle', text: 'Colour' }), themeRow);

    host.append(el('h3', { class: 'tray__subtitle', text: 'Template' }));
    const grid = el('div', { class: 'template-grid template-grid--compact' });
    for (const category of TEMPLATE_CATEGORIES) {
      const group = el('div', { class: 'template-group' });
      group.append(el('h4', { class: 'template-group__title', text: category.name }));
      const row = el('div', { class: 'template-row' });
      for (const template of TEMPLATES.filter((item) => item.category === category.id)) {
        row.append(templateChip(template.id, template.name));
      }
      group.append(row);
      grid.append(group);
    }
    host.append(grid);

    host.append(el('h3', { class: 'tray__subtitle', text: 'Paper size' }));
    const sizes = el('div', { class: 'chip-row' });
    for (const [id, size] of Object.entries(PAGE_SIZES)) {
      const chip = el('button', {
        type: 'button',
        class: `chip${letter.paperSize === id ? ' chip--active' : ''}`,
        text: size.name,
      });
      chip.addEventListener('click', () => {
        applyLetter({ paperSize: id }, `${size.name} paper`);
        buildStationeryTray(host);
      });
      sizes.append(chip);
    }
    host.append(sizes);
  }

  function templateChip(id: string, name: string): HTMLElement {
    const chip = el('button', {
      type: 'button',
      class: `chip chip--template${letter.templateId === id ? ' chip--active' : ''}`,
      text: name,
    });
    chip.addEventListener('click', () => {
      const template = getTemplate(id);
      if (!template) return;
      applyLetter(
        {
          templateId: id,
          themeId: template.themeId,
          paperSize: template.paperSize,
          typography: {
            ...letter.typography,
            family: template.typography.bodyFont,
            sizePt: template.typography.sizePt,
            lineHeight: template.typography.lineHeight,
            align: template.typography.align === 'justify' ? 'justify' : 'left',
            colour: getTheme(template.themeId).palette.paperInk,
          },
        },
        `${template.name} template`,
      );
      applyTheme(getTheme(template.themeId));
      toast(`${template.name}. Your writing is untouched.`, 'success');
    });
    return chip;
  }

  /* ----------------------------- Stickers ----------------------------- */

  function buildStickerTray(host: HTMLElement): void {
    const search = el('input', {
      type: 'search',
      class: 'input',
      placeholder: 'Search stickers',
      'aria-label': 'Search stickers',
    }) as HTMLInputElement;

    const categoryRow = el('div', { class: 'chip-row chip-row--scroll' });
    const results = el('div', { class: 'sticker-grid' });
    let category = STICKER_CATEGORIES[0]!.id;

    const paint = (items: Sticker[]): void => {
      clear(results);
      if (items.length === 0) {
        results.append(el('p', { class: 'tray__hint', text: 'No stickers match that.' }));
        return;
      }
      for (const sticker of items.slice(0, 120)) {
        const button = el('button', {
          type: 'button',
          class: 'sticker-button',
          'aria-label': `Add ${sticker.name}`,
          title: sticker.name,
        });
        const art = renderSticker(sticker.id);
        if (art) button.append(art);
        button.addEventListener('click', () => addSticker(sticker));
        results.append(button);
      }
    };

    for (const item of STICKER_CATEGORIES) {
      const chip = el('button', {
        type: 'button',
        class: `chip${item.id === category ? ' chip--active' : ''}`,
        text: item.name,
      });
      chip.addEventListener('click', () => {
        category = item.id;
        for (const other of categoryRow.children) other.classList.remove('chip--active');
        chip.classList.add('chip--active');
        paint(stickersInCategory(category));
      });
      categoryRow.append(chip);
    }

    search.addEventListener('input', () => {
      const query = search.value.trim();
      paint(query.length > 0 ? searchStickers(query) : stickersInCategory(category));
    });

    const upload = el('input', {
      type: 'file',
      class: 'input input--file',
      accept: 'image/png,image/jpeg,image/webp',
      'aria-label': 'Upload your own sticker',
    }) as HTMLInputElement;
    upload.addEventListener('change', () => {
      const file = upload.files?.[0];
      upload.value = '';
      if (file) void addCustomSticker(file);
    });

    host.append(
      el('p', { class: 'tray__hint', text: 'Tap a sticker to place it, then drag it anywhere on the page.' }),
      search,
      categoryRow,
      results,
      el('h3', { class: 'tray__subtitle', text: 'Your own stickers' }),
      upload,
      el('p', {
        class: 'tray__hint',
        text: 'PNG, JPEG or WebP. Files are checked by their contents and converted locally. SVG is refused, because it can carry scripts.',
      }),
      decorationTools,
    );

    paint(stickersInCategory(category));
  }

  /** A spot on the paper the writer can actually see, with a little scatter. */
  function dropPoint(sizeMm: number): { xMm: number; yMm: number } {
    const centre = page.visibleCentreMm();
    const half = sizeMm / 2;
    const maxX = page.pageGeometry.widthMm - half;
    const maxY = page.totalHeightMm - half;
    return {
      xMm: Math.min(maxX, Math.max(half, centre.xMm + (Math.random() * 40 - 20))),
      yMm: Math.min(maxY, Math.max(half, centre.yMm + (Math.random() * 40 - 20))),
    };
  }

  function addSticker(sticker: Sticker): void {
    const doc = cloneDocument(history.document);
    const spot = dropPoint(sticker.sizeMm);
    const decoration: StickerDecoration = {
      id: createId('dec'),
      kind: 'sticker',
      stickerId: sticker.id,
      colours: [],
      page: 0,
      xMm: spot.xMm,
      yMm: spot.yMm,
      widthMm: sticker.sizeMm,
      heightMm: sticker.sizeMm,
      rotation: Math.round((Math.random() * 20 - 10) / 5) * 5,
      opacity: 1,
      flipped: false,
      locked: false,
      layer: 5,
    };
    doc.decorations.push(decoration);
    applyDoc(doc, `add ${sticker.name}`);
    page.render(doc);
    decorations.select(decoration.id);
    announce(`${sticker.name} placed. Drag to move it, or use the arrow keys.`);
  }

  async function addCustomSticker(file: File): Promise<void> {
    try {
      const attachment = await processImage(file, {
        letterId: letter.id,
        fileName: file.name,
        role: 'signature',
      });
      await putAttachment(attachment);
      attachments = await getAttachmentsForLetter(letter.id);
      refreshUrls();

      const doc = cloneDocument(history.document);
      const spot = dropPoint(30);
      doc.decorations.push({
        id: createId('dec'),
        kind: 'sticker',
        stickerId: `custom:${attachment.id}`,
        colours: [],
        page: 0,
        xMm: spot.xMm,
        yMm: spot.yMm,
        widthMm: 30,
        heightMm: 30 * (attachment.height / Math.max(1, attachment.width)),
        rotation: 0,
        opacity: 1,
        flipped: false,
        locked: false,
        layer: 5,
      });
      setLetter({ ...letter, attachments: attachments.map(toMeta) }, false);
      applyDoc(doc, 'add your sticker');
      page.render(doc);
      toast('Sticker added, converted safely on this device.', 'success');
    } catch (error) {
      toast(error instanceof ImageError ? error.message : `That sticker could not be added: ${describe(error)}`, 'error');
    }
  }

  /* ------------------------ Decoration controls ----------------------- */

  const decorationTools = el('div', { class: 'deco-tools', hidden: true });

  function renderDecorationTools(hasSelection: boolean): void {
    decorationTools.hidden = !hasSelection;
    clear(decorationTools);
    const selected = decorations.selected;
    if (!selected) return;

    decorationTools.append(el('h3', { class: 'tray__subtitle', text: 'Selected decoration' }));
    const row = el('div', { class: 'chip-row' });
    const action = (label: string, run: () => void): void => {
      const button = el('button', { type: 'button', class: 'chip', text: label });
      button.addEventListener('click', run);
      row.append(button);
    };

    action('Flip', () => decorations.flip(selected.id));
    action('Duplicate', () => decorations.duplicate(selected.id));
    action('Behind text', () => decorations.sendBehindText(selected.id));
    action('Bring to front', () => decorations.bringToFront(selected.id));
    action(selected.locked ? 'Unlock' : 'Lock', () => decorations.toggleLock(selected.id));
    action('Delete', () => decorations.remove(selected.id));
    decorationTools.append(row);

    const opacity = el('input', {
      type: 'range',
      class: 'input input--range',
      min: '0.05',
      max: '1',
      step: '0.05',
      value: String(selected.opacity),
      'aria-label': 'Decoration opacity',
    }) as HTMLInputElement;
    opacity.addEventListener('input', () => decorations.setOpacity(selected.id, Number(opacity.value)));
    decorationTools.append(el('label', { class: 'label', text: 'Opacity' }), opacity);
  }

  /* ------------------------------ Photos ------------------------------ */

  function buildPhotoTray(host: HTMLElement): void {
    const input = el('input', {
      type: 'file',
      class: 'input input--file',
      accept: 'image/png,image/jpeg,image/webp',
      multiple: true,
      'aria-label': 'Add photographs',
    }) as HTMLInputElement;
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      input.value = '';
      if (files.length > 0) void addPhotos(files);
    });

    const list = el('div', { class: 'photo-tray' });
    for (const attachment of attachments.filter((item) => item.role === 'photo')) {
      const card = el('div', { class: 'photo-tray__item' });
      const url = photoUrls.get(attachment.id);
      if (url) card.append(el('img', { src: url, alt: attachment.caption || 'Photograph', loading: 'lazy' }));

      const place = el('button', { type: 'button', class: 'chip chip--small', text: 'Place in letter' });
      place.addEventListener('click', () => insertPhotoBlock(attachment.id));

      const remove = el('button', { type: 'button', class: 'chip chip--small chip--danger', text: 'Remove' });
      remove.addEventListener('click', () => void removePhoto(attachment.id));

      card.append(el('div', { class: 'photo-tray__actions' }, [place, remove]));
      list.append(card);
    }

    host.append(
      el('p', { class: 'tray__hint', text: 'Photographs are processed on this device and never uploaded.' }),
      input,
      list,
    );
  }

  async function addPhotos(files: File[]): Promise<void> {
    let added = 0;
    for (const file of files) {
      try {
        const attachment = await processImage(file, { letterId: letter.id, fileName: file.name, role: 'photo' });
        await putAttachment(attachment);
        added += 1;
      } catch (error) {
        toast(error instanceof ImageError ? error.message : `That image could not be added: ${describe(error)}`, 'error');
      }
    }
    if (added === 0) return;
    attachments = await getAttachmentsForLetter(letter.id);
    refreshUrls();
    setLetter({ ...letter, attachments: attachments.map(toMeta) }, false);
    autosave.queue(letter);
    if (openTrayId === 'photos') openTray('photos', 'Photos', buildPhotoTray);
    toast(`${added} ${added === 1 ? 'photograph' : 'photographs'} ready to place.`, 'success');
  }

  function insertPhotoBlock(attachmentId: string): void {
    const template = getTemplate(letter.templateId);
    const doc = cloneDocument(history.document);
    const block: Block = {
      id: createId('blk'),
      type: 'photo',
      attachmentId,
      frame: template?.photoStyle === 'plain' ? 'plain' : (template?.photoStyle ?? 'plain'),
      float: 'centre',
      width: 0.7,
      caption: '',
      note: '',
      monochrome: false,
      printBrightness: 0,
      rotation: 0,
      tape: template?.photoStyle === 'scrapbook',
    };
    const activeId = activeBlockId();
    const index = activeId ? doc.blocks.findIndex((item) => item.id === activeId) : -1;
    doc.blocks.splice(index >= 0 ? index + 1 : doc.blocks.length - 2, 0, block);
    applyDoc(doc, 'add photograph');
    page.render(doc);
    announce('Photograph placed in the letter.');
  }

  async function removePhoto(attachmentId: string): Promise<void> {
    await deleteAttachment(attachmentId);
    attachments = await getAttachmentsForLetter(letter.id);
    refreshUrls();
    const doc = cloneDocument(history.document);
    doc.blocks = doc.blocks.filter((block) => !(block.type === 'photo' && block.attachmentId === attachmentId));
    setLetter({ ...letter, attachments: attachments.map(toMeta) }, false);
    applyDoc(doc, 'remove photograph');
    page.render(doc);
    if (openTrayId === 'photos') openTray('photos', 'Photos', buildPhotoTray);
  }

  /* ------------------------------- Type ------------------------------- */

  function buildTypeTray(host: HTMLElement): void {
    const size = el('input', {
      type: 'range',
      class: 'input input--range',
      min: '9',
      max: '18',
      step: '0.5',
      value: String(letter.typography.sizePt),
      'aria-label': 'Text size in points',
    }) as HTMLInputElement;
    size.addEventListener('input', () => {
      applyLetter(
        { typography: { ...letter.typography, sizePt: Number(size.value) } },
        `${size.value} point text`,
      );
    });

    const leading = el('input', {
      type: 'range',
      class: 'input input--range',
      min: '1.2',
      max: '2.2',
      step: '0.05',
      value: String(letter.typography.lineHeight),
      'aria-label': 'Line spacing',
    }) as HTMLInputElement;
    leading.addEventListener('input', () => {
      applyLetter(
        { typography: { ...letter.typography, lineHeight: Number(leading.value) } },
        'line spacing',
      );
    });

    const ink = el('input', {
      type: 'color',
      class: 'input input--colour',
      value: letter.typography.colour,
      'aria-label': 'Ink colour',
    }) as HTMLInputElement;
    ink.addEventListener('input', () => {
      applyLetter({ typography: { ...letter.typography, colour: ink.value } }, 'ink colour');
    });

    const zoom = el('div', { class: 'chip-row' });
    for (const [label, value] of [['Fit width', 0], ['Actual size', 1], ['Writing zoom', 1.25]] as const) {
      const chip = el('button', { type: 'button', class: 'chip', text: label });
      chip.addEventListener('click', () => {
        followWidth = value === 0;
        if (value === 0) fitWidth();
        else page.setZoom(value);
        announce(`${label}.`);
      });
      zoom.append(chip);
    }

    host.append(
      el('label', { class: 'label', text: 'Text size' }),
      size,
      el('label', { class: 'label', text: 'Line spacing' }),
      leading,
      el('label', { class: 'label', text: 'Ink colour' }),
      ink,
      el('h3', { class: 'tray__subtitle', text: 'Page zoom' }),
      zoom,
    );
  }

  /** True while the page should keep filling the width as the window changes. */
  let followWidth = true;

  function fitWidth(): void {
    // The holder is sized to the *scaled* page, so measure its parent instead.
    const available = page.element.parentElement?.clientWidth || page.element.clientWidth || 800;
    const widthPx = (page.pageGeometry.widthMm / 25.4) * 96;
    page.setZoom(Math.min(1.4, Math.max(0.2, (available - 16) / widthPx)));
  }

  /* ----------------------------- Envelope ----------------------------- */

  function buildEnvelopeTray(host: HTMLElement): void {
    const field = (label: string, value: string, onInput: (value: string) => void, multiline = false): HTMLElement => {
      const id = `env-${label.toLowerCase().replace(/\s+/g, '-')}`;
      const input = (multiline
        ? el('textarea', { class: 'input input--multiline', id, rows: '3' })
        : el('input', { type: 'text', class: 'input', id })) as HTMLInputElement | HTMLTextAreaElement;
      input.value = value;
      input.addEventListener('input', () => onInput(input.value));
      return el('div', { class: 'field' }, [el('label', { class: 'label', for: id, text: label }), input]);
    };

    host.append(
      el('p', { class: 'tray__hint', text: 'Addresses stay on this device, and are encrypted when a letter is locked.' }),
      field('Recipient name', letter.envelope.recipientName, (value) =>
        applyLetter({ envelope: { ...letter.envelope, recipientName: value, enabled: true } }, 'envelope'),
      ),
      field('Recipient address', letter.envelope.recipientAddress, (value) =>
        applyLetter({ envelope: { ...letter.envelope, recipientAddress: value, enabled: true } }, 'envelope'),
        true,
      ),
      field('Your name', letter.envelope.senderName, (value) =>
        applyLetter({ envelope: { ...letter.envelope, senderName: value } }, 'envelope'),
      ),
      field('Your address', letter.envelope.senderAddress, (value) =>
        applyLetter({ envelope: { ...letter.envelope, senderAddress: value } }, 'envelope'),
        true,
      ),
    );

    const seals = el('div', { class: 'chip-row' });
    for (const seal of ['none', 'wax', 'sticker', 'ribbon'] as const) {
      const chip = el('button', {
        type: 'button',
        class: `chip${letter.envelope.sealStyle === seal ? ' chip--active' : ''}`,
        text: seal === 'none' ? 'No seal' : seal[0]!.toUpperCase() + seal.slice(1),
      });
      chip.addEventListener('click', () => {
        applyLetter({ envelope: { ...letter.envelope, sealStyle: seal } }, 'envelope seal');
        buildEnvelopeTray(host);
      });
      seals.append(chip);
    }
    host.append(el('h3', { class: 'tray__subtitle', text: 'Seal' }), seals);
  }

  /* ------------------------------ Export ------------------------------ */

  function buildExportTray(host: HTMLElement): void {
    host.append(
      el('p', { class: 'tray__hint', text: 'Every export is made on this device.' }),
      // Said plainly, because a file that quietly differs from the page is the
      // sort of surprise that ruins a letter you only print once.
      el('p', {
        class: 'tray__hint',
        text:
          'Print gives you the page exactly as it looks here, with the stickers and the layout, ' +
          'and your printer’s “Save as PDF” keeps the text selectable. ' +
          'The PDF and PNG buttons below still use the older plain layout: the words are right, ' +
          'but headings, stickers and paper designs are not carried across yet.',
      }),
    );
    const row = el('div', { class: 'chip-row' });

    const add = (label: string, run: () => Promise<void>): void => {
      const button = el('button', { type: 'button', class: 'chip', text: label });
      button.addEventListener('click', () => {
        button.disabled = true;
        void run()
          .catch((error: unknown) => toast(`Export failed: ${describe(error)}`, 'error'))
          .finally(() => {
            button.disabled = false;
          });
      });
      row.append(button);
    };

    add('PDF', async () => {
      await flush();
      const api = await import('../export/index');
      const result = await api.exportPdf(letter, attachments, {
        paperId: letter.paperSize,
        includePhotographs: true,
        showPageNumbers: true,
        dpi: 300,
      });
      toast(`Saved ${result.fileName}.`, 'success');
    });

    add('PNG pages', async () => {
      await flush();
      const api = await import('../export/index');
      const results = await api.exportImages(letter, attachments, 'image/png', {
        paperId: letter.paperSize,
        includePhotographs: true,
        showPageNumbers: true,
        dpi: 300,
      });
      toast(`Saved ${results.length} ${results.length === 1 ? 'image' : 'images'}.`, 'success');
    });

    add('Plain text', async () => {
      await flush();
      const api = await import('../export/index');
      toast(`Saved ${api.exportPlainText(letter).fileName}.`, 'success');
    });

    add('HTML letter', async () => {
      await flush();
      const api = await import('../export/index');
      const result = await api.exportHtml(letter, attachments);
      toast(`Saved ${result.fileName}.`, 'success');
    });

    add('Backup (.dearly)', async () => {
      await flush();
      const api = await import('../export/index');
      const result = await api.exportLetterArchive(letter, attachments);
      toast(`Saved ${result.fileName}.`, 'success');
    });

    host.append(row);

    const danger = el('button', { type: 'button', class: 'chip chip--danger', text: 'Delete this letter' });
    danger.addEventListener('click', () => void removeLetter());
    host.append(el('h3', { class: 'tray__subtitle', text: 'Danger' }), danger);
  }

  /* ------------------------------------------------------------------ */
  /* Commands and actions                                                */
  /* ------------------------------------------------------------------ */

  function runCommand(command: SlashCommand): void {
    const doc = cloneDocument(history.document);
    const activeId = activeBlockId();
    const index = activeId ? doc.blocks.findIndex((block) => block.id === activeId) : doc.blocks.length - 1;
    let at = Math.max(0, index);

    // The "/query" the writer typed is the command, not part of the letter.
    const host = doc.blocks[at];
    if (host && 'inlines' in host) {
      const text = host.inlines.map((inline) => inline.text).join('');
      const trimmed = text.replace(/\/[\p{L}-]*\s*$/u, '');
      if (trimmed !== text) {
        if (trimmed.trim().length === 0 && doc.blocks.length > 1) {
          // The line held nothing but the command: the new block takes its place.
          doc.blocks.splice(at, 1);
          at = Math.max(0, at - 1);
        } else {
          host.inlines = [{ text: trimmed, marks: [] }];
        }
      }
    }

    const insert = (block: Block): void => {
      doc.blocks.splice(at + 1, 0, block);
    };

    switch (command.id) {
      case 'heading':
        insert(textBlock('heading', ''));
        break;
      case 'quote':
        insert(textBlock('quote', ''));
        break;
      case 'list':
      case 'numbered':
        insert({ id: createId('blk'), type: 'list', ordered: command.id === 'numbered', items: [[]] });
        break;
      case 'divider':
        insert({ id: createId('blk'), type: 'divider' });
        break;
      case 'page-break':
        insert({ id: createId('blk'), type: 'page-break' });
        break;
      case 'postscript':
        insert(textBlock('postscript', 'PS. '));
        break;
      case 'signature':
        insert(textBlock('signature', letter.sender || ''));
        break;
      case 'secret':
        insert(textBlock('secret', ''));
        break;
      case 'date':
        insert(textBlock('meta', new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date())));
        break;
      case 'location':
        insert(textBlock('meta', letter.senderLocation || ''));
        break;
      case 'photo':
      case 'photo-strip':
        openTray('photos', 'Photos', buildPhotoTray);
        return;
      case 'sticker':
        openTray('stickers', 'Stickers', buildStickerTray);
        return;
      case 'speech':
      case 'memory':
        insert(textBlock('quote', ''));
        break;
      default:
        return;
    }

    applyDoc(doc, command.name);
    page.render(doc);
    page.focusBlock(at + 1, true);
  }

  async function doPrint(): Promise<void> {
    try {
      await flush();
      const { printLetter } = await import('../printing/print-controller');
      const outcome = await printLetter(letter, attachments, {
        scope: 'letter',
        paperId: letter.paperSize === 'a6' || letter.paperSize === 'square' || letter.paperSize === 'postcard' ? 'a5' : letter.paperSize,
        showPageNumbers: true,
        showFoldGuides: false,
        showCutGuides: false,
        includePhotographs: true,
        duplex: false,
        envelopeTarget: 'sheet',
      });
      announce(`Sent ${outcome.pages} ${outcome.pages === 1 ? 'page' : 'pages'} to the printer.`);
      const updated = await putLetter({
        ...letter,
        printCount: letter.printCount + 1,
        printedAt: new Date().toISOString(),
        status: letter.status === 'draft' ? 'printed' : letter.status,
      });
      setLetter(updated, false);
    } catch (error) {
      toast(`Printing failed: ${describe(error)}`, 'error');
    }
  }

  async function removeLetter(): Promise<void> {
    const confirmed = await confirmDialog({
      title: 'Delete this letter?',
      body: ['The letter, its photographs and its saved versions will be removed from this device.', 'This cannot be undone.'],
      confirmLabel: 'Delete for ever',
      danger: true,
    });
    if (!confirmed) return;
    autosave.dispose();
    await deleteLetter(letter.id);
    toast('The letter was deleted.', 'success');
    navigate({ name: 'library', id: null });
  }

  async function flush(): Promise<void> {
    page.flush();
    await autosave.flush();
  }

  function renderStatus(state: SaveStatus): void {
    status.textContent = state.state === 'saved' && state.at
      ? `${state.message} · ${formatRelative(state.at)}`
      : state.message;
    status.dataset.state = state.state;
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard                                                            */
  /* ------------------------------------------------------------------ */

  // Capture, so the insert menu sees Enter before the page turns it into a new
  // paragraph. Otherwise the command would run against the wrong line and leave
  // the "/query" behind in the letter.
  disposables.listen(
    document,
    'keydown',
    (event) => {
      const keyboard = event as KeyboardEvent;
      if (slashMenu.handleKey(keyboard)) {
        keyboard.preventDefault();
        keyboard.stopPropagation();
      }
    },
    { capture: true },
  );

  disposables.listen(document, 'keydown', (event) => {
    const keyboard = event as KeyboardEvent;
    if (!(keyboard.ctrlKey || keyboard.metaKey)) return;
    const key = keyboard.key.toLowerCase();
    if (key === 's') {
      keyboard.preventDefault();
      void flush().then(() => announce('Saved locally.'));
    }
    if (key === 'p') {
      keyboard.preventDefault();
      void doPrint();
    }
    if (key === 'z' && !keyboard.shiftKey) {
      keyboard.preventDefault();
      undoButton.click();
    }
    if ((key === 'z' && keyboard.shiftKey) || key === 'y') {
      keyboard.preventDefault();
      redoButton.click();
    }
  });

  // `/` on an empty line opens the insert menu.
  disposables.listen(page.flowElement, 'keyup', (event) => {
    const keyboard = event as KeyboardEvent;
    if (!getPreferences().slashCommands) return;
    if (keyboard.key !== '/') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    slashMenu.show({ left: rect.left, top: rect.bottom + 6 });
  });

  disposables.listen(page.flowElement, 'click', () => {
    decorations.select(null);
  });

  /* ------------------------------------------------------------------ */
  /* Assemble                                                            */
  /* ------------------------------------------------------------------ */

  const stage = el('div', { class: 'desk__stage' }, [page.element]);

  element.append(
    heading,
    topBar,
    el('div', { class: 'desk__meta' }, [status, pageCounter, cheer]),
    stage,
    tray,
    dock,
    toolbar.element,
    slashMenu.element,
    decorations.handlesElement,
  );

  page.setDesign(letter);
  page.render(history.document);
  // The count only fires on a change, so state the starting page count too.
  pageCounter.textContent = '1 page';
  renderStatus(autosave.currentStatus);
  updateMeta();
  // Fit once the sheet has really been laid out, then keep fitting when the
  // window changes — a phone turned on its side must not clip the paper.
  requestAnimationFrame(() => fitWidth());
  window.setTimeout(() => fitWidth(), 120);
  disposables.listen(window, 'resize', () => {
    if (followWidth) fitWidth();
  });
  disposables.listen(window, 'orientationchange', () => {
    if (followWidth) fitWidth();
  });
  setPreferences({ lastSection: 'write' });
  focusHeading(element);

  renderLockState();
  if (isLetterLocked(letter)) {
    // Ask for the password straight away rather than showing a page that
    // cannot be read and offering no way in.
    void lockPanel.promptUnlock().then((unlocked) => {
      if (unlocked) return;
      toast('This letter stays locked. Open Keeping to try the password again.', 'warning');
      openTray('keep', 'Keeping', buildKeepingTray);
    });
  }

  return {
    element,
    dispose(): void {
      page.dispose();
      urls.dispose();
      disposables.dispose();
      clear(element);
    },
    hasUnsavedChanges: () => autosave.hasUnsavedChanges,
    flush,
  };
}

function iconChip(label: string, symbol: string, run: () => void): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    class: 'chip chip--icon',
    'aria-label': label,
    title: label,
    text: symbol,
  });
  button.addEventListener('click', run);
  return button;
}

function missingLetterView(disposables: Disposables): DeskView {
  const element = el('section', { class: 'view' });
  element.append(
    el('h1', { class: 'view__title', text: 'That letter is not on this device' }),
    el('p', {
      class: 'view__intro',
      text: 'Letters live in the browser they were written in. If you have a backup, restore it from Settings.',
    }),
    el('a', { class: 'button button--primary', href: '#/home', text: 'Back to the desk' }),
  );
  return {
    element,
    dispose: () => disposables.dispose(),
    hasUnsavedChanges: () => false,
    flush: async () => undefined,
  };
}
