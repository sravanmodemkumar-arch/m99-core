/**
 * Content Disclosure & Consent Gate
 *
 * Usage (any page/screen):
 *   import { checkConsent } from "../../shared/consent.js";
 *   await checkConsent(cfg, { trigger: "exam_start", moduleId: "rrb-group-d", api });
 *
 * Returns: true if user has valid consent, false if no consent config required.
 * Throws (rejects) if user closes without agreeing — caller should block action.
 *
 * Config shape (from module KV → auth_config.consent_config):
 * {
 *   version: "2025-04",
 *   triggers: ["first_login","exam_start","notes_open","module_access","version_change"],
 *   periodic_days: 30,          // optional — re-show every N days
 *   icon: "🤖",
 *   title: "Content Disclosure",
 *   subtitle: "Please read before continuing",
 *   sections: [
 *     { icon:"🤖", heading:"AI-Generated Content", body:"..." },
 *     { icon:"⚠️", heading:"Accuracy Disclaimer", body:"..." },
 *     { icon:"📋", heading:"Exam Pattern Notice", body:"..." },
 *     { icon:"🔒", heading:"Data Usage", body:"..." }    // optional
 *   ],
 *   official_sources: [
 *     { label:"RRB Official Website", url:"https://www.rrbcdg.gov.in" }
 *   ],
 *   checkbox_label: "I understand all content is AI-generated...",
 *   agree_label: "I Agree & Continue",
 *   footer: "By continuing you acknowledge this disclosure."
 * }
 */

const STORAGE_PREFIX = "consent";

function _storageKey(moduleId, version) {
  return `${STORAGE_PREFIX}_${moduleId}_${version}`;
}

function _getStored(moduleId, version) {
  try { return JSON.parse(localStorage.getItem(_storageKey(moduleId, version)) || "null"); } catch { return null; }
}

function _setStored(moduleId, version) {
  localStorage.setItem(_storageKey(moduleId, version), JSON.stringify({ ts: Date.now() }));
}

function _isExpired(stored, periodicDays) {
  if (!periodicDays || !stored?.ts) return false;
  return (Date.now() - stored.ts) > periodicDays * 86400000;
}

export function needsConsent(cfg, trigger, moduleId) {
  const cc = cfg?.consent_config;
  if (!cc) return false;
  const triggers = cc.triggers || [];
  if (!triggers.includes(trigger) && !triggers.includes("always")) return false;
  const stored = _getStored(moduleId, cc.version);
  if (!stored) return true;
  if (_isExpired(stored, cc.periodic_days)) return true;
  return false;
}

export function checkConsent(cfg, { trigger, moduleId, api }) {
  if (!needsConsent(cfg, trigger, moduleId)) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    _showModal(cfg.consent_config, moduleId, api, resolve, reject);
  });
}

// ─── Modal rendering ──────────────────────────────────────────────────────────

function _showModal(cc, moduleId, api, resolve, reject) {
  if (document.getElementById("consent-overlay")) return;

  const tpl = document.createElement("div");
  tpl.innerHTML = _modalHTML();
  document.body.appendChild(tpl.firstElementChild);

  // Populate content
  _el("consent-header-icon").textContent = cc.icon || "📋";
  _el("consent-title").textContent = cc.title || "Content Disclosure";
  _el("consent-subtitle").textContent = cc.subtitle || "Please read before continuing";
  _el("consent-version-badge").textContent = `Version ${cc.version || "1.0"}`;
  _el("consent-checkbox-text").textContent = cc.checkbox_label || "I have read and agree to the above disclosure.";
  _el("consent-agree-label").textContent = cc.agree_label || "I Agree & Continue";
  if (cc.footer) _el("consent-footer").textContent = cc.footer;

  // Sections
  const sections = cc.sections || _defaultSections();
  _el("consent-sections").innerHTML = sections.map(s => `
    <div style="margin-bottom:1.25rem;padding:1rem;background:var(--surface-2);border-radius:var(--radius);border-left:3px solid var(--primary)">
      <div style="display:flex;align-items:center;gap:0.625rem;margin-bottom:0.5rem">
        <span style="font-size:1.25rem">${s.icon || "📌"}</span>
        <span style="font-weight:700;font-size:0.9375rem">${s.heading}</span>
      </div>
      <div style="font-size:0.875rem;color:var(--text-muted);line-height:1.65">${s.body}</div>
    </div>`).join("");

  // Official sources
  if (cc.official_sources?.length) {
    _el("consent-sources-wrap").style.display = "block";
    _el("consent-sources").innerHTML = cc.official_sources.map(src => `
      <a href="${src.url}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:0.5rem;padding:0.625rem 0.875rem;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:var(--primary);font-size:0.875rem;margin-bottom:0.5rem">
        🔗 ${src.label}
      </a>`).join("");
  }

  let scrolled = false;
  let checked = false;

  window._checkConsentScroll = function(el) {
    if (scrolled) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      scrolled = true;
      _el("consent-scroll-hint").style.display = "none";
      const lbl = _el("consent-checkbox-label");
      const cb = _el("consent-checkbox");
      lbl.style.opacity = "1";
      lbl.style.cursor = "pointer";
      cb.disabled = false;
    }
  };

  window._onConsentCheck = function() {
    checked = _el("consent-checkbox").checked;
    const btn = _el("consent-agree-btn");
    btn.disabled = !checked;
    btn.style.opacity = checked ? "1" : "0.5";
    btn.style.cursor = checked ? "pointer" : "not-allowed";
  };

  window._onConsentAgree = async function() {
    if (!checked) return;
    _setStored(moduleId, cc.version);
    if (api) {
      api("/auth/consent/record", {
        method: "POST",
        body: JSON.stringify({ module_id: moduleId, version: cc.version, trigger: "agree" })
      }).catch(() => {});
    }
    _removeModal();
    resolve(true);
  };

  // Check if body is short enough to not need scrolling
  requestAnimationFrame(() => {
    const body = _el("consent-body");
    if (body && body.scrollHeight <= body.clientHeight + 20) {
      window._checkConsentScroll({ scrollHeight: 0, scrollTop: 0, clientHeight: 1 });
    }
  });
}

