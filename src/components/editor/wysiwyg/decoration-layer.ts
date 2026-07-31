/**
 * Moving things around on the paper.
 *
 * Stickers and notes are dragged, resized, rotated, flipped, layered, locked and
 * deleted directly on the page. Everything works with a finger, a stylus and a
 * mouse through pointer events, and `touch-action: none` on the handles stops a
 * drag turning into a page scroll on a phone.
 *
 * Positions live in millimetres in the model, so a sticker lands in exactly the
 * same place on paper as it does on screen.
 */

import { el } from '../../utilities/dom';
import { cloneDocument, type Decoration, type LetterDocument } from '../../document/model';
import { placeDecoration } from '../../document/render';
import { announce } from '../../accessibility/announce';

export interface ApplyOptions {
  /**
   * True while a finger or mouse button is still down. The caller records the
   * change but must not rebuild the page, because replacing the element under
   * the pointer cancels the gesture — on touch devices it ends the drag dead.
   */
  live?: boolean;
}

export interface DecorationLayerOptions {
  getDocument: () => LetterDocument;
  apply: (doc: LetterDocument, label: string, tag?: string, options?: ApplyOptions) => void;
  /** Redraws the page from the current document. Called once a gesture ends. */
  refresh: () => void;
  /** Millimetres per CSS pixel on screen. */
  pixelsPerMm: () => number;
  sheet: () => HTMLElement;
  layer: () => HTMLElement;
  onSelect: (decoration: Decoration | null) => void;
}

/** Snap distance, in millimetres. */
export const SNAP_MM = 2.5;

export function snap(value: number, guides: number[], tolerance = SNAP_MM): number {
  for (const guide of guides) {
    if (Math.abs(value - guide) <= tolerance) return guide;
  }
  return value;
}

type Mode = 'move' | 'resize' | 'rotate';

export class DecorationLayer {
  private selectedId: string | null = null;
  private pointerId: number | null = null;
  private mode: Mode = 'move';
  private startX = 0;
  private startY = 0;
  private origin: Decoration | null = null;
  private handles: HTMLElement;

  constructor(private readonly options: DecorationLayerOptions) {
    this.handles = el('div', { class: 'deco-handles', hidden: true });
    this.wire();
  }

  get handlesElement(): HTMLElement {
    return this.handles;
  }

  get selected(): Decoration | null {
    if (!this.selectedId) return null;
    return this.options.getDocument().decorations.find((d) => d.id === this.selectedId) ?? null;
  }

