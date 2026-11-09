import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  CAMPUS_MENTAL_KINDS,
  CAMPUS_REPORT_KINDS,
  campusCareerPrerequisites,
  campusResultAllowed,
  campusTabAllowed,
  campusTabsFor,
  normalizeCampusReportKinds,
} from "@contracts/campusReports";
import { getCampusReportKinds } from "./campusReports";
import { getStudentDetail } from "./studentDetail";

const { tutorReportAccessMock } = vi.hoisted(() => ({ tutorReportAccessMock: vi.fn() }));
vi.mock("./tutorAccess", async (importOriginal) => ({
  ...await importOriginal<typeof import("./tutorAccess")>(),
  getTutorReportAccess: tutorReportAccessMock,
}));

/** 仅模拟 Drizzle 查询链，不声称覆盖真实 MySQL/CynosDB。 */
function mockDb(reads: unknown[][], withUser = false) {
  const db = {
    query: {
      users: {
        findFirst: async () => ({
          id: 101, name: "测试学生", phone: "13000000000", role: "student", orgId: 7,
          createdAt: new Date("2026-01-01"), lastSignInAt: new Date("2026-11-01"), deletedAt: null,
        }),
      },
    },
    select: vi.fn(() => {
      const result = reads.shift() ?? [];
      const query = {
        from: () => query,
        innerJoin: () => query,
        leftJoin: () => query,
        where: () => query,
        orderBy: () => query,
        limit: async () => result,
        then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    }),
  };
  return (withUser ? db : { select: db.select }) as never;
}

const profile = {
  id: 1, userId: 101, name: "测试学生", grade: "高一", school: "测试学校", targetSchool: null,
  dailyMinutes: 60, mbti: null, disc: null, onboarded: true, tutorId: 9, academics: null,
};
const resultRows = [
  { id: 2, userId: 101, kind: "mentalsdq", result: { level: "正常" }, answers: { private: "sdq" }, createdAt: new Date("2026-11-02") },
  { id: 1, userId: 101, kind: "e3", result: { version: "3.7" }, answers: { private: "e3" }, createdAt: new Date("2026-11-01") },
];
const emptyLearningReads = [[], [], [], [{ c: 0 }], [{ c: 0 }], [{ c: 0 }]];

beforeEach(() => {
  vi.clearAllMocks();
  tutorReportAccessMock.mockResolvedValue({ allowed: true, expiresAt: null });
});

describe("校园逐报告白名单", () => {
  it("校园 NULL、空数组和异常数据都不开放，非校园 null 不影响旧规则", () => {
    expect(normalizeCampusReportKinds(null)).toEqual([]);
    expect(normalizeCampusReportKinds(undefined)).toEqual([]);
    expect(normalizeCampusReportKinds("not-json")).toEqual([]);
    expect(normalizeCampusReportKinds(["e3", "e3", "unknown", 1])).toEqual(["e3"]);
    expect(campusResultAllowed("e3", [])).toBe(false);
    expect(campusResultAllowed("e3", null)).toBe(true);
    expect(campusResultAllowed("familystudent", null)).toBe(true);
    expect(campusResultAllowed("familystudent", [])).toBe(false);
  });

  it("四套心理量表各自独立授权，不能靠心理栏目并集互相放行", () => {
    for (const granted of CAMPUS_MENTAL_KINDS) {
      const allowed = [granted];
      for (const candidate of CAMPUS_MENTAL_KINDS) {
        expect(campusResultAllowed(candidate, allowed)).toBe(candidate === granted);
      }
      expect(campusTabAllowed("mental", allowed)).toBe(true);
      expect(campusTabsFor(allowed)).toEqual(["mental"]);
    }
  });

  it("学科四维和霍兰德不隐含选科综合报告，career 独立授权", () => {
    expect(campusResultAllowed("subject4d", ["subject4d", "holland"])).toBe(false);
    expect(campusResultAllowed("holland", ["subject4d", "holland"])).toBe(true);
    expect(campusTabAllowed("zhihui", ["subject4d", "holland"])).toBe(false);
    expect(campusResultAllowed("subject4d", ["career"])).toBe(true);
    expect(campusTabAllowed("zhihui", ["career"])).toBe(true);
  });

  it("综合报告四项前置条件逐项缺失时都不能判为 ready", () => {
    const complete = {
      hasSubject4d: true,
      hasHolland: true,
      academics: { subjects: [{ name: "数学", lastScore: 100 }] },
      expectations: { school: "目标大学", majorCat: null, careers: null },
    };
    expect(campusCareerPrerequisites(complete).ready).toBe(true);
    expect(campusCareerPrerequisites({ ...complete, hasSubject4d: false }).ready).toBe(false);
    expect(campusCareerPrerequisites({ ...complete, hasHolland: false }).ready).toBe(false);
    expect(campusCareerPrerequisites({ ...complete, academics: { subjects: [{ name: "数学", lastScore: null }] } }).ready).toBe(false);
    expect(campusCareerPrerequisites({ ...complete, expectations: { school: "", majorCat: null, careers: null } }).ready).toBe(false);
  });

  it("校园注册身份按最新渠道判定；非校园返回 null，校园历史 NULL 归一为空", async () => {
    expect(await getCampusReportKinds(mockDb([[{ campus: true, kinds: null }]]), 101)).toEqual([]);
    expect(await getCampusReportKinds(mockDb([[{ campus: true, kinds: ["e3"] }]]), 101)).toEqual(["e3"]);
    expect(await getCampusReportKinds(mockDb([[{ campus: false, kinds: ["e3"] }]]), 101)).toBeNull();
    expect(await getCampusReportKinds(mockDb([[]]), 101)).toBeNull();
  });
});

describe("教师后台只受原有 B 端报告权限约束", () => {
  it("历史校园学生即使前台授权为空，教师仍可查看全部已测报告和原始答案", async () => {
    const db = mockDb([
      [profile], resultRows, [{ campus: true, kinds: null }], ...emptyLearningReads,
    ], true);
    const detail = await getStudentDetail(db, 101, undefined, { userId: 9, role: "tutor" });
    expect(detail.campusReportKinds).toEqual([]);
    expect(detail.completedKinds).toEqual(["mentalsdq", "e3"]);
    expect(detail.assessments.e3).toEqual({ version: "3.7" });
    expect(detail.assessments.optional?.mentalsdq).toEqual({ level: "正常" });
    expect(detail.assessments.raw.map((r) => r.kind)).toEqual(["mentalsdq", "e3"]);
    expect(detail.assessments.raw.every((r) => r.answers != null)).toBe(true);
    expect(tutorReportAccessMock).toHaveBeenCalledWith(expect.anything(), 9, 101);
  });

  it("即使校园报告已授权，B 端无权限仍只返回名称、时间和空答案", async () => {
    tutorReportAccessMock.mockResolvedValue({ allowed: false, expiresAt: new Date("2026-10-01") });
    const db = mockDb([
      [profile], resultRows, [{ campus: true, kinds: [...CAMPUS_REPORT_KINDS] }], ...emptyLearningReads,
    ], true);
    const detail = await getStudentDetail(db, 101, undefined, { userId: 9, role: "tutor" });
    expect(detail.reportAccess?.allowed).toBe(false);
    expect(detail.completedKinds).toEqual(["mentalsdq", "e3"]);
    expect(detail.assessments.e3).toBeUndefined();
    expect(detail.assessments.optional).toBeUndefined();
    expect(detail.assessments.raw).toHaveLength(2);
    expect(detail.assessments.raw.every((r) => r.answers === null)).toBe(true);
  });
});

describe("校园授权迁移和前后端接入契约", () => {
  it("0055 不回填历史授权，journal 与内嵌迁移同时保留 0054、0055", () => {
    const sql = readFileSync("db/migrations/0055_campus_report_kinds.sql", "utf8");
    expect(sql).toContain("ADD `campus_report_kinds` json NULL");
    expect(sql).not.toMatch(/UPDATE\s+`?student_profile`?/i);
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries).toContainEqual(expect.objectContaining({ idx: 55, tag: "0055_campus_report_kinds" }));
    expect(journal.entries.at(-1)).toMatchObject({ idx: 56, tag: "0056_coaching_stage_handoffs" });
    const embedded = readFileSync("api/migrationsEmbedded.ts", "utf8");
    expect(embedded).toContain("0054_coaching_service_delivery");
    expect(embedded).toContain("0055_campus_report_kinds");
  });

  it("校园注册默认空授权，注册标题与逐学生授权入口已经接入", () => {
    expect(readFileSync("api/inviteRegistration.ts", "utf8")).toContain("campusReportKinds: input.campus ? [] : null");
    const register = readFileSync("src/pages/InviteRegister.tsx", "utf8");
    expect(register).toContain("学业生涯测评");
    expect(register).toContain("测评与升学指导服务");
    expect(readFileSync("api/schoolRouter.ts", "utf8")).toContain("setReports: assessSvcQuery");
    expect(readFileSync("src/components/admin/AssessCenter.tsx", "utf8")).toContain("CampusReportAccessPanel");
  });

  it("机构版旧规则保留，校园前台授权不再过滤老师后台和升学接口", () => {
    const reportDetail = readFileSync("src/pages/ReportDetail.tsx", "utf8");
    expect(reportDetail).toContain("const OPEN_TABS");
    expect(reportDetail).toContain("profile.reportReleased");
    expect(reportDetail).toContain("channelGranted");
    expect(reportDetail).toContain("campus ?");
    expect(readFileSync("api/profileRouter.ts", "utf8")).toContain("campusResultAllowed(row.kind, campusReportKinds)");
    const zhihui = readFileSync("api/zhihuiRouter.ts", "utf8");
    expect(zhihui).toContain("getTutorReportAccess(db, ctx.user.id, studentId)");
    expect(zhihui).toContain('sid === ctx.user.id && campusReportKinds && !campusReportKinds.includes("career")');
    expect(readFileSync("src/components/StudentDetailDrawer.tsx", "utf8")).toContain("allowedKinds={null}");
    expect(readFileSync("src/components/reports/ReportView.tsx", "utf8")).toContain('viewer === "student" && (!!campusInfo?.campus || Array.isArray(allowedKinds))');
  });
});
