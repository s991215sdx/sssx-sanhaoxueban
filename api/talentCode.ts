/**
 * 人才测评邀请码的编解码（v253，后端专用）。
 *
 * 码 = `<发起人编号>-<岗位字母>-<日序号>-<签名>`，例：`a1-v-f8g-k3m9pd`。
 *
 * 为什么把岗位也编进码里：候选人扫码之后不该再看一张「请选择你要应聘的岗位」的列表——
 * 他应聘什么岗是 HR 定的，让他自己选，选错了整份报告的依据就变了。
 * 岗位字母只有 4 种（sales/service/admin/mgmt → s/v/a/m），成本是 1 个字符。
 *
 * 有效期用「日序号」而不是存表：招聘的节奏是「今天发、这周内答」，
 * 只认最近 7 天（含当天），过期自然失效，不需要清理任务，也不需要记「发过哪些码」。
 * 同一个发起人、同一岗位、同一天永远得到同一张码——HR 连点两下不该出现两张不一样的码。
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { JobKey } from "@contracts/talent/score";

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
/** 签名字母表：剔除 0/o、1/l/i 这类易混字符 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SIG_LEN = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 一张码认多久（天，含当天） */
export const TALENT_CODE_DAYS = 7;

const POS_TO_LETTER: Record<JobKey, string> = { sales: "s", service: "v", admin: "a", mgmt: "m" };
const LETTER_TO_POS: Record<string, JobKey> = { s: "sales", v: "service", a: "admin", m: "mgmt" };

const RE = /^[a-z0-9]{1,12}-[svam]-[a-z0-9]{1,6}-[a-z0-9]{6}$/;

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

function sign(ownerId: number, letter: string, day: number, secret: string): string {
  const mac = createHmac("sha256", secret).update(`talent:${ownerId}:${letter}:${day}`).digest();
  let n = 0n;
  for (const b of mac.subarray(0, 8)) n = (n << 8n) | BigInt(b);
  const base = BigInt(ALPHABET.length);
  let out = "";
  for (let i = 0; i < SIG_LEN; i++) {
    out += ALPHABET[Number(n % base)];
    n /= base;
  }
  return out;
}

export const talentDay = (now: number = Date.now()) => Math.floor(now / DAY_MS);

/** 出码。expiresAt 用于前端写「几月几号前有效」。 */
export function encodeTalentCode(
  ownerId: number,
  position: JobKey,
  secret: string,
  now: number = Date.now(),
): { code: string; expiresAt: number } {
  const letter = POS_TO_LETTER[position];
  const day = talentDay(now);
  const code = `${toB36(ownerId)}-${letter}-${toB36(day)}-${sign(ownerId, letter, day, secret)}`;
  return { code, expiresAt: (day + 1) * DAY_MS };
}

export type DecodedTalentCode = { ownerId: number; position: JobKey; day: number };

/** 解码。任何一步不过都返回 null，不区分「签名错」还是「过期」。 */
export function decodeTalentCode(raw: string, secret: string, now: number = Date.now()): DecodedTalentCode | null {
  const code = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!RE.test(code)) return null;
  const [idPart, letter, dayPart, sigPart] = code.split("-");
  const ownerId = fromB36(idPart);
  const day = fromB36(dayPart);
  const position = LETTER_TO_POS[letter];
  if (!Number.isFinite(ownerId) || ownerId <= 0 || !position) return null;
  if (!Number.isFinite(day) || day <= 0) return null;

  const expect = sign(ownerId, letter, day, secret);
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const today = talentDay(now);
  if (day > today || day <= today - TALENT_CODE_DAYS) return null;
  return { ownerId, position, day };
}
