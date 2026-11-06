import { createRequestKey } from "./requestKey";

const CACHE_KEY = "sanhao.assessment.submission-keys";
const TASK_PREFIX = "sanhao.assessment.assignment.";

function fingerprint(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x85ebca6b);
  }
  return `${text.length}:${(a >>> 0).toString(36)}:${(b >>> 0).toString(36)}`;
}

function submissionKey(body: string): string {
  let cache: Record<string, string> = {};
  try { cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>; } catch { /* 私密模式退化为当次标识 */ }
  const fingerprint = fingerprintBody(body);
  if (!cache[fingerprint]) {
    cache[fingerprint] = createRequestKey();
    const entries = Object.entries(cache).slice(-40);
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries))); } catch { /* 服务端任务锁仍防重 */ }
  }
  return cache[fingerprint];
}
const fingerprintBody = fingerprint;

/** 不重写任何答题组件：在统一 tRPC 请求层附加提交键及当前任务标识。 */
export function prepareAssessmentSubmission(url: string, init?: RequestInit): { body: RequestInit["body"]; assignmentId: number | null } {
  if (typeof init?.body !== "string" || !/assessment\.(submit|submitByPass|submitFamilyParent)/.test(url)) return { body: init?.body, assignmentId: null };
  try {
    const parsed = JSON.parse(init.body) as Record<string, { json?: Record<string, unknown> }>;
    let assignmentId: number | null = null;
    for (const entry of Object.values(parsed)) {
      const json = entry.json;
      if (!json) continue;
      const target = url.includes("submitByPass") && json.input && typeof json.input === "object" ? json.input as Record<string, unknown> : json;
      if (typeof target.kind !== "string" && !url.includes("submitFamilyParent")) continue;
      let currentAssignmentId: number | null = null;
      if (typeof target.kind === "string") {
        const value = Number(sessionStorage.getItem(`${TASK_PREFIX}${target.kind}`));
        if (Number.isSafeInteger(value) && value > 0) currentAssignmentId = value;
      }
      target.submissionKey = submissionKey(JSON.stringify({ ...target, assignmentId: currentAssignmentId }));
      if (currentAssignmentId != null) {
        target.assignmentId = currentAssignmentId;
        assignmentId = currentAssignmentId;
      }
    }
    return { body: JSON.stringify(parsed), assignmentId };
  } catch {
    return { body: init.body, assignmentId: null };
  }
}

export function rememberAssessmentAssignment(kind: string, assignmentId: number): void {
  try { sessionStorage.setItem(`${TASK_PREFIX}${kind}`, String(assignmentId)); } catch { /* 服务端可按进行中任务关联 */ }
}

export function clearAssessmentAssignment(kind: string): void {
  try { sessionStorage.removeItem(`${TASK_PREFIX}${kind}`); } catch { /* 无存储权限时不影响提交 */ }
}
