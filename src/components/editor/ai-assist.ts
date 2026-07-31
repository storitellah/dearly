/**
 * Optional AI writing assistant.
 *
 * Off unless two separate things are true: the build has `VITE_ENABLE_AI_ASSIST`
 * set, and the user has turned it on in Settings. Even then, nothing is sent
 * until the exact text to be transmitted has been shown and confirmed.
 *
 * The provider key lives only in the Cloudflare Function at `functions/api/assist.ts`.
 * The browser never sees it, and the assistant is never required for any core
 * feature — with Functions disabled, Dearly works exactly as it does now.
 */

import { el } from '../utilities/dom';
import { getPreferences } from '../storage/preferences';
import { openDialog } from '../accessibility/dialog';
import { toast } from '../ui/toast';
import { describe } from '../utilities/events';
import { assetUrl } from '../utilities/assets';
import type { EditorContext } from './context';

export type AssistTask = 'opening' | 'questions' | 'spelling' | 'translate' | 'closing';

const TASK_LABELS: Record<AssistTask, string> = {
  opening: 'Suggest ways to open',
  questions: 'Suggest questions to ask them',
  spelling: 'Check spelling and punctuation',
  translate: 'Translate the selection',
  closing: 'Suggest ways to close',
};

const TASK_DESCRIPTIONS: Record<AssistTask, string> = {
  opening: 'Ideas for a first line. Your own words are never replaced automatically.',
  questions: 'Questions you might ask, based on what you have written.',
  spelling: 'Spelling and punctuation corrections only — wording is left alone.',
  translate: 'A translation of the selected text, returned alongside your original.',
  closing: 'Ideas for a closing line and sign-off.',
};

export function aiAssistAvailable(): boolean {
  return (
    import.meta.env.VITE_ENABLE_AI_ASSIST === 'true' && getPreferences().aiAssistEnabled === true
  );
}

/**
 * Removes the things that identify people before any text leaves the device:
 * postal addresses from the envelope, email addresses, telephone numbers,
 * postcodes and the recipient's and sender's names.
 */
export function redactForAssistant(
  text: string,
  names: string[] = [],
  addresses: string[] = [],
): string {
  // Contact details are removed first: a name replacement could otherwise break
  // an email address apart and hide it from these patterns.
  let output = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email removed]')
    .replace(/\+?\d[\d\s()-]{7,}\d/g, '[number removed]')
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g, '[postcode removed]')
    .replace(/\b\d{5}(-\d{4})?\b/g, '[postcode removed]');

  for (const address of addresses) {
    for (const line of address.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length < 4) continue;
      output = output.split(trimmed).join('[address removed]');
    }
  }
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length < 2) continue;
    output = output.replace(new RegExp(escapeRegExp(trimmed), 'gi'), '[name removed]');
  }

  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface AiAssistPanel {
  element: HTMLElement;
}

