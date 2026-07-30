/**
 * Shared editor state.
 *
 * One object holds the letter being written, its photographs, and the autosave
 * queue. Panels read from it and call `update`, which is the only way the letter
 * changes — so autosave can never be bypassed by accident.
 */

import { Emitter } from '../utilities/events';
import type { LetterRecord } from '../storage/schema';
import type { StoredAttachment } from '../storage/attachments-repo';
import type { Autosave, SaveStatus } from './autosave';

export type EditorEvents = {
  change: { letter: LetterRecord; source: string };
  attachments: { attachments: StoredAttachment[] };
  status: SaveStatus;
};

export class EditorContext {
  readonly events = new Emitter<EditorEvents>();

  constructor(
    private letterRecord: LetterRecord,
    private attachmentList: StoredAttachment[],
    private readonly autosave: Autosave,
  ) {}

  get letter(): LetterRecord {
    return this.letterRecord;
  }

  get attachments(): StoredAttachment[] {
    return this.attachmentList;
  }

  get locked(): boolean {
    return this.letterRecord.locked !== null;
  }

  /** Applies a change and queues a save. */
  update(patch: Partial<LetterRecord>, source = 'editor'): LetterRecord {
    this.letterRecord = { ...this.letterRecord, ...patch };
    this.autosave.queue(this.letterRecord);
    this.events.emit('change', { letter: this.letterRecord, source });
    return this.letterRecord;
  }

  /** Replaces the record without queueing a save — used after a reload. */
  replace(letter: LetterRecord, source = 'reload'): void {
    this.letterRecord = letter;
    this.events.emit('change', { letter, source });
  }

  setAttachments(attachments: StoredAttachment[]): void {
    this.attachmentList = attachments;
    this.events.emit('attachments', { attachments });
  }

  flush(): Promise<SaveStatus> {
    return this.autosave.flush();
  }

  get hasUnsavedChanges(): boolean {
    return this.autosave.hasUnsavedChanges;
  }
}
