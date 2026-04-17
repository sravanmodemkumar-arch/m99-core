/**
 * Rich question-body renderer.
 * Converts a body array (or plain string) to HTML.
 *
 * Segment schema (body is an array of segments):
 *   {t:"tx",    v:"..."}                        plain text  (\n → <br>)
 *   {t:"para",  v:"..."}                        paragraph   (<p>)
 *   {t:"b",     v:"..."}                        bold inline
 *   {t:"i",     v:"..."}                        italic inline
 *   {t:"u",     v:"..."}                        underline inline
 *   {t:"br"}                                    line break
 *   {t:"label", v:"..."}                        bold block label  ("Statements:", "Conclusion I:")
 *   {t:"img",   src:"...", alt?:"", w?:"60%"}   image
 *   {t:"svg",   v:"<svg>…</svg>"}               inline SVG
 *   {t:"tbl",   headers:[], rows:[][], caption?:"..."}       data table
 *   {t:"chart", kind:"bar|col|pie|donut|line",
 *               title?:"...",
 *               data:{labels:[…], values:[…], colors?:[…]}}  chart
 *   {t:"list",  items:[…], ordered?:false}      bullet / numbered list
 *   {t:"steps", items:[…]}                      numbered step list (styled)
 *   {t:"code",  v:"..."}                        monospace block
 *   {t:"math",  v:"...LaTeX...", display?:false} KaTeX math (inline or block)
 *   {t:"map",   src:"...", alt?:"...", w?:"..."}  map image (same as img, alias)
 *   {t:"hr"}                                    horizontal rule divider
 *   {t:"note",  v:"..."}                        info note box
 *   {t:"warn",  v:"..."}                        warning note box
 */

const DEFAULT_COLORS = [
  "#1e40af","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2","#db2777","#65a30d",
];

// LaTeX math command pattern — triggers math auto-wrap when no $ delimiters present
const LATEX_RE = /\\(sin|cos|tan|cot|sec|csc|frac|sqrt|sum|int|prod|lim|log|ln|exp|times|div|pm|mp|cdot|leq|geq|neq|approx|equiv|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega|infty|forall|exists|partial|nabla|vec|hat|bar|angle|perp|triangle|rightarrow|leftarrow|Rightarrow|therefore|because)\b/;

export function renderBody(body) {
  if (!body) return "";
  if (!Array.isArray(body)) {
    return _renderText(String(body));
  }
  return body.map(renderSeg).join("");
}

