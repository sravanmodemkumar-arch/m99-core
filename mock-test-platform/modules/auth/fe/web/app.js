/** Auth app bootstrap — loads tenant config, applies theme, guards routes */
import { applyTheme, getSavedMode, toggleMode, THEMES, DEFAULT_THEME } from "../shared/themes.js";

const API = "";

// ── Bootstrap ─────────────────────────────────────────────────────────────
export async function boot() {
  const cfg = await loadConfig();
  const mode = _resolveMode(cfg);
  applyTheme(cfg.theme || DEFAULT_THEME, mode);
  _injectModeToggle(cfg, mode);
  return cfg;
}

async function loadConfig() {
  try {
    const res = await fetch(`${API}/auth/config`);
    if (res.ok) return res.json();
  } catch {}
  return {};
}

function _resolveMode(cfg) {
  const control = cfg.mode_control || "user";
  if (control === "force_light") return "light";
  if (control === "force_dark") return "dark";
  if (control === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return getSavedMode(); // "user"
}

function _injectModeToggle(cfg, mode) {
  if (cfg.mode_control === "force_light" || cfg.mode_control === "force_dark") return;
  const btn = document.getElementById("mode-toggle");
  if (!btn) return;
  btn.textContent = mode === "dark" ? "☀️" : "🌙";
  btn.addEventListener("click", () => {
    const next = toggleMode();
    applyTheme(cfg.theme || DEFAULT_THEME, next);
    btn.textContent = next === "dark" ? "☀️" : "🌙";
  });
}

// ── Auth guards ────────────────────────────────────────────────────────────
export function requireAuth() {
  const token = localStorage.getItem("auth_token");
  if (!token) { window.location.href = "/auth/web/login.html"; return false; }
  return true;
}

export function requireGuest() {
  const token = localStorage.getItem("auth_token");
  if (token) { window.location.href = "/auth/web/home.html"; return false; }
  return true;
}

// ── API helpers ────────────────────────────────────────────────────────────
export async function api(path, options = {}) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── UI helpers ─────────────────────────────────────────────────────────────
export function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || "";
}

export function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (label) btn.textContent = loading ? "Please wait…" : label;
}

export function toast(msg, type = "default") {
  let container = document.querySelector(".toast-container");
  if (!container) { container = document.createElement("div"); container.className = "toast-container"; document.body.appendChild(container); }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

export function passwordStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

export function otpAutoAdvance(rowSelector) {
  const digits = document.querySelectorAll(`${rowSelector} input`);
  digits.forEach((input, i) => {
    input.addEventListener("input", () => { if (input.value && i < digits.length - 1) digits[i + 1].focus(); });
    input.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !input.value && i > 0) digits[i - 1].focus(); });
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, digits.length);
      [...text].forEach((c, j) => { if (digits[i + j]) digits[i + j].value = c; });
      const last = digits[Math.min(i + text.length, digits.length - 1)];
      last.focus();
    });
  });
}

export function getOtpValue(rowSelector) {
  return [...document.querySelectorAll(`${rowSelector} input`)].map(i => i.value).join("");
}

export function detectIdentifier(value) {
  if (/^\d{10}$/.test(value)) return "phone";
  if (value.includes("@")) return "email";
  if (/^[a-zA-Z0-9_]{3,30}$/.test(value)) return "username";
  return "userid";
}
