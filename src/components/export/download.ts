/**
 * Local downloads.
 *
 * Exports are produced in the browser and handed to the browser's own download
 * mechanism through a blob URL. Nothing is uploaded, and the URL is revoked as
 * soon as the download has started so image-heavy exports do not leak memory.
 */

import { safeFileName } from '../utilities/format';

export interface DownloadResult {
  fileName: string;
  bytes: number;
}

export function triggerDownload(blob: Blob, fileName: string): DownloadResult {
  const safe = ensureExtension(fileName);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safe;
    anchor.rel = 'noopener';
    anchor.style.setProperty('display', 'none');
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Give the browser a moment to pick the blob up before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  return { fileName: safe, bytes: blob.size };
}

/** Keeps the extension, sanitises the stem. */
export function ensureExtension(fileName: string): string {
  const match = /^(.*?)(\.[A-Za-z0-9]{1,8})?$/.exec(fileName.trim());
  const stem = safeFileName(match?.[1] ?? 'dearly-export', 'dearly-export');
  const extension = (match?.[2] ?? '').toLowerCase();
  return `${stem}${extension}`;
}

export function timestampSuffix(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`;
}
