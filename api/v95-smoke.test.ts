/* v95 冒烟：卡点警示底色去粉——#fbe3df 全局替换为暖沙 #FAF3EB，红色文字/描边保留 */
import { describe, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) yield p;
  }
}

describe("v95 卡点底色去粉", () => {
  it("src 与 scripts 不再残留粉色 #fbe3df", () => {
    for (const f of [...walk("src"), ...walk("scripts")]) {
      const src = read(f);
      if (/#fbe3df/i.test(src)) throw new Error(f + " 残留粉色底色 #fbe3df");
    }
  });

  it("三阶九能主题使用浅色区分底（v95 暖沙 → v101 淡红/淡琥珀），红色警示文字保留", () => {
    const src = read("src/components/reports/e3v37Theme.ts");
    /* v101 起三档底色：卡点淡红 / 待提升淡琥珀 / 正常浅绿，与图例红黄绿一致 */
    if (!/bg:\s*"#(FAF3EB|FBEAE8|F9E4E1|FAF2E4)"/.test(src)) throw new Error("缺：卡点浅色底");
    if (!/text:\s*"#(8f1313|A82524)"/.test(src)) throw new Error("缺：卡点红色文字");
    if (!/bar:\s*"#(b91c1c|DD3534)"/.test(src)) throw new Error("缺：卡点红色条");
    /* 待提升琥珀色与正常绿色不变 */
    if (!/#(f5e7c1|FAF0CC)/i.test(src)) throw new Error("待提升琥珀底色被改动");
  });

  it("得分表行白底 + 判定文字着色（v102 起，替代 v101 的三档淡 tint）", () => {
    const src = read("src/components/reports/AbilityScoreTable.tsx");
    if (/fbe3df/i.test(src)) throw new Error("AbilityScoreTable 残留粉色");
    if (/e3v37LevelBgClass/.test(src)) throw new Error("得分表不应再引用行底色助手");
    if (!/e3v37LevelTextClass\(sub\.level\)/.test(src)) throw new Error("缺：按判定给文字着色");
  });
});
