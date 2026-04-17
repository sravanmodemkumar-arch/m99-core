/**
 * CDN delta sync for mobile — mirrors desktop sync.js logic using fetch + AsyncStorage.
 *
 * manifest.json shape (same as desktop):
 *   { "files": [{ "key": "exam_catalogue", "url": "...", "hash": "..." }, ...] }
 *
 * Storage keys in AsyncStorage:
 *   @cdn_hash:{key}      → last known hash for key (used to skip unchanged files)
 *   @cdn_data:{key}      → cached JSON string for key
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const TIMEOUT_MS = 10000;

async function _fetch(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return { status: res.status, text: await res.text() };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export async function syncNow(manifestUrl) {
  const result = { downloaded: 0, skipped: 0, errors: [] };

  let manifest;
  try {
    const { status, text } = await _fetch(manifestUrl);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    manifest = JSON.parse(text);
  } catch (e) {
    console.log("[sync] offline or manifest failed:", e.message);
    return { ...result, offline: true };
  }

  for (const { key, url, hash } of (manifest.files || [])) {
    const storedHash = await AsyncStorage.getItem(`@cdn_hash:${key}`);
    if (storedHash === hash) { result.skipped++; continue; }
    try {
      const { status, text } = await _fetch(url);
      if (status !== 200) throw new Error(`HTTP ${status}`);
      JSON.parse(text); // validate JSON
      await AsyncStorage.setItem(`@cdn_data:${key}`, text);
      await AsyncStorage.setItem(`@cdn_hash:${key}`, hash);
      result.downloaded++;
      console.log(`[sync] ↓ ${key}`);
    } catch (e) {
      result.errors.push(`${key}: ${e.message}`);
    }
  }

  console.log(`[sync] done ↓${result.downloaded} skip:${result.skipped} err:${result.errors.length}`);
  return result;
}

export async function cacheGet(key) {
  const raw = await AsyncStorage.getItem(`@cdn_data:${key}`);
  return raw ? JSON.parse(raw) : null;
}

export async function cacheSet(key, data) {
  await AsyncStorage.setItem(`@cdn_data:${key}`, JSON.stringify(data));
}
