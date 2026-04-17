import { createApiClient } from "../../../../auth/fe/shared/api.js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const api = createApiClient(() => AsyncStorage.getItem("token"));

export async function startExam(examId) {
  return api("/rrb/exam/start", {
    method: "POST",
    body: JSON.stringify({ exam_id: examId }),
  });
}

export async function syncCheckpoint(sessionId, elapsedS, responses) {
  return api("/rrb/exam/sync", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, elapsed_s: elapsedS, responses }),
  });
}

export async function submitExam(sessionId, responses, elapsedS) {
  return api("/rrb/exam/submit", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, responses, elapsed_s: elapsedS }),
  });
}

export async function fetchBundle(bundleUrl, token) {
  const res = await fetch(bundleUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
