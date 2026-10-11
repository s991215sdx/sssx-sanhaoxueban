/* v108 冒烟：框架图卡片改「左加粗色条 + 浅底色 + 同色系深标题」，红黄绿三档协调 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v108 框架图卡片三档协调配色", () => {
  it("三档浅底色：卡点浅红/待提升浅黄/正常浅绿", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/卡点: "#FDEBEB"/.test(src)) throw new Error("缺：卡点浅红底");
    if (!/待提升: "#FFF6D9"/.test(src)) throw new Error("缺：待提升浅黄底");
    if (!/正常: "#E4F7EC"/.test(src)) throw new Error("缺：正常浅绿底");
  });

  it("卡片用左色条 + 浅色框 + 深标题（三阶与底座两处）", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    const n = (src.match(/border-l-\[5px\]/g) ?? []).length;
    if (n < 2) throw new Error(`缺：左色条卡片（应≥2处，实际${n}）`);
    if (!/borderLeftColor: box\.borderLeft/.test(src)) throw new Error("缺：左条取档色");
  });

  it("心理健康徽标同步新黄/红浅色系", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/warn: \{ border: "#FFC60099", bg: "#FFF6D9", text: "#C79400" \}/.test(src))
      throw new Error("缺：心理健康关注档新黄");
    if (!/bad: \{ border: "#b91c1c99", bg: "#FDEBEB", text: "#8f1313" \}/.test(src))
      throw new Error("缺：心理健康预警档浅红");
  });
});
