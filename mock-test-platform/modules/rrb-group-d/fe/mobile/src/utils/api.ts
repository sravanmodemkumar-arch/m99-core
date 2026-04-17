export interface ApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T;
}

export interface StartExamResponse {
  session_id: string;
  bundle_url: string;
  duration_s: number;
  started_at: number;
  elapsed_s: number;
  resumed: boolean;
  checkpoint?: Record<string, { chosen: string | null; attempted: boolean }>;
}

export interface SubmitResponse {
  answer_key: Record<string, string>;
  result: {
    score: number;
    correct: number;
    wrong: number;
    skipped: number;
    total_qs: number;
  };
}

export interface BundleQuestion {
  id: string;
  section: string;
  text: string;
  image?: string;
  options: Array<{ key: string; text: string; image?: string }>;
}

export interface ExamBundle {
  exam_id: string;
  title: string;
  questions: BundleQuestion[];
}

export interface ExamListing {
  exam_id: string;
  title: string;
  sections: string[];
  total_qs: number;
  duration_s: number;
}

let _getToken: () => Promise<string | null> = async () => null;

export function initApi(getToken: () => Promise<string | null>): void {
  _getToken = getToken;
}

async function call<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  let token: string | null = null;
  try { token = await _getToken(); } catch { /* no token */ }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({})) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}

export async function startExam(examId: string): Promise<ApiResponse<StartExamResponse>> {
  return call<StartExamResponse>("/rrb/exam/start", {
    method: "POST",
    body: JSON.stringify({ exam_id: examId }),
  });
}

export async function syncCheckpoint(
  sessionId: string,
  elapsedS: number,
  responses: Record<string, { chosen: string | null; attempted: boolean }>
): Promise<void> {
  call("/rrb/exam/sync", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, elapsed_s: elapsedS, responses }),
  }).catch(() => {});
}

export async function submitExam(
  sessionId: string,
  responses: Record<string, { chosen: string | null; attempted: boolean }>,
  elapsedS: number
): Promise<ApiResponse<SubmitResponse>> {
  return call<SubmitResponse>("/rrb/exam/submit", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, responses, elapsed_s: elapsedS }),
  });
}

export async function listExams(): Promise<ApiResponse<ExamListing[]>> {
  return call<ExamListing[]>("/rrb/exams");
}

export async function fetchBundle(bundleUrl: string, token: string | null): Promise<ExamBundle> {
  const res = await fetch(bundleUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json() as Promise<ExamBundle>;
}
