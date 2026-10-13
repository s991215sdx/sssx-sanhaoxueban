/* v97 冒烟：后台管理标题/学员名/头像改绿，已推送 chip 文字改绿 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v97 后台管理去黑改绿", () => {
  it("页面标题、学员名绿色，头像绿底白字", () => {
    const src = read("src/pages/Admin.tsx");
    need(src, 'tracking-tight text-[#1E3530]">{platform ? "总系统 · 后台管理"', "页面标题黑色（v128 改）");
    need(src, 'font-semibold text-[#2F7A41]">{s.name}', "学员姓名绿色");
    need(src, "rounded-full bg-[#2F7A41] text-[14px] font-bold text-white", "头像绿底白字");
  });

  it("已推送 chip 文字绿色（icon 与文字两种模式）", () => {
    const src = read("src/components/ReportAccessButton.tsx");
    const greenCount = (src.match(/text-(brand|\[#2F7A41\])/g) ?? []).length;
    if (greenCount < 2) throw new Error(`已推送绿色文字缺（compact + 文字模式），实际 ${greenCount} 处`);
    /* 不应再残留近黑的已推送文字 */
    if (/bg-lime-pale[^"]*text-\[#1E3530\]/.test(src)) throw new Error("已推送仍残留深色文字");
  });
});
