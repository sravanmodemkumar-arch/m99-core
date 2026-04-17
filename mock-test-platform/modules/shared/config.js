/**
 * SINGLE SOURCE OF TRUTH for all API/CDN URLs.
 * Edit DEFAULTS once → every mobile app picks it up.
 * At runtime, values can be overridden via the settings modal and are
 * persisted to AsyncStorage so they survive app restarts.
 *
 * Import in any mobile screen/utility:
 *   import { getConfig, saveConfig } from "<relative>/modules/shared/config.js";
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@mtp_config";

// ── Edit these before each deployment ─────────────────────────────────────────
export const DEFAULTS = {
  auth_base:    "http://localhost:8787",
  admin_base:   "http://localhost:8789",
  exam_base:    "http://localhost:8788",
  cdn_manifest: "http://localhost:8788/exam-engine/manifest.json",
};
// ─────────────────────────────────────────────────────────────────────────────

let _cache = null;

/** Returns merged config: DEFAULTS + any overrides stored in AsyncStorage. */
export async function getConfig() {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    _cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    _cache = { ...DEFAULTS };
  }
  return _cache;
}

/** Saves partial overrides to AsyncStorage and updates in-memory cache. */
export async function saveConfig(updates) {
  const current = await getConfig();
  const next = { ...current, ...updates };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  _cache = next;
  return next;
}

/** Clears in-memory cache — forces re-read from AsyncStorage on next getConfig(). */
export function resetConfigCache() {
  _cache = null;
}
