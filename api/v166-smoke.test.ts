/* v166 冒烟：internal-sssx 搜索接口 400 联调容错——
   一体通 CRM 搜索偶发 400 且原实现不打日志。v166 三层容错：
   ① 先剥 UTF-8 BOM（部分 HTTP 客户端会带上，JSON.parse 必抛）；
   ② JSON 解析失败退 form-encoded（keyword=xxx）；
   ③ 仍失败时 400 响应里回显请求体片段并记 warn 日志，方便联调定位。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v166 internal-sssx 搜索容错", () => {
  const src = readFileSync("api/internal.ts", "utf-8");

  it("剥 BOM 后再 JSON.parse", () => {
    if (!/replace\(\/\^﻿\//.test(src)) throw new Error("缺：BOM 剥离");
  });

  it("JSON 失败退 form-encoded（keyword=xxx）", () => {
    if (!/new URLSearchParams\(rawBody\)/.test(src)) throw new Error("缺：URLSearchParams 回退");
  });

  it("bad_json 时 400 回显请求体片段并记日志", () => {
    if (!/error: "bad_json", got: rawBody\.slice\(0, 200\)/.test(src)) throw new Error("缺：400 回显");
    if (!/\[internal-sssx\] bad_json ip=/.test(src)) throw new Error("缺：bad_json 日志");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v166-2026-10-14";')) throw new Error("BUILD_TAG 未递增到 v166");
  });
});