  private wire(): void {
    const layer = this.options.layer();

    layer.addEventListener('pointerdown', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-decoration]');
      if (!target) return;
      const id = target.dataset.decoration;
      if (!id) return;

      const decoration = this.options.getDocument().decorations.find((d) => d.id === id);
      if (!decoration || decoration.locked) {
        if (decoration?.locked) announce('That decoration is locked.');
        return;
      }

      event.preventDefault();
      this.select(id);
      this.beginDrag(event, 'move');
      // Keep every later move going to this element, even once the finger
      // strays outside it.
      if (target.setPointerCapture) {
        try {
          target.setPointerCapture(event.pointerId);
        } catch {
          // Some pointers cannot be captured; the window listeners still work.
        }
      }
    });

    // Handles live above the page so they stay usable at any zoom.
    this.handles.addEventListener('pointerdown', (event) => {
      const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-handle]');
      if (!handle) return;
      event.preventDefault();
      event.stopPropagation();
      this.beginDrag(event, handle.dataset.handle === 'rotate' ? 'rotate' : 'resize');
      if (handle.setPointerCapture) {
        try {
          handle.setPointerCapture(event.pointerId);
        } catch {
          // As above: window listeners are the fallback.
        }
      }
    });

    window.addEventListener('pointermove', (event) => this.onMove(event));
    window.addEventListener('pointerup', () => this.endDrag());
    window.addEventListener('pointercancel', () => this.endDrag());

    // Keyboard nudging, so decorations are not mouse-only.
    window.addEventListener('keydown', (event) => this.onKey(event));
  }

  private beginDrag(event: PointerEvent, mode: Mode): void {
    const decoration = this.selected;
    if (!decoration || decoration.locked) return;
    this.pointerId = event.pointerId;
    this.mode = mode;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.origin = { ...decoration };
  }

  private onMove(event: PointerEvent): void {
    if (this.pointerId === null || event.pointerId !== this.pointerId || !this.origin) return;
    const pxPerMm = this.options.pixelsPerMm();
    if (pxPerMm <= 0) return;

    const dxMm = (event.clientX - this.startX) / pxPerMm;
    const dyMm = (event.clientY - this.startY) / pxPerMm;

    const doc = cloneDocument(this.options.getDocument());
    const decoration = doc.decorations.find((d) => d.id === this.origin?.id);
    if (!decoration) return;

    if (this.mode === 'move') {
      const guidesX = this.guidesX();
      const guidesY = this.guidesY();
      decoration.xMm = snap(this.origin.xMm + dxMm, guidesX);
      decoration.yMm = snap(this.origin.yMm + dyMm, guidesY);
    } else if (this.mode === 'resize') {
      const ratio = this.origin.heightMm / Math.max(1, this.origin.widthMm);
      const width = Math.max(6, this.origin.widthMm + dxMm * 2);
      decoration.widthMm = Math.min(280, width);
      decoration.heightMm = Math.min(280, width * ratio);
    } else {
      const sheet = this.options.sheet().getBoundingClientRect();
      const centreX = sheet.left + decoration.xMm * pxPerMm;
      const centreY = sheet.top + decoration.yMm * pxPerMm;
      const angle = (Math.atan2(event.clientY - centreY, event.clientX - centreX) * 180) / Math.PI;
      // Round to 5° unless a modifier is held, so tilts look deliberate.
      decoration.rotation = event.shiftKey ? angle : Math.round(angle / 5) * 5;
    }

    this.options.apply(doc, 'move decoration', `decoration:${decoration.id}:${this.mode}`, {
      live: true,
    });
    // Move the element that is already under the pointer rather than waiting
    // for a re-render, which would replace it and cancel the gesture.
    const node = this.nodeFor(decoration.id);
    if (node) placeDecoration(node, decoration);
    this.positionHandles();
  }

  private nodeFor(id: string): HTMLElement | null {
    return this.options
      .layer()
      .querySelector<HTMLElement>(`[data-decoration="${CSS.escape(id)}"]`);
  }

  private endDrag(): void {
    if (this.pointerId === null) return;
    this.pointerId = null;
    const finished = this.origin;
    this.origin = null;
    if (!finished) return;
    // One real render now the gesture is over, so the page and the model agree.
    this.options.refresh();
    this.positionHandles();
  }

  private guidesX(): number[] {
    const sheet = this.options.sheet();
    const widthMm = Number.parseFloat(sheet.style.getPropertyValue('--page-width')) || 210;
    return [widthMm / 2, 20, widthMm - 20];
  }

  private guidesY(): number[] {
    const sheet = this.options.sheet();
    const heightMm = Number.parseFloat(sheet.style.getPropertyValue('--page-height')) || 297;
    return [heightMm / 2, 24, heightMm - 24];
  }

  private onKey(event: KeyboardEvent): void {
    const decoration = this.selected;
    if (!decoration || decoration.locked) return;
    const active = document.activeElement;
    // Never steal arrow keys from the writing surface.
    if (active instanceof HTMLElement && active.isContentEditable) return;

    const step = event.shiftKey ? 5 : 1;
    let handled = true;
    const doc = cloneDocument(this.options.getDocument());
    const target = doc.decorations.find((d) => d.id === decoration.id);
    if (!target) return;

    switch (event.key) {
      case 'ArrowLeft':
        target.xMm -= step;
        break;
      case 'ArrowRight':
        target.xMm += step;
        break;
      case 'ArrowUp':
        target.yMm -= step;
        break;
      case 'ArrowDown':
        target.yMm += step;
        break;
      case 'Delete':
      case 'Backspace':
        this.remove(decoration.id);
        event.preventDefault();
        return;
      default:
        handled = false;
    }

    if (!handled) return;
    event.preventDefault();
    this.options.apply(doc, 'nudge decoration', `decoration:${target.id}:move`);
    this.positionHandles();
  }

  /* ------------------------------------------------------------------ */
  /* Selection and actions                                               */
  /* ------------------------------------------------------------------ */

  select(id: string | null): void {
    this.selectedId = id;
    for (const node of this.options.layer().querySelectorAll('[data-decoration]')) {
      node.classList.toggle('deco-wrap--selected', node instanceof HTMLElement && node.dataset.decoration === id);
    }
    this.options.onSelect(this.selected);
    if (id) {
      this.buildHandles();
      this.positionHandles();
    } else {
      this.handles.hidden = true;
    }
  }

  private buildHandles(): void {
    this.handles.replaceChildren();
    this.handles.hidden = false;
    for (const [handle, label] of [
      ['resize', 'Resize'],
      ['rotate', 'Rotate'],
    ] as const) {
      const node = el('button', {
        type: 'button',
        class: `deco-handle deco-handle--${handle}`,
        'data-handle': handle,
        'aria-label': label,
        title: label,
      });
      this.handles.append(node);
    }
  }

  positionHandles(): void {
    const decoration = this.selected;
    if (!decoration) {
      this.handles.hidden = true;
      return;
    }
    const pxPerMm = this.options.pixelsPerMm();
    const sheet = this.options.sheet().getBoundingClientRect();
    const left = sheet.left + (decoration.xMm + decoration.widthMm / 2) * pxPerMm;
    const top = sheet.top + (decoration.yMm - decoration.heightMm / 2) * pxPerMm;
    this.handles.hidden = false;
    this.handles.style.setProperty('left', `${Math.round(left)}px`);
    this.handles.style.setProperty('top', `${Math.round(top)}px`);
  }

  private update(id: string, change: (decoration: Decoration) => void, label: string): void {
    const doc = cloneDocument(this.options.getDocument());
    const decoration = doc.decorations.find((d) => d.id === id);
    if (!decoration) return;
    change(decoration);
    this.options.apply(doc, label);
  }

  flip(id: string): void {
    this.update(id, (decoration) => {
      decoration.flipped = !decoration.flipped;
    }, 'flip decoration');
  }

  setOpacity(id: string, opacity: number): void {
    this.update(id, (decoration) => {
      decoration.opacity = Math.min(1, Math.max(0.05, opacity));
    }, 'sticker opacity');
  }

  setLayer(id: string, layer: number): void {
    this.update(id, (decoration) => {
      decoration.layer = Math.max(-50, Math.min(50, Math.round(layer)));
    }, 'layer order');
  }

  sendBehindText(id: string): void {
    this.setLayer(id, -1);
    announce('Moved behind the writing. The text is still selectable.');
  }

  bringToFront(id: string): void {
    const highest = Math.max(0, ...this.options.getDocument().decorations.map((d) => d.layer));
    this.setLayer(id, highest + 1);
  }

  toggleLock(id: string): void {
    this.update(id, (decoration) => {
      decoration.locked = !decoration.locked;
    }, 'lock decoration');
    announce(this.selected?.locked ? 'Decoration locked.' : 'Decoration unlocked.');
  }

  duplicate(id: string): void {
    const doc = cloneDocument(this.options.getDocument());
    const source = doc.decorations.find((d) => d.id === id);
    if (!source) return;
    const copy: Decoration = {
      ...source,
      id: `${source.id}-${Math.random().toString(36).slice(2, 7)}`,
      xMm: source.xMm + 6,
      yMm: source.yMm + 6,
      locked: false,
    };
    doc.decorations.push(copy);
    this.options.apply(doc, 'duplicate decoration');
    this.select(copy.id);
  }

  remove(id: string): void {
    const doc = cloneDocument(this.options.getDocument());
    doc.decorations = doc.decorations.filter((d) => d.id !== id);
    this.options.apply(doc, 'remove decoration');
    this.select(null);
    announce('Decoration removed.');
  }
}
