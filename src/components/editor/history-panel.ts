/**
 * Draft history and crash recovery.
 *
 * Snapshots are taken automatically while writing, and before anything
 * destructive. Restoring one snapshots the current text first, so restoring is
 * itself undoable.
 */

import { el, clear } from '../utilities/dom';
import { listSnapshots, saveSnapshot, deleteSnapshot } from '../storage/snapshots';
import { putLetter } from '../storage/letters-repo';
import { formatRelative, formatTimestamp, truncate } from '../utilities/format';
import { confirmDialog } from '../accessibility/dialog';
import { toast } from '../ui/toast';
import { describe } from '../utilities/events';
import type { EditorContext } from './context';

export interface HistoryPanel {
  element: HTMLElement;
  refresh(): Promise<void>;
}

const REASON_LABELS: Record<string, string> = {
  autosave: 'While writing',
  manual: 'Saved by you',
  'pre-import': 'Before a backup was imported',
  'pre-lock': 'Before locking',
  'crash-recovery': 'Recovered after an interruption',
};

export function createHistoryPanel(context: EditorContext): HistoryPanel {
  const panel = el('details', { class: 'panel' });
  panel.append(el('summary', { class: 'panel__summary', text: 'Draft history' }));
  const body = el('div', { class: 'panel__body' });

  const list = el('ul', { class: 'history-list' });
  const keepButton = el('button', {
    type: 'button',
    class: 'button button--quiet button--small',
    text: 'Save a version now',
  });
  keepButton.addEventListener('click', () => {
    void (async () => {
      try {
        await context.flush();
        await saveSnapshot(context.letter, 'manual', { force: true });
        await refresh();
        toast('A version of this draft was saved.', 'success');
      } catch (error) {
        toast(`The version could not be saved: ${describe(error)}`, 'error');
      }
    })();
  });

  body.append(
    el('p', {
      class: 'field-hint',
      text:
        'Dearly keeps up to twelve recent versions of each letter on this device, so an accidental ' +
        'deletion or a crash does not lose your words.',
    }),
    el('div', { class: 'button-row' }, [keepButton]),
    list,
  );
  panel.append(body);

  async function refresh(): Promise<void> {
    clear(list);
    try {
      const snapshots = await listSnapshots(context.letter.id);
      if (snapshots.length === 0) {
        list.append(el('li', { class: 'history-list__empty', text: 'No earlier versions yet.' }));
        return;
      }
      for (const snapshot of snapshots) {
        const item = el('li', { class: 'history-item' });
        item.append(
          el('p', { class: 'history-item__when', text: formatTimestamp(snapshot.createdAt) }),
          el('p', {
            class: 'history-item__meta',
            text: `${REASON_LABELS[snapshot.reason] ?? snapshot.reason} · ${
              snapshot.wordCount
            } words · ${formatRelative(snapshot.createdAt)}`,
          }),
          el('p', {
            class: 'history-item__preview',
            text: truncate(snapshot.letter.body, 140) || 'Empty draft.',
          }),
        );

        const restore = el('button', {
          type: 'button',
          class: 'button button--quiet button--small',
          text: 'Restore this version',
        });
        restore.addEventListener('click', () => {
          void restoreSnapshot(snapshot.id);
        });

        const remove = el('button', {
          type: 'button',
          class: 'button button--danger button--small',
          text: 'Delete',
        });
        remove.addEventListener('click', () => {
          void (async () => {
            await deleteSnapshot(snapshot.id);
            await refresh();
          })();
        });

        item.append(el('div', { class: 'history-item__actions' }, [restore, remove]));
        list.append(item);
      }
    } catch (error) {
      list.append(el('li', { class: 'history-list__empty', text: describe(error) }));
    }
  }

  async function restoreSnapshot(id: string): Promise<void> {
    const snapshots = await listSnapshots(context.letter.id);
    const snapshot = snapshots.find((item) => item.id === id);
    if (!snapshot) return;

    const confirmed = await confirmDialog({
      title: 'Restore this version?',
      body: [
        `The letter will go back to how it was on ${formatTimestamp(snapshot.createdAt)}.`,
        'The current text is saved as a version first, so you can come back to it.',
      ],
      confirmLabel: 'Restore',
    });
    if (!confirmed) return;

    try {
      await context.flush();
      await saveSnapshot(context.letter, 'manual', { force: true });
      const restored = await putLetter({
        ...snapshot.letter,
        id: context.letter.id,
        attachments: context.letter.attachments,
        locked: context.letter.locked,
      });
      context.replace(restored, 'restore');
      await refresh();
      toast('The earlier version was restored.', 'success');
    } catch (error) {
      toast(`The version could not be restored: ${describe(error)}`, 'error');
    }
  }

  void refresh();
  context.events.on('change', (event) => {
    if (event.source === 'restore') void refresh();
  });

  return { element: panel, refresh };
}
