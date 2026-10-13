/* v90 冒烟：后台页面去灰——tab 条淡绿底、白色卡片上的按钮/输入框改白底 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v90 后台去灰", () => {
  it("tab 切换条为淡绿底、激活 tab 纯白", () => {
    const src = read("src/pages/Admin.tsx");
    if (!/bg-white p-1/.test(src)) throw new Error("缺：tab 条白底");
    if (!src.includes('tab === t.key ? "bg-[#52A965] text-white shadow"')) throw new Error("缺：激活 tab 草绿色卡");
  });

  it("白色卡片上的控件不再用灰底 bg-cream", () => {
    const src = read("src/pages/Admin.tsx");
    if (src.includes("border-border bg-cream ")) throw new Error("仍有灰底控件（border-border bg-cream ）");
  });
});
