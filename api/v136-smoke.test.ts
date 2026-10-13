import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v136 学员详情头部参照报告设计", () => {
  it("墨绿整卡 + 顶部小字标签 + 白字姓名 + 分隔线", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/rounded-2xl bg-\[#0C7064\] p-4/.test(src)) throw new Error("缺：墨绿头卡");
    if (!/Student Profile · 学员档案/.test(src)) throw new Error("缺：顶部小字标签");
    if (!/text-\[18px\] font-bold text-white/.test(src)) throw new Error("缺：白字姓名");
    if (!/h-px bg-white\/25/.test(src)) throw new Error("缺：分隔线");
  });

  it("统计格为纯白底（v138 断言随设计更新）", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/rounded-xl bg-white px-1 py-2\.5/.test(src)) throw new Error("缺：白底统计格");
  });

  it("测评为绿色竖条 + 黑色粗体标题", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/h-3\.5 w-1 rounded-full bg-\[#0C7064\]/.test(src)) throw new Error("缺：绿色竖条标题");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
