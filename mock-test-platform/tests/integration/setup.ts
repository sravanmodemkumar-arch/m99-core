import { webcrypto } from "node:crypto";

// Node 18: `globalThis.crypto` exists but bare `crypto` identifier is not a
// global. Node 19+ adds it as a global. Always assign so tests can write
// `crypto.subtle` without the namespace prefix (matches CF Workers behavior).
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
  writable: true,
});
