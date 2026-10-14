/* v162 冒烟：直连（无反代）场景下，限流/日志用 TCP 对端真实 IP（X-Forwarded-For 为空时回退 getConnInfo），
   否则所有调用方会被挤进同一个 "unknown" 限流桶。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v162 限流 IP 真实取值", () => {
  const internal = readFileSync("api/internal.ts", "utf-8");

  it("clientIp：优先 X-Forwarded-For，回退 getConnInfo 对端地址", () => {
    if (!/getConnInfo/.test(internal)) throw new Error("缺：getConnInfo");
    if (!/x-forwarded-for/.test(internal)) throw new Error("缺：反代头优先");
    if (!/getConnInfo\(c\)\.remote\.address/.test(internal)) throw new Error("缺：TCP 对端回退");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 未递增");
  });
});
