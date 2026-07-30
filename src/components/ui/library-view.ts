/**
 * The memory box: every letter, searchable and paginated.
 *
 * Only summaries are loaded — no letter bodies beyond a short preview, and no
 * photographs at all — so a library with hundreds of image-heavy letters still
 * opens quickly on a modest phone.
 */

import { el, clear } from '../utilities/dom';
import { navigate } from './router';
import {
  listLetters,
  deleteLetter,
  type LetterSummary,
  type ListOptions,
} from '../storage/letters-repo';
import { createLetter, LETTER_CATEGORIES, LETTER_STATUSES } from '../storage/schema';
import { putLetter } from '../storage/letters-repo';
import { getPreferences, setPreferences } from '../storage/preferences';
import { formatRelative, formatLongDate } from '../utilities/format';
import { confirmDialog } from '../accessibility/dialog';
import { announce } from '../accessibility/announce';
import { focusHeading } from '../accessibility/focus';
import { toast } from './toast';
import { Disposables, describe } from '../utilities/events';

export interface LibraryView {
  element: HTMLElement;
  refresh(): Promise<void>;
  dispose(): void;
}

const CATEGORY_LABELS: Record<string, string> = {
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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ready: 'Ready',
  printed: 'Printed',
  sent: 'Sent',
  kept: 'Kept',
  archived: 'Archived',
};

