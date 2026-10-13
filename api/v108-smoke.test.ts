/* v108 冒烟（v116 重设计后更新）：框架图卡片浅色底 + 同色系描边 + 同色系深标题 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v108 框架图卡片三档协调配色", () => {
  it("三档浅底色：卡点浅红/待提升浅黄/正常浅绿", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    for (const tok of ['bg: "#F9E4E1"', 'bg: "#FAF0CC"', 'bg: "#E9F3E6"']) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
  });

  it("卡片用同色系细边框（三阶与底座两处容器）", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    const n = (src.match(/rounded-xl border px-3 py-3 text-center/g) ?? []).length;
    if (n < 2) throw new Error(`缺：档色边框卡片（应≥2处，实际${n}）`);
    if (!/borderColor: box\.borderColor, background: box\.background/.test(src))
      throw new Error("缺：容器取档色");
  });
});
