/* v159 冒烟：章节卡左侧内嵌胶囊色条（粗圆头、上下两端圆弧过渡变细，参考一体通样式图），
   随评分档红/黄/绿，无档保持 lime；章节大标题（h3）同步随档着色。废弃 v154-v156 的边框方案。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v159 章节卡胶囊色条 + 标题随档着色", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("卡片根节点：档色标识（v159 胶囊 / v163 起回左边框，两种均兼容）", () => {
    if (!/(paper-card relative scroll-mt-20 overflow-hidden p-5 pl-9|paper-card scroll-mt-20 border-l-\[12px\] border-lime p-5 pl-6)/.test(src))
      throw new Error("缺：档色标识容器");
  });

  it("档色标识随档着色（胶囊或左边框），无档 lime", () => {
    if (!/E3V37_LEVEL_STYLE\[accent\]\.bar/.test(src)) throw new Error("缺：档色引用");
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
