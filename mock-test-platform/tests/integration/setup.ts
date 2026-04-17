import { webcrypto } from "node:crypto";

// Cloudflare Workers provides `crypto` globally; Node.js 18 exposes it as
// `globalThis.crypto` in modern versions, but vitest's "node" environment
// sometimes doesn't surface it. Polyfill once here so worker.js runs cleanly.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: false,
  });
}
