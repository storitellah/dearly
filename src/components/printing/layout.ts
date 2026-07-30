/**
 * Letter pagination.
 *
 * This module turns a letter record into a list of pages made of positioned
 * boxes, measured in millimetres. It is pure: no DOM, no canvas, no side
 * effects. Print, PNG/JPEG export and PDF export all consume its output, which
 * is why a printed page and an exported page look the same.
 *
 * Text is never cut mid-line: a paragraph breaks between lines, and a heading,
 * closing or caption is kept with the block it belongs to where it fits.
 */

import { getPaper, type PaperSpec } from './paper';
import { getStationery, type Stationery } from '../stationery/stationery';
import { ptToMm } from '../stationery/typography';
import { measureText, type Measurer, type TextStyle } from './measure';
import { formatLongDate } from '../utilities/format';
import type { AttachmentMeta, LetterRecord } from '../storage/schema';

export interface LayoutOptions {
  paperId: string;
  /** Millimetre overrides for the stationery's own margins. */
  margins?: { top: number; right: number; bottom: number; left: number };
  showPageNumbers: boolean;
  showFoldGuides: boolean;
  showCutGuides: boolean;
  includePhotographs: boolean;
  /** Measurement hook; swapped in tests. */
  measure?: Measurer;
}

export interface TextLine {
  kind: 'text';
  text: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  sizePt: number;
  align: 'left' | 'right' | 'centre' | 'justify';
  italic: boolean;
  weight: number;
  /** True for the last line of a justified paragraph, which is not stretched. */
  lastOfParagraph: boolean;
  role: 'meta' | 'greeting' | 'body' | 'closing' | 'signature' | 'caption' | 'title';
}

export interface ImageBox {
  kind: 'image';
  attachmentId: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export type LayoutItem = TextLine | ImageBox;

export interface LayoutPage {
  index: number;
  items: LayoutItem[];
}

export interface LetterLayout {
  pages: LayoutPage[];
  paper: PaperSpec;
  stationery: Stationery;
  margins: { top: number; right: number; bottom: number; left: number };
  columnWidthMm: number;
  lineHeightMm: number;
  fontId: string;
  bodySizePt: number;
  inkColour: string;
  showPageNumbers: boolean;
  showFoldGuides: boolean;
  showCutGuides: boolean;
}

const MM_PER_PX = 25.4 / 96;

function pxToMm(px: number): number {
  return px * MM_PER_PX;
}

/** Wraps one paragraph into lines that fit `widthMm`. */
export function wrapParagraph(
  text: string,
  widthMm: number,
  style: TextStyle,
  measure: Measurer,
): string[] {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  const fits = (candidate: string): boolean =>
    pxToMm(measure(candidate, style)) <= widthMm * 0.998;

  for (const word of collapsed.split(' ')) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (current.length > 0) lines.push(current);

    if (fits(word)) {
      current = word;
      continue;
    }
    // A single word wider than the column (a long URL, say) is broken by
    // character so it cannot disappear off the edge of the paper.
    let chunk = '';
    for (const character of word) {
      const attempt = chunk + character;
      if (chunk.length > 0 && !fits(attempt)) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = attempt;
      }
    }
    current = chunk;
  }
  if (current.length > 0) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

