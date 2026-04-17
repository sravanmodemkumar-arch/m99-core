/**
 * TSF — Test Session File.
 * Built by CF Worker on exam start. Stored in KV (48h TTL).
 * Contains: session metadata + question order + answer key (encrypted or omitted from client bundle).
 *
 * Client bundle (served from R2) = TSF minus answer_key.
 * Answer key is returned only on submit, after session is locked.
 */

import { getExamConfig, totalQuestions } from "./config.js";

const TSF_VERSION = "1";

/**
 * Build a new TSF for a user starting an exam.
 *
 * @param {{ tenantId: string, uid: string, examId: string, sessionId: string }} params
 * @param {KVNamespace} kv
 * @param {R2Bucket} r2
 * @param {object} cfg — result of getExamConfig()
 * @returns {Promise<TSF>}
 */
export async function buildTSF(params, kv, r2, cfg) {
  const { tenantId, uid, examId, sessionId } = params;

  // Fetch master question bank from R2 (question-schema v1.4.0 format)
  const bankKey = `${cfg.bundle_prefix}/${examId}/bank.json`;
  const bankObj  = await r2.get(bankKey);
  if (!bankObj) throw new Error(`Question bank not found: ${bankKey}`);
  const bank = await bankObj.json();

  // Support both flat-array schema v1.4.0 ({questions:[...]}) and legacy ({section:[...]})
  const allQuestions = bank.questions
    ? bank.questions
    : Object.values(bank).flat();

  // Build per-section question lists with optional shuffle
  const questionOrder = [];
  const answerKey     = {};

  for (const section of cfg.sections) {
    const pool = allQuestions
      .filter(q => q.section === section.id)
      .map(q => ({
        id:      q.qid  || q.id,
        answer:  Array.isArray(q.ans)  ? q.ans[0]  : (q.answer || q.ans),
        options: (q.opts || q.options || []).map(o => ({
          id:   o.id,
          text: o.v   || o.text || o.value || String(o.id),
        })),
        body:    q.body || [{ t: "tx", v: q.text || "" }],
        instr:   q.instr || "",
      }));

    const selected = _pick(pool, section.count, cfg.shuffle_qs);
    for (const q of selected) {
      if (cfg.shuffle_opts) q.options = _shuffle(q.options);
      questionOrder.push({ id: q.id, section: section.id, _q: q });
      answerKey[q.id] = q.answer;
    }
  }

  const tsf = {
    v:          TSF_VERSION,
    session_id: sessionId,
    tenant_id:  tenantId,
    uid,
    exam_id:    examId,
    started_at: Date.now(),
    expires_at: Date.now() + cfg.session.tsf_ttl_s * 1000,
    duration_s: cfg.duration_s,
    status:     "active",      // active | submitted | expired

    question_order: questionOrder,
    answer_key:     answerKey,  // NOT sent to client — stays in KV only

    // Client bundle reference — served from R2
    bundle_key: `${cfg.bundle_prefix}/${examId}/bundle_${sessionId}.json`,

    // Checkpoint — updated by fire-and-forget during exam
    checkpoint: {
      elapsed_s: 0,
      responses: {},           // { [qid]: { chosen, attempted } }
      synced_at: Date.now(),
    },
  };

  // Write client-safe bundle to R2 (questions + order, no answer key)
  const clientBundle = _buildClientBundle(tsf, bank, cfg);
  await r2.put(tsf.bundle_key, JSON.stringify(clientBundle), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { session_id: sessionId, tenant_id: tenantId },
  });

  // Strip _q (question data) from question_order before writing to KV — only needed for bundle build
  tsf.question_order = tsf.question_order.map(({ id, section }) => ({ id, section }));

  // Write full TSF (with answer key) to KV
  const kvKey = `tsf:${sessionId}`;
  await kv.put(kvKey, JSON.stringify(tsf), { expirationTtl: cfg.session.tsf_ttl_s });

  return tsf;
}

/**
 * Load existing TSF from KV.
 * Returns null if not found or expired.
 */
export async function loadTSF(sessionId, kv) {
  const raw = await kv.get(`tsf:${sessionId}`);
  if (!raw) return null;
  const tsf = JSON.parse(raw);
  if (tsf.expires_at < Date.now()) return null;
  return tsf;
}

/**
 * Update checkpoint in KV — called on fire-and-forget sync during exam.
 * Never blocks the client response.
 */
export async function syncCheckpoint(sessionId, patch, kv) {
  const raw = await kv.get(`tsf:${sessionId}`);
  if (!raw) return;
  const tsf = JSON.parse(raw);
  if (tsf.status !== "active") return;

  tsf.checkpoint.elapsed_s  = patch.elapsed_s ?? tsf.checkpoint.elapsed_s;
  tsf.checkpoint.responses  = { ...tsf.checkpoint.responses, ...(patch.responses || {}) };
  tsf.checkpoint.synced_at  = Date.now();

  const ttlRemaining = Math.max(60, Math.floor((tsf.expires_at - Date.now()) / 1000));
  await kv.put(`tsf:${sessionId}`, JSON.stringify(tsf), { expirationTtl: ttlRemaining });
}

/**
 * Lock TSF on submit — returns answer key for client-side scoring display.
 */
export async function lockTSF(sessionId, finalResponses, kv) {
  const raw = await kv.get(`tsf:${sessionId}`);
  if (!raw) throw new Error("Session not found");
  const tsf = JSON.parse(raw);
  if (tsf.status === "submitted") throw new Error("Already submitted");

  tsf.status = "submitted";
  tsf.submitted_at = Date.now();
  tsf.checkpoint.responses = finalResponses;
  tsf.checkpoint.elapsed_s = finalResponses._elapsed_s || tsf.checkpoint.elapsed_s;

  // Keep locked TSF in KV long enough for EPS batch (48h)
  await kv.put(`tsf:${sessionId}`, JSON.stringify(tsf), { expirationTtl: 172800 });

  // Return answer key so client can display correct answers
  return tsf.answer_key;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _buildClientBundle(tsf, _bank, cfg) {
  // question_order already carries the mapped question data in ._q
  const questions = tsf.question_order.map(({ id, section, _q }) => ({
    id,
    section,
    body:    _q?.body    || [{ t: "tx", v: id }],
    instr:   _q?.instr   || "",
    options: _q?.options || [],
  }));

  return {
    session_id:    tsf.session_id,
    exam_id:       tsf.exam_id,
    duration_s:    tsf.duration_s,
    started_at:    tsf.started_at,
    sections:      cfg.sections,
    questions,
    // answer_key intentionally omitted
  };
}

function _pick(pool, count, shuffle) {
  const arr = shuffle ? _shuffle([...pool]) : [...pool];
  return arr.slice(0, Math.min(count, arr.length));
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
