/* v207 冒烟：粤华校园版学生报告封面增强（仅校园渠道学生生效，其他机构不变）。
   需求（孙冬晓 2026-10-19）：报告封面/页眉——
   1) 年级后加「班级」行（班级来自 student_profile.class_name，v191 校园注册时填写）；
   2) 报告编号前加「学校：东莞粤华学校」（学生归属机构名）；
   3) 报告封面挂粤华校徽（机构 logoUrl，内嵌查看同样生效）。
   口径：按「被查看学生」的注册渠道是否 campus 判断（reportData 新返回 student.campus/schoolName/schoolLogo/className）。
   版本注记：与唐海陵 v206（学员按机构移除守卫）同日撞号，本特性顺延为 v207。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v207 粤华报告封面增强（校园学生专属）", () => {
  const api = read("api/zhihuiRouter.ts");
  const page = read("src/pages/ZhihuiReport.tsx");
  const router = read("api/router.ts");

  it("reportData 返回学生校园归属与班级", () => {
    if (!/className: profile\?\.className/.test(api)) throw new Error("缺：className 返回");
    if (!/campus: stuCampus/.test(api)) throw new Error("缺：campus 返回");
    if (!/schoolName/.test(api)) throw new Error("缺：schoolName 返回");
    if (!/logoUrl/.test(api)) throw new Error("缺：logoUrl 返回");
  });

  it("封面：学校行 / 年级后班级行 / 校徽", () => {
    if (!/stuCampus/.test(page)) throw new Error("缺：学生校园口径 stuCampus");
    if (!/班　　级/.test(page)) throw new Error("缺：班级行");
    if (!/学校：/.test(page)) throw new Error("缺：页眉学校标注");
    if (!/stuLogo && <img/.test(page)) throw new Error("缺：封面校徽");
  });

  it("BUILD_TAG 已递增到 v207", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 207) throw new Error(`BUILD_TAG 未递增到 v207（当前 v${v}）`);
  });
});
