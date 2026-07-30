/**
 * Text and HTML safety.
 *
 * Dearly renders letter content with `textContent`, so nothing here is required
 * for the normal writing path. It exists for the two places where a string does
 * become markup or is read from an untrusted file:
 *
 *  - HTML export, where letter text is escaped before being written into a file;
 *  - archive import, where a body that arrives as HTML is reduced to plain text.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes the five characters that matter for HTML and attribute contexts. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** Strips characters that break CSS strings, used for generated stylesheets. */
export function escapeCssString(value: string): string {
  return value.replace(/["'\\\n\r]/g, '');
}

const BLOCK_LEVEL = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BR',
  'DIV',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'P',
  'PRE',
  'SECTION',
  'TR',
]);

const DROP_ENTIRELY = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'TEMPLATE',
  'NOSCRIPT',
  'SVG',
  'MATH',
  'LINK',
  'META',
  'BASE',
  'FORM',
  'INPUT',
  'BUTTON',
  'TEXTAREA',
  'SELECT',
]);

/**
 * Converts arbitrary HTML into plain text. Parsing happens in an inert document
 * created by `DOMParser`, so no script runs, no image loads and no network
 * request is made — only the resulting text is kept.
 */
export function htmlToPlainText(html: string): string {
  if (typeof DOMParser === 'undefined') return stripTagsWithRegex(html);

  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const node of Array.from(doc.querySelectorAll('*'))) {
    if (DROP_ENTIRELY.has(node.tagName.toUpperCase())) node.remove();
  }

  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.nodeValue ?? '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName.toUpperCase();
    if (DROP_ENTIRELY.has(tag)) return;
    if (tag === 'BR') {
      parts.push('\n');
      return;
    }
    for (const child of Array.from(element.childNodes)) walk(child);
    if (BLOCK_LEVEL.has(tag)) parts.push('\n\n');
  };

  for (const child of Array.from(doc.body.childNodes)) walk(child);

  return parts
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTagsWithRegex(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** True when a string contains anything that could execute if rendered. */
export function looksExecutable(value: string): boolean {
  return /<\s*script|javascript\s*:|on[a-z]+\s*=|data:text\/html|<\s*iframe|<\s*object|srcdoc\s*=/i.test(
    value,
  );
}

/**
 * Removes control characters that can hide content or corrupt a file name,
 * keeping tab, newline and carriage return which are meaningful in a letter.
 */
export function stripControlCharacters(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200e\u200f\u202a-\u202e]/g, '');
}
