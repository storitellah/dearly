/**
 * One undo history for the whole letter.
 *
 * Typing, formatting, moving a sticker, inserting a photograph, changing the
 * template — all of it lands in the same stack, because two competing undo
 * systems is how people lose work. Consecutive typing is coalesced so one press
 * of undo removes a phrase rather than a letter.
 */

import { cloneDocument, type LetterDocument } from './model';

export interface HistoryEntry {
  doc: LetterDocument;
  /** Short label, shown in the interface: "typing", "sticker moved". */
  label: string;
  at: number;
  /** Consecutive entries with the same tag merge together. */
  tag?: string;
}

export const MAX_HISTORY = 120;
/** Typing within this window merges into the previous entry. */
export const COALESCE_MS = 900;

export class DocumentHistory {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private current: HistoryEntry;

  constructor(doc: LetterDocument) {
    this.current = { doc: cloneDocument(doc), label: 'start', at: Date.now() };
  }

  get document(): LetterDocument {
    return this.current.doc;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Label of the change undo would reverse, for the button's title. */
  get undoLabel(): string | null {
    return this.current.label === 'start' ? null : this.current.label;
  }

  get redoLabel(): string | null {
    return this.future[this.future.length - 1]?.label ?? null;
  }

  /** Records a new state. */
  commit(doc: LetterDocument, label: string, tag?: string): void {
    const now = Date.now();
    const mergeable =
      tag !== undefined &&
      this.current.tag === tag &&
      now - this.current.at < COALESCE_MS;

    if (mergeable) {
      // Replace the current state without growing the stack.
      this.current = { doc: cloneDocument(doc), label, at: now, ...(tag ? { tag } : {}) };
      return;
    }

    this.past.push(this.current);
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
    this.current = { doc: cloneDocument(doc), label, at: now, ...(tag ? { tag } : {}) };
  }

  undo(): LetterDocument | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(this.current);
    this.current = previous;
    return cloneDocument(this.current.doc);
  }

  redo(): LetterDocument | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(this.current);
    this.current = next;
    return cloneDocument(this.current.doc);
  }

  /** Replaces the baseline without adding an undo step — used after a reload. */
  reset(doc: LetterDocument): void {
    this.past = [];
    this.future = [];
    this.current = { doc: cloneDocument(doc), label: 'start', at: Date.now() };
  }

  get size(): number {
    return this.past.length;
  }
}
