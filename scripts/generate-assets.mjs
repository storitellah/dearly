#!/usr/bin/env node
/**
 * Generates the binary assets that are committed to the repository:
 * application icons (PNG + ICO) and the optional interface sounds (WAV).
 *
 * They are generated rather than hand-drawn so they can be reproduced exactly,
 * reviewed as code, and regenerated when the branding changes:
 *
 *     npm run generate:assets
 *
 * No external tooling is required — the PNG and WAV encoders below are written
 * against the file formats directly, using only Node's built-in zlib.
 */

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const iconsDir = join(root, 'public', 'icons');
const soundsDir = join(root, 'public', 'sounds');

/* -------------------------------------------------------------------------- */
/* PNG encoder                                                                */
/* -------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** Encodes RGBA pixel data as a PNG. */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------------------- */
/* The Dearly mark: an envelope with a folded letter, on warm paper            */
/* -------------------------------------------------------------------------- */

const PAPER = [246, 241, 231];
const INK = [43, 33, 24];
const ACCENT = [140, 47, 57];
const LETTER = [255, 253, 248];

function blend(base, colour, alpha) {
  return [
    Math.round(base[0] + (colour[0] - base[0]) * alpha),
    Math.round(base[1] + (colour[1] - base[1]) * alpha),
    Math.round(base[2] + (colour[2] - base[2]) * alpha),
  ];
}

/**
 * Coverage of a shape at a pixel, sampled 3×3 for anti-aliasing.
 * `inside` takes normalised coordinates in the 0–1 square.
 */
function coverage(inside, x, y, size) {
  let hits = 0;
  for (let sy = 0; sy < 3; sy += 1) {
    for (let sx = 0; sx < 3; sx += 1) {
      const px = (x + (sx + 0.5) / 3) / size;
      const py = (y + (sy + 0.5) / 3) / size;
      if (inside(px, py)) hits += 1;
    }
  }
  return hits / 9;
}

/** Draws the mark and returns raw RGBA pixels. */
function buildIconPixels(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  // A maskable icon must survive a circular crop, so the mark is drawn smaller
  // and the background covers the whole square.
  const inset = maskable ? 0.22 : 0.12;
  const radius = maskable ? 0 : 0.18;

  const envelopeLeft = inset;
  const envelopeRight = 1 - inset;
  const envelopeTop = inset + 0.06;
  const envelopeBottom = 1 - inset - 0.06;
  const envelopeWidth = envelopeRight - envelopeLeft;
  const envelopeHeight = envelopeBottom - envelopeTop;

  const insideBackground = (x, y) => {
    if (radius === 0) return true;
    const r = radius;
    const cx = Math.min(Math.max(x, r), 1 - r);
    const cy = Math.min(Math.max(y, r), 1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };

  const insideEnvelope = (x, y) =>
    x >= envelopeLeft && x <= envelopeRight && y >= envelopeTop && y <= envelopeBottom;

  // The letter peeking out of the envelope.
  const letterLeft = envelopeLeft + envelopeWidth * 0.16;
  const letterRight = envelopeRight - envelopeWidth * 0.16;
  const letterTop = envelopeTop - envelopeHeight * 0.22;
  const insideLetter = (x, y) =>
    x >= letterLeft && x <= letterRight && y >= letterTop && y <= envelopeTop + envelopeHeight * 0.34;

  // Ruled lines on the letter.
  const insideRule = (x, y) => {
    if (x < letterLeft + envelopeWidth * 0.08 || x > letterRight - envelopeWidth * 0.08) return false;
    for (const offset of [0.06, 0.14, 0.22]) {
      const lineY = letterTop + envelopeHeight * offset;
      if (Math.abs(y - lineY) <= envelopeHeight * 0.016) return true;
    }
    return false;
  };

  // The envelope flap: two diagonals meeting in the middle.
  const insideFlap = (x, y) => {
    if (!insideEnvelope(x, y)) return false;
    const t = (x - envelopeLeft) / envelopeWidth;
    const mid = 0.5;
    const depth = 0.52;
    const edge =
      envelopeTop + envelopeHeight * depth * (t <= mid ? t / mid : (1 - t) / mid);
    return Math.abs(y - edge) <= envelopeHeight * 0.02;
  };

  // A wax seal where the flap closes.
  const sealX = envelopeLeft + envelopeWidth * 0.5;
  const sealY = envelopeTop + envelopeHeight * 0.56;
  const sealR = envelopeHeight * 0.13;
  const insideSeal = (x, y) => (x - sealX) ** 2 + (y - sealY) ** 2 <= sealR * sealR;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;

      const background = coverage(insideBackground, x, y, size);
      if (background === 0) {
        rgba[index + 3] = 0;
        continue;
      }

      let colour = PAPER;
      colour = blend(colour, LETTER, coverage(insideLetter, x, y, size));
      colour = blend(colour, INK, coverage(insideRule, x, y, size) * 0.55);
      colour = blend(colour, blend(PAPER, INK, 0.06), coverage(insideEnvelope, x, y, size) * 0.9);
      colour = blend(colour, INK, coverage(insideFlap, x, y, size) * 0.75);
      colour = blend(colour, ACCENT, coverage(insideSeal, x, y, size));

      // A hairline border around the envelope, for definition at small sizes.
      const border = coverage(
        (px, py) =>
          insideEnvelope(px, py) &&
          (px - envelopeLeft < 0.006 ||
            envelopeRight - px < 0.006 ||
            py - envelopeTop < 0.006 ||
            envelopeBottom - py < 0.006),
        x,
        y,
        size,
      );
      colour = blend(colour, INK, border * 0.6);

      rgba[index] = colour[0];
      rgba[index + 1] = colour[1];
      rgba[index + 2] = colour[2];
      rgba[index + 3] = Math.round(background * 255);
    }
  }

  return rgba;
}

