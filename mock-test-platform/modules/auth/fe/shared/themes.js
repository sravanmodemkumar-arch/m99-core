/** 25 themes × 2 modes. Each theme: light + dark token sets. */
export const THEMES = {
  "ocean-blue":    { light: { primary:"#2563EB", primaryDark:"#1D4ED8", bg:"#F8FAFC", surface:"#FFFFFF", surface2:"#F1F5F9", text:"#0F172A", textMuted:"#64748B", border:"#E2E8F0" }, dark: { primary:"#60A5FA", primaryDark:"#3B82F6", bg:"#0B1222", surface:"#131F35", surface2:"#1E2D45", text:"#F1F5F9", textMuted:"#94A3B8", border:"#1E3A5F" } },
  "forest-green":  { light: { primary:"#16A34A", primaryDark:"#15803D", bg:"#F0FDF4", surface:"#FFFFFF", surface2:"#DCFCE7", text:"#052E16", textMuted:"#4B7A5A", border:"#BBF7D0" }, dark: { primary:"#4ADE80", primaryDark:"#22C55E", bg:"#031A0E", surface:"#072917", surface2:"#0D3D22", text:"#DCFCE7", textMuted:"#86EFAC", border:"#14532D" } },
  "royal-purple":  { light: { primary:"#7C3AED", primaryDark:"#6D28D9", bg:"#FAF5FF", surface:"#FFFFFF", surface2:"#F3E8FF", text:"#1E0040", textMuted:"#7E5A9B", border:"#DDD6FE" }, dark: { primary:"#A78BFA", primaryDark:"#8B5CF6", bg:"#0D0520", surface:"#18083A", surface2:"#25104F", text:"#F3E8FF", textMuted:"#C4B5FD", border:"#4C1D95" } },
  "sunset-orange": { light: { primary:"#EA580C", primaryDark:"#C2410C", bg:"#FFF7ED", surface:"#FFFFFF", surface2:"#FFEDD5", text:"#431407", textMuted:"#9A5C38", border:"#FED7AA" }, dark: { primary:"#FB923C", primaryDark:"#F97316", bg:"#1C0900", surface:"#2D1200", surface2:"#3F1C00", text:"#FFEDD5", textMuted:"#FCA06B", border:"#7C2D12" } },
  "crimson-red":   { light: { primary:"#DC2626", primaryDark:"#B91C1C", bg:"#FFF5F5", surface:"#FFFFFF", surface2:"#FEE2E2", text:"#450A0A", textMuted:"#9B4141", border:"#FECACA" }, dark: { primary:"#F87171", primaryDark:"#EF4444", bg:"#1A0505", surface:"#2D0808", surface2:"#3F0D0D", text:"#FEE2E2", textMuted:"#FCA5A5", border:"#7F1D1D" } },
  "midnight-dark": { light: { primary:"#334155", primaryDark:"#1E293B", bg:"#F8FAFC", surface:"#FFFFFF", surface2:"#F1F5F9", text:"#0F172A", textMuted:"#64748B", border:"#E2E8F0" }, dark: { primary:"#94A3B8", primaryDark:"#CBD5E1", bg:"#020617", surface:"#0F172A", surface2:"#1E293B", text:"#F1F5F9", textMuted:"#94A3B8", border:"#1E293B" } },
  "golden-amber":  { light: { primary:"#D97706", primaryDark:"#B45309", bg:"#FFFBEB", surface:"#FFFFFF", surface2:"#FEF3C7", text:"#1C0A00", textMuted:"#926800", border:"#FDE68A" }, dark: { primary:"#FCD34D", primaryDark:"#FBBF24", bg:"#1C1000", surface:"#2D1A00", surface2:"#3F2500", text:"#FEF3C7", textMuted:"#FDE68A", border:"#92400E" } },
  "steel-gray":    { light: { primary:"#475569", primaryDark:"#334155", bg:"#F8FAFC", surface:"#FFFFFF", surface2:"#F1F5F9", text:"#0F172A", textMuted:"#64748B", border:"#CBD5E1" }, dark: { primary:"#94A3B8", primaryDark:"#CBD5E1", bg:"#111318", surface:"#1C2028", surface2:"#252B36", text:"#E2E8F0", textMuted:"#94A3B8", border:"#334155" } },
  "rose-pink":     { light: { primary:"#DB2777", primaryDark:"#BE185D", bg:"#FFF0F7", surface:"#FFFFFF", surface2:"#FCE7F3", text:"#3D0020", textMuted:"#9B4470", border:"#FBCFE8" }, dark: { primary:"#F472B6", primaryDark:"#EC4899", bg:"#1A0010", surface:"#2D0020", surface2:"#3F0030", text:"#FCE7F3", textMuted:"#F9A8D4", border:"#831843" } },
  "deep-teal":     { light: { primary:"#0D9488", primaryDark:"#0F766E", bg:"#F0FDFA", surface:"#FFFFFF", surface2:"#CCFBF1", text:"#022C22", textMuted:"#2D7A70", border:"#99F6E4" }, dark: { primary:"#2DD4BF", primaryDark:"#14B8A6", bg:"#021A16", surface:"#042F27", surface2:"#083D32", text:"#CCFBF1", textMuted:"#5EEAD4", border:"#0F4038" } },
  "indigo":        { light: { primary:"#4338CA", primaryDark:"#3730A3", bg:"#EEF2FF", surface:"#FFFFFF", surface2:"#E0E7FF", text:"#1E1B4B", textMuted:"#5B5EA6", border:"#C7D2FE" }, dark: { primary:"#818CF8", primaryDark:"#6366F1", bg:"#0D0B2A", surface:"#15113F", surface2:"#1E1857", text:"#E0E7FF", textMuted:"#A5B4FC", border:"#312E81" } },
  "emerald":       { light: { primary:"#059669", primaryDark:"#047857", bg:"#ECFDF5", surface:"#FFFFFF", surface2:"#D1FAE5", text:"#022C22", textMuted:"#2D6A50", border:"#A7F3D0" }, dark: { primary:"#34D399", primaryDark:"#10B981", bg:"#021810", surface:"#04291C", surface2:"#063D2A", text:"#D1FAE5", textMuted:"#6EE7B7", border:"#065F46" } },
  "sky-blue":      { light: { primary:"#0284C7", primaryDark:"#0369A1", bg:"#F0F9FF", surface:"#FFFFFF", surface2:"#E0F2FE", text:"#082F49", textMuted:"#2A6E9A", border:"#BAE6FD" }, dark: { primary:"#38BDF8", primaryDark:"#0EA5E9", bg:"#030F1A", surface:"#051C2E", surface2:"#082A42", text:"#E0F2FE", textMuted:"#7DD3FC", border:"#0C4A6E" } },
  "violet":        { light: { primary:"#7C3AED", primaryDark:"#6D28D9", bg:"#FAF5FF", surface:"#FFFFFF", surface2:"#F3E8FF", text:"#2E1065", textMuted:"#6B46C1", border:"#DDD6FE" }, dark: { primary:"#A78BFA", primaryDark:"#8B5CF6", bg:"#120729", surface:"#1E0F42", surface2:"#2B175A", text:"#F3E8FF", textMuted:"#C4B5FD", border:"#4C1D95" } },
  "navy":          { light: { primary:"#1E3A5F", primaryDark:"#152A47", bg:"#F0F4F8", surface:"#FFFFFF", surface2:"#D9E4F0", text:"#0A1929", textMuted:"#3A5A80", border:"#B0C4D8" }, dark: { primary:"#5B8DB8", primaryDark:"#4A7AA8", bg:"#060E18", surface:"#0D1E30", surface2:"#152D45", text:"#D9E4F0", textMuted:"#7AA3C0", border:"#1E3A5F" } },
  "coral":         { light: { primary:"#F43F5E", primaryDark:"#E11D48", bg:"#FFF1F2", surface:"#FFFFFF", surface2:"#FFE4E6", text:"#44080F", textMuted:"#9B3A4A", border:"#FECDD3" }, dark: { primary:"#FB7185", primaryDark:"#F43F5E", bg:"#1A0508", surface:"#2D080E", surface2:"#400C15", text:"#FFE4E6", textMuted:"#FDA4AF", border:"#881337" } },
  "sage-green":    { light: { primary:"#65A30D", primaryDark:"#4D7C0F", bg:"#F7FEE7", surface:"#FFFFFF", surface2:"#ECFCCB", text:"#1A2E05", textMuted:"#4E7A20", border:"#D9F99D" }, dark: { primary:"#A3E635", primaryDark:"#84CC16", bg:"#0D1800", surface:"#192800", surface2:"#243800", text:"#ECFCCB", textMuted:"#BEF264", border:"#365314" } },
  "bronze":        { light: { primary:"#92400E", primaryDark:"#78350F", bg:"#FEFCE8", surface:"#FFFFFF", surface2:"#FEF9C3", text:"#1C1600", textMuted:"#7A5C00", border:"#FDE047" }, dark: { primary:"#D4A04A", primaryDark:"#B8872D", bg:"#150D00", surface:"#241600", surface2:"#352100", text:"#FEF9C3", textMuted:"#CA8A04", border:"#78350F" } },
  "lavender":      { light: { primary:"#818CF8", primaryDark:"#6366F1", bg:"#FAF5FF", surface:"#FFFFFF", surface2:"#EDE9FE", text:"#1E1B4B", textMuted:"#6B65B0", border:"#DDD6FE" }, dark: { primary:"#A5B4FC", primaryDark:"#818CF8", bg:"#0E0B2E", surface:"#19154A", surface2:"#241E62", text:"#EDE9FE", textMuted:"#C4B5FD", border:"#3730A3" } },
  "charcoal":      { light: { primary:"#1C1C1E", primaryDark:"#000000", bg:"#F4F4F5", surface:"#FFFFFF", surface2:"#E4E4E7", text:"#09090B", textMuted:"#71717A", border:"#D4D4D8" }, dark: { primary:"#A1A1AA", primaryDark:"#D4D4D8", bg:"#09090B", surface:"#18181B", surface2:"#27272A", text:"#FAFAFA", textMuted:"#A1A1AA", border:"#3F3F46" } },
  "mint":          { light: { primary:"#10B981", primaryDark:"#059669", bg:"#ECFDF5", surface:"#FFFFFF", surface2:"#D1FAE5", text:"#022C22", textMuted:"#2D7A60", border:"#A7F3D0" }, dark: { primary:"#34D399", primaryDark:"#10B981", bg:"#021410", surface:"#04231B", surface2:"#063326", text:"#D1FAE5", textMuted:"#6EE7B7", border:"#065F46" } },
  "deep-maroon":   { light: { primary:"#881337", primaryDark:"#6F0F2D", bg:"#FFF5F7", surface:"#FFFFFF", surface2:"#FFE4EA", text:"#3D0012", textMuted:"#8B3A50", border:"#FECDD3" }, dark: { primary:"#FB7185", primaryDark:"#F43F5E", bg:"#1A0008", surface:"#2D0012", surface2:"#40001C", text:"#FFE4EA", textMuted:"#FDA4AF", border:"#881337" } },
  "pearl-white":   { light: { primary:"#475569", primaryDark:"#334155", bg:"#F8FAFC", surface:"#FFFFFF", surface2:"#F1F5F9", text:"#0F172A", textMuted:"#94A3B8", border:"#E2E8F0" }, dark: { primary:"#CBD5E1", primaryDark:"#94A3B8", bg:"#F8FAFC", surface:"#FFFFFF", surface2:"#F1F5F9", text:"#0F172A", textMuted:"#64748B", border:"#E2E8F0" } },
  "electric-blue": { light: { primary:"#0EA5E9", primaryDark:"#0284C7", bg:"#F0F9FF", surface:"#FFFFFF", surface2:"#E0F2FE", text:"#082F49", textMuted:"#2A6E9A", border:"#BAE6FD" }, dark: { primary:"#38BDF8", primaryDark:"#0EA5E9", bg:"#020C18", surface:"#041828", surface2:"#06233C", text:"#E0F2FE", textMuted:"#7DD3FC", border:"#0369A1" } },
  "saffron":       { light: { primary:"#F59E0B", primaryDark:"#D97706", bg:"#FFFBEB", surface:"#FFFFFF", surface2:"#FEF3C7", text:"#1C0A00", textMuted:"#926800", border:"#FDE68A" }, dark: { primary:"#FCD34D", primaryDark:"#FBBF24", bg:"#1A1000", surface:"#2B1A00", surface2:"#3D2600", text:"#FEF3C7", textMuted:"#FDE68A", border:"#92400E" } },
};

