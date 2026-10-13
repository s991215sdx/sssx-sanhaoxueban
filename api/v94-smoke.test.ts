/* v94 冒烟：文字去绿——olive 系改墨绿炭黑，绿色只留点缀 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v94 文字去绿", () => {
  it("olive 令牌为深绿系（v94 墨绿炭黑 → v98 报告深绿，均为深绿非鲜绿文字）", () => {
    const src = read("tailwind.config.js");
    for (const tok of ['DEFAULT: "#(20362B|0B3D2E|0A3B34|1E3530)"', 'soft: "#(43564C|4B5F57|4E6A61|55645C|46564F)"', 'mute: "#(7A8A82|8FA39B|8CA098|7C8C84)"']) {
      if (!src.includes(tok) && !new RegExp(tok).test(src)) throw new Error("缺 olive 令牌：" + tok);
    }
    /* lime 鲜绿点缀保留 */
    if (!/DEFAULT: "#(3CC078|52A965)"/.test(src)) throw new Error("lime 鲜绿应保留");
  });

  it("关键页面无 v93 绿色文字残留", () => {
    for (const f of ["src/components/StudentDetailDrawer.tsx", "src/pages/Report.tsx", "src/pages/Tutor.tsx"]) {
      const src = read(f);
      if (/#1F6B43|#2E7D55|#6E8579/i.test(src)) throw new Error(f + " 残留绿色文字色值");
    }
  });
});
