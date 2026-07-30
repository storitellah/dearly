/**
 * Private feedback form — the one place Dearly deliberately talks to a server.
 *
 * It posts to `functions/api/feedback.ts`, a Cloudflare Pages Function, and it is
 * hidden unless the build sets `VITE_ENABLE_FEEDBACK=true`. No letter content is
 * attached, ever: the message is whatever the person types, plus the app version.
 */

import { el } from '../utilities/dom';
import { assetUrl, appVersion, deployEnvironment } from '../utilities/assets';
import { announce } from '../accessibility/announce';
import { toast } from './toast';
import { describe } from '../utilities/events';

export interface FeedbackForm {
  element: HTMLElement;
}

const MAX_MESSAGE = 4000;

export function createFeedbackForm(): FeedbackForm {
  const wrapper = el('div', { class: 'feedback' });

  if (import.meta.env.VITE_ENABLE_FEEDBACK !== 'true') {
    wrapper.append(
      el('h3', { class: 'panel__subheading', text: 'Send feedback' }),
      el('p', { class: 'field-hint' }, [
        document.createTextNode('This build has the feedback form switched off. Email '),
        (() => {
          const link = el('a', { href: 'mailto:hello@storitellah.com', class: 'footer__link' });
          link.textContent = 'hello@storitellah.com';
          return link;
        })(),
        document.createTextNode(' instead — nothing about your letters is included either way.'),
      ]),
    );
    return { element: wrapper };
  }

  const form = el('form', { class: 'feedback__form', novalidate: true }) as HTMLFormElement;
  const messageId = 'feedback-message';
  const kindId = 'feedback-kind';
  const replyId = 'feedback-reply';

  const kind = el('select', { class: 'input', id: kindId }) as HTMLSelectElement;
  kind.append(
    el('option', { value: 'feedback', text: 'Feedback' }),
    el('option', { value: 'bug', text: 'Bug report' }),
    el('option', { value: 'idea', text: 'Idea' }),
  );

  const message = el('textarea', {
    class: 'input input--multiline',
    id: messageId,
    rows: '5',
    maxlength: String(MAX_MESSAGE),
    required: true,
  }) as HTMLTextAreaElement;

  const reply = el('input', {
    type: 'email',
    class: 'input',
    id: replyId,
    autocomplete: 'email',
    placeholder: 'Optional, only if you would like a reply',
  }) as HTMLInputElement;

  const submit = el('button', { type: 'submit', class: 'button button--primary', text: 'Send privately' });
  const status = el('p', { class: 'field-hint', role: 'status' });

  form.append(
    el('div', { class: 'field' }, [el('label', { class: 'label', for: kindId, text: 'Kind' }), kind]),
    el('div', { class: 'field' }, [
      el('label', { class: 'label', for: messageId, text: 'Message' }),
      message,
      el('p', {
        class: 'field-hint',
        text: 'Only what you type here is sent, together with the app version. No letter text, no photographs, no addresses.',
      }),
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'label', for: replyId, text: 'Email (optional)' }),
      reply,
    ]),
    el('div', { class: 'button-row' }, [submit]),
    status,
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void send();
  });

  async function send(): Promise<void> {
    const text = message.value.trim();
    if (text.length < 4) {
      status.textContent = 'Please write a little more.';
      message.focus();
      return;
    }
    submit.disabled = true;
    status.textContent = 'Sending…';
    try {
      const response = await fetch(assetUrl('api/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: kind.value,
          message: text.slice(0, MAX_MESSAGE),
          replyTo: reply.value.trim().slice(0, 200),
          appVersion,
          deployEnvironment: deployEnvironment(),
        }),
      });
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? 'Too many messages from this address just now. Please try again later.'
            : `The server replied with ${response.status}.`,
        );
      }
      form.reset();
      status.textContent = 'Thank you — your message was sent.';
      announce('Feedback sent.');
      toast('Thank you. Your message was sent.', 'success');
    } catch (error) {
      status.textContent = `That could not be sent: ${describe(error)} Dearly itself keeps working offline.`;
    } finally {
      submit.disabled = false;
    }
  }

  wrapper.append(el('h3', { class: 'panel__subheading', text: 'Send feedback' }), form);
  return { element: wrapper };
}