export const THEME_NAMES = Object.keys(THEMES);
export const DEFAULT_THEME = "ocean-blue";
export const DEFAULT_MODE = "light";

export function getThemeVars(themeName, mode) {
  const theme = THEMES[themeName] || THEMES[DEFAULT_THEME];
  return theme[mode] || theme.light;
}

export function applyTheme(themeName, mode) {
  const vars = getThemeVars(themeName, mode);
  const root = document.documentElement;
  root.style.setProperty("--primary", vars.primary);
  root.style.setProperty("--primary-dark", vars.primaryDark);
  root.style.setProperty("--bg", vars.bg);
  root.style.setProperty("--surface", vars.surface);
  root.style.setProperty("--surface-2", vars.surface2);
  root.style.setProperty("--text", vars.text);
  root.style.setProperty("--text-muted", vars.textMuted);
  root.style.setProperty("--border", vars.border);
  document.documentElement.setAttribute("data-theme", themeName);
  document.documentElement.setAttribute("data-mode", mode);
}

export function getSavedMode() {
  return localStorage.getItem("theme_mode") || DEFAULT_MODE;
}

export function toggleMode() {
  const current = getSavedMode();
  const next = current === "light" ? "dark" : "light";
  localStorage.setItem("theme_mode", next);
  return next;
}
