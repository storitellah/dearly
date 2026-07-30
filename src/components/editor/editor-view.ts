/**
 * The writing view.
 *
 * Assembles the letter fields, the writing area, the panels and the preview, and
 * owns the autosave loop. Nothing here writes to storage directly: every change
 * goes through `EditorContext`, which queues a save and reports its state.
 */

import { el, clear } from '../utilities/dom';
import { navigate } from '../ui/router';
import { getLetter, putLetter, deleteLetter } from '../storage/letters-repo';
import { getAttachmentsForLetter } from '../storage/attachments-repo';
import { saveSnapshot, latestSnapshot } from '../storage/snapshots';
import {
  LETTER_CATEGORIES,
  LETTER_STATUSES,
  isLetterLocked,
  type LetterCategory,
  type LetterRecord,
  type LetterStatus,
} from '../storage/schema';
import { setPreferences } from '../storage/preferences';
import { Autosave, guardUnload, type SaveStatus } from './autosave';
import { EditorContext } from './context';
import { createPaperPanel } from './paper-panel';
import { createEnvelopePanel } from './envelope-panel';
import { createPhotoPanel } from './photo-panel';
import { createSignaturePanel } from './signature-panel';
import { createPreviewPanel } from './preview-panel';
import { createExportPanel } from './export-panel';
import { createHistoryPanel } from './history-panel';
import { createLockPanel } from './lock-panel';
import { createAiAssistPanel } from './ai-assist';
import { nextPrompt } from '../prompts/prompt-library';
import { formatRelative, readingMinutes, wordCount } from '../utilities/format';
import { confirmDialog } from '../accessibility/dialog';
import { announce } from '../accessibility/announce';
import { focusHeading } from '../accessibility/focus';
import { toast } from '../ui/toast';
import { Disposables, describe } from '../utilities/events';

export interface EditorView {
  element: HTMLElement;
  dispose(): void;
  hasUnsavedChanges(): boolean;
  flush(): Promise<void>;
}

const CATEGORY_LABELS: Record<LetterCategory, string> = {
  love: 'Love',
  family: 'Family',
  friendship: 'Friendship',
  gratitude: 'Gratitude',
  apology: 'Apology',
  milestone: 'Milestone',
  'future-self': 'To my future self',
  farewell: 'Farewell',
  everyday: 'Everyday',
  other: 'Other',
};

const STATUS_LABELS: Record<LetterStatus, string> = {
  draft: 'Draft',
  ready: 'Ready to send',
  printed: 'Printed',
  sent: 'Sent',
  kept: 'Kept',
  archived: 'Archived',
};

