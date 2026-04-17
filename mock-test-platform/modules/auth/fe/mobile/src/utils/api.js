import { createApiClient, loadConfig } from "../../../shared/api.js";
import { Storage } from "./storage.js";

export const api = createApiClient(() => Storage.get("token"));

let _cfg = null;
export async function getConfig() {
  if (_cfg) return _cfg;
  _cfg = await loadConfig(api);
  return _cfg;
}

export async function requireAuth(navigation) {
  const token = await Storage.get("token");
  if (!token) { navigation.replace("Login"); return false; }
  return true;
}

export async function requireGuest(navigation) {
  const token = await Storage.get("token");
  if (token) { navigation.replace("Home"); return false; }
  return true;
}
