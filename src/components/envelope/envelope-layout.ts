/**
 * Envelope layout.
 *
 * Two ways to print an envelope, both supported:
 *  - directly onto a real envelope, using a page the size of the envelope;
 *  - onto a sheet of A4 or US Letter, with the envelope outline plus cut and
 *    fold guides, for people whose printer will not take an envelope.
 *
 * Address placement follows postal convention: recipient in the lower middle
 * third, sender top left, stamp area top right.
 */

import { getEnvelope, getPaper, type EnvelopeSpec, type PaperSpec } from '../printing/paper';
import { wrapParagraph } from '../printing/layout';
import { measureText, type Measurer, type TextStyle } from '../printing/measure';
import type { EnvelopeSettings, LetterRecord } from '../storage/schema';

export interface EnvelopeTextBlock {
  lines: string[];
  xMm: number;
  yMm: number;
  widthMm: number;
  sizePt: number;
  lineHeightMm: number;
  align: 'left' | 'right';
  role: 'recipient' | 'sender' | 'stamp' | 'note';
}

export interface EnvelopeLayout {
  envelope: EnvelopeSpec;
  /** Sheet the envelope is printed on, or the envelope itself. */
  sheet: PaperSpec | null;
  /** Position of the envelope rectangle on the sheet, in millimetres. */
  offsetXMm: number;
  offsetYMm: number;
  blocks: EnvelopeTextBlock[];
  seal: { style: EnvelopeSettings['sealStyle']; colour: string } | null;
  showGuides: boolean;
  fontId: string;
  inkColour: string;
}

export interface EnvelopeLayoutOptions {
  /** `envelope` prints on envelope-sized pages, `sheet` prints on paper. */
  target: 'envelope' | 'sheet';
  sheetId?: string;
  showGuides?: boolean;
  measure?: Measurer;
}

export function layoutEnvelope(
  letter: LetterRecord,
  options: EnvelopeLayoutOptions,
): EnvelopeLayout {
  const measure = options.measure ?? measureText;
  const envelope = getEnvelope(letter.envelope.size);
  const sheet = options.target === 'sheet' ? getPaper(options.sheetId ?? envelope.sheet) : null;

  const offsetXMm = sheet ? Math.max(0, (sheet.widthMm - envelope.widthMm) / 2) : 0;
  const offsetYMm = sheet ? Math.max(0, (sheet.heightMm - envelope.heightMm) / 2) : 0;

  const sizePt = Math.min(12, Math.max(9.5, letter.typography.sizePt));
  const style: TextStyle = { fontId: letter.typography.family, sizePx: (sizePt / 72) * 96 };
  const smallStyle: TextStyle = { ...style, sizePx: style.sizePx * 0.85 };
  const lineHeightMm = (sizePt * 1.45 * 25.4) / 72;
  const smallLineHeightMm = (sizePt * 0.85 * 1.4 * 25.4) / 72;

  const blocks: EnvelopeTextBlock[] = [];

  const recipientWidth = envelope.widthMm * 0.52;
  const recipientText = [letter.envelope.recipientName, letter.envelope.recipientAddress]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('\n');

  if (recipientText.length > 0) {
    const lines = wrapAddress(recipientText, recipientWidth, style, measure);
    blocks.push({
      lines,
      xMm: offsetXMm + envelope.widthMm * 0.36,
      yMm: offsetYMm + envelope.heightMm * 0.46,
      widthMm: recipientWidth,
      sizePt,
      lineHeightMm,
      align: 'left',
      role: 'recipient',
    });
  }

  const senderText = [letter.envelope.senderName, letter.envelope.senderAddress]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('\n');

  if (senderText.length > 0) {
    const lines = wrapAddress(senderText, envelope.widthMm * 0.4, smallStyle, measure);
    blocks.push({
      lines,
      xMm: offsetXMm + 10,
      yMm: offsetYMm + 8,
      widthMm: envelope.widthMm * 0.4,
      sizePt: sizePt * 0.85,
      lineHeightMm: smallLineHeightMm,
      align: 'left',
      role: 'sender',
    });
  }

  const stampNote = letter.envelope.stampNote.trim();
  if (stampNote.length > 0) {
    const width = envelope.widthMm * 0.28;
    blocks.push({
      lines: wrapAddress(stampNote, width, smallStyle, measure),
      xMm: offsetXMm + envelope.widthMm - width - 10,
      yMm: offsetYMm + 8,
      widthMm: width,
      sizePt: sizePt * 0.85,
      lineHeightMm: smallLineHeightMm,
      align: 'right',
      role: 'stamp',
    });
  }

  if (letter.openingDate) {
    const width = envelope.widthMm * 0.4;
    blocks.push({
      lines: [`Please open on ${letter.openingDate}`],
      xMm: offsetXMm + 10,
      yMm: offsetYMm + envelope.heightMm - 12,
      widthMm: width,
      sizePt: sizePt * 0.85,
      lineHeightMm: smallLineHeightMm,
      align: 'left',
      role: 'note',
    });
  }

  return {
    envelope,
    sheet,
    offsetXMm,
    offsetYMm,
    blocks,
    seal:
      letter.envelope.sealStyle === 'none'
        ? null
        : { style: letter.envelope.sealStyle, colour: letter.envelope.sealColour },
    showGuides: options.showGuides ?? sheet !== null,
    fontId: letter.typography.family,
    inkColour: letter.typography.colour,
  };
}

function wrapAddress(
  text: string,
  widthMm: number,
  style: TextStyle,
  measure: Measurer,
): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;
    lines.push(...wrapParagraph(trimmed, widthMm, style, measure));
  }
  return lines.slice(0, 12);
}
