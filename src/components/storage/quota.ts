/**
 * Storage quota reporting.
 *
 * The editor checks this before a large write so it can warn *before* a save
 * fails, and the Settings screen shows it so nothing about local storage is a
 * surprise.
 */

import { describe } from '../utilities/events';

export interface QuotaReport {
  supported: boolean;
  usageBytes: number;
  quotaBytes: number;
  /** 0–1. `0` when the browser will not say. */
  ratio: number;
  level: 'ok' | 'watch' | 'almost-full' | 'unknown';
  persisted: boolean;
}

export const WATCH_RATIO = 0.75;
export const ALMOST_FULL_RATIO = 0.9;

export function levelFor(usageBytes: number, quotaBytes: number): QuotaReport['level'] {
  if (!Number.isFinite(quotaBytes) || quotaBytes <= 0) return 'unknown';
  const ratio = usageBytes / quotaBytes;
  if (ratio >= ALMOST_FULL_RATIO) return 'almost-full';
  if (ratio >= WATCH_RATIO) return 'watch';
  return 'ok';
}

export async function readQuota(): Promise<QuotaReport> {
  const storage = navigator.storage as StorageManager | undefined;
  if (!storage || typeof storage.estimate !== 'function') {
    return {
      supported: false,
      usageBytes: 0,
      quotaBytes: 0,
      ratio: 0,
      level: 'unknown',
      persisted: false,
    };
  }
  try {
    const estimate = await storage.estimate();
    const usageBytes = estimate.usage ?? 0;
    const quotaBytes = estimate.quota ?? 0;
    let persisted = false;
    if (typeof storage.persisted === 'function') {
      persisted = await storage.persisted();
    }
    return {
      supported: true,
      usageBytes,
      quotaBytes,
      ratio: quotaBytes > 0 ? usageBytes / quotaBytes : 0,
      level: levelFor(usageBytes, quotaBytes),
      persisted,
    };
  } catch (error) {
    console.warn('Dearly: could not read the storage estimate.', describe(error));
    return {
      supported: false,
      usageBytes: 0,
      quotaBytes: 0,
      ratio: 0,
      level: 'unknown',
      persisted: false,
    };
  }
}

/**
 * Asks the browser to make local storage persistent, so letters are not evicted
 * under storage pressure. Browsers may grant this silently, prompt, or refuse.
 */
export async function requestPersistence(): Promise<boolean> {
  const storage = navigator.storage as StorageManager | undefined;
  if (!storage || typeof storage.persist !== 'function') return false;
  try {
    return await storage.persist();
  } catch (error) {
    console.warn('Dearly: persistence request failed.', describe(error));
    return false;
  }
}

/** True when there is room for roughly `bytes` more data. */
export function hasHeadroom(report: QuotaReport, bytes: number): boolean {
  if (!report.supported || report.quotaBytes <= 0) return true;
  return report.usageBytes + bytes < report.quotaBytes * 0.98;
}
