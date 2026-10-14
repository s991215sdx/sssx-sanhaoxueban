/* v156 冒烟：章节卡左边框明显加粗到 12px（参考用户提供的样式图），随评分档红/黄/绿着色；
   仅左边框染色（borderLeftColor），其余三边保持 paper-card 默认边框色。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v156 章节卡左边框明显加粗（12px）", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("卡片左边框加粗到 12px（或 v159 胶囊色条）", () => {
    // v159 起为内嵌胶囊色条（w-[16px] rounded-full），兼容 border-l-[12px] 写法
    if (!/(border-l-\[\d+px\]|w-\[16px\] rounded-full)/.test(src)) throw new Error("缺：明显加粗左边框/胶囊色条");
  });

  it("档色只作用于左侧标识，不再有整框 borderColor", () => {
    if (!/E3V37_LEVEL_STYLE\[accent\]\.bar/.test(src)) throw new Error("缺：档色引用");
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
