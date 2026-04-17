/**
 * Admin Shell — call initAdminShell() in every admin page.
 * Injects sidebar, topbar, toast container.
 * Exports: adminApi(path, opts), toast(msg, type), showModal(id), hideModal(id)
 */

const TOKEN    = localStorage.getItem("auth_token");
const API_BASE = "/admin";

const NAV = [
  { label: "Dashboard",       icon: "📊", href: "./dashboard.html",       section: null },
  { label: "Exams",           icon: "📋", href: "./exams.html",           section: "Content" },
  { label: "Questions",       icon: "❓", href: "./questions.html",        section: null },
  { label: "Subjects",        icon: "📚", href: "./subjects.html",         section: null },
  { label: "Bulk Import",     icon: "📥", href: "./bulk-import.html",      section: null },
  { label: "Bundles",         icon: "📦", href: "./bundles.html",          section: null },
  { label: "Users",           icon: "👥", href: "./users.html",            section: "People" },
  { label: "Subscriptions",   icon: "💳", href: "./subscriptions.html",    section: null },
  { label: "Reports",         icon: "📈", href: "./reports.html",          section: "Analytics" },
  { label: "Settings",        icon: "⚙️",  href: "./settings.html",         section: "System" },
  { label: "Tenants",         icon: "🏢", href: "./tenants.html",          section: null, superOnly: true },
];

export async function initAdminShell(opts = {}) {
  if (!TOKEN) { window.location.href = "/modules/auth/fe/web/login.html"; return; }

  // Verify admin access
  let me;
  try {
    const res = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) throw new Error("not admin");
    me = await res.json();
  } catch {
    window.location.href = "/modules/auth/fe/web/login.html";
    return;
  }

  // Inject toast container
  const tc = document.createElement("div");
  tc.id = "toast-container";
  document.body.appendChild(tc);

  // Build sidebar HTML
  const current = location.pathname.split("/").pop();
  let lastSection = null;
  let navHtml = "";
  for (const item of NAV) {
    if (item.superOnly && me.role !== "super_admin") continue;
    if (item.section && item.section !== lastSection) {
      navHtml += `<div class="sidebar-section">${item.section}</div>`;
      lastSection = item.section;
    }
    const active = current === item.href.replace("./", "") ? " active" : "";
    navHtml += `<a class="nav-item${active}" href="${item.href}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></a>`;
  }

  const pageTitle = opts.title || document.title || "Admin";

  // Build full layout wrapper
  document.body.insertAdjacentHTML("afterbegin", `
<div class="admin-layout">
  <aside class="sidebar">
    <div class="sidebar-logo">⚙️ <span>Admin</span></div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">${me.uid || "admin"}</div>
      <div class="sidebar-role">${me.role || ""}</div>
    </div>
  </aside>
  <div class="admin-main">
    <div class="topbar">
      <div class="topbar-title" id="topbar-title">${pageTitle}</div>
      <div class="topbar-actions" id="topbar-actions"></div>
      <button class="btn btn-secondary btn-sm" onclick="adminLogout()">Logout</button>
    </div>
    <div class="page-body" id="page-body"></div>
  </div>
</div>`);

  // Move any existing body children (besides the layout) into page-body
  const layout   = document.querySelector(".admin-layout");
  const pageBody = document.getElementById("page-body");
  // Elements that were already in body before shell injection — move them in
  Array.from(document.body.children).forEach(el => {
    if (el !== layout && el.id !== "toast-container") pageBody.appendChild(el);
  });

  window.adminLogout = function() {
    localStorage.clear();
    window.location.href = "/modules/auth/fe/web/login.html";
  };

  return me;
}

// ── API helper ────────────────────────────────────────────────────────────────

export async function adminApi(path, opts = {}) {
  const { method = "GET", body } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── Toast ─────────────────────────────────────────────────────────────────────

export function toast(msg, type = "default") {
  const tc = document.getElementById("toast-container");
  if (!tc) return;
  const el = document.createElement("div");
  el.className = `toast ${type === "success" ? "toast-success" : type === "error" ? "toast-error" : type === "warning" ? "toast-warning" : ""}`;
  el.textContent = msg;
  tc.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

export function showModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

export function hideModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

// ── Pagination helper ─────────────────────────────────────────────────────────

export function renderPagination(containerId, page, total, limit, onPage) {
  const totalPages = Math.ceil(total / limit);
  const el = document.getElementById(containerId);
  if (!el || totalPages <= 1) { if (el) el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="pagination">
      <button class="page-btn" ${page <= 1 ? "disabled" : ""} onclick="(${onPage.toString()})(${page - 1})">‹ Prev</button>
      ${[...Array(totalPages)].map((_, i) => `
        <button class="page-btn ${i + 1 === page ? "active" : ""}" onclick="(${onPage.toString()})(${i + 1})">${i + 1}</button>
      `).join("")}
      <button class="page-btn" ${page >= totalPages ? "disabled" : ""} onclick="(${onPage.toString()})(${page + 1})">Next ›</button>
    </div>`;
}
