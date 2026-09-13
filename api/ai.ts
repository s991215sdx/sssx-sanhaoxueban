/**
 * AI 网关助手（多凭据源 + 视觉支持）。
 *
 * 凭据优先级：
 * 1. DEFAULT_AI_BASE_URL / DEFAULT_AI_API_KEY / DEFAULT_AI_MODEL（平台 portal 注入）
 * 2. MOONSHOT_API_KEY（直连 Moonshot 开放平台，模型默认 kimi-latest，支持图片理解）
 *
 * 所有调用带超时并静默降级为 null——调用方必须提供规则引擎兜底。
 * 网关一旦放行，全部 AI 能力（苏格拉底引导、错题识别、树洞共情、首页智能入口）自动升级。
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | (
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      )[];
};

type Provider = { base: string; key: string; model: string; name: string };

function providers(): Provider[] {
  const list: Provider[] = [];
  const b = process.env.DEFAULT_AI_BASE_URL?.replace(/\/$/, "");
  const k = process.env.DEFAULT_AI_API_KEY;
  const m = process.env.DEFAULT_AI_MODEL;
  if (b && k && m) list.push({ base: b, key: k, model: m, name: "gateway" });
  const mk = process.env.MOONSHOT_API_KEY;
  if (mk) {
    list.push({
      base: (process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.cn/v1").replace(/\/$/, ""),
      key: mk,
      model: process.env.MOONSHOT_MODEL ?? "kimi-latest",
      name: "moonshot",
    });
  }
  return list;
}

export function aiAvailable() {
  return providers().length > 0;
}

export function aiProviderName(): string | null {
  return providers()[0]?.name ?? null;
}

/** 尝试调用 chat/completions（支持图片消息）；任何失败都返回 null（调用方降级）。 */
export async function tryChat(
  messages: ChatMessage[],
  opts: { timeoutMs?: number; maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const ps = providers();
  if (ps.length === 0) return null;
  const timeoutMs = opts.timeoutMs ?? 8000;
  for (const p of ps) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // kimi-k2.x 推理模型只允许 temperature=1，传其他值会 400，因此对 k2 系列不下发 temperature
      const isK2 = /^kimi-k2/i.test(p.model);
      const body: Record<string, unknown> = {
        model: p.model,
        messages,
        max_tokens: opts.maxTokens ?? 2000, // 推理模型（k2.x）会先消耗思考 token，默认给足
      };
      if (!isK2) body.temperature = opts.temperature ?? 0.7;
      const res = await fetch(`${p.base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch {
      // 尝试下一个凭据源
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** 调模型并要求返回 JSON 对象；解析失败返回 null。 */
export async function tryChatJSON<T>(
  messages: ChatMessage[],
  opts: { timeoutMs?: number; maxTokens?: number } = {},
): Promise<T | null> {
  const text = await tryChat(messages, { ...opts, temperature: 0.2 });
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

/** AI 健康自检（公开探针用）：返回凭据状态与一次真实往返结果。 */
export async function aiSelfTest(): Promise<{ configured: boolean; provider: string | null; pong: boolean; ms: number | null }> {
  const ps = providers();
  if (ps.length === 0) return { configured: false, provider: null, pong: false, ms: null };
  const t0 = Date.now();
  const r = await tryChat([{ role: "user", content: "只回复两个字： pong" }], { timeoutMs: 45000, maxTokens: 500 });
  return { configured: true, provider: ps[0].name, pong: r != null, ms: r != null ? Date.now() - t0 : null };
}