export function createAiAssistPanel(
  context: EditorContext,
  getSelection: () => { text: string; whole: boolean },
  /** Puts an accepted suggestion into the letter. The caller decides where. */
  insertSuggestion: (text: string) => void,
): AiAssistPanel {
  const panel = el('details', { class: 'panel panel--assist' });
  panel.append(el('summary', { class: 'panel__summary', text: 'Writing assistant (optional)' }));
  const body = el('div', { class: 'panel__body' });

  if (import.meta.env.VITE_ENABLE_AI_ASSIST !== 'true') {
    body.append(
      el('p', {
        class: 'field-hint',
        text:
          'This build has the writing assistant switched off, so no text can be sent anywhere. ' +
          'Every other feature works without it.',
      }),
    );
    panel.append(body);
    return { element: panel };
  }

  body.append(
    el('p', {
      class: 'field-hint',
      text:
        'The assistant suggests openings, questions, corrections, translations and closings. It never ' +
        'writes your letter for you, and it never runs on its own. Photographs are never sent. Each ' +
        'request shows you the exact text first and waits for your confirmation.',
    }),
  );

  const buttons = el('div', { class: 'button-row' });
  for (const task of Object.keys(TASK_LABELS) as AssistTask[]) {
    const button = el('button', {
      type: 'button',
      class: 'button button--quiet button--small',
      text: TASK_LABELS[task],
      title: TASK_DESCRIPTIONS[task],
    });
    button.addEventListener('click', () => void request(task));
    buttons.append(button);
  }
  body.append(buttons);

  const output = el('div', { class: 'assist-output', role: 'region', 'aria-live': 'polite' });
  body.append(output);
  panel.append(body);

  async function request(task: AssistTask): Promise<void> {
    if (!aiAssistAvailable()) {
      toast('Turn the writing assistant on in Settings first.', 'warning');
      return;
    }
    const selection = getSelection();
    const source = selection.text.trim();
    if (source.length === 0) {
      toast('Select some text first, or write a little more.', 'warning');
      return;
    }

    const letter = context.letter;
    const redacted = redactForAssistant(
      source,
      [letter.recipient, letter.sender, letter.envelope.recipientName, letter.envelope.senderName],
      [letter.envelope.recipientAddress, letter.envelope.senderAddress],
    );

    const preview = el('div', { class: 'assist-preview' });
    preview.append(
      el('p', { class: 'label', text: 'Exactly this text will be sent, and nothing else:' }),
      el('pre', { class: 'assist-preview__text', text: redacted }),
      el('p', {
        class: 'field-hint',
        text:
          `Sent to: ${assetUrl('api/assist')} on this site, which forwards it to the configured ` +
          'AI provider. Names, addresses, email addresses, telephone numbers and postcodes have ' +
          'been removed above. No photographs, no title, no dates and no other letters are included. ' +
          'The response is not stored anywhere.',
      }),
    );

    const dialog = openDialog({
      title: TASK_LABELS[task],
      body: [TASK_DESCRIPTIONS[task], selection.whole ? 'This is your whole letter.' : 'This is your selection.'],
      content: preview,
      buttons: [
        { label: 'Cancel', value: 'cancel', variant: 'quiet' },
        { label: 'Send this text', value: 'send', variant: 'primary' },
      ],
      dismissValue: 'cancel',
    });

    if ((await dialog.result) !== 'send') return;

    output.textContent = 'Waiting for a reply…';
    try {
      const response = await fetch(assetUrl('api/assist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, text: redacted }),
      });
      if (!response.ok) {
        const detail = response.status === 429 ? 'Too many requests — try again in a minute.' : `Error ${response.status}.`;
        throw new Error(detail);
      }
      const data = (await response.json()) as { suggestions?: unknown };
      const suggestions = Array.isArray(data.suggestions)
        ? data.suggestions.filter((item): item is string => typeof item === 'string')
        : [];

      output.textContent = '';
      if (suggestions.length === 0) {
        output.append(el('p', { text: 'No suggestions came back. Your letter is unchanged.' }));
        return;
      }
      output.append(el('h3', { class: 'panel__subheading', text: 'Suggestions' }));
      const list = el('ul', { class: 'assist-list' });
      for (const suggestion of suggestions) {
        const item = el('li', { class: 'assist-list__item' });
        item.append(el('p', { class: 'assist-list__text', text: suggestion }));
        const insert = el('button', {
          type: 'button',
          class: 'button button--quiet button--small',
          text: 'Add to the end of my letter',
        });
        insert.addEventListener('click', () => {
          insertSuggestion(suggestion);
          toast('Added. Edit it into your own words.', 'success');
        });
        item.append(insert);
        list.append(item);
      }
      output.append(list);
    } catch (error) {
      output.textContent = '';
      output.append(
        el('p', {
          text: `The assistant could not be reached: ${describe(error)} Your letter is unchanged, and works offline as usual.`,
        }),
      );
    }
  }

  return { element: panel };
}