export function createLibraryView(): LibraryView {
  const disposables = new Disposables();
  const preferences = getPreferences();

  const state: Required<Pick<ListOptions, 'page' | 'pageSize' | 'search' | 'category' | 'status' | 'sort'>> = {
    page: 0,
    pageSize: preferences.libraryPageSize,
    search: '',
    category: 'all',
    status: 'all',
    sort: 'updated-desc',
  };

  const element = el('section', { class: 'view view--library', 'aria-labelledby': 'library-title' });

  const heading = el('h1', { class: 'view__title', id: 'library-title', text: 'Your memory box' });
  const intro = el('p', {
    class: 'view__intro',
    text: 'Every letter is stored on this device only. Nothing here has been uploaded.',
  });

  const newButton = el('button', {
    type: 'button',
    class: 'button button--primary',
    text: 'Write a new letter',
  });
  newButton.addEventListener('click', () => {
    void startNewLetter();
  });

  const controls = el('form', { class: 'library-controls', role: 'search' });

  const searchId = 'library-search';
  const searchInput = el('input', {
    type: 'search',
    id: searchId,
    class: 'input',
    placeholder: 'Search titles, recipients and tags',
    autocomplete: 'off',
  }) as HTMLInputElement;

  const categorySelect = el('select', { class: 'input', id: 'library-category' }) as HTMLSelectElement;
  categorySelect.append(el('option', { value: 'all', text: 'All occasions' }));
  for (const category of LETTER_CATEGORIES) {
    categorySelect.append(
      el('option', { value: category, text: CATEGORY_LABELS[category] ?? category }),
    );
  }

  const statusSelect = el('select', { class: 'input', id: 'library-status' }) as HTMLSelectElement;
  statusSelect.append(el('option', { value: 'all', text: 'Any status' }));
  for (const status of LETTER_STATUSES) {
    statusSelect.append(el('option', { value: status, text: STATUS_LABELS[status] ?? status }));
  }

  const sortSelect = el('select', { class: 'input', id: 'library-sort' }) as HTMLSelectElement;
  for (const [value, label] of [
    ['updated-desc', 'Recently edited first'],
    ['created-desc', 'Newest first'],
    ['updated-asc', 'Least recently edited'],
    ['title-asc', 'By title'],
  ] as const) {
    sortSelect.append(el('option', { value, text: label }));
  }

  controls.append(
    el('div', { class: 'field field--grow' }, [
      el('label', { class: 'label', for: searchId, text: 'Search' }),
      searchInput,
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'label', for: 'library-category', text: 'Occasion' }),
      categorySelect,
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'label', for: 'library-status', text: 'Status' }),
      statusSelect,
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'label', for: 'library-sort', text: 'Order' }),
      sortSelect,
    ]),
  );

  controls.addEventListener('submit', (event) => event.preventDefault());

  const summary = el('p', { class: 'library-summary', role: 'status' });
  const list = el('ul', { class: 'letter-grid' });
  const pager = el('nav', { class: 'pager', 'aria-label': 'Pages of letters' });

  element.append(
    el('div', { class: 'view__header' }, [
      el('div', {}, [heading, intro]),
      el('div', { class: 'view__actions' }, [newButton]),
    ]),
    controls,
    summary,
    list,
    pager,
  );

  let searchTimer: number | undefined;
  disposables.listen(searchInput, 'input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.search = searchInput.value;
      state.page = 0;
      void refresh();
    }, 220);
  });
  disposables.add(() => window.clearTimeout(searchTimer));

  disposables.listen(categorySelect, 'change', () => {
    state.category = categorySelect.value as ListOptions['category'] as never;
    state.page = 0;
    void refresh();
  });
  disposables.listen(statusSelect, 'change', () => {
    state.status = statusSelect.value as ListOptions['status'] as never;
    state.page = 0;
    void refresh();
  });
  disposables.listen(sortSelect, 'change', () => {
    state.sort = sortSelect.value as ListOptions['sort'] as never;
    void refresh();
  });

  async function startNewLetter(): Promise<void> {
    try {
      const preferences = getPreferences();
      const letter = createLetter({
        sender: preferences.senderName,
        senderLocation: preferences.senderLocation,
        stationeryId: preferences.lastStationeryId,
        signature: { name: preferences.senderName, style: 'typed', attachmentId: null, closing: 'With love,' },
      });
      await putLetter(letter);
      navigate({ name: 'write', id: letter.id });
    } catch (error) {
      toast(`The letter could not be created: ${describe(error)}`, 'error');
    }
  }

  function renderCard(item: LetterSummary): HTMLElement {
    const card = el('li', { class: 'letter-card' });
    const link = el('a', {
      class: 'letter-card__link',
      href: `#/write/${item.id}`,
    });
    link.append(el('h2', { class: 'letter-card__title', text: item.title }));
    card.append(link);

    const meta = el('p', { class: 'letter-card__meta' });
    const parts = [
      item.recipient ? `For ${item.recipient}` : 'No recipient yet',
      CATEGORY_LABELS[item.category] ?? item.category,
      STATUS_LABELS[item.status] ?? item.status,
    ];
    meta.textContent = parts.join(' · ');
    card.append(meta);

    if (item.locked) {
      card.append(
        el('p', {
          class: 'letter-card__locked',
          text: 'Locked with a password. Open it and enter the password to read it.',
        }),
      );
    } else if (item.preview.length > 0) {
      card.append(el('p', { class: 'letter-card__preview', text: item.preview }));
    } else {
      card.append(el('p', { class: 'letter-card__preview letter-card__preview--empty', text: 'Empty so far.' }));
    }

    const facts = el('ul', { class: 'letter-card__facts' });
    facts.append(
      el('li', { text: `Written ${formatLongDate(item.dateWritten) || 'recently'}` }),
      el('li', { text: `Edited ${formatRelative(item.updatedAt)}` }),
    );
    if (!item.locked) facts.append(el('li', { text: `${item.words} words` }));
    if (item.attachmentCount > 0) {
      facts.append(
        el('li', {
          text: `${item.attachmentCount} ${item.attachmentCount === 1 ? 'photograph' : 'photographs'}`,
        }),
      );
    }
    if (item.printCount > 0) facts.append(el('li', { text: `Printed ${item.printCount}×` }));
    if (item.sealed) facts.append(el('li', { text: 'Sealed' }));
    if (item.openingDate) facts.append(el('li', { text: `Open on ${formatLongDate(item.openingDate)}` }));
    if (item.fromFuture) {
      facts.append(el('li', { text: 'Written by a newer version of Dearly — read only' }));
    }
    card.append(facts);

    if (item.tags.length > 0) {
      const tags = el('ul', { class: 'tag-list', 'aria-label': 'Tags' });
      for (const tag of item.tags) tags.append(el('li', { class: 'tag', text: tag }));
      card.append(tags);
    }

    const actions = el('div', { class: 'letter-card__actions' });
    const open = el('a', {
      class: 'button button--quiet button--small',
      href: `#/write/${item.id}`,
      text: item.locked ? 'Unlock' : 'Open',
    });
    const remove = el('button', {
      type: 'button',
      class: 'button button--danger button--small',
      text: 'Delete',
    });
    remove.addEventListener('click', () => {
      void removeLetter(item);
    });
    actions.append(open, remove);
    card.append(actions);
    return card;
  }

  async function removeLetter(item: LetterSummary): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete “${item.title}”?`,
      body: [
        'This removes the letter, its photographs and its recovery snapshots from this device.',
        'This cannot be undone. If you might want it later, export a backup first.',
      ],
      confirmLabel: 'Delete for ever',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteLetter(item.id);
      toast(`“${item.title}” was deleted.`, 'success');
      await refresh();
    } catch (error) {
      toast(`The letter could not be deleted: ${describe(error)}`, 'error');
    }
  }

  function renderPager(total: number, page: number, pageCount: number): void {
    clear(pager);
    if (pageCount <= 1) return;

    const previous = el('button', {
      type: 'button',
      class: 'button button--quiet button--small',
      text: 'Previous',
      disabled: page === 0,
    });
    previous.addEventListener('click', () => {
      state.page = Math.max(0, page - 1);
      void refresh();
    });

    const next = el('button', {
      type: 'button',
      class: 'button button--quiet button--small',
      text: 'Next',
      disabled: page >= pageCount - 1,
    });
    next.addEventListener('click', () => {
      state.page = Math.min(pageCount - 1, page + 1);
      void refresh();
    });

    pager.append(
      previous,
      el('p', {
        class: 'pager__status',
        text: `Page ${page + 1} of ${pageCount} · ${total} letters`,
      }),
      next,
    );
  }

  async function refresh(): Promise<void> {
    try {
      const result = await listLetters(state);
      state.page = result.page;
      clear(list);

      if (result.items.length === 0) {
        summary.textContent =
          state.search.length > 0 || state.category !== 'all' || state.status !== 'all'
            ? 'No letters match those filters.'
            : 'No letters yet.';
        const empty = el('li', { class: 'letter-grid__empty' });
        empty.append(
          el('p', {
            text:
              state.search.length > 0
                ? 'Try a different search.'
                : 'Your first letter is waiting. Nothing you write leaves this device.',
          }),
        );
        list.append(empty);
      } else {
        summary.textContent = `${result.total} ${result.total === 1 ? 'letter' : 'letters'}${
          result.pageCount > 1 ? `, showing ${result.items.length}` : ''
        }.`;
        for (const item of result.items) list.append(renderCard(item));
      }

      renderPager(result.total, result.page, result.pageCount);
      if (state.pageSize !== getPreferences().libraryPageSize) {
        setPreferences({ libraryPageSize: state.pageSize });
      }
    } catch (error) {
      clear(list);
      summary.textContent = 'Your letters could not be read from local storage.';
      list.append(
        el('li', { class: 'letter-grid__empty' }, [
          el('p', { text: describe(error) }),
          el('p', {
            text:
              'This usually means the browser is in private mode, or storage has been blocked for this site.',
          }),
        ]),
      );
      announce('Letters could not be loaded.', 'assertive');
    }
  }

  focusHeading(element);

  return {
    element,
    refresh,
    dispose(): void {
      disposables.dispose();
    },
  };
}
