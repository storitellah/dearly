/**
 * Autosave.
 *
 * Rules this module exists to guarantee:
 *  - "Saved locally" is shown only after IndexedDB has confirmed the write.
 *  - A failed save is reported, never hidden, and the letter stays marked unsaved.
 *  - Saves never overlap: a change made mid-save queues another save afterwards.
 *  - Leaving the page flushes pending work first.
 *  - Recovery snapshots are taken on the way past, rate-limited by
 *    `src/components/storage/snapshots.ts`.
 */

import { debounce, type Debounced } from '../utilities/debounce';
import { describe } from '../utilities/events';
import type { LetterRecord } from '../storage/schema';
import { StorageError } from '../storage/db';
import { hasHeadroom, readQuota, type QuotaReport } from '../storage/quota';

export type SaveState =
  | 'idle'
  | 'unsaved'
  | 'saving'
  | 'saved'
  | 'error'
  | 'storage-almost-full'
  | 'recovered';

export interface SaveStatus {
  state: SaveState;
  /** Text shown in the interface and announced to screen readers. */
  message: string;
  at: string | null;
  /** Set when `state` is `error`. */
  detail?: string;
}

export const STATUS_TEXT: Record<SaveState, string> = {
  idle: 'Nothing to save yet',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved locally',
  error: 'Unable to save',
  'storage-almost-full': 'Storage almost full',
  recovered: 'Recovered draft',
};

export interface AutosaveOptions {
  /** Persists the letter. Must reject if the write did not happen. */
  save: (letter: LetterRecord) => Promise<LetterRecord>;
  /** Takes a recovery snapshot. Returning null means "not this time". */
  snapshot?: (letter: LetterRecord) => Promise<unknown>;
  onStatus?: (status: SaveStatus) => void;
  onSaved?: (letter: LetterRecord) => void;
  /** Debounce window while typing. */
  delayMs?: number;
  /** Check the storage estimate every N saves. */
  quotaEveryNSaves?: number;
  quota?: () => Promise<QuotaReport>;
}

export class Autosave {
  private pending: LetterRecord | null = null;
  private inFlight = false;
  private dirty = false;
  private saveCount = 0;
  private status: SaveStatus = { state: 'idle', message: STATUS_TEXT.idle, at: null };
  private readonly schedule: Debounced<[]>;
  private disposed = false;

  constructor(private readonly options: AutosaveOptions) {
    this.schedule = debounce(() => {
      void this.run();
    }, options.delayMs ?? 900);
  }

  get currentStatus(): SaveStatus {
    return this.status;
  }

  get hasUnsavedChanges(): boolean {
    return this.dirty || this.pending !== null || this.inFlight;
  }

  /** Records an edit. The letter is saved after the debounce window. */
  queue(letter: LetterRecord): void {
    if (this.disposed) return;
    this.pending = letter;
    this.dirty = true;
    this.setStatus({ state: 'unsaved', message: STATUS_TEXT.unsaved, at: this.status.at });
    this.schedule();
  }

  /** Saves immediately. Used when navigating away, closing or printing. */
  async flush(): Promise<SaveStatus> {
    if (this.disposed) return this.status;
    this.schedule.cancel();
    await this.run();
    return this.status;
  }

  /** Marks the current state as recovered from a snapshot. */
  markRecovered(): void {
    this.setStatus({
      state: 'recovered',
      message: STATUS_TEXT.recovered,
      at: new Date().toISOString(),
    });
  }

  dispose(): void {
    this.disposed = true;
    this.schedule.cancel();
  }

  private setStatus(status: SaveStatus): void {
    this.status = status;
    this.options.onStatus?.(status);
  }

  private async run(): Promise<void> {
    if (this.inFlight) {
      // A save is already running; the newest letter will be picked up after it.
      return;
    }
    const letter = this.pending;
    if (!letter) return;

    this.pending = null;
    this.inFlight = true;
    this.setStatus({ state: 'saving', message: STATUS_TEXT.saving, at: this.status.at });

    try {
      const saved = await this.options.save(letter);
      this.saveCount += 1;
      this.dirty = this.pending !== null;

      const at = saved.updatedAt;
      let warned = false;

      const every = this.options.quotaEveryNSaves ?? 10;
      if (this.saveCount % every === 0) {
        const report = await (this.options.quota ?? readQuota)();
        if (report.level === 'almost-full' || !hasHeadroom(report, 512 * 1024)) {
          warned = true;
          this.setStatus({
            state: 'storage-almost-full',
            message: STATUS_TEXT['storage-almost-full'],
            at,
            detail:
              'This device is nearly out of space for local data. Export a backup, then remove ' +
              'letters or photographs you no longer need.',
          });
        }
      }

      if (!warned) {
        this.setStatus({ state: 'saved', message: STATUS_TEXT.saved, at });
      }

      this.options.onSaved?.(saved);

      if (this.options.snapshot) {
        try {
          await this.options.snapshot(saved);
        } catch (error) {
          // A missed snapshot is not a failed save; say so quietly.
          console.warn('Dearly: a recovery snapshot could not be written.', describe(error));
        }
      }
    } catch (error) {
      this.pending = this.pending ?? letter;
      this.dirty = true;
      const quota = error instanceof StorageError && error.kind === 'quota';
      this.setStatus({
        state: 'error',
        message: STATUS_TEXT.error,
        at: this.status.at,
        detail: quota
          ? 'This device has run out of space for local data. Export a backup, then free some space — your text is still on screen.'
          : `${describe(error)} Your text is still on screen; try again, or export it to be safe.`,
      });
    } finally {
      this.inFlight = false;
      if (this.pending && !this.disposed) {
        // Changes arrived while saving: save again.
        this.schedule();
      }
    }
  }
}

/**
 * Warns before the tab closes with unsaved work. Browsers require a synchronous
 * handler, so a final flush is attempted but cannot be awaited.
 */
export function guardUnload(autosave: Autosave): () => void {
  const handler = (event: BeforeUnloadEvent): void => {
    if (!autosave.hasUnsavedChanges) return;
    void autosave.flush();
    event.preventDefault();
    // Required by older browsers to show the confirmation prompt.
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);

  const visibility = (): void => {
    if (document.visibilityState === 'hidden' && autosave.hasUnsavedChanges) {
      void autosave.flush();
    }
  };
  document.addEventListener('visibilitychange', visibility);

  return () => {
    window.removeEventListener('beforeunload', handler);
    document.removeEventListener('visibilitychange', visibility);
  };
}
