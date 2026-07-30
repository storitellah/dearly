/**
 * Plain text and standalone HTML export.
 *
 * The HTML export is a single self-contained file: no scripts, no external
 * stylesheet, no remote font, images inlined as data URIs. It opens offline, in
 * any browser, and prints reasonably from there too.
 */

import { escapeHtml } from '../security/sanitise';
import { formatLongDate } from '../utilities/format';
import { getFont } from '../stationery/typography';
import { getStationery } from '../stationery/stationery';
import { splitParagraphs } from '../printing/layout';
import { blobToBase64 } from '../utilities/bytes';
import type { LetterRecord } from '../storage/schema';
import type { StoredAttachment } from '../storage/attachments-repo';

export function letterToPlainText(letter: LetterRecord): string {
  const lines: string[] = [];
  const heading = [letter.senderLocation.trim(), formatLongDate(letter.dateWritten)]
    .filter((part) => part.length > 0)
    .join(' · ');
  if (heading.length > 0) lines.push(heading, '');
  if (letter.title.trim().length > 0) lines.push(letter.title.trim(), '');
  if (letter.recipient.trim().length > 0) lines.push(`Dear ${letter.recipient.trim()},`, '');

  lines.push(...splitParagraphs(letter.body).flatMap((paragraph) => [paragraph, '']));

  const closing = letter.signature.closing.trim();
  const name = letter.signature.name.trim() || letter.sender.trim();
  if (closing.length > 0) lines.push(closing);
  if (name.length > 0) lines.push(name);

  const captions = letter.attachments
    .filter((item) => item.role === 'photo' && item.caption.trim().length > 0)
    .map((item, index) => `[${index + 1}] ${item.caption.trim()}`);
  if (captions.length > 0) lines.push('', 'Photographs:', ...captions);

  if (letter.tags.length > 0) lines.push('', `Tags: ${letter.tags.join(', ')}`);

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export async function letterToHtml(
  letter: LetterRecord,
  attachments: StoredAttachment[] = [],
): Promise<string> {
  const stationery = getStationery(letter.stationeryId);
  const font = getFont(letter.typography.family);
  const title = letter.title.trim().length > 0 ? letter.title.trim() : 'A letter';

  const figures: string[] = [];
  for (const attachment of attachments.filter((item) => item.role === 'photo')) {
    const base64 = await blobToBase64(attachment.preview);
    const caption = attachment.caption.trim();
    figures.push(
      [
        '      <figure>',
        `        <img src="data:${attachment.type};base64,${base64}" alt="${escapeHtml(
          caption.length > 0 ? caption : 'A photograph enclosed with this letter',
        )}" width="${attachment.width}" height="${attachment.height}">`,
        caption.length > 0 ? `        <figcaption>${escapeHtml(caption)}</figcaption>` : '',
        '      </figure>',
      ]
        .filter((line) => line.length > 0)
        .join('\n'),
    );
  }

  const paragraphs = splitParagraphs(letter.body)
    .map((paragraph) => `      <p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  const heading = [letter.senderLocation.trim(), formatLongDate(letter.dateWritten)]
    .filter((part) => part.length > 0)
    .join(' · ');

  const closing = letter.signature.closing.trim();
  const signatureName = letter.signature.name.trim() || letter.sender.trim();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        background: #efe9dd;
        color: ${escapeHtml(letter.typography.colour)};
        font-family: ${font.stack};
        font-size: ${letter.typography.sizePt}pt;
        line-height: ${letter.typography.lineHeight};
      }
      main {
        background: ${escapeHtml(stationery.paper)};
        max-width: 170mm;
        margin: 12mm auto;
        padding: ${stationery.margins.top}mm ${stationery.margins.right}mm
          ${stationery.margins.bottom}mm ${stationery.margins.left}mm;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
      }
      .meta { text-align: right; font-size: 0.92em; opacity: 0.85; }
      h1 { font-size: 1.25em; font-weight: 600; margin: 0 0 1em; }
      p { margin: 0 0 0.8em; text-align: ${letter.typography.align}; }
      .closing { margin-top: 2em; }
      .signature { font-style: ${letter.signature.style === 'script' ? 'italic' : 'normal'}; }
      figure { margin: 1.5em 0; }
      img { max-width: 100%; height: auto; }
      figcaption { font-size: 0.85em; font-style: italic; text-align: center; opacity: 0.8; }
      footer { max-width: 170mm; margin: 0 auto 12mm; font-size: 0.8em; opacity: 0.7; text-align: center; }
      @media print {
        body { background: #fff; }
        main { box-shadow: none; margin: 0; max-width: none; }
        footer { display: none; }
      }
    </style>
  </head>
  <body>
    <main>
${heading.length > 0 ? `      <p class="meta">${escapeHtml(heading)}</p>` : ''}
${title.length > 0 ? `      <h1>${escapeHtml(title)}</h1>` : ''}
${
  letter.recipient.trim().length > 0
    ? `      <p>Dear ${escapeHtml(letter.recipient.trim())},</p>`
    : ''
}
${paragraphs}
${closing.length > 0 ? `      <p class="closing">${escapeHtml(closing)}</p>` : ''}
${signatureName.length > 0 ? `      <p class="signature">${escapeHtml(signatureName)}</p>` : ''}
${figures.join('\n')}
    </main>
    <footer>Exported from Dearly by Storitellah — this file contains no scripts and needs no internet connection.</footer>
  </body>
</html>
`;
}
