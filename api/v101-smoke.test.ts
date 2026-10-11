/* v101→v102 冒烟：得分表去行底色——白底 + 判定文字着色（卡点深红/待提升琥珀/正常绿） */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v102 得分表白底+色字", () => {
  it("得分表行不再按判定铺底色（v101 的淡 tint 已撤销）", () => {
    const src = read("src/components/reports/AbilityScoreTable.tsx");
    if (/e3v37LevelBgClass/.test(src)) throw new Error("得分表仍引用行底色助手");
    if (/(FBEAE8|FBF3DC|F0FAF5)/.test(src)) throw new Error("得分表仍残留三档淡色底");
    /* 行底统一浅中性 */
    if (!/bg-cream\/70 px-3 py-2/.test(src)) throw new Error("小计行缺统一白底");
  });

  it("判定文字三档：卡点深红/待提升琥珀/正常绿，标签+分数+判定都着色", () => {
    const theme = read("src/components/reports/e3v37Theme.ts");
    for (const [tok, label] of [
      ['level === "卡点" ? "text-[#8f1313]"', "卡点深红"],
      ['"待提升" ? "text-[#8a6d1a]"', "待提升琥珀"],
      ['"text-[#2F8F60]"', "正常绿"],
    ]) {
      if (!theme.includes(tok)) throw new Error(`缺 ${label}：${tok}`);
    }
    const table = read("src/components/reports/AbilityScoreTable.tsx");
    const uses = (table.match(/e3v37LevelTextClass\(/g) ?? []).length;
    if (uses < 3) throw new Error(`判定文字着色处数不足（标签+分数+判定列），实际 ${uses}`);
  });
});
