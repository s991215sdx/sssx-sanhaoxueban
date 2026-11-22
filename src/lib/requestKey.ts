/**
 * HTTP 测试入口等非安全上下文没有 crypto.randomUUID，但仍有 getRandomValues。
 * 发起测评与提交共用同一实现，避免按钮在请求发出前因浏览器兼容差异中断。
 */
export function createRequestKey(): string {
  if (typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
