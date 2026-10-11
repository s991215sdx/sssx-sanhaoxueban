/* v87 冒烟：桌面端内容区白色卡片背景板 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v87 内容区背景板", () => {
  it("Layout 桌面端用 paper-card 白色卡片包裹内容并加宽自适应", () => {
    const src = read("src/components/Layout.tsx");
    if (!src.includes("md:paper-card")) throw new Error("缺：桌面端 paper-card 背景板");
    if (!/md:max-w-6xl/.test(src)) throw new Error("缺：桌面端内容区加宽到 max-w-6xl");
    if (!/md:min-h-\[calc\(100vh/.test(src)) throw new Error("缺：卡片最小高度撑满视口");
    if (!/md:px-8 md:py-7/.test(src)) throw new Error("缺：卡片内边距");
  });
});
