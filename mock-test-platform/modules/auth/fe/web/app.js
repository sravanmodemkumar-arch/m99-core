/** Auth app bootstrap — loads tenant config, applies theme, guards routes */
import { applyTheme, getSavedMode, toggleMode, THEMES, DEFAULT_THEME, registerCustomTheme } from "../shared/themes.js";
export { otpAutoAdvance, getOtpValue } from "../shared/otp-dom.js";
export { detectIdentifier } from "../shared/validators.js";
export { renderOtpInput, renderPasswordField, renderReauthGate, renderProgressSteps, renderModuleCard, renderFaqItem, renderDeviceItem, renderEmptyState, startResendTimer } from "../shared/components.js";

// When running inside Electron, desktop-adapter.js is injected via <script> in each HTML file.
// The adapter bridges window.electronAuth ↔ localStorage so this file needs no changes.

const API = "";

// ── Bootstrap ─────────────────────────────────────────────────────────────
export async function boot() {
  const cfg = await loadConfig();
  if (cfg.custom_theme) registerCustomTheme(cfg.custom_theme);
  const mode = _resolveMode(cfg);
  applyTheme(cfg.theme || cfg.custom_theme?.name || DEFAULT_THEME, mode);
  _injectModeToggle(cfg, mode);
  _applyDesktopBranding(cfg);
  return cfg;
}

function _applyDesktopBranding(cfg) {
  const aside = document.getElementById("aside-title");
  if (aside && cfg.name) aside.textContent = cfg.name;
  const sub = document.getElementById("aside-subtitle");
  if (sub && cfg.tagline) sub.textContent = cfg.tagline;
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

export { passwordStrengthScore as passwordStrength, passwordStrengthLabel } from "../shared/validators.js";

