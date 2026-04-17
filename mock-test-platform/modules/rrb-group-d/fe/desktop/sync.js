const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const TIMEOUT = 8000;

function _get(url) {
  return new Promise((resolve, reject) => {
    const mod   = url.startsWith("https") ? https : http;
    const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    mod.get(url, res => {
      let b = "";
      res.on("data",  c  => { b += c; });
      res.on("end",   () => { clearTimeout(timer); resolve({ status: res.statusCode, body: b }); });
      res.on("error", e  => { clearTimeout(timer); reject(e); });
    }).on("error", e => { clearTimeout(timer); reject(e); });
  });
}

function readState(cacheDir) {
  try { return JSON.parse(fs.readFileSync(path.join(cacheDir, "_sync.json"), "utf8")); }
  catch { return {}; }
}

function writeState(cacheDir, state) {
  fs.writeFileSync(path.join(cacheDir, "_sync.json"), JSON.stringify(state));
}

async function syncNow(manifestUrl, cacheDir) {
  const result = { downloaded: 0, skipped: 0, errors: [] };

  let manifest;
  try {
    const { status, body } = await _get(manifestUrl);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    manifest = JSON.parse(body);
  } catch (e) {
    console.log("[sync] offline:", e.message);
    return { ...result, offline: true };
  }

  const state = readState(cacheDir);
  for (const { key, url, hash } of (manifest.files || [])) {
    if (state[key] === hash) { result.skipped++; continue; }
    try {
      const { status, body } = await _get(url);
      if (status !== 200) throw new Error(`HTTP ${status}`);
      JSON.parse(body);
      const safe = key.replace(/[^a-z0-9_:-]/gi, "_");
      fs.writeFileSync(path.join(cacheDir, `${safe}.json`), body);
      state[key] = hash;
      result.downloaded++;
    } catch (e) {
      result.errors.push(`${key}: ${e.message}`);
    }
  }

  writeState(cacheDir, state);
  return result;
}

module.exports = { syncNow };
