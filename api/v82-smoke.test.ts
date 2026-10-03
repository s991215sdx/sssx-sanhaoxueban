/* v82 冒烟：注册二维码「测评套餐」——渠道绑定测评 + 注册一站式连测 + 伴学师推送解锁 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeAssessKinds, INVITE_ASSESS_KINDS } from "@contracts/invite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v82 normalizeAssessKinds", () => {
  it("保留合法 key 并去重，剔除未知 key", () => {
    expect(normalizeAssessKinds(["mbti", "e3", "mbti", "hack"])).toEqual(["mbti", "e3"]);
  });
  it("all 直接放行全部", () => {
    expect(normalizeAssessKinds(["all", "x"])).toEqual(["all"]);
  });
  it("null/undefined 视为空；非数组非法；兼容 JSON 字符串", () => {
    expect(normalizeAssessKinds(null)).toEqual([]);
    expect(normalizeAssessKinds(undefined)).toEqual([]);
    expect(normalizeAssessKinds(42)).toBeNull();
    expect(normalizeAssessKinds("not-json")).toBeNull();
    expect(normalizeAssessKinds('["disc","subject"]')).toEqual(["disc", "subject"]);
  });
  it("套餐种类覆盖测评中心全部 kind（mental 一项覆盖四套量表）", () => {
    const keys = INVITE_ASSESS_KINDS.map((k) => k.key);
    for (const k of ["mbti", "disc", "e3", "e3parent", "multi5", "discparent", "anchor", "holland", "mental", "subject"]) {
      expect(keys).toContain(k);
    }
  });
});

describe("v82 后端接线", () => {
  const routerSrc = read("api/inviteRouter.ts");
  it("createChannel 接收并写入 assessmentAccess/assessmentKinds", () => {
    need(routerSrc, "assessmentAccess", "createChannel 测评套餐开关");
    need(routerSrc, "normalizeAssessKinds(input.assessmentKinds)", "createChannel 归一化");
    need(routerSrc, "assessmentKinds", "createChannel 写入列");
  });
  it("myAssessmentAccess 学员端查询", () => {
    need(routerSrc, "myAssessmentAccess", "学员端套餐查询");
    need(routerSrc, "inviteChannels.assessmentAccess", "套餐查询读列");
  });
  it("setChannelAssessments 修改渠道套餐", () => {
    need(routerSrc, "setChannelAssessments", "修改渠道套餐");
    need(routerSrc, "assertChannelEditable", "权限校验");
  });
  it("registerWithInvite 返回 assessQueue", () => {
    need(routerSrc, "assessQueue", "注册返回测评队列");
  });
  it("伴学师推送 setReleasedAssessments", () => {
    const coachSrc = read("api/coachRouter.ts");
    need(coachSrc, "setReleasedAssessments", "推送测评 mutation");
    need(coachSrc, "releasedAssessments: value", "写入档案列");
  });
  it("schema 与迁移含新列", () => {
    const schemaSrc = read("db/schema.ts");
    need(schemaSrc, 'assessmentAccess: boolean("assessment_access")', "渠道套餐开关列");
    need(schemaSrc, 'assessmentKinds: json("assessment_kinds")', "渠道套餐种类列");
    need(schemaSrc, 'releasedAssessments: json("released_assessments")', "档案推送列");
    const mig = read("api/migrationsEmbedded.ts");
    need(mig, "0026_invite_assessment_access", "内嵌迁移 0026");
    need(mig, "released_assessments", "迁移含推送列");
  });
  it("学员列表带 releasedAssessments 与 assessBoundKinds", () => {
    const detailSrc = read("api/studentDetail.ts");
    need(detailSrc, "releasedAssessments", "列表带推送状态");
    need(detailSrc, "assessBoundKinds", "列表带渠道绑定状态");
  });
});

describe("v82 前端接线", () => {
  it("测评中心：按套餐过滤 + 队列连测", () => {
    const src = read("src/pages/AssessmentCenter.tsx");
    need(src, "myAssessmentAccess", "查询渠道套餐");
    need(src, "releasedAssessments", "读取伴学师推送");
    need(src, "visibleTests", "按套餐过滤");
    need(src, 'params.get("queue")', "队列深链");
    need(src, "queueDone", "完成一项自动下一个");
    need(src, "hiddenCount", "隐藏测评提示");
  });
  it("注册落地页：注册成功带队列跳测评中心", () => {
    const src = read("src/pages/InviteRegister.tsx");
    need(src, "assessQueue", "注册响应取队列");
    need(src, "/assessments?queue=", "队列跳转");
  });
  it("建码页：测评套餐编辑器 + 编辑入口", () => {
    const src = read("src/components/admin/InviteChannelsTab.tsx");
    need(src, "AssessAccessEditor", "套餐编辑器");
    need(src, "INVITE_ASSESS_KINDS", "套餐种类");
    need(src, "setChannelAssessments", "保存渠道套餐");
  });
  it("伴学师/管理员学员卡：推送测评面板", () => {
    const panelSrc = read("src/components/AssessmentReleasePanel.tsx");
    need(panelSrc, "setReleasedAssessments", "面板保存");
    need(panelSrc, "渠道已绑定", "绑定态禁用");
    need(read("src/pages/Tutor.tsx"), "AssessmentReleasePanel", "伴学师学员卡");
    need(read("src/pages/Admin.tsx"), "AssessmentReleasePanel", "管理员学员行");
  });
});
