/** Default auth config — overridden per module from KV tenant:auth_config */
export const DEFAULT_AUTH_CONFIG = {
  identifiers: ["phone", "email"],
  identity_mode: "combined",
  registration: { self: true, admin_import: true },
  second_factor: { otp_required: false, totp_enabled: false },
  forgot_password: { via: ["email", "phone"] },
  lockout: { attempts: 3, duration_mins: 60 },
  devices: { max_same_location: 3, max_diff_location: 1, location: "city", diff_location_wait_hrs: 6 },
  social: ["google"],
  consent_config: {
    version: "2025-04",
    triggers: ["first_login", "exam_start", "notes_open", "module_access"],
    periodic_days: null,
    icon: "📋",
    title: "Content Disclosure Notice",
    subtitle: "AI-generated content — please read before continuing",
    sections: [],          // empty = defaults in consent.js are used
    official_sources: [],
    checkbox_label: "I understand that all content on this platform is AI-generated and is for practice only. I will verify important information from official sources before my exam.",
    agree_label: "I Agree & Continue",
    footer: "This acknowledgement is stored for compliance. You may be asked to re-confirm if content policies are updated."
  },
  admin: {
    roles: [],
    platforms: { desktop: "full", web: "full", mobile: "view_only" },
    login: { separate: true, require_totp: true },
    audit: "full",
    notifications: { failed_logins: true, new_registrations: true, session_anomalies: true },
  },
};

export async function getAuthConfig(tenantId, moduleId, env) {
  const key = `auth_config:${tenantId}:${moduleId}`;
  const raw = await env.KV.get(key);
  if (!raw) return DEFAULT_AUTH_CONFIG;
  return { ...DEFAULT_AUTH_CONFIG, ...JSON.parse(raw) };
}

export function detectIdentifierType(value) {
  if (/^\d{10}$/.test(value)) return "phone";
  if (value.includes("@")) return "email";
  if (/^[a-zA-Z0-9_]{3,30}$/.test(value)) return "username";
  return "userid";
}
