/**
 * 测评码的编解码（v239，后端专用）。
 *
 * 码 = `<孩子编号>-<测评代号>-<时段>-<签名>`，例：`a1-mb-8f3k-qw7xd2`。
 *
 * 为什么带「时段」而不只是一个版本号：
 *  这张码能换到一个孩子的短会话，等于一张临时门禁卡。门禁卡不能永久有效，
 *  所以签名里掺一个 6 小时滚动窗口，只认当前与上一格——过期即失效，
 *  不需要任何清理任务，也不需要在库里记「发过哪些码」。
 *  代价是跨过窗口时码会失效，现场点一下重新出即可（出码是免费的）。
 *
 * 这一段必须留在后端：密钥不进前端 bundle，签名才能防伪造。
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PASS_ALPHABET,
  PASS_CODE_RE,
  PASS_SIG_LEN,
  PASS_SLOT_HOURS,
  normalizePassCode,
  passDefOf,
  passDefBySlug,
  passExpiresAt,
  passSlotAt,
  type PassKind,
} from "@contracts/passCode";

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

function toB36(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  let v = Math.floor(n);
  let out = "";
  while (v > 0) {
    out = B36[v % 36] + out;
    v = Math.floor(v / 36);
  }
  return out;
}

function fromB36(s: string): number {
  if (!s) return NaN;
  let n = 0;
  for (const ch of s) {
    const i = B36.indexOf(ch);
    if (i < 0) return NaN;
    n = n * 36 + i;
  }
  return n;
}

/** 签名：HMAC(密钥, "pass:孩子编号:代号:时段") 取 64 位，再按字母表逐位落到 6 个字符。 */
function sign(userId: number, slug: string, slot: number, secret: string): string {
  const mac = createHmac("sha256", secret).update(`pass:${userId}:${slug}:${slot}`).digest();
  let n = 0n;
  for (const b of mac.subarray(0, 8)) n = (n << 8n) | BigInt(b);
  const base = BigInt(PASS_ALPHABET.length);
  let out = "";
  for (let i = 0; i < PASS_SIG_LEN; i++) {
    out += PASS_ALPHABET[Number(n % base)];
    n /= base;
  }
  return out;
}

/**
 * 生成一张码。同一孩子、同一测评、同一时段永远得到同一张码——
 * 伴学师连点两下不该出现两张不一样的码，那样现场会分不清该发哪张。
 */
export function encodePassCode(
  userId: number,
  kind: PassKind,
  secret: string,
  now: number = Date.now(),
): { code: string; slot: number; expiresAt: number } | null {
  const def = passDefOf(kind);
  if (!def) return null;
  const slot = passSlotAt(now);
  const code = `${toB36(userId)}-${def.slug}-${toB36(slot)}-${sign(userId, def.slug, slot, secret)}`;
  return { code, slot, expiresAt: passExpiresAt(slot) };
}

export type DecodedPass = { userId: number; kind: PassKind; slot: number };

/**
 * 解一张码：形状 → 编号 → 代号 → 时段 → 签名 → 是否在有效窗口内。
 * 任何一步不过一律返回 null，不回「签名错」还是「过期」——
 * 现场只需要一句话：「这张码不能用了，让伴学师重新出一张」。
 */
export function decodePassCode(
  raw: string,
  secret: string,
  now: number = Date.now(),
): DecodedPass | null {
  const code = normalizePassCode(raw);
  if (!PASS_CODE_RE.test(code)) return null;
  const [idPart, slug, slotPart, sigPart] = code.split("-");
  const userId = fromB36(idPart);
  const slot = fromB36(slotPart);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  if (!Number.isFinite(slot) || slot <= 0) return null;

  const def = passDefBySlug(slug);
  if (!def) return null;

  const expect = sign(userId, slug, slot, secret);
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  /* 只认当前与上一格：跨了两个窗口，码就该作废了 */
  const cur = passSlotAt(now);
  if (slot !== cur && slot !== cur - 1) return null;

  return { userId, kind: def.kind, slot };
}

/** 这张码还剩多久（毫秒），用于前端写「今晚 18 点前有效」。 */
export function passRemainingMs(slot: number, now: number = Date.now()): number {
  return Math.max(0, passExpiresAt(slot) - now);
}

/** 时段常量再导出一次，避免 api 层重复写 6 小时。 */
export const PASS_WINDOW_HOURS = PASS_SLOT_HOURS;
