import { TRPCError } from "@trpc/server";

export const MAX_COACHING_MEDIA_BYTES = 4 * 1024 * 1024;
const signatures: Record<string, { offset: number; bytes: number[] }[]> = {
  "image/jpeg": [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  "image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/webp": [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }],
  "audio/mpeg": [{ offset: 0, bytes: [0x49, 0x44, 0x33] }, { offset: 0, bytes: [0xff] }],
  "audio/mp4": [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
  "audio/wav": [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, { offset: 8, bytes: [0x57, 0x41, 0x56, 0x45] }],
  "audio/webm": [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
  "audio/ogg": [{ offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] }],
};

export function validateCoachingMedia(dataUrl: string, mimeType: string | undefined, kind: "audio" | "image") {
  const match = /^data:([a-z0-9/+.-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl.trim());
  if (!match || match[1] !== mimeType || !signatures[mimeType ?? ""] || (kind === "image" ? !mimeType?.startsWith("image/") : !mimeType?.startsWith("audio/"))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "附件格式不符，请选择真实图片或录音文件" });
  }
  const base64 = match[2]!;
  if (base64.length % 4 !== 0 || base64.length > Math.ceil(MAX_COACHING_MEDIA_BYTES / 3) * 4 + 4) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "附件须为有效 Base64 且不超过 4 MB" });
  }
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_COACHING_MEDIA_BYTES || bytes.toString("base64").replace(/=+$/, "") !== base64.replace(/=+$/, "")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "附件内容不是有效的 Base64 文件" });
  }
  if (!signatures[mimeType!]!.every((signature) => signature.bytes.every((byte, index) => bytes[signature.offset + index] === byte))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "附件真实格式与声明不符，已拒绝上传" });
  }
  return { bytes: bytes.length, mediaData: `data:${mimeType};base64,${base64}` };
}
