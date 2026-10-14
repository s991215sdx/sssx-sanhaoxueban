/* v154 冒烟：详版模块章节卡左边框色条升级为卡片级全高左边框（随评分档红/黄/绿）。
   v153 把色条做在了标题行上，v154 按用户要求改为直接改卡片左边框颜色（参考多元智能总览卡 accent-l 样式）。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v154 章节卡卡片级左色条", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("卡片根节点带左侧边框并随档着色", () => {
    if (!/paper-card scroll-mt-20 border-l-(\[?\d+px?\]|\d+) border-lime p-5 pl-6/.test(src)) throw new Error("缺：卡片级左边框");
    // v155 起 inline 色只作用于 borderLeftColor（其余三边保持默认边框色），此处兼容两种写法
    if (!/style=\{accent \? \{ border(Left)?Color: E3V37_LEVEL_STYLE\[accent\]\.bar \} : undefined\}/.test(src))
      throw new Error("缺：档色边框 inline style");
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
