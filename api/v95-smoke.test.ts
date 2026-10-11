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

  it("三阶九能主题使用暖沙底色，红色警示文字保留", () => {
    const src = read("src/components/reports/e3v37Theme.ts");
    if (!/bg:\s*"#FAF3EB"/.test(src)) throw new Error("缺：卡点暖沙底色 #FAF3EB");
    if (!/text:\s*"#8f1313"/.test(src)) throw new Error("缺：卡点红色文字 #8f1313");
    if (!/bar:\s*"#b91c1c"/.test(src)) throw new Error("缺：卡点红色条 #b91c1c");
    /* 待提升琥珀色与正常绿色不变 */
    if (!/#f5e7c1/.test(src)) throw new Error("待提升琥珀底色被改动");
  });

  it("得分表能力行不再整行刷粉", () => {
    const src = read("src/components/reports/AbilityScoreTable.tsx");
    if (/fbe3df/i.test(src)) throw new Error("AbilityScoreTable 残留粉色");
    if (!/bg-\[#FAF3EB\]\/40/.test(src)) throw new Error("缺：小计行暖沙提示底");
  });
});
