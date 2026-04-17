export function detectIdentifier(value) {
  const v = value.trim();
  if (/^\d{10}$/.test(v)) return "phone";
  if (v.includes("@")) return "email";
  if (/^\d+$/.test(v)) return "userid";
  return "username";
}

export function validatePhone(v) {
  return /^\d{10}$/.test(v.trim()) ? null : "Enter a valid 10-digit phone number";
}

export function validateEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : "Enter a valid email address";
}

export function validatePassword(v) {
  if (!v || v.length < 8) return "Password must be at least 8 characters";
  return null;
}

export function passwordStrengthScore(v) {
  if (!v) return 0;
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;
  return score; // 0–4
}

export function passwordStrengthLabel(score) {
  return ["", "Weak", "Fair", "Good", "Strong"][score] || "";
}

export function getOtpFromInputs(inputs) {
  return Array.from(inputs).map(i => i.value).join("");
}
