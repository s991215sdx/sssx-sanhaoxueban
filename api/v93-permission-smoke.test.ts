/* v93 权限冒烟：机构身份与学员可见范围。
   v256 修订：同一手机号的不同机构身份分别隔离；无机构旧学员只有在存在当前机构邀请、
   主管或分配关系时才可见，不能把全部无机构账号混入任一机构。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v93/v256 多身份机构隔离与历史无机构学员", () => {
  it("v256：listStudents 只取本机构与有本机构关系的无机构旧学员", () => {
    const src = read("api/studentDetail.ts");
    need(src, "listUnboundOrgStudentIds(db, orgId)", "无机构旧学员关系范围");
    if (src.includes("where(eq(users.orgId, orgId))"))
      throw new Error("残留独占机构过滤：应合并当前机构与旧关系范围");
  });

  it("v256：getStudentDetail 统一使用 sameOrg", () => {
    const src = read("api/studentDetail.ts");
    need(src, "sameOrg(db, { orgId }, userId)", "当前身份详情边界");
  });

  it("v256：sameOrg 对异机构拒绝，无机构学员按本机构关系放行", () => {
    const src = read("api/tenant.ts");
    need(src, "target.orgId === me.orgId", "同机构目标判断");
    need(src, "target.orgId != null", "有机构目标必须先通过机构校验");
    need(src, "listUnboundOrgStudentIds", "无机构旧学员关系范围");
    need(src, "orgScope", "orgScope helper 存在");
  });

  it("isMyStudent：先校验机构，再校验当前身份关系", () => {
    const src = read("api/tutorAccess.ts");
    need(src, "student.orgId !== tutor.orgId", "跨机构关系拒绝");
    need(src, "旧跨机构关系不能越权", "跨机构拒绝注释");
  });

  it("报告页桌面端整体放大（zoom）仍在", () => {
    need(read("src/components/reports/ReportView.tsx"), "report-view-zoom", "报告 zoom 钩子类名");
    need(read("src/index.css"), ".report-view-zoom", "zoom 样式");
  });
});
