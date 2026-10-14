/* v161 冒烟：伴学师列表——名下学员默认折叠（点击展开看全部）+ 伴学师分页（每页 10 个）。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v161 伴学师列表折叠 + 分页", () => {
  const admin = readFileSync("src/pages/Admin.tsx", "utf-8");

  it("学员默认折叠，点击展开/收起", () => {
    if (!/const \[expandedTutors, setExpandedTutors\] = useState<number\[\]>\(\[\]\)/.test(admin))
      throw new Error("缺：折叠状态（默认空=全部折叠）");
    if (!/const toggleTutor = \(id: number\)/.test(admin)) throw new Error("缺：展开/收起切换");
    if (!/expandedTutors\.includes\(t\.id\)/.test(admin)) throw new Error("缺：展开判定");
    if (!/学员 \$\{t\.studentCount\} 人 · 点击展开/.test(admin)) throw new Error("缺：折叠提示行");
    if (!/收起学员列表/.test(admin)) throw new Error("缺：收起文案");
    if (!/\{expanded && \(/.test(admin)) throw new Error("缺：展开后才渲染学员列表");
  });

  it("伴学师列表分页（每页 10 个）", () => {
    if (!/const tutorsPager = usePager\(tutors \?\? \[\], 10\)/.test(admin)) throw new Error("缺：tutorsPager");
    if (!/tutorsPager\.pageItems\.map\(\(t\)/.test(admin)) throw new Error("缺：按页渲染伴学师");
    if (!/tutorsPager\.totalPages > 1 && \(/.test(admin)) throw new Error("缺：多页才渲染分页条");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v161-2026-10-14";')) throw new Error("BUILD_TAG 未递增到 v161");
  });
});
