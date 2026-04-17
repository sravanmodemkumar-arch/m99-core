import AsyncStorage from "@react-native-async-storage/async-storage";
import { getConfig } from "../../../../../shared/config.js";

export async function getToken() {
  return AsyncStorage.getItem("admin_token");
}

async function _fetch(path, options = {}) {
  const { admin_base } = await getConfig();
  const token = await getToken();
  const res = await fetch(`${admin_base}/admin${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const adminGet    = (path)       => _fetch(path);
export const adminPost   = (path, body) => _fetch(path, { method: "POST",   body: JSON.stringify(body) });
export const adminPut    = (path, body) => _fetch(path, { method: "PUT",    body: JSON.stringify(body) });
export const adminDelete = (path)       => _fetch(path, { method: "DELETE" });

export function fmtDate(ts) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(ts); }
}
