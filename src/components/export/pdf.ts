/**
 * A small, dependency-free PDF writer.
 *
 * Dearly needs one thing from PDF: a file whose pages are exactly the size of
 * the paper, containing the pages it already knows how to render. So each page
 * is rendered to a canvas, encoded as JPEG, and embedded as an image XObject
 * with `DCTDecode` — the one filter every PDF reader has supported since 1.2.
 * No font embedding, no external library, works offline.
 *
 * The output is a valid PDF 1.4 file with a correct cross-reference table, which
 * is why it opens in Preview, Acrobat, Chrome and every phone viewer.
 */

import { mmToPt } from '../printing/paper';
import { utf8ToBytes } from '../utilities/bytes';

export interface PdfPageInput {
  /** JPEG bytes for the page. */
  jpeg: Uint8Array;
  widthMm: number;
  heightMm: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface PdfMetadata {
  title: string;
  author?: string;
  subject?: string;
  creationDate?: Date;
}

type Part = string | Uint8Array;

function partLength(part: Part): number {
  return typeof part === 'string' ? utf8ToBytes(part).length : part.length;
}

function concat(parts: Part[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + partLength(part), 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    const bytes = typeof part === 'string' ? utf8ToBytes(part) : part;
    out.set(bytes, offset);
    offset += bytes.length;
  }
  return out;
}

/** Escapes a string for a PDF literal `( … )`. */
function pdfString(value: string): string {
  // Keep to ASCII: PDF literals are byte strings, and metadata is not the place
  // to be adventurous. Anything outside ASCII is transliterated away.
  const ascii = value.replace(/[^\x20-\x7e]/g, '');
  return `(${ascii.replace(/([\\()])/g, '\\$1')})`;
}

function pdfDate(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return (
    `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(absolute / 60))}'${pad(absolute % 60)}'`
  );
}

/**
 * Assembles the PDF. Object numbering:
 *   1        catalogue
 *   2        page tree
 *   3        document information
 *   4 + 3n   page n
 *   5 + 3n   page n content stream
 *   6 + 3n   page n image
 */
export function buildPdf(pages: PdfPageInput[], metadata: PdfMetadata): Blob {
  if (pages.length === 0) throw new Error('A PDF needs at least one page.');

  const objects: Part[][] = [];
  const pageObjectNumbers: number[] = [];

  const push = (body: Part[]): number => {
    objects.push(body);
    return objects.length; // object numbers are 1-based
  };

  // Reserve 1 (catalogue) and 2 (pages) so the tree can reference its children.
  push(['']);
  push(['']);
  const infoNumber = push([
    '<< /Title ',
    pdfString(metadata.title),
    ' /Author ',
    pdfString(metadata.author ?? 'Dearly by Storitellah'),
    ' /Subject ',
    pdfString(metadata.subject ?? 'A letter written in Dearly'),
    ' /Producer (Dearly by Storitellah) /Creator (Dearly by Storitellah) /CreationDate ',
    pdfString(pdfDate(metadata.creationDate ?? new Date())),
    ' >>',
  ]);

  for (const page of pages) {
    const widthPt = mmToPt(page.widthMm);
    const heightPt = mmToPt(page.heightMm);

    const imageNumber = push([
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} ` +
        '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
        `${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      '\nendstream',
    ]);

    const content = `q\n${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
    const contentNumber = push([
      `<< /Length ${utf8ToBytes(content).length} >>\nstream\n`,
      content,
      'endstream',
    ]);

    const pageNumber = push([
      '<< /Type /Page /Parent 2 0 R ' +
        `/MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] ` +
        `/Resources << /XObject << /Im0 ${imageNumber} 0 R >> >> ` +
        `/Contents ${contentNumber} 0 R >>`,
    ]);
    pageObjectNumbers.push(pageNumber);
  }

  objects[0] = [`<< /Type /Catalog /Pages 2 0 R >>`];
  objects[1] = [
    `<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [` +
      pageObjectNumbers.map((number) => `${number} 0 R`).join(' ') +
      '] >>',
  ];

  const header = '%PDF-1.4\n%âãÏÓ\n';
  const parts: Part[] = [header];
  let offset = partLength(header);
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(offset);
    const opening = `${index + 1} 0 obj\n`;
    const closing = '\nendobj\n';
    parts.push(opening, ...body, closing);
    offset += partLength(opening) + body.reduce((sum, p) => sum + partLength(p), 0) + partLength(closing);
  });

  const xrefStart = offset;
  const lines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (const value of offsets) {
    lines.push(`${String(value).padStart(10, '0')} 00000 n `);
  }
  const xref = `${lines.join('\n')}\n`;
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoNumber} 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;

  parts.push(xref, trailer);

  return new Blob([concat(parts) as unknown as BlobPart], { type: 'application/pdf' });
}
