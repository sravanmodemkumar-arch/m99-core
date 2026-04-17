/**
 * Platform-agnostic fetch wrapper.
 * Callers inject a getToken() function so this file has no storage dependency.
 * Web: getToken = () => localStorage.getItem("token")
 * Mobile: getToken = () => AsyncStorage.getItem("token")
 */

export function createApiClient(getToken) {
  return async function api(path, options = {}) {
    let token;
    try { token = await getToken(); } catch {}
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(path, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: { error: "Network error" } };
    }
  };
}

export async function loadConfig(api) {
  try {
    const { ok, data } = await api("/auth/config");
    if (ok) return data;
  } catch {}
  return {};
}
