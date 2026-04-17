/**
 * SINGLE SOURCE OF TRUTH for all API/CDN URLs.
 *
 * ► To change URLs for a deployment: edit modules/shared/app-config.json ONLY.
 *   All mobile apps, desktop apps, and servers read from that one file.
 *
 * Mobile (React Native): import getConfig/saveConfig from here.
 *   - Returns DEFAULTS merged with any runtime overrides saved in AsyncStorage.
 *   - Runtime overrides: tap ⚙ gear on any login screen → settings modal.
 *
 * Desktop / Node: read modules/shared/app-config.json directly with fs.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import _defaults from "./app-config.json";

const STORAGE_KEY = "@mtp_config";

export const DEFAULTS = {
  auth_base:    _defaults.auth_base,
  admin_base:   _defaults.admin_base,
  exam_base:    _defaults.exam_base,
  user_base:    _defaults.user_base,
  rrb_base:     _defaults.rrb_base,
  rrb_gd_base:  _defaults.rrb_gd_base,
  cdn_manifest: _defaults.cdn_manifest,
};

let _cache = null;

/** Returns merged config: DEFAULTS + any runtime overrides from AsyncStorage. */
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
