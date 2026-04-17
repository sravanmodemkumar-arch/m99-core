import { otpAutoAdvance, getOtpValue } from "./otp-dom.js";
import { passwordStrengthScore, passwordStrengthLabel } from "./validators.js";

// ─── OTP Input ────────────────────────────────────────────────────────────────

export function renderOtpInput({ containerId, label = "", errorId = "" }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="field" data-component="otp-input">
      ${label ? `<label>${label}</label>` : ""}
      <div class="otp-row" id="otp-row-${containerId}">
        <input type="tel" maxlength="1" inputmode="numeric" autocomplete="one-time-code">
        <input type="tel" maxlength="1" inputmode="numeric">
        <input type="tel" maxlength="1" inputmode="numeric">
        <input type="tel" maxlength="1" inputmode="numeric">
        <input type="tel" maxlength="1" inputmode="numeric">
        <input type="tel" maxlength="1" inputmode="numeric">
      </div>
      ${errorId ? `<div class="error" id="${errorId}"></div>` : ""}
    </div>`;
  otpAutoAdvance(`#otp-row-${containerId}`);
  return () => getOtpValue(`#otp-row-${containerId}`);
}

// ─── Password Field ───────────────────────────────────────────────────────────

export function renderPasswordField({ containerId, label = "Password", inputId, errorId = "", showStrength = false, autocomplete = "current-password" }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="field" data-component="password-field">
      <label>${label}</label>
      <div class="pw-wrap">
        <input type="password" id="${inputId}" placeholder="${label}" autocomplete="${autocomplete}">
        <button type="button" class="pw-toggle" onclick="(function(){const i=document.getElementById('${inputId}');i.type=i.type==='password'?'text':'password'})()">👁️</button>
      </div>
      ${showStrength ? `<div class="pw-strength"><div class="pw-strength-bar"><div class="pw-strength-fill" id="pwf-${inputId}"></div></div><span class="pw-strength-label" id="pwl-${inputId}"></span></div>` : ""}
      ${errorId ? `<div class="error" id="${errorId}"></div>` : ""}
    </div>`;
  if (showStrength) {
    document.getElementById(inputId).addEventListener("input", e => {
      const score = passwordStrengthScore(e.target.value);
      const fill = document.getElementById(`pwf-${inputId}`);
      const lbl = document.getElementById(`pwl-${inputId}`);
      if (fill) { fill.style.width = `${score * 25}%`; fill.className = `pw-strength-fill s${score}`; }
      if (lbl) lbl.textContent = passwordStrengthLabel(score);
    });
  }
}

// ─── Re-auth Gate ─────────────────────────────────────────────────────────────

export function renderReauthGate({ containerId, requireOtp = false, requireTotp = false, submitLabel = "Confirm", onSubmit }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="reauth-gate" data-component="reauth-gate" style="border-top:1px solid var(--border);margin-top:1.25rem;padding-top:1.25rem">
      <div style="font-size:0.875rem;font-weight:600;margin-bottom:1rem">Confirm your identity</div>
      <div class="field">
        <label>Password *</label>
        <div class="pw-wrap">
          <input type="password" id="rg-pw-${containerId}" placeholder="Current password" autocomplete="current-password">
          <button type="button" class="pw-toggle" onclick="(function(){const i=document.getElementById('rg-pw-${containerId}');i.type=i.type==='password'?'text':'password'})()">👁️</button>
        </div>
        <div class="error" id="rg-pw-err-${containerId}"></div>
      </div>
      ${requireOtp ? `
      <div class="field">
        <label>OTP <span style="color:var(--text-muted);font-weight:400">(sent to your phone)</span></label>
        <div class="otp-row" id="rg-otp-${containerId}">
          <input type="tel" maxlength="1" inputmode="numeric"><input type="tel" maxlength="1" inputmode="numeric">
          <input type="tel" maxlength="1" inputmode="numeric"><input type="tel" maxlength="1" inputmode="numeric">
          <input type="tel" maxlength="1" inputmode="numeric"><input type="tel" maxlength="1" inputmode="numeric">
        </div>
        <div class="error" id="rg-otp-err-${containerId}"></div>
      </div>` : ""}
      ${requireTotp ? `
      <div class="field">
        <label>Authenticator Code</label>
        <div class="otp-row" id="rg-totp-${containerId}">
          <input type="tel" maxlength="1" inputmode="numeric"><input type="tel" maxlength="1" inputmode="numeric">
          <input type="tel" maxlength="1" inputmode="numeric"><input type="tel" maxlength="1" inputmode="numeric">
          <input type="tel" maxlength="1" inputmode="numeric"><input type="tel" maxlength="1" inputmode="numeric">
        </div>
        <div class="error" id="rg-totp-err-${containerId}"></div>
      </div>` : ""}
      <div class="error" id="rg-submit-err-${containerId}" style="text-align:center"></div>
      <button type="button" class="btn btn-primary" id="rg-btn-${containerId}">${submitLabel}</button>
    </div>`;
  if (requireOtp) otpAutoAdvance(`#rg-otp-${containerId}`);
  if (requireTotp) otpAutoAdvance(`#rg-totp-${containerId}`);
  document.getElementById(`rg-btn-${containerId}`).onclick = () => {
    const pw = document.getElementById(`rg-pw-${containerId}`).value;
    if (!pw) { document.getElementById(`rg-pw-err-${containerId}`).textContent = "Required"; return; }
    document.getElementById(`rg-pw-err-${containerId}`).textContent = "";
    const payload = { password: pw };
    if (requireOtp) {
      const otp = getOtpValue(`#rg-otp-${containerId}`);
      if (otp.length !== 6) { document.getElementById(`rg-otp-err-${containerId}`).textContent = "Enter all 6 digits"; return; }
      payload.otp = otp;
    }
    if (requireTotp) {
      const totp = getOtpValue(`#rg-totp-${containerId}`);
      if (totp.length !== 6) { document.getElementById(`rg-totp-err-${containerId}`).textContent = "Enter all 6 digits"; return; }
      payload.totp = totp;
    }
    onSubmit?.(payload, containerId);
  };
}

