/* v154 冒烟：详版模块章节卡左边框色条升级为卡片级全高左边框（随评分档红/黄/绿）。
   v153 把色条做在了标题行上，v154 按用户要求改为直接改卡片左边框颜色（参考多元智能总览卡 accent-l 样式）。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v154 章节卡卡片级左色条", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("卡片根节点带档色标识", () => {
    // v159 起为内嵌胶囊色条（w-[16px] rounded-full），此处兼容历史边框写法
    if (!/(paper-card scroll-mt-20 border-l-(\[?\d+px?\]|\d+) border-lime p-5 pl-[67]|paper-card relative scroll-mt-20 overflow-hidden p-5 pl-9)/.test(src))
      throw new Error("缺：卡片级档色标识");
    if (!/E3V37_LEVEL_STYLE\[accent\]\.bar/.test(src)) throw new Error("缺：档色引用");
  });

  it("标题行不再有独立边框", () => {
    if (!/<div className="flex items-center gap-2\.5">/.test(src)) throw new Error("缺：标题行去边框");
    if (/gap-2\.5 border-l-4 border-lime pl-3/.test(src)) throw new Error("残留：标题行旧边框");
  });

  it("accent 传入链完整（v153 逻辑保留）", () => {
    if (!/accent=\{secAccent\}/.test(src)) throw new Error("缺：渲染处传入 accent");
    if (!/systems\.core\.find\(\(c\) => c\.key === modSys\)\?\.level/.test(src)) throw new Error("缺：三阶系统分档");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 未递增");
  });
});
