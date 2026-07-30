/**
 * Entry point.
 *
 * Dearly by Storitellah — write what deserves to be kept.
 */

import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/editor.css';
import './styles/library.css';
import './styles/stationery.css';
import './styles/print.css';

import { startApp } from './app';
import { el } from './components/utilities/dom';
import { describe } from './components/utilities/events';

const container = document.getElementById('app');

if (!container) {
  throw new Error('Dearly could not start: the #app container is missing from index.html.');
}

startApp(container).catch((error: unknown) => {
  // Never leave a blank page: say what happened, in plain language, and make
  // clear that stored letters are untouched.
  container.replaceChildren(
    el('section', { class: 'view view--error' }, [
      el('h1', { class: 'view__title', text: 'Dearly could not start' }),
      el('p', { class: 'view__intro', text: describe(error) }),
      el('p', {
        text:
          'Any letters already written are still stored on this device. Reloading the page usually ' +
          'helps. If it does not, check that this browser is allowed to store data for this site.',
      }),
    ]),
  );
});
