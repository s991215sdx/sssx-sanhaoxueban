/* v110 冒烟：三阶分组标题加同色系浅色渐变横幅背景 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v110 三阶分组标题横幅", () => {
  it("板块色带浅底色 tint", () => {
    const src = read("src/components/reports/e3v37Theme.ts");
    for (const tok of ['tint: "#E2FAF7"', 'tint: "#FFF6D9"', 'tint: "#FFE9DB"']) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
  });

  it("得分表分组标题用渐变横幅（tint 左深右隐）", () => {
    const src = read("src/components/reports/AbilityScoreTable.tsx");
    if (!/linear-gradient\(90deg, \$\{sys\.tint\} 0%, \$\{sys\.tint\}A6 55%, transparent 100%\)/.test(src))
      throw new Error("缺：tint 渐变横幅");
    if (!/rounded-lg px-2\.5 py-1\.5/.test(src)) throw new Error("缺：横幅圆角内边距");
  });
});
