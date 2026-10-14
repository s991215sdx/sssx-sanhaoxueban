/* v163 冒烟：章节卡左边框加粗着色（12px，随评分档红/黄/绿，无档保持 lime），其余三边默认色；
   废弃 v159 的内嵌胶囊色条（用户明确要求：是左边框加粗变色，不是单独加色条）；章节大标题随档着色保留。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v163 章节卡左边框加粗变色", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("卡片左边框 12px 加粗，仅左边框染色", () => {
    if (!/paper-card scroll-mt-20 border-l-\[12px\] border-lime p-5 pl-6/.test(src))
      throw new Error("缺：border-l-[12px] 加粗左边框");
    if (!/style=\{accent \? \{ borderLeftColor: E3V37_LEVEL_STYLE\[accent\]\.bar \} : undefined\}/.test(src))
      throw new Error("缺：仅 borderLeftColor 染色");
    if (/\{ borderColor: E3V37_LEVEL_STYLE\[accent\]\.bar \}/.test(src)) throw new Error("残留：整框 borderColor 染色");
  });

  it("胶囊色条已移除", () => {
    if (/w-\[16px\] rounded-full/.test(src)) throw new Error("残留：胶囊色条");
    if (/absolute bottom-3 left-2 top-3/.test(src)) throw new Error("残留：色条定位");
  });

  it("章节大标题随档着色（保留）", () => {
    if (!/style=\{accent \? \{ color: E3V37_LEVEL_STYLE\[accent\]\.bar \} : undefined\}/.test(src))
      throw new Error("缺：h3 标题随档着色");
  });

  it("accent 传入链完整", () => {
    if (!/accent=\{secAccent\}/.test(src)) throw new Error("缺：渲染处传入 accent");
    if (!/systems\.core\.find\(\(c\) => c\.key === modSys\)\?\.level/.test(src)) throw new Error("缺：三阶系统分档");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v163-2026-10-14";')) throw new Error("BUILD_TAG 未递增到 v163");
  });
});
