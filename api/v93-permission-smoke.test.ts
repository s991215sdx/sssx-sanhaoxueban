/* v93 权限冒烟：org_id 为 NULL 的平台直客学员可见性。
   v179 修订：可见性改由「数据归位」保证——存量直客账号迁移到原机构后按本机构可见；
   代码层面机构范围严格限定本机构，不再对 NULL 放行（防新机构越权看其他机构数据）。
   v190 修订（孙冬晓确认 2026-10-17）：无机构学员改对本机构管理员可见——公开邀请码注册的
   学员不分机构，继续隐藏会导致「学生做完测评却在机构列表消失」；其他机构仍严格隔离。
   口径统一为 tenant.orgScope = 本机构 + org_id IS NULL。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v93/v190 平台直客（org_id NULL）可见性", () => {
  it("v190：listStudents 机构范围 = 本机构 + 无机构（orgScope）", () => {
    const src = read("api/studentDetail.ts");
    need(src, "orgScope(orgId)", "机构范围用 orgScope（本机构+无机构）");
    if (src.includes("where(eq(users.orgId, orgId))"))
      throw new Error("残留 v93 严格过滤：listStudents 仍有 eq(orgId) 独占分支");
  });

  it("v190：getStudentDetail 无机构学员对本机构管理员放行", () => {
    const src = read("api/studentDetail.ts");
    need(src, "target.orgId !== orgId && target.orgId != null", "无机构目标放行+跨机构拒绝");
  });

  it("v190：sameOrg 无机构账号对本机构管理员放行", () => {
    const src = read("api/tenant.ts");
    need(src, "t.orgId === me.orgId || t.orgId == null", "无机构目标放行");
    need(src, "orgScope", "orgScope helper 存在");
  });

  it("isMyStudent：关系命中即认（v230——跨机构分配仅限平台超管建立，隔离不被破坏）", () => {
    const src = read("api/tutorAccess.ts");
    need(src, "跨机构分配记录同样生效", "跨机构分配生效注释");
    if (src.includes("meOrg !== targetOrg")) throw new Error("v230 应移除双非空异机构的一律拒绝");
  });

  it("报告页桌面端整体放大（zoom）仍在", () => {
    need(read("src/components/reports/ReportView.tsx"), "report-view-zoom", "报告 zoom 钩子类名");
    need(read("src/index.css"), ".report-view-zoom", "zoom 样式");
  });
});
