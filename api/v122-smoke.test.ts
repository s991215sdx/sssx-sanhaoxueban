/* v122 冒烟：全局主题迁入「栖川烟渚」色卡（克制与温柔）——深青绿主色/草绿正向色/橙黄辅助 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v122 栖川烟渚主题色", () => {
  it("tailwind 主题令牌为新色卡色值", () => {
    const src = read("tailwind.config.js");
    for (const tok of [
      'DEFAULT: "#0C7064"', 'deep: "#095048"', 'pale: "#D9EDE8"',
      'DEFAULT: "#52A965"', 'light: "#8EBD86"', 'tint: "#CDE3CC"', 'pale: "#E9F3E6"',
      'deep: "#FFFAEE"', '"#FCCE45"', '"#FA872A"',
      'DEFAULT: "#0A3B34"', 'soft: "#4E6A61"', 'mute: "#8CA098"',
    ]) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
    if (/#0EA875|#3CC078|#FFC600|#FF961F|#0B3D2E/.test(src)) throw new Error("残留：旧主题色");
  });

  it("CSS 变量主色为深青绿 hsl(173 81% 24%)", () => {
    const src = read("src/index.css");
    if (!/--primary: 173 81% 24%;/.test(src)) throw new Error("缺：primary 深青绿");
    if (!/--background: 45 55% 96%;/.test(src)) throw new Error("缺：米白底");
    if (/159 85% 36%|150 20% 97%/.test(src)) throw new Error("残留：旧 CSS 变量");
  });

  it("组件内无旧主题 hex 残留", () => {
    const rv = read("src/components/reports/ReportView.tsx");
    if (/#0EA875|#3CC078|#6FD9A4|#B9ECD0|#E4F7EC|#FFC600|#FF961F/i.test(rv))
      throw new Error("残留：ReportView 旧主题色");
    const lf = read("src/components/Layout.tsx");
    if (/#0EA875/i.test(lf)) throw new Error("残留：Layout 旧主色");
  });
});