function _removeModal() {
  const el = document.getElementById("consent-overlay");
  if (el) el.remove();
  delete window._checkConsentScroll;
  delete window._onConsentCheck;
  delete window._onConsentAgree;
}

function _el(id) { return document.getElementById(id); }

function _defaultSections() {
  return [
    {
      icon: "🤖",
      heading: "AI-Generated Content",
      body: "All questions, explanations, mock tests, and study material on this platform are generated using Artificial Intelligence (AI). This content is created for practice and preparation purposes only. It does not represent official exam content."
    },
    {
      icon: "⚠️",
      heading: "Accuracy Disclaimer",
      body: "AI-generated content may contain errors, inaccuracies, outdated information, or variations from official exam patterns. The platform does not guarantee correctness. Always verify facts, answers, and syllabus from official government and examination authority sources before your exam."
    },
    {
      icon: "📋",
      heading: "Exam Pattern Notice",
      body: "Mock tests and practice questions are modelled on publicly available syllabi and previous year patterns. The actual exam may differ in structure, difficulty, or content. Appearing in this mock test does not imply any relationship with the official examination authority."
    },
    {
      icon: "🔒",
      heading: "Your Data",
      body: "Your answers, scores, and usage data are stored securely and used only to generate performance reports and improve your preparation experience. Your data is not shared with third parties or examination authorities."
    }
  ];
}

function _modalHTML() {
  return `<div id="consent-overlay" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center;padding:0;animation:fadeIn 0.2s ease">
  <div id="consent-sheet" style="background:var(--surface);width:100%;max-width:600px;max-height:92vh;border-radius:var(--radius) var(--radius) 0 0;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.25s ease">
    <div style="padding:1.25rem 1.5rem 1rem;border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div id="consent-header-icon" style="font-size:1.75rem">📋</div>
        <div>
          <div id="consent-title" style="font-size:1.0625rem;font-weight:700;line-height:1.3"></div>
          <div id="consent-subtitle" style="font-size:0.8125rem;color:var(--text-muted);margin-top:0.125rem"></div>
        </div>
      </div>
      <div id="consent-version-badge" style="display:inline-block;margin-top:0.625rem;font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);background:var(--surface-2);border:1px solid var(--border);padding:0.125rem 0.5rem;border-radius:999px"></div>
    </div>
    <div id="consent-body" style="overflow-y:auto;flex:1;padding:1.25rem 1.5rem" onscroll="window._checkConsentScroll(this)">
      <div id="consent-sections"></div>
      <div id="consent-sources-wrap" style="display:none;margin-top:1.25rem">
        <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:0.625rem">Official Sources</div>
        <div id="consent-sources"></div>
      </div>
      <div id="consent-footer" style="margin-top:1.25rem;padding:0.875rem;background:var(--surface-2);border-radius:var(--radius);font-size:0.8rem;color:var(--text-muted);line-height:1.6"></div>
      <div id="consent-scroll-hint" style="text-align:center;padding:0.875rem 0;font-size:0.8125rem;color:var(--text-muted)">↓ Scroll to read all before agreeing</div>
    </div>
    <div style="padding:1rem 1.5rem;border-top:1px solid var(--border);flex-shrink:0;background:var(--surface)">
      <label style="display:flex;align-items:flex-start;gap:0.75rem;margin-bottom:0.875rem;cursor:pointer;opacity:0.4;transition:opacity 0.2s" id="consent-checkbox-label">
        <input type="checkbox" id="consent-checkbox" disabled onchange="window._onConsentCheck()" style="margin-top:0.125rem;width:18px;height:18px;flex-shrink:0;accent-color:var(--primary)">
        <span id="consent-checkbox-text" style="font-size:0.875rem;line-height:1.5"></span>
      </label>
      <button id="consent-agree-btn" disabled onclick="window._onConsentAgree()" class="btn btn-primary" style="width:100%;opacity:0.5;cursor:not-allowed">
        <span id="consent-agree-label">I Agree &amp; Continue</span>
      </button>
    </div>
  </div>
  <style>@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}#consent-body::-webkit-scrollbar{width:4px}#consent-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}</style>
</div>`;
}
