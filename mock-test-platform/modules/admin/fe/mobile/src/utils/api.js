import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL  = "https://api.yourplatform.com";
const ADMIN_PFX = "/admin";

export async function getToken() {
  return AsyncStorage.getItem("admin_token");
}

export async function adminGet(path) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${ADMIN_PFX}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function adminPost(path, body) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${ADMIN_PFX}${path}`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function adminPut(path, body) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${ADMIN_PFX}${path}`, {
    method:  "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function adminDelete(path) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${ADMIN_PFX}${path}`, {
    method:  "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function fmtDate(ts) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(ts); }
}
