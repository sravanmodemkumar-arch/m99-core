/**
 * admin-common.js — shared auth guard, sidebar renderer, API helpers, toasts
 * Included by every super-admin page via <script src="./admin-common.js">
 */

// ── Auth guard ───────────────────────────────────────────────────────────────
const _TOKEN = localStorage.getItem("auth_token");
const _ROLE  = localStorage.getItem("role");

if (!_TOKEN || _ROLE !== "super_admin") {
  location.href = "/modules/auth/fe/web/login.html";
}

// ── API ──────────────────────────────────────────────────────────────────────
window.api = {
  async get(path) {
    const r = await fetch(path, { headers: { Authorization: `Bearer ${_TOKEN}` } });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: d };
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${_TOKEN}` },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: d };
  },
  async put(path, body) {
    const r = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${_TOKEN}` },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: d };
  },
  async del(path) {
    const r = await fetch(path, { method: "DELETE", headers: { Authorization: `Bearer ${_TOKEN}` } });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: d };
  },
};

// ── Toast ────────────────────────────────────────────────────────────────────
window.toast = function(msg, type = "success") {
  const colors = { success: "#16a34a", error: "#dc2626", info: "#2563eb", warn: "#d97706" };
  const el = Object.assign(document.createElement("div"), { textContent: msg });
  Object.assign(el.style, {
    position: "fixed", bottom: "24px", right: "24px", zIndex: "9999",
    padding: "12px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
    color: "#fff", maxWidth: "360px", background: colors[type] || colors.info,
    boxShadow: "0 4px 20px rgba(0,0,0,.25)", animation: "toastIn .2s ease",
    lineHeight: "1.4",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
};

// ── Modal helpers ─────────────────────────────────────────────────────────────
window.openModal = function(id)  { document.getElementById(id).style.display = "flex"; }
window.closeModal = function(id) { document.getElementById(id).style.display = "none"; }
window.closeAllModals = function() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.style.display = "none");
};
document.addEventListener("keydown", e => { if (e.key === "Escape") window.closeAllModals(); });

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV = [
  { href: "dashboard.html",  icon: "📊", label: "Dashboard"  },
  { href: "tenants.html",    icon: "🏢", label: "Tenants"    },
  { href: "users.html",      icon: "👥", label: "Users"      },
  { href: "questions.html",  icon: "❓", label: "Questions"  },
  { href: "exams.html",      icon: "📋", label: "Exams"      },
  { href: "sessions.html",   icon: "📈", label: "Sessions"   },
];

window.renderSidebar = function() {
  const cur  = location.pathname.split("/").pop();
  const name = localStorage.getItem("name") || "Super Admin";
  const navHtml = NAV.map(n => `
    <a href="${n.href}" class="nav-item${n.href === cur ? " active" : ""}">
      <span class="nav-icon">${n.icon}</span><span>${n.label}</span>
    </a>`).join("");

  document.getElementById("admin-sidebar").innerHTML = `
    <div class="sb-brand">
      <div style="font-size:26px">⚙️</div>
      <div>
        <div class="sb-title">Super Admin</div>
        <div class="sb-sub">Mock Test Platform</div>
      </div>
    </div>
    <nav class="sb-nav">${navHtml}</nav>
    <div class="sb-footer">
      <div class="sb-avatar">${name[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div class="sb-uname" title="${name}">${name}</div>
        <div class="sb-urole">super_admin</div>
      </div>
      <button class="sb-logout" onclick="adminLogout()" title="Logout">⎋</button>
    </div>`;
};

window.adminLogout = function() { localStorage.clear(); location.href = "/modules/auth/fe/web/login.html"; };

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("admin-sidebar")) window.renderSidebar();
});

