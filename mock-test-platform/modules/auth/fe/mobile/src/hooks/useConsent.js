import { useRef, useState } from "react";
import { Storage } from "../utils/storage.js";
import { api } from "../utils/api.js";

function _key(moduleId, version) { return `consent_${moduleId}_${version}`; }

function _expired(stored, days) {
  if (!days || !stored?.ts) return false;
  return (Date.now() - stored.ts) > days * 86400000;
}

export function useConsent(cfg, moduleId) {
  const [visible, setVisible] = useState(false);
  const resolveRef = useRef(null);

  async function check(trigger) {
    const cc = cfg?.consent_config;
    if (!cc) return false;
    const triggers = cc.triggers || [];
    if (!triggers.includes(trigger) && !triggers.includes("always")) return false;
    const stored = await Storage.getJson(_key(moduleId, cc.version));
    if (stored && !_expired(stored, cc.periodic_days)) return false;
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setVisible(true);
    });
  }

  async function agree() {
    const cc = cfg?.consent_config;
    if (cc) {
      await Storage.setJson(_key(moduleId, cc.version), { ts: Date.now() });
      api("/auth/consent/record", { method: "POST", body: JSON.stringify({ module_id: moduleId, version: cc.version }) }).catch(() => {});
    }
    setVisible(false);
    resolveRef.current?.(true);
  }

  return { consentVisible: visible, checkConsent: check, agreeConsent: agree, consentConfig: cfg?.consent_config };
}
