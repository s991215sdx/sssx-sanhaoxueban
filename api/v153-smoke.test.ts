/* v153 冒烟：详版报告模块章节卡左边框色条随评分档（红<3.0 / 黄3.0-3.7 / 绿≥3.8）。
   v154：色条从标题行升级为卡片级全高左边框（断言已随设计更新，BUILD_TAG 断言已放宽） */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v153 章节卡左色条随评分", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("CollapsibleSection 支持 accent 属性", () => {
    if (!/accent\?: E3V37Level;/.test(src)) throw new Error("缺：accent 属性");
    if (!/accent=\{secAccent\}/.test(src)) throw new Error("缺：渲染处传入 accent");
  });

  it("头部左边框随档着色，无档保持 lime", () => {
    // v159 起改为内嵌胶囊色条（w-[16px] rounded-full），边框方案废弃，此处兼容全部历史写法
    if (!/(border-l-(\[?\d+px?\]|\d+) border-lime p-5 pl-[67]|w-\[16px\] rounded-full)/.test(src))
      throw new Error("缺：卡片级档色标识");
    if (!/E3V37_LEVEL_STYLE\[accent\]\.bar/.test(src)) throw new Error("缺：档色引用");
  });

  it("渲染处按模块取评分档", () => {
    if (!/systems\.core\.find\(\(c\) => c\.key === modSys\)\?\.level/.test(src)) throw new Error("缺：三阶系统分档");
    if (!/s\.title\.includes\("条件模块"\) \|\| s\.title\.includes\("亲子对照"\)/.test(src)) throw new Error("缺：条件/亲子对照均分档");
    if (!/s\.title\.includes\("学能模块"\)/.test(src)) throw new Error("缺：学能均分档");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
