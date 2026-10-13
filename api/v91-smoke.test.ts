/* v91 冒烟：明快亮色系——正文近黑、深绿品牌色、鲜绿点缀、亮底 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v91 明快色系", () => {
  it("tailwind 令牌为深绿/鲜绿/亮底", () => {
    const src = read("tailwind.config.js");
    for (const [tok, hex] of [
      /* v91 的 #1F6B43 偏"鲜绿"，v94 改墨绿炭黑 #20362B，v98 改报告深绿 #0B3D2E，v122 改深青墨绿 #0A3B34（不再锁死单一值） */
      ['DEFAULT: "#(1F6B43|20362B|0B3D2E|0A3B34)"', "olive 深绿"],
      ['DEFAULT: "#(3CC078|52A965)"', "lime 鲜绿"],
      ['pale: "#(E4F7EC|E9F3E6)"', "浅绿 tint"],
    ]) {
      if (!src.includes(tok) && !new RegExp(tok).test(src)) throw new Error("缺 " + hex + "：" + tok);
    }
    /* 亮底：v91 引入 #F7F9F8，v93 起进一步提为纯白（不再锁死具体值） */
    if (!/DEFAULT: "#(F7F9F8|FFFFFF)"/.test(src)) throw new Error("缺：亮底 cream");
  });

  it("正文前景色为近黑而非中绿", () => {
    const src = read("src/index.css");
    if (!/--foreground: (160 12% 14%|172 40% 13%)/.test(src)) throw new Error("缺：近黑正文色");
  });

  it("不再残留 v85 雾感色值", () => {
    const files = ["src/pages/Login.tsx", "src/pages/Report.tsx", "src/lib/reportDownload.ts"];
    for (const f of files) {
      const src = read(f);
      if (/#2E8B57|#44B979|#8AA695/i.test(src)) throw new Error(f + " 残留 v85 色值");
    }
  });
});
