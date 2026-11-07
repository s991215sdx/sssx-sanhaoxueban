import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, authedQuery, tutorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { isPlatformAdmin } from "./tenant";
import { ASSESSMENT_PACKAGES, COURSE_CATALOG, DEFAULT_ORG_POINTS, fullCoverageCredits, recommendedOrgPoints, selectionFor } from "@contracts/orgService";
import { INVITE_ASSESS_KINDS } from "@contracts/invite";
import { adjustOrgPoints, allocateOrgPoints, initializeOrgPoints, pointOverview, walletBalance } from "./orgPoints";
import { cancelAssessmentItem, createAssessmentActivity, listAssessmentActivities, myAssessmentAssignments, startAssessmentAssignment } from "./assessmentActivities";
import { requireOrgStaff } from "./orgAccess";

function platformOrg(ctx: { user: { role: "tutor" | "user" | "admin" | "jiaowu"; orgId: number | null } }, orgId: number): number {
  if (!isPlatformAdmin(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "仅平台超管可调整机构总积分" });
  return orgId;
}

export const orgServiceRouter = createRouter({
  catalog: tutorQuery.query(() => ({
    packages: ASSESSMENT_PACKAGES,
    singles: INVITE_ASSESS_KINDS.map((k) => selectionFor(k.key)!),
    courses: COURSE_CATALOG,
    fullCoverageCredits: fullCoverageCredits(),
    students: 200,
    recommendedPoints: recommendedOrgPoints(200),
    defaultPoints: DEFAULT_ORG_POINTS,
  })),

  myWallet: tutorQuery.query(({ ctx }) => walletBalance(getDb(), requireOrgStaff(ctx.user), ctx.user.id)),

  points: adminQuery.input(z.object({ orgId: z.number().int().positive().optional() })).query(({ ctx, input }) => {
    const orgId = ctx.user.orgId ?? input.orgId;
    if (orgId == null || (ctx.user.orgId != null && input.orgId != null && input.orgId !== ctx.user.orgId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "请选择要查看的本机构积分账户" });
    }
    return pointOverview(getDb(), orgId);
  }),

  initializePoints: adminQuery.input(z.object({ orgId: z.number().int().positive(), amount: z.number().int().min(0).max(100_000_000).default(DEFAULT_ORG_POINTS) }))
    .mutation(({ ctx, input }) => initializeOrgPoints(getDb(), platformOrg(ctx, input.orgId), ctx.user.id, input.amount)),

  adjustPoints: adminQuery.input(z.object({ orgId: z.number().int().positive(), delta: z.number().int().min(-100_000_000).max(100_000_000).refine((n) => n !== 0), reason: z.string().trim().min(2).max(500) }))
    .mutation(({ ctx, input }) => adjustOrgPoints(getDb(), { orgId: platformOrg(ctx, input.orgId), actorUserId: ctx.user.id, delta: input.delta, reason: input.reason })),

  allocatePoints: adminQuery.input(z.object({ tutorUserId: z.number().int().positive(), amount: z.number().int().positive().max(10_000_000) }))
    .mutation(({ ctx, input }) => {
      if (ctx.user.orgId == null) throw new TRPCError({ code: "FORBIDDEN", message: "请由本机构管理员分配伴学师积分" });
      return allocateOrgPoints(getDb(), { orgId: ctx.user.orgId, actorUserId: ctx.user.id, ...input });
    }),

  createActivity: tutorQuery.input(z.object({
    requestKey: z.string().min(12).max(64), studentIds: z.array(z.number().int().positive()).min(1).max(50),
    selections: z.array(z.string().min(1).max(48)).min(1).max(20), title: z.string().trim().min(1).max(128),
    note: z.string().max(500).optional(), dueAt: z.date().nullable().optional(),
  })).mutation(({ ctx, input }) => createAssessmentActivity(getDb(), ctx.user, input)),

  activities: tutorQuery.query(({ ctx }) => listAssessmentActivities(getDb(), ctx.user)),

  cancelItem: tutorQuery.input(z.object({ itemId: z.number().int().positive(), reason: z.string().trim().min(2).max(500) }))
    .mutation(({ ctx, input }) => cancelAssessmentItem(getDb(), ctx.user, input.itemId, input.reason)),

  myAssignments: authedQuery.query(({ ctx }) => {
    if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员身份查看测评任务" });
    return myAssessmentAssignments(getDb(), ctx.user.id);
  }),

  startAssignment: authedQuery.input(z.object({ assignmentId: z.number().int().positive() })).mutation(({ ctx, input }) => {
    if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员身份开始测评" });
    return startAssessmentAssignment(getDb(), ctx.user.id, input.assignmentId);
  }),
});
