/* v93 冒烟：org_id 为 NULL 的平台直客学员对机构管理员/伴学师可见（不再隐身） */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v93 平台直客（org_id NULL）可见性修复", () => {
  it("listStudents：机构范围查询包含 org_id IS NULL 的用户", () => {
    const src = read("api/studentDetail.ts");
    need(src, "isNull(users.orgId)", "机构范围包含未归属用户");
    need(src, "or(eq(users.orgId, orgId), isNull(users.orgId))", "or 组合条件");
  });

  it("getStudentDetail：目标学员 org_id 为 NULL 时放行", () => {
    const src = read("api/studentDetail.ts");
    need(src, "(target.orgId !== orgId && target.orgId != null)", "NULL 目标放行判断");
  });

  it("sameOrg：目标账号 org_id 为 NULL 时放行", () => {
    const src = read("api/tenant.ts");
    need(src, "(t.orgId === me.orgId || t.orgId == null)", "sameOrg NULL 放行");
  });

  it("isMyStudent：一方 org 为 NULL 时跳过机构一致性，双方异机构仍隔离", () => {
    const src = read("api/tutorAccess.ts");
    need(src, "meOrg != null && targetOrg != null && meOrg !== targetOrg", "双非空异机构才拒绝");
  });

  it("报告页桌面端放大与近全屏容器仍在", () => {
    need(read("src/components/reports/ReportView.tsx"), "report-view-zoom", "报告 zoom 钩子类名");
    need(read("src/index.css"), ".report-view-zoom", "zoom 样式");
    need(read("src/components/Layout.tsx"), "isReportPage", "报告页近全屏分支");
  });
});