// Safe escaping for math content: escapes XSS chars but preserves \, $, ^, _, {, }
function escMath(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Render plain text: auto-wraps LaTeX math with $ delimiters if needed
function _renderText(s) {
  if (!s) return "";
  // Already has $ delimiters → pass through with XSS-safe escaping, KaTeX handles it
  if (s.includes("$")) return escMath(s).replace(/\n/g, "<br>");
  // Contains LaTeX commands but no delimiters → wrap entire string as inline math
  if (LATEX_RE.test(s)) return `<span class="qb-math">$${escMath(s)}$</span>`;
  // Plain text → full HTML escape
  return esc(s).replace(/\n/g, "<br>");
}

function renderSeg(seg) {
  if (!seg || !seg.t) return "";
  switch (seg.t) {
    case "tx":
      return _renderText(seg.v || "");

    case "para":
      return `<p class="qb-para">${_renderText(seg.v || "")}</p>`;

    case "b":
      return `<strong>${esc(seg.v || "")}</strong>`;

    case "i":
      return `<em>${esc(seg.v || "")}</em>`;

    case "u":
      return `<u>${esc(seg.v || "")}</u>`;

    case "br":
      return "<br>";

    case "hr":
      return `<hr class="qb-hr">`;

    case "label":
      return `<div class="qb-label">${esc(seg.v || "")}</div>`;

    case "note":
      return `<div class="qb-note">${esc(seg.v || "").replace(/\n/g, "<br>")}</div>`;

    case "warn":
      return `<div class="qb-warn">${esc(seg.v || "").replace(/\n/g, "<br>")}</div>`;

    case "img":
    case "map":
      return `<div class="qb-img-wrap">
        <img class="qb-img" src="${ea(seg.src || seg.v || "")}" alt="${ea(seg.alt || "")}"
          ${seg.w ? `style="max-width:${ea(seg.w)}"` : ""}>
        ${seg.caption ? `<div class="qb-img-caption">${esc(seg.caption)}</div>` : ""}
      </div>`;

    case "svg":
      return `<div class="qb-svg-wrap">${seg.v || ""}</div>`;

    case "tbl":
      return renderTable(seg);

    case "chart":
      return renderChart(seg);

    case "list":
      return renderList(seg);

    case "steps":
      return renderSteps(seg);

    case "code":
      return `<pre class="qb-code">${esc(seg.v || "")}</pre>`;

    case "math":
      // Output raw LaTeX with KaTeX delimiters — KaTeX auto-render picks these up
      if (seg.display) {
        return `<div class="qb-math-block">\\[${seg.v || ""}\\]</div>`;
      }
      return `<span class="qb-math">\\(${seg.v || ""}\\)</span>`;

    default:
      return esc(String(seg.v ?? ""));
  }
}

// ── Table ──────────────────────────────────────────────────────────────────
function renderTable(seg) {
  const headers = seg.headers || [];
  const rows    = seg.rows    || [];
  const caption = seg.caption
    ? `<caption class="qb-tbl-caption">${esc(seg.caption)}</caption>` : "";
  const thead = headers.length
    ? `<thead><tr>${headers.map(h => `<th>${esc(String(h))}</th>`).join("")}</tr></thead>` : "";
  const tbody = `<tbody>${rows.map(row =>
    `<tr>${row.map(cell => `<td>${esc(String(cell ?? ""))}</td>`).join("")}</tr>`
  ).join("")}</tbody>`;
  return `<div class="qb-tbl-wrap"><table class="qb-tbl">${caption}${thead}${tbody}</table></div>`;
}

// ── List ───────────────────────────────────────────────────────────────────
function renderList(seg) {
  const tag   = seg.ordered ? "ol" : "ul";
  const items = (seg.items || []).map(item => {
    const text = typeof item === "object" ? renderBody(item.body || item.v || "") : _renderText(String(item));
    return `<li>${text}</li>`;
  }).join("");
  return `<${tag} class="qb-list">${items}</${tag}>`;
}

// ── Steps ──────────────────────────────────────────────────────────────────
function renderSteps(seg) {
  const items = (seg.items || []).map((item, i) => {
    const text = typeof item === "object" ? renderBody(item.body || item.v || "") : _renderText(String(item));
    return `<div class="qb-step">
      <div class="qb-step-num">${i + 1}</div>
      <div class="qb-step-body">${text}</div>
    </div>`;
  }).join("");
  return `<div class="qb-steps">${items}</div>`;
}

// ── Charts ─────────────────────────────────────────────────────────────────
function renderChart(seg) {
  const { labels = [], values = [], colors } = seg.data || {};
  if (!labels.length || !values.length)
    return `<div class="qb-chart-empty">No chart data</div>`;

  const resolvedColors = labels.map((_, i) =>
    (colors && colors[i]) || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
  );
  const title = seg.title
    ? `<div class="qb-chart-title">${esc(seg.title)}</div>` : "";
  const max   = Math.max(...values, 1);

  switch (seg.kind) {
    case "pie":
    case "donut":
      return renderPieChart(seg.kind === "donut", labels, values, resolvedColors, title);
    case "bar":
      return renderHBarChart(labels, values, resolvedColors, max, title);
    case "line":
    case "col":
    default:
      return renderVBarChart(labels, values, resolvedColors, max, title);
  }
}

function renderHBarChart(labels, values, colors, max, title) {
  const rows = labels.map((lbl, i) => {
    const pct = Math.round((values[i] / max) * 100);
    return `<div class="qb-hbar-row">
      <div class="qb-hbar-label">${esc(String(lbl))}</div>
      <div class="qb-hbar-track">
        <div class="qb-hbar-fill" style="width:${pct}%;background:${colors[i]}"></div>
      </div>
      <div class="qb-hbar-val">${values[i]}</div>
    </div>`;
  }).join("");
  return `<div class="qb-chart">${title}<div class="qb-hbar">${rows}</div></div>`;
}

function renderVBarChart(labels, values, colors, max, title) {
  const bars = labels.map((lbl, i) => {
    const pct = Math.round((values[i] / max) * 100);
    return `<div class="qb-vbar-col">
      <div class="qb-vbar-val">${values[i]}</div>
      <div class="qb-vbar-track">
        <div class="qb-vbar-fill" style="height:${pct}%;background:${colors[i]}"></div>
      </div>
      <div class="qb-vbar-label">${esc(String(lbl))}</div>
    </div>`;
  }).join("");
  return `<div class="qb-chart">${title}<div class="qb-vbar">${bars}</div></div>`;
}

function renderPieChart(isDonut, labels, values, colors, title) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let cumDeg  = 0;
  const stops = labels.map((_, i) => {
    const deg  = (values[i] / total) * 360;
    const stop = `${colors[i]} ${Math.round(cumDeg)}deg ${Math.round(cumDeg + deg)}deg`;
    cumDeg += deg;
    return stop;
  }).join(", ");

  const hole   = isDonut ? `<div class="qb-pie-hole"></div>` : "";
  const legend = labels.map((lbl, i) =>
    `<div class="qb-pie-legend-row">
      <span class="qb-pie-dot" style="background:${colors[i]}"></span>
      <span>${esc(String(lbl))}</span>
      <span class="qb-pie-pct">${Math.round((values[i] / total) * 100)}%</span>
    </div>`
  ).join("");

  return `<div class="qb-chart">
    ${title}
    <div class="qb-pie-wrap">
      <div class="qb-pie" style="background:conic-gradient(${stops})">${hole}</div>
      <div class="qb-pie-legend">${legend}</div>
    </div>
  </div>`;
}

// ── Escape helpers ─────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function ea(s) {
  return String(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
