import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestKey } from "../src/lib/requestKey";
import { prepareAssessmentSubmission } from "../src/lib/assessmentSubmission";

afterEach(() => vi.unstubAllGlobals());

describe("HTTP 非安全上下文的测评请求标识", () => {
  it("优先沿用浏览器原生 UUID", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "native-uuid" });
    expect(createRequestKey()).toBe("native-uuid");
  });

  it("没有 randomUUID 时仍生成唯一的 32 位标识", () => {
    const randomBytes = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => randomBytes(bytes) });
    const first = createRequestKey();
    const second = createRequestKey();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).toMatch(/^[0-9a-f]{32}$/);
    expect(first).not.toBe(second);
  });

  it("提交链路不再依赖 randomUUID，仍写入幂等键", () => {
    const randomBytes = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => randomBytes(bytes) });
    vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    const prepared = prepareAssessmentSubmission("/api/trpc/assessment.submit?batch=1", {
      body: JSON.stringify({ 0: { json: { kind: "disc", answers: [1] } } }),
    });
    const payload = JSON.parse(String(prepared.body)) as { 0: { json: { submissionKey: string } } };
    expect(payload[0].json.submissionKey).toMatch(/^[0-9a-f]{32}$/);
  });
});
