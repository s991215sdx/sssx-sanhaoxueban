/* v122/v123 冒烟：全局主题迁入「栖川烟渚」色卡（克制与温柔）——v123 起 91 种零散色值按语义体系整体归并 */
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
      'DEFAULT: "#0C7064"', 'deep: "#08463E"', 'pale: "#D9EDE8"',
      'DEFAULT: "#52A965"', 'light: "#8EBD86"', 'tint: "#CDE3CC"', 'pale: "#E9F3E6"',
      'deep: "#FFFAEE"', '"#FCCE45"', '"#FA872A"',
      'DEFAULT: "#1E3530"', 'soft: "#46564F"', 'mute: "#7C8C84"',
    ]) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
    if (/#0EA875|#3CC078|#FFC600|#FF961F|#0B3D2E/.test(src)) throw new Error("残留：旧主题色");
  });

  it("CSS 变量主色为深青绿 hsl(173 81% 24%)", () => {
    const src = read("src/index.css");
    if (!/--primary: 173 81% 24%;/.test(src)) throw new Error("缺：primary 深青绿");
    if (!/--foreground: 168 31% 17%;/.test(src)) throw new Error("缺：墨色正文");
    if (!/--background: 45 (55|85)% 97%;/.test(src)) throw new Error("缺：米白底");
    if (/159 85% 36%|150 20% 97%/.test(src)) throw new Error("残留：旧 CSS 变量");
  });

  it("语义色体系归并：报告与主题文件无旧零散色值", () => {
    const banned = /#2F8F60|#8F1313|#B91C1C|#8A6D1A|#C7A23A|#F5E7C1|#FAF3EB|#C79400|#15C7BA|#0E9488|#FFCA01|#FE7B01|#DCE9F5|#6B7280|#20362B/i;
    for (const f of [
      "src/components/reports/ReportView.tsx",
      "src/components/reports/e3v37Theme.ts",
      "src/components/reports/SystemFramework.tsx",
      "tailwind.config.js",
    ]) {
      if (banned.test(read(f))) throw new Error(`残留旧色值：${f}`);
    }
    // 体系锚点：危险/警示/正向/信息四家族出自色卡
    const theme = read("src/components/reports/e3v37Theme.ts");
    for (const tok of ['bar: "#DD3534"', 'bar: "#FCCE45"', 'bar: "#52A965"']) {
      if (!theme.includes(tok)) throw new Error(`缺体系锚点：${tok}`);
    }
  });
});
