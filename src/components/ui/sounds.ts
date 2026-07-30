/**
 * Optional interface sounds.
 *
 * Off by default. Sounds are decoration only: every event that has a sound also
 * has a visible state and a screen-reader announcement, so nothing is conveyed by
 * audio alone. Files are small local WAVs, fetched only after sounds are enabled.
 */

import { getPreferences } from '../storage/preferences';
import { assetUrl } from '../utilities/assets';
import { describe } from '../utilities/events';

export type SoundName = 'page' | 'seal' | 'send';

const FILES: Record<SoundName, string> = {
  page: 'sounds/page-turn.wav',
  seal: 'sounds/seal.wav',
  send: 'sounds/send.wav',
};

const buffers = new Map<SoundName, AudioBuffer>();
let audioContext: AudioContext | null = null;

export function soundsSupported(): boolean {
  return typeof window !== 'undefined' && 'AudioContext' in window;
}

function context(): AudioContext | null {
  if (!soundsSupported()) return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

export async function playSound(name: SoundName): Promise<void> {
  if (!getPreferences().sounds) return;
  const ctx = context();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') await ctx.resume();
    let buffer = buffers.get(name);
    if (!buffer) {
      const response = await fetch(assetUrl(FILES[name]));
      if (!response.ok) return;
      buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      buffers.set(name, buffer);
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.start();
  } catch (error) {
    // Audio is never essential; a failure is logged and ignored.
    console.warn('Dearly: a sound could not be played.', describe(error));
  }
}

export function releaseAudio(): void {
  buffers.clear();
  void audioContext?.close();
  audioContext = null;
}
