import AsyncStorage from "@react-native-async-storage/async-storage";
import { getConfig } from "../../../../../shared/config.js";

export async function getToken() {
  return AsyncStorage.getItem("auth_token");
}

async function _fetch(path, options = {}) {
  const { user_base } = await getConfig();
  const token = await getToken();
  const res = await fetch(`${user_base}/user${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const userGet  = (path)       => _fetch(path);
export const userPut  = (path, body) => _fetch(path, { method: "PUT", body: JSON.stringify(body) });

export function fmt(score) {
  if (score == null) return "—";
  return (score >= 0 ? "+" : "") + Number(score).toFixed(3).replace(/\.?0+$/, "");
}

export function fmtDate(ts) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(ts); }
}
