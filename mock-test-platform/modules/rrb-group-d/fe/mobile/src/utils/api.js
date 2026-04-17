import AsyncStorage from "@react-native-async-storage/async-storage";
import { getConfig } from "../../../../../../shared/config.js";

export async function getToken() {
  return await AsyncStorage.getItem("auth_token");
}

export async function apiGet(path) {
  const { rrb_gd_base } = await getConfig();
  const token = await getToken();
  const res = await fetch(`${rrb_gd_base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiPost(path, body) {
  const { rrb_gd_base } = await getConfig();
  const token = await getToken();
  const res = await fetch(`${rrb_gd_base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function fmtTime(s) {
  if (!s) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