export function layoutLetter(letter: LetterRecord, options: LayoutOptions): LetterLayout {
  const measure = options.measure ?? measureText;
  const paper = getPaper(options.paperId);
  const stationery = getStationery(letter.stationeryId);
  const margins = options.margins ?? stationery.margins;

  const columnWidthMm = paper.widthMm - margins.left - margins.right;
  const usableHeightMm = paper.heightMm - margins.top - margins.bottom;
  const bodySizePt = letter.typography.sizePt;
  const lineHeightMm = ptToMm(bodySizePt * letter.typography.lineHeight);
  const bodyStyle: TextStyle = {
    fontId: letter.typography.family,
    sizePx: (bodySizePt / 72) * 96,
  };
  const metaStyle: TextStyle = { ...bodyStyle, sizePx: bodyStyle.sizePx * 0.92 };
  const captionStyle: TextStyle = { ...bodyStyle, sizePx: bodyStyle.sizePx * 0.85, italic: true };

  const pages: LayoutPage[] = [];
  let items: LayoutItem[] = [];
  let cursor = margins.top;

  const pushPage = (): void => {
    pages.push({ index: pages.length, items });
    items = [];
    cursor = margins.top;
  };

  const remaining = (): number => margins.top + usableHeightMm - cursor;

  const ensure = (heightMm: number): void => {
    if (heightMm <= remaining() || items.length === 0) return;
    pushPage();
  };

  const addLine = (
    text: string,
    role: TextLine['role'],
    align: TextLine['align'],
    style: TextStyle,
    lastOfParagraph = true,
  ): void => {
    const lineHeight = ptToMm((style.sizePx / 96) * 72 * letter.typography.lineHeight);
    ensure(lineHeight);
    items.push({
      kind: 'text',
      text,
      xMm: margins.left,
      yMm: cursor,
      widthMm: columnWidthMm,
      sizePt: (style.sizePx / 96) * 72,
      align,
      italic: style.italic ?? false,
      weight: style.weight ?? 400,
      lastOfParagraph,
      role,
    });
    cursor += lineHeight;
  };

  const addSpace = (mm: number): void => {
    cursor = Math.min(cursor + mm, margins.top + usableHeightMm);
  };

  /* --- Heading: place and date, then greeting ---------------------------- */

  const placeAndDate = [letter.senderLocation.trim(), formatLongDate(letter.dateWritten)]
    .filter((part) => part.length > 0)
    .join(' · ');
  if (placeAndDate.length > 0) {
    for (const line of wrapParagraph(placeAndDate, columnWidthMm, metaStyle, measure)) {
      addLine(line, 'meta', 'right', metaStyle);
    }
    addSpace(lineHeightMm * 0.8);
  }

  const greeting = buildGreeting(letter);
  if (greeting) {
    for (const line of wrapParagraph(greeting, columnWidthMm, bodyStyle, measure)) {
      addLine(line, 'greeting', 'left', bodyStyle);
    }
    addSpace(lineHeightMm * 0.5);
  }

  /* --- Body -------------------------------------------------------------- */

  const paragraphs = splitParagraphs(letter.body);
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const lines = wrapParagraph(paragraph, columnWidthMm, bodyStyle, measure);
    lines.forEach((line, lineIndex) => {
      const isLast = lineIndex === lines.length - 1;
      // Avoid leaving a single line of a paragraph alone at the foot of a page.
      if (lineIndex === 0 && lines.length > 1 && remaining() < lineHeightMm * 2) {
        if (items.length > 0) pushPage();
      }
      addLine(
        line,
        'body',
        letter.typography.align === 'justify' && !isLast ? 'justify' : 'left',
        bodyStyle,
        isLast,
      );
    });
    if (paragraphIndex < paragraphs.length - 1) addSpace(lineHeightMm * 0.65);
  });

  /* --- Closing and signature -------------------------------------------- */

  const closing = letter.signature.closing.trim();
  const signatureName = letter.signature.name.trim() || letter.sender.trim();
  const drawnSignature =
    letter.signature.style === 'drawn' && letter.signature.attachmentId
      ? letter.attachments.find(
          (item) => item.id === letter.signature.attachmentId && item.role === 'signature',
        )
      : undefined;

  if (closing.length > 0 || signatureName.length > 0 || drawnSignature) {
    const blockHeight =
      lineHeightMm * (closing ? 1 : 0) +
      (drawnSignature ? 22 : signatureName ? lineHeightMm : 0) +
      lineHeightMm;
    ensure(blockHeight);
    addSpace(lineHeightMm * 0.9);
    if (closing.length > 0) addLine(closing, 'closing', 'left', bodyStyle);
    if (drawnSignature) {
      const box = fitImage(drawnSignature, Math.min(70, columnWidthMm * 0.5), 22);
      ensure(box.heightMm);
      items.push({
        kind: 'image',
        attachmentId: drawnSignature.id,
        xMm: margins.left,
        yMm: cursor,
        widthMm: box.widthMm,
        heightMm: box.heightMm,
      });
      cursor += box.heightMm + lineHeightMm * 0.2;
    }
    if (signatureName.length > 0) {
      addLine(signatureName, 'signature', 'left', {
        ...bodyStyle,
        italic: letter.signature.style === 'script',
      });
    }
  }

  /* --- Photographs ------------------------------------------------------- */

  if (options.includePhotographs) {
    const photos = letter.attachments.filter((item) => item.role === 'photo');
    for (const photo of photos) {
      const maxHeight = usableHeightMm * 0.62;
      const box = fitImage(photo, columnWidthMm, maxHeight);
      const captionLines =
        photo.caption.trim().length > 0
          ? wrapParagraph(photo.caption.trim(), columnWidthMm, captionStyle, measure)
          : [];
      const captionHeight = captionLines.length * ptToMm((captionStyle.sizePx / 96) * 72 * 1.4);
      const needed = box.heightMm + captionHeight + lineHeightMm;

      if (needed > remaining() && items.length > 0) pushPage();
      else addSpace(lineHeightMm * 0.8);

      items.push({
        kind: 'image',
        attachmentId: photo.id,
        xMm: margins.left + (columnWidthMm - box.widthMm) / 2,
        yMm: cursor,
        widthMm: box.widthMm,
        heightMm: box.heightMm,
      });
      cursor += box.heightMm + 2;
      for (const line of captionLines) addLine(line, 'caption', 'centre', captionStyle);
    }
  }

  if (items.length > 0 || pages.length === 0) pushPage();

  return {
    pages,
    paper,
    stationery,
    margins,
    columnWidthMm,
    lineHeightMm,
    fontId: letter.typography.family,
    bodySizePt,
    inkColour: letter.typography.colour,
    showPageNumbers: options.showPageNumbers,
    showFoldGuides: options.showFoldGuides,
    showCutGuides: options.showCutGuides,
  };
}

function buildGreeting(letter: LetterRecord): string | null {
  const recipient = letter.recipient.trim();
  if (recipient.length === 0) return null;
  // If the writer already opened the letter themselves, do not add a second
  // greeting.
  const opening = letter.body.trimStart().slice(0, 40).toLowerCase();
  if (/^(dear|dearest|hello|hi |hey |my dear|to my)/.test(opening)) return null;
  return `Dear ${recipient},`;
}

export function fitImage(
  image: Pick<AttachmentMeta, 'width' | 'height'>,
  maxWidthMm: number,
  maxHeightMm: number,
): { widthMm: number; heightMm: number } {
  const width = image.width > 0 ? image.width : 4;
  const height = image.height > 0 ? image.height : 3;
  const ratio = height / width;
  let widthMm = maxWidthMm;
  let heightMm = widthMm * ratio;
  if (heightMm > maxHeightMm) {
    heightMm = maxHeightMm;
    widthMm = heightMm / ratio;
  }
  return { widthMm: round(widthMm), heightMm: round(heightMm) };
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function pageCount(layout: LetterLayout): number {
  return layout.pages.length;
}
