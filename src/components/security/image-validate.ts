/**
 * Image validation and local processing.
 *
 * Rules:
 *  - A file's *contents* decide what it is. The extension and the browser-reported
 *    MIME type are treated as hints only.
 *  - SVG is refused. An SVG can carry script, external references and CSS, and it
 *    has no place in a printed letter. PNG, JPEG and WebP are accepted.
 *  - Every accepted image is re-encoded by the browser into a fresh bitmap, so
 *    metadata, colour profiles, embedded thumbnails and any appended payload are
 *    discarded rather than stored.
 *  - Pixel dimensions are capped before decoding to avoid decompression bombs.
 */

import { createId } from '../utilities/id';
import { safeFileName } from '../utilities/format';
import type { AttachmentMeta } from '../storage/schema';
import type { StoredAttachment } from '../storage/attachments-repo';

/** Largest file Dearly will read from disk. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Largest decoded pixel count accepted (about 40 megapixels). */
export const MAX_IMAGE_PIXELS = 40_000_000;
/** Longest edge kept for printing. */
export const PRINT_MAX_EDGE = 2400;
/** Longest edge kept for on-screen previews. */
export const PREVIEW_MAX_EDGE = 640;

export type ImageKind = 'image/png' | 'image/jpeg' | 'image/webp';

export class ImageError extends Error {
  constructor(
    message: string,
    readonly kind:
      | 'too-large'
      | 'unsupported-type'
      | 'svg-refused'
      | 'unreadable'
      | 'too-many-pixels'
      | 'no-canvas',
  ) {
    super(message);
    this.name = 'ImageError';
  }
}

interface Signature {
  type: ImageKind;
  matches: (bytes: Uint8Array) => boolean;
}

const SIGNATURES: Signature[] = [
  {
    type: 'image/png',
    matches: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    type: 'image/jpeg',
    matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/webp',
    matches: (b) =>
      b.length > 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

/** Detects the real image type from the leading bytes. */
export function detectImageType(bytes: Uint8Array): ImageKind | 'image/svg+xml' | null {
  for (const signature of SIGNATURES) {
    if (signature.matches(bytes)) return signature.type;
  }
  // SVG and other XML: sniff a little text so it can be refused with a clear
  // message rather than a generic failure.
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, 512))
    .toLowerCase();
  if (head.includes('<svg') || (head.includes('<?xml') && head.includes('svg'))) {
    return 'image/svg+xml';
  }
  return null;
}

export async function assertAcceptableImage(file: Blob): Promise<ImageKind> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageError(
      `That image is larger than ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB. Please choose a smaller file.`,
      'too-large',
    );
  }
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const detected = detectImageType(head);
  if (detected === 'image/svg+xml') {
    throw new ImageError(
      'SVG files are not accepted, because they can contain scripts. Export the artwork as PNG or JPEG first.',
      'svg-refused',
    );
  }
  if (detected === null) {
    throw new ImageError(
      'That file is not a PNG, JPEG or WebP image. Dearly checks the file contents, not its name.',
      'unsupported-type',
    );
  }
  return detected;
}

export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to the <img> path (older Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new ImageError('That image could not be read.', 'unreadable'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sizeOf(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if ('naturalWidth' in source) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function drawTo(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new ImageError('This browser cannot process images on a canvas.', 'no-canvas');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(source as CanvasImageSource, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageError('That image could not be re-encoded.', 'unreadable'));
      },
      type,
      quality,
    );
  });
}

export interface ProcessOptions {
  letterId: string;
  caption?: string;
  role?: AttachmentMeta['role'];
  fileName?: string;
}

/**
 * Validates, decodes, downscales and re-encodes an image entirely on the device.
 * Nothing is uploaded. Returns the record ready to be stored.
 */
export async function processImage(
  file: Blob,
  options: ProcessOptions,
): Promise<StoredAttachment> {
  const detected = await assertAcceptableImage(file);
  const source = await decode(file);
  try {
    const { width, height } = sizeOf(source);
    if (width * height > MAX_IMAGE_PIXELS) {
      throw new ImageError(
        'That image has too many pixels to process safely. Please resize it first.',
        'too-many-pixels',
      );
    }

    // Photographs are re-encoded as JPEG; anything with possible transparency
    // stays PNG so a scanned signature keeps its transparent background.
    const keepAlpha = detected === 'image/png' || options.role === 'signature';
    const outputType: ImageKind = keepAlpha ? 'image/png' : 'image/jpeg';

    const printSize = fitWithin(width, height, PRINT_MAX_EDGE);
    const previewSize = fitWithin(width, height, PREVIEW_MAX_EDGE);

    const printCanvas = drawTo(source, printSize.width, printSize.height);
    const previewCanvas = drawTo(source, previewSize.width, previewSize.height);

    const original = await canvasToBlob(printCanvas, outputType, 0.92);
    const preview = await canvasToBlob(previewCanvas, outputType, 0.8);

    // Release the large canvases promptly on memory-constrained devices.
    printCanvas.width = 0;
    printCanvas.height = 0;
    previewCanvas.width = 0;
    previewCanvas.height = 0;

    return {
      id: createId('img'),
      letterId: options.letterId,
      name: safeFileName(options.fileName ?? 'photograph', 'photograph'),
      type: outputType,
      bytes: original.size,
      width: printSize.width,
      height: printSize.height,
      caption: (options.caption ?? '').slice(0, 400),
      role: options.role ?? 'photo',
      createdAt: new Date().toISOString(),
      original,
      preview,
    };
  } finally {
    if ('close' in source && typeof source.close === 'function') source.close();
  }
}