// ── Shared CSS (injected once) ────────────────────────────────────────────────
const _CSS = `
@keyframes toastIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; background: #f8fafc; color: #0f172a; }

/* Layout */
.admin-wrap { display: flex; min-height: 100vh; }
#admin-sidebar {
  width: 220px; flex-shrink: 0; background: #0f172a; color: #fff;
  display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
}
.sb-brand { padding: 18px 14px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,.08); }
.sb-title { font-size: 14px; font-weight: 800; }
.sb-sub   { font-size: 10px; color: rgba(255,255,255,.4); margin-top:1px; }
.sb-nav   { padding: 10px 8px; flex: 1; overflow-y: auto; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 7px; margin-bottom: 2px; color: rgba(255,255,255,.6); text-decoration: none; font-size: 13px; font-weight: 500; transition: background .15s, color .15s; }
.nav-item:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.9); }
.nav-item.active { background: #2563eb; color: #fff; font-weight: 700; }
.nav-icon { font-size: 15px; width: 18px; text-align: center; flex-shrink: 0; }
.sb-footer { padding: 10px 12px; border-top: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; gap: 8px; }
.sb-avatar { width: 28px; height: 28px; border-radius: 50%; background: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.sb-uname  { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-urole  { font-size: 10px; color: rgba(255,255,255,.4); }
.sb-logout { margin-left: auto; background: none; border: none; color: rgba(255,255,255,.35); cursor: pointer; font-size: 17px; padding: 2px; flex-shrink:0; }
.sb-logout:hover { color: rgba(255,255,255,.8); }

/* Main */
.main-area { margin-left: 220px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { height: 52px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; position: sticky; top: 0; z-index: 50; }
.topbar-title { font-size: 15px; font-weight: 700; }
.topbar-right { display: flex; align-items: center; gap: 10px; }
.page-content { padding: 24px; flex: 1; }

/* Stat cards */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; margin-bottom: 28px; }
.stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; }
.stat-num  { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1; margin-bottom: 6px; }
.stat-lbl  { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.stat-icon { font-size: 22px; float: right; margin-top: -2px; }

/* Buttons */
.btn { border: none; border-radius: 7px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s; white-space: nowrap; }
.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:hover { background: #1d4ed8; }
.btn-danger  { background: #dc2626; color: #fff; }
.btn-danger:hover { background: #b91c1c; }
.btn-ghost   { background: #fff; color: #475569; border: 1.5px solid #e2e8f0; }
.btn-ghost:hover { background: #f8fafc; }
.btn-success { background: #16a34a; color: #fff; }
.btn-success:hover { background: #15803d; }
.btn-warn    { background: #d97706; color: #fff; }
.btn-warn:hover { background: #b45309; }
.btn-sm { padding: 5px 12px; font-size: 12px; border-radius: 5px; }
.btn:disabled { opacity:.55; cursor:not-allowed; }

/* Table */
.table-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { background: #f8fafc; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.tbl td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; vertical-align: middle; }
.tbl tr:last-child td { border-bottom: none; }
.tbl tr:hover td { background: #f8fafc; }
.tbl-actions { display: flex; gap: 6px; }

/* Badges */
.badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
.bg-blue   { background: #dbeafe; color: #1d4ed8; }
.bg-green  { background: #dcfce7; color: #15803d; }
.bg-red    { background: #fee2e2; color: #dc2626; }
.bg-gray   { background: #f1f5f9; color: #64748b; }
.bg-orange { background: #ffedd5; color: #ea580c; }
.bg-purple { background: #f3e8ff; color: #7c3aed; }
.bg-yellow { background: #fef9c3; color: #854d0e; }

/* Filter bar */
.filter-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
.filter-bar select, .filter-bar input { padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 7px; font-size: 13px; outline: none; background: #fff; color: #334155; }
.filter-bar input:focus, .filter-bar select:focus { border-color: #2563eb; }
.filter-bar input { min-width: 180px; }

/* Pagination */
.pagination { display: flex; align-items: center; gap: 6px; padding: 12px 16px; border-top: 1px solid #f1f5f9; justify-content: flex-end; background: #fafafa; }
.pg-btn { padding: 4px 11px; border: 1px solid #e2e8f0; border-radius: 5px; background: #fff; font-size: 12px; cursor: pointer; color: #475569; }
.pg-btn:disabled { opacity:.45; cursor:not-allowed; }
.pg-btn.cur { background: #2563eb; color: #fff; border-color: #2563eb; }
.pg-info { font-size: 12px; color: #64748b; margin-right: 6px; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-box { background: #fff; border-radius: 12px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,.3); }
.modal-head { padding: 18px 22px 14px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: #fff; z-index: 1; }
.modal-title { font-size: 16px; font-weight: 700; }
.modal-close { background: none; border: none; font-size: 22px; color: #94a3b8; cursor: pointer; line-height: 1; }
.modal-close:hover { color: #475569; }
.modal-body { padding: 18px 22px; }
.modal-foot { padding: 14px 22px 18px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; justify-content: flex-end; }

/* Form fields */
.fld { margin-bottom: 14px; }
.fld label { display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 5px; text-transform: uppercase; letter-spacing: .04em; }
.fld input, .fld select, .fld textarea { width: 100%; padding: 9px 11px; border: 1.5px solid #e2e8f0; border-radius: 7px; font-size: 13px; color: #0f172a; outline: none; transition: border-color .15s; font-family: inherit; background: #fff; }
.fld input:focus, .fld select:focus, .fld textarea:focus { border-color: #2563eb; }
.fld textarea { min-height: 72px; resize: vertical; }
.fld-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fld-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.fld-hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }

/* Section builder */
.sec-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px 10px; background: #f8fafc; border-radius: 7px; border: 1px solid #e2e8f0; }
.sec-row input { flex: 1; padding: 6px 10px; border: 1.5px solid #e2e8f0; border-radius: 5px; font-size: 13px; outline: none; }
.sec-row input:focus { border-color: #2563eb; }
.del-sec { background: none; border: none; color: #dc2626; cursor: pointer; font-size: 18px; padding: 0 2px; line-height: 1; }

/* Color swatch */
.color-swatch { display: inline-block; width: 18px; height: 18px; border-radius: 4px; border: 1px solid rgba(0,0,0,.2); vertical-align: middle; margin-left: 6px; }

/* Misc */
.empty-row td { text-align: center; padding: 40px 20px !important; color: #94a3b8; }
.truncate { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title-text { font-size: 14px; font-weight: 700; color: #1e293b; }
`;

const styleEl = document.createElement("style");
styleEl.textContent = _CSS;
document.head.appendChild(styleEl);
