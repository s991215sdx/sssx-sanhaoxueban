/* v98 冒烟：品牌主色 + 报告深绿文字（v122 起 brand 由翡翠绿 #0EA875 迁入深青绿 #0C7064） */
import { describe, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle) && !new RegExp(needle).test(src)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v98 品牌主色主题", () => {
  it("tailwind：brand 主色令牌 + olive 报告深绿", () => {
    const src = read("tailwind.config.js");
    need(src, 'DEFAULT: "#(0EA875|0C7064)"', "brand 主色");
    need(src, 'deep: "#(0B8A63|095048|08463E)"', "brand 深色（hover）");
    need(src, 'DEFAULT: "#(0B3D2E|0A3B34|1E3530)"', "olive 报告深绿文字");
    need(src, 'mute: "#(8FA39B|8CA098)"', "olive 灰绿辅助文字");
  });

  it("primary CSS 变量为翡翠绿", () => {
    need(read("src/index.css"), "--primary: (159 85% 36%|173 81% 24%)", "primary 主色");
  });

  it("按钮/头部底色走 bg-brand，不再用 bg-olive（mute 除外）", () => {
    let bad = 0;
    for (const d of ["src", "scripts"]) {
      const walk = (dir: string) => {
        for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
          const p = join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (/\.(ts|tsx|js|jsx|html)$/.test(e.name)) {
            const s = read(p);
            const m = s.match(/\bbg-olive\b/g);
            if (m) {
              bad += m.length;
              throw new Error(p + " 残留 bg-olive");
            }
          }
        }
      };
      walk(d);
    }
    if (bad > 0) throw new Error("残留 bg-olive");
  });

  it("bg-brand 已被使用（Layout 头像/按钮）", () => {
    const layout = read("src/components/Layout.tsx");
    need(layout, "bg-brand", "Layout 品牌底色");
    need(layout, 'fill="#(0EA875|0C7064)"', "Logo 品牌色");
  });
});
