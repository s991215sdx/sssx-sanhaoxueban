/* v92 冒烟：后台行内按钮规范化——修复 v90 替换造成的类名粘连，统一按钮内边距 */
import { describe, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(d: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      if (!["node_modules", "dist", ".git"].includes(f)) out.push(...walk(p));
    } else if (/\.(tsx?|css|html)$/.test(f)) out.push(p);
  }
  return out;
}

describe("v92 按钮规范化", () => {
  it("全项目无类名粘连（bg-cream-card 后必须跟空白）", () => {
    for (const f of walk(join(root, "src"))) {
      const src = readFileSync(f, "utf8");
      if (/bg-cream-card[^ /"'\`{]/.test(src)) throw new Error(f + " 存在粘连类名");
    }
  });

  it("后台行内按钮统一为 px-3.5 py-2 text-[13px] 白底", () => {
    const src = readFileSync(join(root, "src/pages/Admin.tsx"), "utf8");
    if (/bg-cream-cardpx-/.test(src)) throw new Error("Admin.tsx 仍有粘连类名");
    if (!src.includes("px-3.5 py-2 text-[13px] font-medium text-olive whitespace-nowrap")) throw new Error("缺统一按钮样式");
  });
});
