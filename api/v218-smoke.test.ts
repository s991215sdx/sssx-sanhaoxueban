/* v218 冒烟：报告推荐口径统一 + 粤华组合池全视角生效。
   背景（2026-10-19 唐先生反馈）：
   1. 刘芷茵（首选历史）报告中「12 门类推荐指数」理工农医仍标高推荐、「适合从事的职业」全是工程师——
      v217 只修了后端专业推荐，门类推荐指数（前端 menleiRec）与职业推荐（后端 careerPicks）仍是旧口径。
   2. 粤华学校要求第一/第二/第三推荐只限 5 组合（物化生/物化地/物化政/政史地/政史生），
      但伴学师/管理员内嵌查看粤华学生时 campus=false 走了通用版组合。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v218 推荐口径统一与粤华组合池", () => {
  const api = read("api/zhihuiRouter.ts");
  const page = read("src/pages/ZhihuiReport.tsx");

  it("门类推荐指数：首选历史时理工农医不推荐、理学压到45以下", () => {
    need(page, 'for (const m of ["工学", "农学", "医学"]) sc[m] = 0', "硬核门类清零");
    need(page, "Math.min(rec[\"理学\"], 45)", "理学上限45");
  });

  it("职业推荐：四维加权 + 首选历史过滤硬核工科职业", () => {
    need(api, "CAREER_MENLEI", "职业→门类映射");
    need(api, "CAREER_HARD", "硬核工科职业过滤");
    need(api, "0.6 + 0.8 * careerFit(top)", "职业四维加权");
    need(api, "careerPicks.length === 0", "职业兜底补位");
  });

  it("粤华学生全视角走 5 组合池", () => {
    need(page, "campus || data?.student.campus", "内嵌查看同样校园版");
    need(page, "data?.student.campus, scorePct]);", "依赖数组带学生 campus 与权重（v221）");
  });

  it("BUILD_TAG 已递增到 v218", () => {
    const router = read("api/router.ts");
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 218) throw new Error(`BUILD_TAG 未递增到 v218（当前 v${v}）`);
  });
});