/** Encodes the mark as a PNG at the given size. */
function drawIcon(size, options = {}) {
  return encodePng(size, size, buildIconPixels(size, options));
}

/** Social preview: the mark on paper, at 1200×630. */
function drawSocialPreview() {
  const width = 1200;
  const height = 630;
  const rgba = Buffer.alloc(width * height * 4);
  const iconSize = 320;
  const icon = buildIconPixels(iconSize);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      // Warm paper with a very soft vignette.
      const dx = (x - width / 2) / (width / 2);
      const dy = (y - height / 2) / (height / 2);
      const vignette = Math.min(1, 0.94 + 0.06 * (1 - (dx * dx + dy * dy)));
      rgba[index] = Math.round(PAPER[0] * vignette);
      rgba[index + 1] = Math.round(PAPER[1] * vignette);
      rgba[index + 2] = Math.round(PAPER[2] * vignette);
      rgba[index + 3] = 255;
    }
  }

  const offsetX = Math.round((width - iconSize) / 2);
  const offsetY = Math.round((height - iconSize) / 2 - 40);
  for (let y = 0; y < iconSize; y += 1) {
    for (let x = 0; x < iconSize; x += 1) {
      const source = (y * iconSize + x) * 4;
      const alpha = icon[source + 3] / 255;
      if (alpha === 0) continue;
      const target = ((y + offsetY) * width + (x + offsetX)) * 4;
      for (let c = 0; c < 3; c += 1) {
        rgba[target + c] = Math.round(rgba[target + c] * (1 - alpha) + icon[source + c] * alpha);
      }
    }
  }

  // A rule under the mark, standing in for the wordmark at preview sizes.
  const ruleY = offsetY + iconSize + 60;
  for (let y = ruleY; y < ruleY + 4; y += 1) {
    for (let x = width / 2 - 220; x < width / 2 + 220; x += 1) {
      const index = (y * width + Math.round(x)) * 4;
      rgba[index] = ACCENT[0];
      rgba[index + 1] = ACCENT[1];
      rgba[index + 2] = ACCENT[2];
    }
  }

  return encodePng(width, height, rgba);
}

