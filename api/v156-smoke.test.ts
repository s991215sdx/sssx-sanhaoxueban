/* v156 冒烟：章节卡左边框明显加粗到 12px（参考用户提供的样式图），随评分档红/黄/绿着色；
   仅左边框染色（borderLeftColor），其余三边保持 paper-card 默认边框色。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v156 章节卡左边框明显加粗（12px）", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("卡片左边框加粗到 12px", () => {
    if (!/paper-card scroll-mt-20 border-l-\[12px\] border-lime p-5 pl-6/.test(src))
      throw new Error("缺：border-l-[12px] 明显加粗左边框");
  });

  it("inline 色只作用左边框（borderLeftColor），不再有整框 borderColor", () => {
    if (!/style=\{accent \? \{ borderLeftColor: E3V37_LEVEL_STYLE\[accent\]\.bar \} : undefined\}/.test(src))
      throw new Error("缺：borderLeftColor 只染左边框");
    if (/\{ borderColor: E3V37_LEVEL_STYLE\[accent\]\.bar \}/.test(src)) throw new Error("残留：整框 borderColor 染色");
  });

  it("标题行仍无独立边框（旧式色条不复活）", () => {
    if (!/<div className="flex items-center gap-2\.5">/.test(src)) throw new Error("缺：标题行去边框");
    if (/gap-2\.5 border-l-4 border-lime pl-3/.test(src)) throw new Error("残留：标题行旧色条");
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
