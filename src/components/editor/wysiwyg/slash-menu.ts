/**
 * Slash commands.
 *
 * Typing `/` on an empty line opens a small keyboard-driven menu for the things
 * people reach for mid-letter. Entirely optional — it can be switched off in
 * Settings, and everything it offers is also available from the desk drawers.
 */

import { el, clear } from '../../utilities/dom';

export interface SlashCommand {
  id: string;
  name: string;
  hint: string;
  keywords: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'heading', name: 'Heading', hint: 'A bigger line', keywords: ['title', 'h2'] },
  { id: 'quote', name: 'Quote', hint: 'Set a line apart', keywords: ['blockquote'] },
  { id: 'list', name: 'List', hint: 'A bulleted list', keywords: ['bullet', 'items'] },
  { id: 'numbered', name: 'Numbered list', hint: 'A list in order', keywords: ['ordered', 'steps'] },
  { id: 'photo', name: 'Photograph', hint: 'Add a picture here', keywords: ['image', 'picture'] },
  { id: 'photo-strip', name: 'Photo strip', hint: 'Three in a row', keywords: ['strip', 'polaroid'] },
  { id: 'sticker', name: 'Sticker', hint: 'Open the sticker drawer', keywords: ['decoration'] },
  { id: 'divider', name: 'Divider', hint: 'A small ornament', keywords: ['rule', 'line', 'break'] },
  { id: 'postscript', name: 'Postscript', hint: 'PS at the end', keywords: ['ps', 'afterthought'] },
  { id: 'signature', name: 'Signature', hint: 'Sign the letter', keywords: ['sign', 'name'] },
  { id: 'date', name: 'Date', hint: "Today's date", keywords: ['today', 'when'] },
  { id: 'location', name: 'Location', hint: 'Where you are writing', keywords: ['place', 'where'] },
  { id: 'page-break', name: 'Page break', hint: 'Start a new page', keywords: ['new page'] },
  { id: 'secret', name: 'Secret note', hint: 'A quiet aside', keywords: ['hidden', 'aside'] },
  { id: 'speech', name: 'Speech bubble', hint: 'A note in a bubble', keywords: ['bubble', 'say'] },
  { id: 'memory', name: 'Memory card', hint: 'A small boxed memory', keywords: ['card', 'remember'] },
];

export function filterCommands(query: string): SlashCommand[] {
  const term = query.trim().toLowerCase();
  if (term.length === 0) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((command) =>
    `${command.name} ${command.hint} ${command.keywords.join(' ')}`.toLowerCase().includes(term),
  );
}

export class SlashMenu {
  readonly element: HTMLElement;
  private list: HTMLElement;
  private items: SlashCommand[] = [];
  private index = 0;
  private open = false;
  private query = '';

  constructor(private readonly onChoose: (command: SlashCommand) => void) {
    this.element = el('div', {
      class: 'slash-menu',
      role: 'listbox',
      'aria-label': 'Insert',
      hidden: true,
    });
    this.list = el('ul', { class: 'slash-menu__list' });
    this.element.append(
      el('p', { class: 'slash-menu__hint', text: 'Type to filter · Enter to insert · Esc to close' }),
      this.list,
    );
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(at: { left: number; top: number }, query = ''): void {
    this.open = true;
    this.query = query;
    this.element.hidden = false;
    this.element.style.setProperty('left', `${Math.round(at.left)}px`);
    this.element.style.setProperty('top', `${Math.round(at.top)}px`);
    this.refresh();
  }

  setQuery(query: string): void {
    this.query = query;
    this.index = 0;
    this.refresh();
  }

  private refresh(): void {
    this.items = filterCommands(this.query);
    clear(this.list);

    if (this.items.length === 0) {
      this.list.append(el('li', { class: 'slash-menu__empty', text: 'Nothing matches that' }));
      return;
    }

    this.items.forEach((command, position) => {
      const item = el('li', {
        class: `slash-menu__item${position === this.index ? ' slash-menu__item--active' : ''}`,
        role: 'option',
        'aria-selected': position === this.index ? 'true' : 'false',
        id: `slash-${command.id}`,
      });
      item.append(
        el('span', { class: 'slash-menu__name', text: command.name }),
        el('span', { class: 'slash-menu__hint-text', text: command.hint }),
      );
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        this.choose(position);
      });
      this.list.append(item);
    });
  }

  /** Returns true when the key was consumed by the menu. */
  handleKey(event: KeyboardEvent): boolean {
    if (!this.open) return false;

    if (event.key === 'Escape') {
      this.hide();
      return true;
    }
    if (event.key === 'ArrowDown') {
      this.index = (this.index + 1) % Math.max(1, this.items.length);
      this.refresh();
      return true;
    }
    if (event.key === 'ArrowUp') {
      this.index = (this.index - 1 + this.items.length) % Math.max(1, this.items.length);
      this.refresh();
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      this.choose(this.index);
      return true;
    }
    return false;
  }

  private choose(position: number): void {
    const command = this.items[position];
    this.hide();
    if (command) this.onChoose(command);
  }

  hide(): void {
    this.open = false;
    this.index = 0;
    this.query = '';
    this.element.hidden = true;
  }
}
