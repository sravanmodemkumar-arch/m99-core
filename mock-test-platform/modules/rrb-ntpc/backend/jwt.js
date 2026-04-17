/** Verify-only JWT helper — auth worker signs, exam-engine only verifies. */
export async function verifyJwt(token, secret) {
  const parts = token?.split(".");
  if (parts?.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = await _sign(`${header}.${body}`, secret);
  if (!_timingSafeEqual(sig, expected)) return null;
  const payload = JSON.parse(_b64urlDecode(body));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function _sign(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return _b64url(String.fromCharCode(...new Uint8Array(sig)));
}

function _b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function _b64urlDecode(str) {
  return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
}
function _timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