/* -------------------------------------------------------------------------- */
/* WAV encoder and the three interface sounds                                 */
/* -------------------------------------------------------------------------- */

const SAMPLE_RATE = 22050;

function encodeWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767 * 0.9), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function noise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

/** A short paper-turn: filtered noise with a soft envelope. */
function pageTurn() {
  const length = Math.round(SAMPLE_RATE * 0.38);
  const random = noise(20260130);
  const samples = new Float32Array(length);
  let low = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / length;
    const envelope = Math.sin(Math.PI * t) ** 2 * (1 - t * 0.4);
    const source = random();
    low += (source - low) * 0.22; // gentle low-pass, so it is not harsh
    samples[i] = low * envelope * 0.5;
  }
  return samples;
}

/** A wax-seal press: a low thud with a short tail. */
function seal() {
  const length = Math.round(SAMPLE_RATE * 0.3);
  const random = noise(770118);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const decay = Math.exp(-t * 22);
    const body = Math.sin(2 * Math.PI * 118 * t) * 0.7 + Math.sin(2 * Math.PI * 74 * t) * 0.3;
    samples[i] = (body + random() * 0.12) * decay * 0.6;
  }
  return samples;
}

/** A send chime: two quiet, related notes. */
function send() {
  const length = Math.round(SAMPLE_RATE * 0.55);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const first = Math.sin(2 * Math.PI * 523.25 * t) * Math.exp(-t * 7);
    const second = t > 0.12 ? Math.sin(2 * Math.PI * 783.99 * (t - 0.12)) * Math.exp(-(t - 0.12) * 6) : 0;
    samples[i] = (first * 0.4 + second * 0.35) * 0.5;
  }
  return samples;
}

/* -------------------------------------------------------------------------- */

const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Dearly">
  <rect width="512" height="512" rx="92" fill="#f6f1e7"/>
  <rect x="140" y="120" width="232" height="150" rx="6" fill="#fffdf8" stroke="#2b2118" stroke-width="7"/>
  <g stroke="#2b2118" stroke-width="7" stroke-linecap="round" opacity="0.55">
    <path d="M172 160h168M172 190h168M172 220h116"/>
  </g>
  <rect x="96" y="232" width="320" height="188" rx="10" fill="#efe7d8" stroke="#2b2118" stroke-width="9"/>
  <path d="M96 240l160 120 160-120" fill="none" stroke="#2b2118" stroke-width="9" stroke-linejoin="round"/>
  <circle cx="256" cy="352" r="30" fill="#8c2f39"/>
</svg>
`;

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(soundsDir, { recursive: true });

  const outputs = [
    ['icon-192.png', drawIcon(192)],
    ['icon-512.png', drawIcon(512)],
    ['maskable-192.png', drawIcon(192, { maskable: true })],
    ['maskable-512.png', drawIcon(512, { maskable: true })],
    ['apple-touch-icon.png', drawIcon(180, { maskable: true })],
    ['icon-32.png', drawIcon(32)],
    ['social-preview.png', drawSocialPreview()],
  ];

  for (const [name, buffer] of outputs) {
    await writeFile(join(iconsDir, name), buffer);
    console.log(`icons/${name} — ${(buffer.length / 1024).toFixed(1)} kB`);
  }

  await writeFile(join(iconsDir, 'icon.svg'), SVG_ICON, 'utf8');
  await writeFile(join(iconsDir, 'favicon.ico'), buildIco(drawIcon(32), 32));

  const sounds = [
    ['page-turn.wav', pageTurn()],
    ['seal.wav', seal()],
    ['send.wav', send()],
  ];
  for (const [name, samples] of sounds) {
    const buffer = encodeWav(samples);
    await writeFile(join(soundsDir, name), buffer);
    console.log(`sounds/${name} — ${(buffer.length / 1024).toFixed(1)} kB`);
  }
}

/** An ICO wrapping a single PNG image, which every current browser accepts. */
function buildIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry[0] = size === 256 ? 0 : size;
  entry[1] = size === 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

await main();
