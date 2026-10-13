import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v141 弱项便签摆正 + 米白底", () => {
  const src = readFileSync("src/components/coach/StudentAdvicePanel.tsx", "utf-8");

  it("小卡片无倾斜、米白底", () => {
    if (/rotate-\[/.test(src)) throw new Error("残留：倾斜");
    if (!/bg-\[#FFFAEE\]/.test(src)) throw new Error("缺：米白底");
    if (/bg-\[#FFF7D8\]/.test(src)) throw new Error("残留：浅黄底");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
