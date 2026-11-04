/**
 * 家庭码的编解码（v238，后端专用）。
 *
 * 码 = `<孩子编号>-<版本>-<签名>`，三段都用 base36 / 自家字母表，例：`a1-0-k3m9pd`。
 *
 * 为什么是派生而不是查表：
 *  1. 老库建不了新表（数据目录权限），而一张码根本不需要独立存储；
 *  2. 码里只有编号与版本，签名用 APP_SECRET 派生——改不动编号，猜不出别人家孩子的码；
 *  3. 「换码」= 学生档案里的版本号 +1，旧码立刻对不上，历史答卷一条不动。
 *
 * 这一段必须留在后端：密钥不进前端 bundle，签名才能防伪造。
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  FAMILY_CODE_ALPHABET,
  FAMILY_CODE_RE,
  FAMILY_CODE_SIG_LEN,
  normalizeFamilyCode,
} from "@contracts/familyCode";

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

/** 签名：HMAC(密钥, 孩子编号 + 版本) 取 64 位，再按字母表逐位落到 6 个字符。 */
function sign(userId: number, ver: number, secret: string): string {
  const mac = createHmac("sha256", secret).update(`family:${userId}:${ver}`).digest();
  let n = 0n;
  for (const b of mac.subarray(0, 8)) n = (n << 8n) | BigInt(b);
  const base = BigInt(FAMILY_CODE_ALPHABET.length);
  let out = "";
  for (let i = 0; i < FAMILY_CODE_SIG_LEN; i++) {
    out += FAMILY_CODE_ALPHABET[Number(n % base)];
    n /= base;
  }
  return out;
}

/** 生成一张码。同一孩子、同一版本永远得到同一张码（幂等，不需要存）。 */
export function encodeFamilyCode(userId: number, ver: number, secret: string): string {
  return `${toB36(userId)}-${toB36(ver)}-${sign(userId, ver, secret)}`;
}

/**
 * 解一张码：形状 → 编号 → 签名。签名不对一律当「没有这张码」，
 * 不回「编号存在但签名错」——那就等于告诉别人哪几个编号是真的。
 */
export function decodeFamilyCode(raw: string, secret: string): { userId: number; ver: number } | null {
  const code = normalizeFamilyCode(raw);
  if (!FAMILY_CODE_RE.test(code)) return null;
  const [idPart, verPart, sigPart] = code.split("-");
  const userId = fromB36(idPart);
  const ver = fromB36(verPart);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  if (!Number.isFinite(ver) || ver < 0) return null;

  const expect = sign(userId, ver, secret);
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId, ver };
}
