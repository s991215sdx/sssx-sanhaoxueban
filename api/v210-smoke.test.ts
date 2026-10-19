/* v210 冒烟：报告院校推荐的总分口径修正——按实际填写科目的满分合计自动判定总分，折算 750 等效分。
   问题（孙冬晓 2026-10-19）：高一上 9 科考试满分 1050（语数英 150 + 其余 100），
   报告却把原始总分直接对照 750 分制的分数段矩阵，导致「你的档」标注错误。
   口径：fullTotal = Σ(有成绩科目的满分[成绩档案 fullScore 或 defaultFullScore 按年级兜底])；
   equiv750 = totalScore / fullTotal × 750；矩阵「你的档」与冲稳保文案均用 equiv750。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v210 总分口径自动判定与 750 折算", () => {
  const page = read("src/pages/ZhihuiReport.tsx");
  const router = read("api/router.ts");

  it("按满分合计自动判定并折算等效分", () => {
    if (!/fullTotal/.test(page)) throw new Error("缺：fullTotal 满分合计");
    if (!/equiv750 = fullTotal > 0 \? Math\.round\(\(totalScore \/ fullTotal\) \* 750\)/.test(page)) throw new Error("缺：750 等效分折算");
    if (!/defaultFullScore\(a\.name, grade\)/.test(page)) throw new Error("缺：按年级科目满分兜底");
  });

  it("矩阵「你的档」用等效分标注", () => {
    if (!/equiv750 >= Number\(b\.band\.slice\(0, 3\)\)/.test(page)) throw new Error("缺：矩阵按 equiv750 对照");
  });

  it("BUILD_TAG 已递增到 v210", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 210) throw new Error(`BUILD_TAG 未递增到 v210（当前 v${v}）`);
  });
});
