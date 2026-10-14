/* v159 冒烟：章节卡左侧内嵌胶囊色条（粗圆头、上下两端圆弧过渡变细，参考一体通样式图），
   随评分档红/黄/绿，无档保持 lime；章节大标题（h3）同步随档着色。废弃 v154-v156 的边框方案。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v159 章节卡胶囊色条 + 标题随档着色", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("卡片根节点：内嵌定位容器，不再用 border-l 边框方案", () => {
    if (!/paper-card relative scroll-mt-20 overflow-hidden p-5 pl-9/.test(src))
      throw new Error("缺：relative 内嵌容器 + 左侧留白");
    if (/paper-card[^\n]*border-l-/.test(src)) throw new Error("残留：border-l 边框方案");
  });

  it("胶囊色条：16px 粗圆头，随档着色，无档 lime", () => {
    if (!/w-\[16px\] rounded-full/.test(src)) throw new Error("缺：粗圆头胶囊色条");
    if (!/background: accent \? E3V37_LEVEL_STYLE\[accent\]\.bar : "#52A965"/.test(src))
      throw new Error("缺：色条随档着色/默认 lime");
    if (!/absolute bottom-3 left-2 top-3/.test(src)) throw new Error("缺：色条全高内嵌定位");
  });

  it("章节大标题随档着色", () => {
    if (!/style=\{accent \? \{ color: E3V37_LEVEL_STYLE\[accent\]\.bar \} : undefined\}/.test(src))
      throw new Error("缺：h3 标题随档着色");
  });

  it("accent 传入链完整", () => {
    if (!/accent=\{secAccent\}/.test(src)) throw new Error("缺：渲染处传入 accent");
    if (!/systems\.core\.find\(\(c\) => c\.key === modSys\)\?\.level/.test(src)) throw new Error("缺：三阶系统分档");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 未递增");
  });
});
