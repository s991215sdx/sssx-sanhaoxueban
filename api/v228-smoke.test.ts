/* v228/v229 冒烟：页面按版本分流 + 功能权限服务端拦截。
   v228：职员侧校园判定与选科权重默认值改按 organizations.edition（不再靠渠道猜），存量经 0042 回填后行为逐字节一致；
   v229：关闭的功能在服务端真正拦截（403），默认全开=存量零变化。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v228 页面按版本分流", () => {
  it("职员校园判定按 edition（平台超管保持原口径）", () => {
    const api = read("api/schoolRouter.ts");
    need(api, "按机构版本（edition）判定，不再靠渠道猜测", "判定口径注释");
    need(api, 'select({ edition: organizations.edition }).from(organizations).where(eq(organizations.id, orgId))', "查机构版本");
    need(api, 'return org?.edition === "school"', "edition=school 即校园");
    need(api, "平台超管：任一 campus 渠道即为校园平台", "超管口径不变");
  });

  it("选科权重默认值按 edition（35/40）", () => {
    const api = read("api/schoolRouter.ts");
    need(api, "校园机构默认 35——按机构版本（edition）判定", "注释");
    need(api, 'edition: organizations.edition, settings: organizations.settings', "权重查询带 edition");
    need(api, 'editionBy.get(orgId) === "school" ? 35 : 40', "默认值分支");
  });

  it("升级校园版自动补校园渠道（org.update）", () => {
    const api = read("api/orgRouter.ts");
    need(api, "升级为校园版但机构还没有校园渠道时，自动补一条", "自动补渠道");
  });

  it("学生侧校园流程仍走渠道标识（不被版本化误伤）", () => {
    const api = read("api/schoolRouter.ts");
    need(api, "myCampusInfo", "学生渠道判定保留");
    const invite = read("api/inviteRouter.ts");
    need(invite, "campus: !!ch.campus", "渠道 campus 透传保留");
  });
});

describe("v229 功能权限服务端拦截", () => {
  it("orgServices：生效机构 + 默认全开", () => {
    const s = read("api/orgServices.ts");
    need(s, "effectiveOrgId", "生效机构解析");
    need(s, "学生=最新注册渠道", "学生口径");
    need(s, "orgId == null) return resolveServices", "无机构放行");
    need(s, "serviceEnabledFor", "开关判定");
  });

  it("middleware：requireService 中间件与三种基座", () => {
    const m = read("api/middleware.ts");
    need(m, 'throw new TRPCError({ code: "FORBIDDEN", message: "该功能未对本机构开通，请联系平台管理员" })', "403 提示");
    need(m, "serviceAuthedQuery", "基座导出");
    need(m, "serviceTutorQuery", "基座导出");
    need(m, "serviceAdminQuery", "基座导出");
  });

  it("资料库/树洞/选科规划整路由拦截，AI 建议单点拦截", () => {
    need(read("api/libraryRouter.ts"), 'serviceTutorQuery("library")', "library 拦截");
    need(read("api/treeholeRouter.ts"), 'serviceAuthedQuery("aiCoach")', "树洞拦截");
    need(read("api/zhihuiRouter.ts"), 'serviceAuthedQuery("xuanke")', "选科规划拦截");
    const coach = read("api/coachRouter.ts");
    need(coach, 'askAdvice: serviceTutorQuery("aiCoach")', "AI 建议拦截");
    need(coach, "  myStudents: tutorQuery", "伴学管理不受 aiCoach 影响");
  });

  it("schoolRouter 六个子路由按服务包拦截，context/权重不拦", () => {
    const api = read("api/schoolRouter.ts");
    need(api, 'serviceAuthedQuery("assessCenter")', "测评中心服务包基座");
    need(api, 'serviceAuthedQuery("intention")', "选科统计服务包基座");
    const left = api.split("\n").filter((l) => /^\s+\w+: authedQuery/.test(l)).map((l) => l.trim());
    const allowed = ["context:", "get:", "set:"];
    for (const l of left) {
      if (!allowed.some((a) => l.startsWith(a))) throw new Error(`不该用未拦截基座的过程：${l}`);
    }
  });

  it("前端入口隐藏：资料库/AI 陪练", () => {
    const tutor = read("src/pages/Tutor.tsx");
    need(tutor, 'services?.library !== false', "资料库按钮隐藏");
    need(tutor, 'services?.aiCoach !== false', "AI 面板隐藏");
    const layout = read("src/components/Layout.tsx");
    need(layout, 'services?.library === false', "学校版菜单隐藏资料库");
    const school = read("src/components/admin/SchoolConsole.tsx");
    need(school, 'it.key !== "library"', "控制台菜单过滤");
  });

  it("版本号 ≥ v228（后续版本递增不追溯修改本断言）", () => {
    const router = read("api/router.ts");
    const m = router.match(/BUILD_TAG = "v(\d+)-/);
    if (!m || Number(m[1]) < 228) throw new Error("BUILD_TAG 应不低于 v228");
  });
});
