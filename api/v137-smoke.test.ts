import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v137 陪跑对策面板白卡 + 弱项便贴样式", () => {
  const src = readFileSync("src/components/coach/StudentAdvicePanel.tsx", "utf-8");

  it("外层面板为白色卡片（无绿色底）", () => {
    if (!/rounded-xl border border-\[#A9B8B0\]\/40 bg-white p-3/.test(src)) throw new Error("缺：白色面板");
    if (/bg-lime-pale\/40/.test(src)) throw new Error("残留：浅绿底面板");
  });

  it("弱项小卡片为米白便签底（v141：去旋转、浅黄改米白）", () => {
    if (!/bg-\[#FFFAEE\]/.test(src)) throw new Error("缺：米白便签底");
    if (/rotate-\[/.test(src)) throw new Error("残留：倾斜");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