export async function createEditorView(letterId: string): Promise<EditorView> {
  const disposables = new Disposables();

  const loaded = await getLetter(letterId);
  if (!loaded) {
    const missing = el('section', { class: 'view view--editor' });
    missing.append(
      el('h1', { class: 'view__title', text: 'That letter is not on this device' }),
      el('p', {
        class: 'view__intro',
        text:
          'Letters are stored locally, so a link to one only works in the browser it was written in. ' +
          'If you have a backup file, restore it from Settings.',
      }),
    );
    const back = el('a', { class: 'button button--primary', href: '#/library', text: 'Back to your memory box' });
    missing.append(back);
    return {
      element: missing,
      dispose: () => disposables.dispose(),
      hasUnsavedChanges: () => false,
      flush: async () => undefined,
    };
  }

  const attachments = await getAttachmentsForLetter(loaded.id);

  const autosave = new Autosave({
    save: async (letter) => putLetter(letter),
    snapshot: (letter) => saveSnapshot(letter, 'autosave'),
    onStatus: (status) => renderStatus(status),
    delayMs: 800,
  });
  const context = new EditorContext(loaded, attachments, autosave);
  disposables.add(() => autosave.dispose());
  disposables.add(guardUnload(autosave));

  /* Header ---------------------------------------------------------------- */

  const element = el('section', { class: 'view view--editor', 'aria-labelledby': 'editor-title' });

  const titleInput = el('input', {
    type: 'text',
    class: 'input input--title',
    id: 'letter-title',
    placeholder: 'Untitled letter',
    autocomplete: 'off',
  }) as HTMLInputElement;

  const status = el('p', { class: 'save-status', role: 'status', 'aria-live': 'polite' });
  const statusDetail = el('p', { class: 'save-status__detail', hidden: true });

  const heading = el('h1', { class: 'view__title', id: 'editor-title', text: 'Write' });

  const backLink = el('a', { class: 'button button--quiet button--small', href: '#/library', text: '← Memory box' });

  const deleteButton = el('button', {
    type: 'button',
    class: 'button button--danger button--small',
    text: 'Delete letter',
  });
  deleteButton.addEventListener('click', () => void removeLetter());

  /* Fields ---------------------------------------------------------------- */

  const recipient = textField('letter-recipient', 'To', 'Who is this letter for?');
  const sender = textField('letter-sender', 'From', 'Your name');
  const place = textField('letter-place', 'Written in', 'Town or city');
  const dateWritten = dateField('letter-date', 'Date written');
  const sendingDate = dateField('letter-sending', 'Planned sending date (optional)');
  const openingDate = dateField('letter-opening', 'To be opened on (optional)');

  const categorySelect = el('select', { class: 'input', id: 'letter-category' }) as HTMLSelectElement;
  for (const category of LETTER_CATEGORIES) {
    categorySelect.append(el('option', { value: category, text: CATEGORY_LABELS[category] }));
  }

  const statusSelect = el('select', { class: 'input', id: 'letter-status' }) as HTMLSelectElement;
  for (const value of LETTER_STATUSES) {
    statusSelect.append(el('option', { value, text: STATUS_LABELS[value] }));
  }

  const tagsInput = el('input', {
    type: 'text',
    class: 'input',
    id: 'letter-tags',
    placeholder: 'Comma-separated, e.g. birthday, grandma',
    autocomplete: 'off',
  }) as HTMLInputElement;

  const sealedInput = el('input', { type: 'checkbox', class: 'checkbox', id: 'letter-sealed' }) as HTMLInputElement;

  const details = el('details', { class: 'panel', open: true });
  details.append(el('summary', { class: 'panel__summary', text: 'The letter’s details' }));
  details.append(
    el('div', { class: 'panel__body' }, [
      el('div', { class: 'field-grid' }, [
        recipient.field,
        sender.field,
        place.field,
        dateWritten.field,
        sendingDate.field,
        openingDate.field,
        fieldWrap('letter-category', 'Occasion', categorySelect),
        fieldWrap('letter-status', 'Status', statusSelect),
        fieldWrap('letter-tags', 'Tags', tagsInput),
      ]),
      el('div', { class: 'field field--checkbox' }, [
        sealedInput,
        el('label', { class: 'label', for: 'letter-sealed', text: 'Mark as sealed (finished and not to be edited)' }),
      ]),
    ]),
  );

  /* Writing area ---------------------------------------------------------- */

  const bodyInput = el('textarea', {
    class: 'input writing-area',
    id: 'letter-body',
    rows: '18',
    spellcheck: 'true',
    placeholder: 'Dear …',
    'aria-describedby': 'writing-meta',
  }) as HTMLTextAreaElement;

  const writingMeta = el('p', { class: 'writing-meta', id: 'writing-meta', role: 'status' });

  const promptText = el('p', { class: 'prompt__text' });
  let currentPromptId: string | null = null;
  const promptButton = el('button', {
    type: 'button',
    class: 'button button--quiet button--small',
    text: 'Another prompt',
  });
  promptButton.addEventListener('click', () => showPrompt());

  const promptUse = el('button', {
    type: 'button',
    class: 'button button--quiet button--small',
    text: 'Write about this',
  });
  promptUse.addEventListener('click', () => {
    const prompt = promptText.textContent ?? '';
    if (prompt.length === 0) return;
    const separator = bodyInput.value.trim().length === 0 ? '' : '\n\n';
    bodyInput.value = `${bodyInput.value}${separator}`;
    bodyInput.focus();
    const position = bodyInput.value.length;
    bodyInput.setSelectionRange(position, position);
    pushBody();
    announce('Prompt kept in mind. Write your own words below.');
  });

  const promptBlock = el('aside', { class: 'prompt', 'aria-label': 'Writing prompt' }, [
    el('h2', { class: 'prompt__heading', text: 'If you are stuck' }),
    promptText,
    el('div', { class: 'button-row' }, [promptUse, promptButton]),
  ]);

  function showPrompt(): void {
    const prompt = nextPrompt(context.letter.category, currentPromptId);
    currentPromptId = prompt.id;
    promptText.textContent = prompt.text;
  }
  showPrompt();

  /* Panels ---------------------------------------------------------------- */

  const paperPanel = createPaperPanel(context);
  const envelopePanel = createEnvelopePanel(context);
  const photoPanel = createPhotoPanel(context);
  disposables.add(() => photoPanel.dispose());
  const signaturePanel = createSignaturePanel(context);
  disposables.add(() => signaturePanel.dispose());
  const exportPanel = createExportPanel(context);
  const historyPanel = createHistoryPanel(context);
  const lockPanel = createLockPanel(context);
  const assistPanel = createAiAssistPanel(context, () => {
    const start = bodyInput.selectionStart ?? 0;
    const end = bodyInput.selectionEnd ?? 0;
    if (end > start) return { text: bodyInput.value.slice(start, end), whole: false };
    return { text: bodyInput.value, whole: true };
  });

  const previewPanel = createPreviewPanel(context);
  disposables.add(() => previewPanel.dispose());

  const lockedNotice = el('p', { class: 'locked-notice', hidden: true });

  element.append(
    el('div', { class: 'view__header' }, [
      el('div', { class: 'view__header-main' }, [
        heading,
        el('div', { class: 'field' }, [
          el('label', { class: 'label', for: 'letter-title', text: 'Title (for your memory box)' }),
          titleInput,
        ]),
        status,
        statusDetail,
      ]),
      el('div', { class: 'view__actions' }, [backLink, deleteButton]),
    ]),
    lockedNotice,
    el('div', { class: 'editor-grid' }, [
      el('div', { class: 'editor-grid__main' }, [
        details,
        el('div', { class: 'field' }, [
          el('label', { class: 'label', for: 'letter-body', text: 'Your letter' }),
          bodyInput,
          writingMeta,
        ]),
        promptBlock,
        paperPanel,
        envelopePanel,
        photoPanel.element,
        signaturePanel.element,
        assistPanel.element,
        exportPanel.element,
        historyPanel.element,
        lockPanel.element,
      ]),
      el('div', { class: 'editor-grid__side' }, [previewPanel.element]),
    ]),
  );

  /* Wiring ---------------------------------------------------------------- */

  function pushBody(): void {
    context.update({ body: bodyInput.value }, 'body');
    updateWritingMeta();
  }

  function updateWritingMeta(): void {
    const words = wordCount(bodyInput.value);
    const minutes = readingMinutes(bodyInput.value);
    writingMeta.textContent =
      words === 0
        ? 'Nothing written yet. Everything you type is saved on this device only.'
        : `${words} ${words === 1 ? 'word' : 'words'} · about ${minutes} ${
            minutes === 1 ? 'minute' : 'minutes'
          } to read · ${previewPanel.pages()} ${previewPanel.pages() === 1 ? 'page' : 'pages'}`;
  }

  disposables.listen(bodyInput, 'input', pushBody);
  disposables.listen(titleInput, 'input', () => context.update({ title: titleInput.value }, 'title'));
  disposables.listen(recipient.input, 'input', () =>
    context.update({ recipient: recipient.input.value }, 'fields'),
  );
  disposables.listen(sender.input, 'input', () => {
    context.update({ sender: sender.input.value }, 'fields');
    setPreferences({ senderName: sender.input.value });
  });
  disposables.listen(place.input, 'input', () => {
    context.update({ senderLocation: place.input.value }, 'fields');
    setPreferences({ senderLocation: place.input.value });
  });
  disposables.listen(dateWritten.input, 'change', () =>
    context.update({ dateWritten: dateWritten.input.value }, 'fields'),
  );
  disposables.listen(sendingDate.input, 'change', () =>
    context.update({ sendingDate: sendingDate.input.value || null }, 'fields'),
  );
  disposables.listen(openingDate.input, 'change', () =>
    context.update({ openingDate: openingDate.input.value || null }, 'fields'),
  );
  disposables.listen(categorySelect, 'change', () => {
    context.update({ category: categorySelect.value as LetterCategory }, 'fields');
    showPrompt();
  });
  disposables.listen(statusSelect, 'change', () =>
    context.update({ status: statusSelect.value as LetterStatus }, 'fields'),
  );
  disposables.listen(tagsInput, 'change', () =>
    context.update(
      {
        tags: tagsInput.value
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
          .slice(0, 32),
      },
      'fields',
    ),
  );
  disposables.listen(sealedInput, 'change', () =>
    context.update({ sealed: sealedInput.checked }, 'fields'),
  );

  // Ctrl/Cmd+S saves immediately; Ctrl/Cmd+P prints through Dearly's own layout.
  disposables.listen(document, 'keydown', (event) => {
    const keyboard = event as KeyboardEvent;
    if (!(keyboard.ctrlKey || keyboard.metaKey)) return;
    if (keyboard.key.toLowerCase() === 's') {
      keyboard.preventDefault();
      void context.flush().then(() => announce('Saved locally.'));
    }
    if (keyboard.key.toLowerCase() === 'p') {
      keyboard.preventDefault();
      void exportPanel.print();
    }
  });

  function renderStatus(state: SaveStatus): void {
    const at = state.at ? ` · ${formatRelative(state.at)}` : '';
    status.textContent = `${state.message}${state.state === 'saved' ? at : ''}`;
    status.dataset.state = state.state;
    if (state.detail) {
      statusDetail.hidden = false;
      statusDetail.textContent = state.detail;
    } else {
      statusDetail.hidden = true;
      statusDetail.textContent = '';
    }
  }

  function syncFields(): void {
    const letter = context.letter;
    const locked = isLetterLocked(letter);

    titleInput.value = letter.title;
    recipient.input.value = letter.recipient;
    sender.input.value = letter.sender;
    place.input.value = letter.senderLocation;
    dateWritten.input.value = letter.dateWritten;
    sendingDate.input.value = letter.sendingDate ?? '';
    openingDate.input.value = letter.openingDate ?? '';
    categorySelect.value = letter.category;
    statusSelect.value = letter.status;
    tagsInput.value = letter.tags.join(', ');
    sealedInput.checked = letter.sealed;
    bodyInput.value = letter.body;

    for (const control of [
      recipient.input,
      sender.input,
      place.input,
      dateWritten.input,
      sendingDate.input,
      openingDate.input,
      categorySelect,
      statusSelect,
      tagsInput,
      sealedInput,
      bodyInput,
      promptUse,
    ]) {
      control.disabled = locked;
    }

    lockedNotice.hidden = !locked;
    lockedNotice.textContent = locked
      ? 'This letter is locked. Unlock it below to read, edit, print or export it.'
      : '';

    heading.textContent = locked
      ? 'Locked letter'
      : letter.title.trim().length > 0
        ? letter.title.trim()
        : 'Write';

    updateWritingMeta();
  }

  async function removeLetter(): Promise<void> {
    const confirmed = await confirmDialog({
      title: 'Delete this letter?',
      body: [
        'The letter, its photographs and its saved versions are removed from this device.',
        'This cannot be undone. Export a backup first if you might want it later.',
      ],
      confirmLabel: 'Delete for ever',
      danger: true,
    });
    if (!confirmed) return;
    try {
      autosave.dispose();
      await deleteLetter(context.letter.id);
      toast('The letter was deleted.', 'success');
      navigate({ name: 'library', id: null });
    } catch (error) {
      toast(`The letter could not be deleted: ${describe(error)}`, 'error');
    }
  }

  /* Crash recovery -------------------------------------------------------- */

  async function offerRecovery(): Promise<void> {
    const snapshot = await latestSnapshot(context.letter.id);
    if (!snapshot) return;
    const letter: LetterRecord = context.letter;
    // A snapshot newer than the stored letter means the last session ended
    // before its final save completed.
    if (snapshot.createdAt <= letter.updatedAt) return;
    if (snapshot.letter.body === letter.body) return;

    const restore = await confirmDialog({
      title: 'A more recent draft was recovered',
      body: [
        `Dearly found a draft saved ${formatRelative(snapshot.createdAt)} that is newer than the letter on this device.`,
        'This usually means the browser closed before the last save finished.',
        'Restoring keeps the current text as a version, so nothing is lost either way.',
      ],
      confirmLabel: 'Restore the recovered draft',
      cancelLabel: 'Keep what is here',
    });
    if (!restore) return;

    await saveSnapshot(letter, 'crash-recovery', { force: true });
    const restored = await putLetter({ ...snapshot.letter, id: letter.id, locked: letter.locked });
    context.replace(restored, 'recovery');
    autosave.markRecovered();
    await historyPanel.refresh();
    toast('The recovered draft was restored.', 'success');
  }

  context.events.on('change', () => syncFields());
  syncFields();
  renderStatus(autosave.currentStatus);
  setPreferences({ lastSection: 'write' });

  if (isLetterLocked(context.letter)) {
    void lockPanel.promptUnlock();
  } else {
    void offerRecovery();
  }

  focusHeading(element);

  return {
    element,
    dispose(): void {
      void autosave.flush();
      disposables.dispose();
      clear(element);
    },
    hasUnsavedChanges: () => autosave.hasUnsavedChanges,
    flush: async () => {
      await autosave.flush();
    },
  };
}

function fieldWrap(id: string, label: string, control: HTMLElement): HTMLElement {
  return el('div', { class: 'field' }, [
    el('label', { class: 'label', for: id, text: label }),
    control,
  ]);
}

function textField(
  id: string,
  label: string,
  placeholder: string,
): { field: HTMLElement; input: HTMLInputElement } {
  const input = el('input', {
    type: 'text',
    class: 'input',
    id,
    placeholder,
    autocomplete: 'off',
  }) as HTMLInputElement;
  return { field: fieldWrap(id, label, input), input };
}

function dateField(id: string, label: string): { field: HTMLElement; input: HTMLInputElement } {
  const input = el('input', { type: 'date', class: 'input', id }) as HTMLInputElement;
  return { field: fieldWrap(id, label, input), input };
}

export function editorTitle(letter: LetterRecord): string {
  return letter.title.trim().length > 0 ? letter.title.trim() : 'Untitled letter';
}
