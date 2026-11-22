import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { env } from "./lib/env";

const PREFIX = "c1";
function key(): Buffer {
  const configured = env.coachingDataKey;
  if (!configured) {
    if (env.isProduction) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "敏感数据加密密钥尚未配置" });
    return createHash("sha256").update("sanhao-coaching-development-only").digest();
  }
  try {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32 && decoded.toString("base64").replace(/=+$/, "") === configured.replace(/=+$/, "")) return decoded;
  } catch { /* 改用长口令派生；生产仍要求至少 32 字节。 */ }
  if (Buffer.byteLength(configured, "utf8") < 32) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "COACHING_DATA_KEY 须为 32 字节 Base64 密钥或至少 32 字节口令" });
  return createHash("sha256").update(configured, "utf8").digest();
}

export function encryptCoachingText(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptCoachingText(value: string): string {
  const [version, iv, tag, encrypted, extra] = value.split(".");
  if (version !== PREFIX || !iv || !tag || !encrypted || extra) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "敏感数据格式无效" });
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "敏感数据无法解密，请核对密钥配置" });
  }
}

/** 兼容迁移前明文；新写入的敏感正文一律进入加密字段。 */
export function revealCoachingText(plain: string | null, encrypted: string | null): string {
  return encrypted ? decryptCoachingText(encrypted) : plain ?? "";
}
