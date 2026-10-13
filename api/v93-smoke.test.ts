/* v93 冒烟：去留白 + 提亮——页面纯白底、2xl 屏内容容器 1560px、tab 条淡绿统一 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v93 去留白提亮", () => {
  it("页面底色纯白血缘", () => {
    const src = read("tailwind.config.js");
    if (!src.includes('DEFAULT: "#FFFFFF"')) throw new Error("cream 底应为纯白");
  });

  it("内容容器 2xl 屏放宽到 1560px", () => {
    const src = read("src/components/Layout.tsx");
    if (!src.includes("2xl:max-w-[1560px]")) throw new Error("缺 2xl:max-w-[1560px]");
  });

  it("后台与伴学工作台 tab 条统一淡绿底", () => {
    for (const f of ["src/pages/Admin.tsx", "src/pages/Tutor.tsx"]) {
      const src = read(f);
      if (!/flex rounded-xl bg-(lime-pale|\[#F6EFD9\]|\[#52A965\]) p-1/.test(src)) throw new Error(f + " tab 条底色不符");
    }
  });
});
