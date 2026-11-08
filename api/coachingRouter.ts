import { z } from "zod";
import { and, eq, isNull, or } from "drizzle-orm";
import { createRouter, authedQuery, tutorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { courseCatalog, users } from "@db/schema";
import { requireOrgStaff } from "./orgAccess";
import {
  acceptHandoff, addCoachingReview, addCoachingTask, addHandoff, coachingCaseDetail, createCoachingCase, downloadCoachingDeliverable,
  ensureCourseCatalog, familyCoachingFeedback, grantGuardian, listCoachingCases, listFamilyCoachingCases, pushParticipantFeedback, reassignCoachingCase,
  revokeGuardian, saveCoachingPlan, saveCourseSession, saveDailyCheckin, saveSupervision, setCoachingStatus, updateGrow, uploadCoachingDeliverable, verifyCoachingTask,
} from "./coachingService";
import { createCoachingException, recordCoachingException, revealCoachingException } from "./coachingExceptions";
import { cancelReassignment, listIncomingHandoffs } from "./coachingLifecycle";

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const caseInput = z.object({ studentUserId: z.number().int().positive(), scenarios: z.array(z.enum(["A", "B", "C", "D"])).min(1).max(4),
  goal: z.string().trim().min(2).max(5000), currentSituation: z.string().trim().min(2).max(8000), planSummary: z.string().trim().min(2).max(10000),
  serviceStart: dateText, serviceEnd: dateText });
const supervisionInput = z.object({ selfStudyMinutes: z.number().int().min(0).max(1440).default(0),
  alignment: z.string().max(6000).default(""), checks: z.string().max(6000).default(""), exitCheck: z.string().max(6000).default(""), followUp: z.string().max(6000).default("") });
const dailyCheckinInput = z.object({
  caseId: z.number().int().positive(), supervisionId: z.number().int().positive().nullable().optional(), checkDate: dateText,
  completionRate: z.number().int().min(0).max(100), accuracyRate: z.number().int().min(0).max(100),
  actualCompletion: z.string().max(10000), evidence: z.string().max(10000), tomorrowFirst: z.string().max(6000),
  gapReason: z.string().max(6000).default(""), errorCause: z.string().max(6000).default(""), correction: z.string().max(6000).default(""),
  followUp: z.string().max(6000).default(""), followUpDate: dateText.nullable().optional(),
  feynmanEnabled: z.boolean().default(false), feynmanConcept: z.string().max(2000).default(""), feynmanOutput: z.string().max(10000).default(""),
  feynmanGrade: z.enum(["A", "B", "C"]).optional(), feynmanStuck: z.string().max(6000).default(""), feynmanQuestion: z.string().max(6000).default(""),
  retestDate: dateText.nullable().optional(), traces: z.array(z.enum(["draft", "notes", "mindmap", "errorbook", "review"])).max(5),
  traceEvidence: z.string().max(10000).default(""), traceFollowUp: z.string().max(6000).default(""), changeReason: z.string().trim().max(500).optional(),
});

export const coachingRouter = createRouter({
  cases: tutorQuery.query(({ ctx }) => listCoachingCases(getDb(), ctx.user)),
  incoming: tutorQuery.query(({ ctx }) => listIncomingHandoffs(getDb(), ctx.user)),
  staff: tutorQuery.query(({ ctx }) => {
    const orgId = requireOrgStaff(ctx.user);
    return getDb().select({ id: users.id, name: users.name, role: users.role }).from(users)
      .where(and(eq(users.orgId, orgId), or(eq(users.role, "tutor"), eq(users.role, "admin")), isNull(users.deletedAt))).orderBy(users.id);
  }),
  detail: tutorQuery.input(z.object({ caseId: z.number().int().positive() })).query(({ ctx, input }) => coachingCaseDetail(getDb(), ctx.user, input.caseId)),
  createException: tutorQuery.input(z.object({ caseId: z.number().int().positive(), severity: z.enum(["S1", "S2", "S3", "S4"]),
    category: z.enum(["service", "archive", "communication", "attendance", "complaint", "integrity", "wellbeing", "safety", "other"]),
    title: z.string().trim().min(2).max(180), detail: z.string().trim().min(2).max(12000), sensitive: z.boolean().default(false),
    assigneeId: z.number().int().positive(), dueAt: z.date() })).mutation(({ ctx, input }) => createCoachingException(getDb(), ctx.user, input)),
  recordException: tutorQuery.input(z.object({ exceptionId: z.number().int().positive(), action: z.enum(["progress", "closed"]),
    note: z.string().trim().min(2).max(12000), evidence: z.string().trim().max(12000).optional() }))
    .mutation(({ ctx, input }) => recordCoachingException(getDb(), ctx.user, input)),
  revealException: tutorQuery.input(z.object({ exceptionId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => revealCoachingException(getDb(), ctx.user, input.exceptionId)),
  createCase: tutorQuery.input(caseInput).mutation(({ ctx, input }) => createCoachingCase(getDb(), ctx.user, input)),
  updateGrow: tutorQuery.input(caseInput.omit({ studentUserId: true }).extend({ caseId: z.number().int().positive(), scenarioChangeReason: z.string().trim().max(500).optional() }))
    .mutation(({ ctx, input }) => updateGrow(getDb(), ctx.user, input)),
  catalog: tutorQuery.query(async ({ ctx }) => {
    const db = getDb(); const orgId = requireOrgStaff(ctx.user);
    await ensureCourseCatalog(db, orgId);
    return db.select().from(courseCatalog).where(and(eq(courseCatalog.orgId, orgId), eq(courseCatalog.active, true)));
  }),
  savePlan: tutorQuery.input(z.object({ caseId: z.number().int().positive(), level: z.enum(["term", "month", "week", "day"]),
    parentId: z.number().int().positive().nullable().optional(), title: z.string().trim().min(2).max(160), content: z.string().trim().min(2).max(15000),
    startDate: dateText, endDate: dateText, sourceResultId: z.number().int().positive().nullable().optional(), confirmed: z.boolean().default(true) }))
    .mutation(({ ctx, input }) => saveCoachingPlan(getDb(), ctx.user, input)),
  addTask: tutorQuery.input(z.object({ caseId: z.number().int().positive(), planId: z.number().int().positive().nullable().optional(),
    title: z.string().trim().min(2).max(180), detail: z.string().max(6000).optional(), dueDate: dateText }))
    .mutation(({ ctx, input }) => addCoachingTask(getDb(), ctx.user, input)),
  verifyTask: tutorQuery.input(z.object({ taskId: z.number().int().positive(), evidence: z.string().trim().min(2).max(10000), result: z.string().trim().min(2).max(10000) }))
    .mutation(({ ctx, input }) => verifyCoachingTask(getDb(), ctx.user, input)),
  addReview: tutorQuery.input(z.object({ caseId: z.number().int().positive(), period: z.enum(["day", "week", "month", "term"]),
    periodKey: z.string().trim().min(2).max(24), content: z.string().trim().min(2).max(15000), nextActions: z.string().trim().min(2).max(10000) }))
    .mutation(({ ctx, input }) => addCoachingReview(getDb(), ctx.user, input)),
  addHandoff: tutorQuery.input(z.object({ caseId: z.number().int().positive(), type: z.enum(["H1", "H2", "H3", "H4", "H5"]),
    toUserId: z.number().int().positive(), title: z.string().trim().min(2).max(180), content: z.string().trim().min(2).max(15000), dueAt: z.date().nullable().optional() }))
    .mutation(({ ctx, input }) => addHandoff(getDb(), ctx.user, input)),
  acceptHandoff: tutorQuery.input(z.object({ handoffId: z.number().int().positive() })).mutation(({ ctx, input }) => acceptHandoff(getDb(), ctx.user, input.handoffId)),
  setStatus: tutorQuery.input(z.object({ caseId: z.number().int().positive(), status: z.enum(["active", "paused", "closed", "archived"]), reason: z.string().trim().min(2).max(2000) }))
    .mutation(({ ctx, input }) => setCoachingStatus(getDb(), ctx.user, input)),
  reassign: tutorQuery.input(z.object({ caseId: z.number().int().positive(), coachId: z.number().int().positive(), supervisorId: z.number().int().positive(), reason: z.string().trim().min(2).max(2000) }))
    .mutation(({ ctx, input }) => reassignCoachingCase(getDb(), ctx.user, input)),
  cancelReassignment: tutorQuery.input(z.object({ handoffId: z.number().int().positive(), reason: z.string().trim().min(2).max(2000) }))
    .mutation(({ ctx, input }) => cancelReassignment(getDb(), ctx.user, input)),
  saveCheckin: tutorQuery.input(dailyCheckinInput).mutation(({ ctx, input }) => saveDailyCheckin(getDb(), ctx.user, input)),
  saveSupervision: tutorQuery.input(z.object({ caseId: z.number().int().positive(), visitAt: z.date(), status: z.enum(["draft", "completed"]).default("completed") }).merge(supervisionInput))
    .mutation(({ ctx, input }) => saveSupervision(getDb(), ctx.user, input)),
  saveSession: tutorQuery.input(z.object({ caseId: z.number().int().positive(), startAt: z.date(), format: z.enum(["one_to_one", "salon", "workshop", "mixed"]),
    status: z.enum(["draft", "completed"]).default("completed"), changeReason: z.string().max(500).optional(), lateChangeConfirmed: z.boolean().default(false),
    sharedSummary: z.string().max(12000).optional(), supervision: supervisionInput,
    units: z.array(z.object({ courseKey: z.string().max(24), lessonNo: z.number().int().min(1).max(12).nullable().optional(), title: z.string().trim().min(2).max(180),
      learningPoints: z.string().max(10000).optional(), practiceEvidence: z.string().max(10000).optional() })).min(1).max(5),
    participants: z.array(z.object({ studentUserId: z.number().int().positive(), guardianLabel: z.string().max(64).optional(),
      attendance: z.enum(["present", "late", "absent", "leave"]).default("present"), personalObservation: z.string().max(10000).optional(),
      privateNote: z.string().max(10000).optional(), feedbackText: z.string().max(12000).optional(),
      action: z.object({ title: z.string().trim().min(2).max(180), detail: z.string().max(6000).optional(), dueDate: dateText }).optional() })).min(1).max(30) }))
    .mutation(({ ctx, input }) => saveCourseSession(getDb(), ctx.user, input)),
  pushFeedback: tutorQuery.input(z.object({ participantId: z.number().int().positive(), feedbackText: z.string().max(12000) }))
    .mutation(({ ctx, input }) => pushParticipantFeedback(getDb(), ctx.user, input)),
  upload: tutorQuery.input(z.object({ caseId: z.number().int().positive(), sessionId: z.number().int().positive().nullable().optional(),
    participantId: z.number().int().positive().nullable().optional(), taskId: z.number().int().positive().nullable().optional(),
    kind: z.enum(["text", "audio", "image"]), body: z.string().max(12000).optional(), mediaData: z.string().max(5_600_000).optional(), mimeType: z.string().max(80).optional() }))
    .mutation(({ ctx, input }) => uploadCoachingDeliverable(getDb(), ctx.user, input)),
  download: authedQuery.input(z.object({ deliverableId: z.number().int().positive() })).query(({ ctx, input }) => downloadCoachingDeliverable(getDb(), ctx.user, input.deliverableId)),
  lookupGuardian: tutorQuery.input(z.object({ phone: z.string().trim().regex(/^1\d{10}$/) })).query(async ({ ctx, input }) => {
    const db = getDb(); const orgId = requireOrgStaff(ctx.user);
    return db.select({ id: users.id, name: users.name, phone: users.phone }).from(users)
      .where(and(eq(users.phone, input.phone), eq(users.role, "user"), isNull(users.deletedAt), or(eq(users.orgId, orgId), isNull(users.orgId)))).limit(5);
  }),
  grantGuardian: tutorQuery.input(z.object({ caseId: z.number().int().positive(), guardianUserId: z.number().int().positive(), label: z.string().trim().min(1).max(64) }))
    .mutation(({ ctx, input }) => grantGuardian(getDb(), ctx.user, input)),
  revokeGuardian: tutorQuery.input(z.object({ grantId: z.number().int().positive() })).mutation(({ ctx, input }) => revokeGuardian(getDb(), ctx.user, input.grantId)),
  familyCases: authedQuery.query(({ ctx }) => listFamilyCoachingCases(getDb(), ctx.user)),
  familyFeedback: authedQuery.input(z.object({ caseId: z.number().int().positive() }).optional())
    .query(({ ctx, input }) => familyCoachingFeedback(getDb(), ctx.user, input?.caseId)),
});
