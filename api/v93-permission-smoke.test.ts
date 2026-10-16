/* v93 权限冒烟：org_id 为 NULL 的平台直客学员可见性。
   v179 修订：可见性改由「数据归位」保证——存量直客账号迁移到原机构后按本机构可见；
   代码层面机构范围严格限定本机构，不再对 NULL 放行（防新机构越权看其他机构数据）。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v93 平台直客（org_id NULL）可见性", () => {
  it("v179：listStudents 严格本机构过滤（直客经数据归位后由本机构可见）", () => {
    const src = read("api/studentDetail.ts");
    if (src.includes("or(eq(users.orgId, orgId), isNull(users.orgId))"))
      throw new Error("残留 v93 放行：listStudents 对 org_id IS NULL 放行");
    need(src, "where(eq(users.orgId, orgId))", "严格 eq(orgId) 过滤");
  });

  it("v179：getStudentDetail 目标学员必须属于本机构", () => {
    const src = read("api/studentDetail.ts");
    if (src.includes("(target.orgId !== orgId && target.orgId != null)"))
      throw new Error("残留 v93 放行：getStudentDetail 对 NULL 机构学员放行");
  });

  it("v179：sameOrg 目标账号必须同机构", () => {
    const src = read("api/tenant.ts");
    if (src.includes("(t.orgId === me.orgId || t.orgId == null)"))
      throw new Error("残留 v93 放行：sameOrg 对 NULL 机构账号放行");
    need(src, "t.orgId === me.orgId", "严格同机构判定");
  });

  it("isMyStudent：一方 org 为 NULL 时跳过机构一致性，双方异机构仍隔离", () => {
    const src = read("api/tutorAccess.ts");
    need(src, "meOrg != null && targetOrg != null && meOrg !== targetOrg", "双非空异机构才拒绝");
  });

  it("报告页桌面端整体放大（zoom）仍在", () => {
    need(read("src/components/reports/ReportView.tsx"), "report-view-zoom", "报告 zoom 钩子类名");
    need(read("src/index.css"), ".report-view-zoom", "zoom 样式");
  });
});
