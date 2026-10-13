/* v124/v125 冒烟：框架强调色浅绿→色卡浅米黄（v125 起选中态为深青绿底白字），整体提亮 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v124 浅米黄框架强调色", () => {
  it("tailwind：butter 带浅米黄 pale 档，olive 加深去灰", () => {
    const src = read("tailwind.config.js");
    if (!src.includes('butter: { DEFAULT: "#FCCE45", pale: "#FFF7D8" }')) throw new Error("缺：butter pale 档");
    if (!src.includes('soft: "#46564F"')) throw new Error("缺：olive soft 加深");
  });

  it("CSS 变量提亮：背景更亮、边框更暖、辅助文字加深", () => {
    const src = read("src/index.css");
    for (const tok of ["--background: 45 85% 97%;", "--border: 42 26% 84%;", "--muted-foreground: 160 10% 34%;"]) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
  });

  it("后台页签/侧栏激活态为深青绿底白字（v125），无 lime-pale 残留", () => {
    const admin = read("src/pages/Admin.tsx");
    if (!admin.includes("border-transparent bg-brand font-semibold text-white shadow-sm")) throw new Error("缺：页签激活态");
    if (/bg-lime-pale/.test(admin)) throw new Error("残留：Admin lime-pale");
    const layout = read("src/components/Layout.tsx");
    if (!layout.includes("bg-brand font-semibold text-white shadow-sm")) throw new Error("缺：侧栏激活态");
    if (/bg-lime-pale(?!\/)/.test(layout)) throw new Error("残留：Layout lime-pale");
  });

  it("已推送 chip 换浅米黄", () => {
    const src = read("src/components/ReportAccessButton.tsx");
    if (!/bg-butter-pale px-3 py-1\.5 text-\[12\.5px\] font-semibold text-brand/.test(src))
      throw new Error("缺：已推送 chip 新色");
  });
});