// ─── Progress Steps ───────────────────────────────────────────────────────────

export function renderProgressSteps({ containerId, total, current }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.className = "progress-bar";
  container.innerHTML = Array.from({ length: total }, (_, i) =>
    `<div class="progress-step ${i < current - 1 ? "done" : i === current - 1 ? "active" : ""}"></div>`
  ).join("");
}

// ─── Module Card (subscriptions) ─────────────────────────────────────────────

export function renderModuleCard(mod) {
  const daysLeft = mod.expires_at ? Math.ceil((new Date(mod.expires_at) - Date.now()) / 86400000) : null;
  const pct = mod.started_at && mod.expires_at
    ? Math.min(100, Math.max(0, Math.round((Date.now() - new Date(mod.started_at)) / (new Date(mod.expires_at) - new Date(mod.started_at)) * 100)))
    : 0;
  const barColor = daysLeft === null ? "var(--primary)" : daysLeft > 30 ? "var(--success)" : daysLeft > 7 ? "var(--warning)" : "var(--danger)";
  const statusClass = mod.status === "active" ? "badge-success" : "badge-muted";
  return `
    <div class="module-card" data-component="module-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;margin-bottom:0.75rem">
      <div style="display:flex;align-items:center;gap:0.875rem;margin-bottom:1rem">
        <div style="font-size:2rem;flex-shrink:0">${mod.icon || "📚"}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:0.9375rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${mod.name}</div>
          <div style="font-size:0.8125rem;color:var(--text-muted)">${mod.module_id || ""}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.25rem;align-items:flex-end">
          <span class="badge ${statusClass}">${mod.status || "unknown"}</span>
          ${mod.tier ? `<span class="badge badge-outline">${mod.tier}</span>` : ""}
        </div>
      </div>
      <div style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:0.625rem">
        ${mod.started_at ? `Started ${new Date(mod.started_at).toLocaleDateString()}` : ""}
        ${mod.expires_at ? ` · Expires ${new Date(mod.expires_at).toLocaleDateString()}` : ""}
      </div>
      ${daysLeft !== null ? `
      <div style="background:var(--surface-2);border-radius:4px;height:6px;overflow:hidden;margin-bottom:0.375rem">
        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width 0.4s"></div>
      </div>
      <div style="font-size:0.75rem;color:${barColor};font-weight:600">${daysLeft > 0 ? `${daysLeft} days left` : "Expired"}</div>` : ""}
    </div>`;
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

export function renderFaqItem(index, q, a) {
  return `
    <div class="faq-item" id="faq-${index}" data-component="faq-item" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:0.625rem;overflow:hidden">
      <div class="faq-question" onclick="this.closest('.faq-item').classList.toggle('open')" style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;cursor:pointer;font-weight:500;font-size:0.9375rem">
        <span>${q}</span><span class="faq-arrow" style="color:var(--text-muted);transition:transform 0.2s;font-size:1.125rem">›</span>
      </div>
      <div class="faq-answer" style="display:none;padding:0 1.25rem 1rem;font-size:0.875rem;color:var(--text-muted);line-height:1.6;border-top:1px solid var(--border)">${a}</div>
    </div>`;
}

// ─── Device Item ──────────────────────────────────────────────────────────────

const DEVICE_ICONS = { mobile: "📱", tablet: "📱", desktop: "🖥️", web: "🌐" };

export function renderDeviceItem(session, onEnd) {
  const icon = DEVICE_ICONS[session.device_type] || "🖥️";
  const isCurrent = session.is_current;
  const lastSeen = session.last_seen ? new Date(session.last_seen).toLocaleString() : "Unknown";
  const id = `dev-${session.session_id}`;
  return `
    <div class="device-item" id="${id}" data-component="device-item" style="display:flex;align-items:center;gap:0.875rem;padding:1rem 1.25rem;border-bottom:1px solid var(--border)">
      <div style="font-size:1.5rem;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500;font-size:0.9rem">${session.device_name || session.device_type || "Unknown device"}</div>
        <div style="font-size:0.8125rem;color:var(--text-muted)">${session.city ? session.city + " · " : ""}Last seen ${lastSeen}</div>
      </div>
      <div>
        ${isCurrent
          ? `<span class="badge badge-success">This device</span>`
          : `<button type="button" class="btn btn-danger btn-sm" onclick="(${onEnd.toString()})('${session.session_id}','${id}')">End</button>`}
      </div>
    </div>`;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function renderEmptyState({ icon = "📭", title, desc }) {
  return `
    <div data-component="empty-state" style="text-align:center;padding:3rem 1rem">
      <div style="font-size:3rem;margin-bottom:1rem">${icon}</div>
      <div style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">${title}</div>
      <div style="font-size:0.875rem;color:var(--text-muted)">${desc}</div>
    </div>`;
}

// ─── Resend OTP Timer ─────────────────────────────────────────────────────────

export function startResendTimer(btnId, timerId, seconds = 30, onResend) {
  let secs = seconds;
  const btn = document.getElementById(btnId);
  const timer = document.getElementById(timerId);
  if (btn) btn.style.display = "none";
  if (timer) { timer.style.display = "inline"; timer.textContent = `Resend in ${secs}s`; }
  const iv = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(iv);
      if (btn) btn.style.display = "inline";
      if (timer) timer.style.display = "none";
    } else {
      if (timer) timer.textContent = `Resend in ${secs}s`;
    }
  }, 1000);
}
