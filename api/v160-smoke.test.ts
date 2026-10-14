/* v160 冒烟：用户列表 / 学员列表 / 伴学工作台学员管理 三个列表加分页。
   共享 usePager（resetKey 变化回第 1 页）+ Pager 组件（共 N 条 · 页码 · 上一页/下一页，单页不渲染）。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v160 三个列表分页", () => {
  const pagerHook = readFileSync("src/hooks/usePager.ts", "utf-8");
  const pager = readFileSync("src/components/Pager.tsx", "utf-8");
  const admin = readFileSync("src/pages/Admin.tsx", "utf-8");
  const tutor = readFileSync("src/pages/Tutor.tsx", "utf-8");

  it("usePager：切片 + resetKey 重置 + 页码夹取", () => {
    if (!/slice\(\(safePage - 1\) \* pageSize, safePage \* pageSize\)/.test(pagerHook))
      throw new Error("缺：按页切片");
    if (!/\[resetKey\]/.test(pagerHook)) throw new Error("缺：resetKey 重置到第 1 页");
    if (!/Math\.min\(Math\.max\(1, page\), totalPages\)/.test(pagerHook)) throw new Error("缺：页码夹取");
  });

  it("Pager 组件：总数/页码/翻页，单页不渲染", () => {
    if (!/共 \{total\} 条/.test(pager)) throw new Error("缺：总数展示");
    if (!/上一页/.test(pager) || !/下一页/.test(pager)) throw new Error("缺：翻页按钮");
    if (!/totalPages <= 1\) return null/.test(pager)) throw new Error("缺：单页不渲染");
  });

  it("后台 · 用户列表分页", () => {
    if (!/const usersPager = usePager\(users \?\? \[\], 20, debouncedSearch\)/.test(admin))
      throw new Error("缺：用户列表 usePager");
    if (!/usersPager\.pageItems\.map\(\(u\)/.test(admin)) throw new Error("缺：用户列表按页渲染");
  });

  it("后台 · 学员列表分页", () => {
    if (!/const studentsPager = usePager\(filtered, 20, kw\)/.test(admin))
      throw new Error("缺：学员列表 usePager");
    if (!/studentsPager\.pageItems\.map\(\(s\)/.test(admin)) throw new Error("缺：学员列表按页渲染");
  });

  it("伴学工作台 · 学员管理分页（每页 10 卡）", () => {
    if (!/const pager = usePager\(filtered, 10, kw\)/.test(tutor)) throw new Error("缺：伴学学员 usePager");
    if (!/pager\.pageItems\.map\(\(s\)/.test(tutor)) throw new Error("缺：伴学学员按页渲染");
  });

  it("两处渲染 Pager 组件", () => {
    const adminPagerCount = (admin.match(/<Pager /g) ?? []).length;
    if (adminPagerCount < 2) throw new Error("缺：Admin 两处 Pager");
    if (!/<Pager page=\{pager\.page\}/.test(tutor)) throw new Error("缺：Tutor Pager");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v160-2026-10-14";')) throw new Error("BUILD_TAG 未递增到 v160");
  });
});
