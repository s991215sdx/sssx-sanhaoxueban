import { z } from "zod";
import { and, eq, isNull, or } from "drizzle-orm";
import { createRouter, authedQuery, tutorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { courseCatalog, users } from "@db/schema";
import { requireOrgStaff } from "./orgAccess";
import {
  acceptHandoff, addCoachingReview, addCoachingTask, addHandoff, coachingCaseDetail, createCoachingCase, downloadCoachingDeliverable,
  endCoachingScenarios, ensureCourseCatalog, familyCoachingFeedback, grantGuardian, listCoachingCases, listFamilyCoachingCases, pushParticipantFeedback, reassignCoachingCase,
  revokeGuardian, saveCoachingPlan, saveCourseSession, saveDailyCheckin, saveSupervision, setCoachingStatus, updateGrow, uploadCoachingDeliverable, verifyCoachingTask,
} from "./coachingService";
import { createCoachingException, listCoachingCrisisFollowups, recordCoachingCrisisFollowup, recordCoachingException, revealCoachingException } from "./coachingExceptions";
import { cancelReassignment, listIncomingHandoffs } from "./coachingLifecycle";
import { getCoachingMonthlyPreview, listCoachingMonthlyReports, pushCoachingMonthlyReport, saveCoachingMonthlyReport } from "./coachingMonthly";
import { assignQualityReview, closeQualityReview, qualityInbox, qualityReviews, submitQualityReview, submitSelfQualityReview } from "./coachingQuality";
import { COACHING_QUALITY_FRAMEWORK } from "@contracts/orgService";
import { coachingOperations, coachingStaffWorkloads, remindCoachingOperation } from "./coachingOperations";
import {
  coachingNotificationInbox, getCoachingNotificationSettings, markCoachingNotificationRead,
  retryCoachingNotification, saveCoachingNotificationSettings, transferCoachingNotificationManual,
} from "./coachingNotifications";
import { confirmCoachingPlan, confirmFamilyCoachingPlan, familyPendingPlans, saveCoachingGrowProfile } from "./coachingPlanning";
import { coachingRecordInput, familyCoachingActions, listCoachingExtendedRecords, revealCoachingExtendedRecords,
  saveCoachingExtendedRecord, submitFamilyActionFeedback, verifyFamilyAction } from "./coachingExtended";
import { cancelCourseSession, cancelSupervision, courseSessionForEdit, courseSessionHistory, courseSessionRecipients, rescheduleCourseSession, rescheduleSupervision } from "./coachingSchedule";
import { revokeFamilyResourceAccess } from "./coachingRecipients";
import { getCoachingDeliverySettings, saveCoachingDeliverySettings } from "./coachingDelivery";
import { saveCoachingCaseProfile } from "./coachingProfile";
import { acceptFamilyCoachingStageHandoff, createCoachingStageHandoff, familyCoachingStageHandoffs } from "./coachingStageHandoffs";

const id = z.number().int().positive();
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthText = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const qualityScores = z.object({ plan: z.number().int().min(0).max(20), execution: z.number().int().min(0).max(20),
  archive: z.number().int().min(0).max(20), family: z.number().int().min(0).max(20), review: z.number().int().min(0).max(20) });
const qualityContent = z.object({ scores: qualityScores, findings: z.string().trim().min(2).max(12000),
  improvementActions: z.string().trim().min(2).max(12000) });
const monthlyContent = z.object({ caseId: id, month: monthText,
  goalProgress: z.string().trim().min(2).max(12000), academicProgress: z.string().trim().min(2).max(12000),
  taskExecution: z.string().trim().min(2).max(12000), learningMethod: z.string().trim().min(2).max(12000),
  habitFamily: z.string().trim().min(2).max(12000), meetingNotes: z.string().max(15000).optional(),
  nextActions: z.array(z.string().trim().min(2).max(2000)).min(1).max(3), familyAction: z.string().trim().min(2).max(4000) });
const growFormInput = z.object({
  purpose: z.array(z.enum(["分数提升", "综合成长"])).min(1).max(2),
  purposeNote: z.string().trim().max(2000).default(""),
  targetSchool: z.string().trim().max(180).default(""),
  subjects: z.array(z.object({ name: z.string().trim().min(1).max(60), baseline: z.number().min(0).max(1000).nullable(), target: z.number().min(0).max(1000).nullable() })).max(20),
  courses: z.array(z.string().trim().min(1).max(20)).min(1).max(5),
  strategyNote: z.string().trim().max(4000).default(""),
  weekly: z.array(z.object({ item: z.string().trim().min(1).max(200), metric: z.string().trim().max(200).default("") })).min(1).max(12),
  exams: z.array(z.object({ name: z.string().trim().min(1).max(80), date: z.string().trim().max(10).default(""), scores: z.string().trim().max(2000).default("") })).max(12),
});
const caseInput = z.object({ studentUserId: id, scenarios: z.array(z.enum(["A", "B", "C", "D"])).min(1).max(4),
  goal: z.string().trim().min(2).max(5000), currentSituation: z.string().trim().min(2).max(8000), planSummary: z.string().trim().min(2).max(10000),
  growForm: growFormInput.nullable().optional(),
  serviceStart: dateText, serviceEnd: dateText, capacityOverrideReason: z.string().trim().max(1000).optional() });
const supervisionInput = z.object({ selfStudyMinutes: z.number().int().min(0).max(1440).default(0),
  alignment: z.string().max(6000).default(""), checks: z.string().max(6000).default(""), exitCheck: z.string().max(6000).default(""), followUp: z.string().max(6000).default(""),
  signInAt: z.date().nullable().optional(), signOutAt: z.date().nullable().optional(), timeBlocks: z.array(z.record(z.string(), z.unknown())).max(12).optional(),
  leaveReason: z.string().max(4000).optional(), makeupPlan: z.string().max(4000).optional(), handoffNote: z.string().max(4000).optional() });
const dailyCheckinInput = z.object({
  caseId: id, supervisionId: id.nullable().optional(), checkDate: dateText,
  completionRate: z.number().int().min(0).max(100), accuracyRate: z.number().int().min(0).max(100),
  actualCompletion: z.string().max(10000), evidence: z.string().max(10000), tomorrowFirst: z.string().max(6000),
  gapReason: z.string().max(6000).default(""), errorCause: z.string().max(6000).default(""), correction: z.string().max(6000).default(""),
  followUp: z.string().max(6000).default(""), followUpDate: dateText.nullable().optional(),
  feynmanEnabled: z.boolean().default(false), feynmanConcept: z.string().max(2000).default(""), feynmanOutput: z.string().max(10000).default(""),
  feynmanGrade: z.enum(["A", "B", "C"]).optional(), feynmanStuck: z.string().max(6000).default(""), feynmanQuestion: z.string().max(6000).default(""),
  retestDate: dateText.nullable().optional(), traces: z.array(z.enum(["draft", "notes", "mindmap", "errorbook", "review"])).max(5),
  traceEvidence: z.string().max(10000).default(""), traceFollowUp: z.string().max(6000).default(""), changeReason: z.string().trim().max(500).optional(),
});
const growInput = z.object({ caseId: id, studentGoal: z.string().trim().min(2).max(6000), parentExpectation: z.string().trim().min(2).max(6000),
  targetSchool: z.string().max(180).optional(), targetDate: dateText.nullable().optional(),
  targetSubjects: z.array(z.object({ subject: z.string().trim().min(1).max(60), baseline: z.string().trim().min(1).max(2000), target: z.string().trim().min(1).max(2000) })).max(20),
  currentSituation: z.string().trim().min(2).max(10000), evidence: z.string().trim().min(2).max(10000), followUpActions: z.string().trim().min(2).max(10000),
  nextContactAt: z.date().nullable().optional(), retestDueAt: z.date().nullable().optional(), changeReason: z.string().trim().max(500).optional(),
  reportLinks: z.array(z.object({ resultId: id, conclusion: z.string().trim().min(2).max(6000), evidence: z.string().trim().min(2).max(6000),
    trainingSuggestion: z.string().trim().min(2).max(6000), cycle: z.string().trim().min(2).max(80), ownerId: id, reviewAt: z.date() })).max(20) });
const deliverySettingsInput = z.object({ h3Hours: z.number().int().min(1).max(168), weeklyPlanDay: z.number().int().min(0).max(6),
  weeklyReviewDay: z.number().int().min(0).max(6), qualityVersion: z.string().regex(/^\d+\.\d+$/), retentionDays: z.number().int().min(30).max(3650),
  hardCaseLimit: z.number().int().min(0).max(10000), s1Hours: z.number().int().min(1).max(168), s2Hours: z.number().int().min(1).max(72), s3Hours: z.number().int().min(1).max(168) });

export const coachingRouter = createRouter({
  cases: tutorQuery.query(({ ctx }) => listCoachingCases(getDb(), ctx.user)),
  incoming: tutorQuery.query(({ ctx }) => listIncomingHandoffs(getDb(), ctx.user)),
  staff: tutorQuery.query(({ ctx }) => {
    const orgId = requireOrgStaff(ctx.user);
    return getDb().select({ id: users.id, name: users.name, role: users.role }).from(users)
      .where(and(eq(users.orgId, orgId), or(eq(users.role, "tutor"), eq(users.role, "admin")), isNull(users.deletedAt))).orderBy(users.id);
  }),
  detail: tutorQuery.input(z.object({ caseId: id })).query(({ ctx, input }) => coachingCaseDetail(getDb(), ctx.user, input.caseId)),
  saveProfile: tutorQuery.input(z.object({ caseId: id, birthDate: dateText.nullable().optional(),
    studentInfo: z.string().max(20000).default(""), threeParty: z.string().max(30000).default(""),
    parentProfile: z.string().max(15000).default(""), attention: z.string().max(15000).default(""), commAdvice: z.string().max(15000).default("") }))
    .mutation(({ ctx, input }) => saveCoachingCaseProfile(getDb(), ctx.user, input)),
  createException: tutorQuery.input(z.object({ caseId: id, severity: z.enum(["S1", "S2", "S3", "S4"]),
    category: z.enum(["service", "archive", "communication", "attendance", "complaint", "integrity", "wellbeing", "safety", "other"]),
    title: z.string().trim().min(2).max(180), detail: z.string().trim().min(2).max(12000), sensitive: z.boolean().default(false),
    assigneeId: id, dueAt: z.date().optional() })).mutation(({ ctx, input }) => createCoachingException(getDb(), ctx.user, input)),
  recordException: tutorQuery.input(z.object({ exceptionId: id, action: z.enum(["progress", "closed"]),
    note: z.string().trim().min(2).max(12000), evidence: z.string().trim().max(12000).optional() }))
    .mutation(({ ctx, input }) => recordCoachingException(getDb(), ctx.user, input)),
  revealException: tutorQuery.input(z.object({ exceptionId: id })).mutation(({ ctx, input }) => revealCoachingException(getDb(), ctx.user, input.exceptionId)),
  crisisFollowups: tutorQuery.input(z.object({ exceptionId: id })).query(({ ctx, input }) => listCoachingCrisisFollowups(getDb(), ctx.user, input.exceptionId)),
  saveCrisisFollowup: tutorQuery.input(z.object({ followupId: id, detail: z.string().trim().min(2).max(12000),
    evidence: z.string().trim().min(2).max(12000), status: z.enum(["pending", "completed"]) }))
    .mutation(({ ctx, input }) => recordCoachingCrisisFollowup(getDb(), ctx.user, input)),
  createCase: tutorQuery.input(caseInput).mutation(({ ctx, input }) => createCoachingCase(getDb(), ctx.user, input)),
  updateGrow: tutorQuery.input(caseInput.omit({ studentUserId: true, capacityOverrideReason: true }).extend({ caseId: id, scenarioChangeReason: z.string().trim().max(500).optional() }))
    .mutation(({ ctx, input }) => updateGrow(getDb(), ctx.user, input)),
  saveGrowProfile: tutorQuery.input(growInput).mutation(({ ctx, input }) => saveCoachingGrowProfile(getDb(), ctx.user, input)),
  confirmPlan: tutorQuery.input(z.object({ planId: id })).mutation(({ ctx, input }) => confirmCoachingPlan(getDb(), ctx.user, input.planId)),
  familyPendingPlans: authedQuery.input(z.object({ caseId: id })).query(({ ctx, input }) => familyPendingPlans(getDb(), ctx.user, input.caseId)),
  confirmFamilyPlan: authedQuery.input(z.object({ planId: id, comment: z.string().trim().max(2000).optional() }))
    .mutation(({ ctx, input }) => confirmFamilyCoachingPlan(getDb(), ctx.user, input)),
  catalog: tutorQuery.query(async ({ ctx }) => {
    const db = getDb(); const orgId = requireOrgStaff(ctx.user);
    await ensureCourseCatalog(db, orgId);
    return db.select().from(courseCatalog).where(and(eq(courseCatalog.orgId, orgId), eq(courseCatalog.active, true)));
  }),
  savePlan: tutorQuery.input(z.object({ caseId: id, level: z.enum(["term", "month", "week", "day"]),
    parentId: id.nullable().optional(), title: z.string().trim().min(2).max(160), content: z.string().trim().min(2).max(15000),
    startDate: dateText, endDate: dateText, sourceResultId: id.nullable().optional(), confirmed: z.boolean().default(false) }))
    .mutation(({ ctx, input }) => saveCoachingPlan(getDb(), ctx.user, input)),
  addTask: tutorQuery.input(z.object({ caseId: id, planId: id.nullable().optional(),
    title: z.string().trim().min(2).max(180), detail: z.string().max(6000).optional(), dueDate: dateText }))
    .mutation(({ ctx, input }) => addCoachingTask(getDb(), ctx.user, input)),
  verifyTask: tutorQuery.input(z.object({ taskId: id, evidence: z.string().trim().min(2).max(10000), result: z.string().trim().min(2).max(10000) }))
    .mutation(({ ctx, input }) => verifyCoachingTask(getDb(), ctx.user, input)),
  addReview: tutorQuery.input(z.object({ caseId: id, period: z.enum(["day", "week", "month", "term"]),
    periodKey: z.string().trim().min(2).max(24), content: z.string().trim().min(2).max(15000), nextActions: z.string().trim().min(2).max(10000) }))
    .mutation(({ ctx, input }) => addCoachingReview(getDb(), ctx.user, input)),
  addHandoff: tutorQuery.input(z.object({ caseId: id, type: z.enum(["H1", "H2", "H3", "H4", "REASSIGN"]),
    toUserId: id, title: z.string().trim().min(2).max(180), content: z.string().trim().min(2).max(15000), dueAt: z.date().nullable().optional() }))
    .mutation(({ ctx, input }) => addHandoff(getDb(), ctx.user, input)),
  acceptHandoff: tutorQuery.input(z.object({ handoffId: id, capacityOverrideReason: z.string().trim().max(1000).optional() }))
    .mutation(({ ctx, input }) => acceptHandoff(getDb(), ctx.user, input.handoffId, input.capacityOverrideReason)),
  createStageHandoff: tutorQuery.input(z.object({
    caseId: id, monthlyReportId: id, nextPlanId: id, recipientUserId: id,
    title: z.string().trim().min(2).max(180), familyAction: z.string().trim().min(2).max(4000), dueAt: z.date(),
  })).mutation(({ ctx, input }) => createCoachingStageHandoff(getDb(), ctx.user, input)),
  familyStageHandoffs: authedQuery.input(z.object({ caseId: id }))
    .query(({ ctx, input }) => familyCoachingStageHandoffs(getDb(), ctx.user, input.caseId)),
  acceptFamilyStageHandoff: authedQuery.input(z.object({ handoffId: id, comment: z.string().trim().max(2000).optional() }))
    .mutation(({ ctx, input }) => acceptFamilyCoachingStageHandoff(getDb(), ctx.user, input)),
  endScenarios: tutorQuery.input(z.object({ caseId: id, scenarios: z.array(z.enum(["A", "B", "C", "D"])).min(1).max(4), reason: z.string().trim().min(2).max(2000) }))
    .mutation(({ ctx, input }) => endCoachingScenarios(getDb(), ctx.user, input)),
  setStatus: tutorQuery.input(z.object({ caseId: id, status: z.enum(["active", "paused", "closed", "archived"]), reason: z.string().trim().min(2).max(2000) }))
    .mutation(({ ctx, input }) => setCoachingStatus(getDb(), ctx.user, input)),
  reassign: tutorQuery.input(z.object({ caseId: id, coachId: id, supervisorId: id, reason: z.string().trim().min(2).max(2000), capacityOverrideReason: z.string().trim().max(1000).optional() }))
    .mutation(({ ctx, input }) => reassignCoachingCase(getDb(), ctx.user, input)),
  cancelReassignment: tutorQuery.input(z.object({ handoffId: id, reason: z.string().trim().min(2).max(2000) }))
    .mutation(({ ctx, input }) => cancelReassignment(getDb(), ctx.user, input)),
  saveCheckin: tutorQuery.input(dailyCheckinInput).mutation(({ ctx, input }) => saveDailyCheckin(getDb(), ctx.user, input)),
  saveSupervision: tutorQuery.input(z.object({ caseId: id, supervisionId: id.optional(), visitAt: z.date(), status: z.enum(["draft", "scheduled", "completed"]).default("completed") }).merge(supervisionInput))
    .mutation(({ ctx, input }) => saveSupervision(getDb(), ctx.user, input)),
  sessionForEdit: tutorQuery.input(z.object({ sessionId: id })).query(({ ctx, input }) => courseSessionForEdit(getDb(), ctx.user, input.sessionId)),
  sessionRecipients: tutorQuery.input(z.object({ caseId: id, studentUserIds: z.array(id).min(1).max(30) }))
    .query(({ ctx, input }) => courseSessionRecipients(getDb(), ctx.user, input.caseId, input.studentUserIds)),
  sessionHistory: tutorQuery.input(z.object({ sessionId: id })).query(({ ctx, input }) => courseSessionHistory(getDb(), ctx.user, input.sessionId)),
  saveSession: tutorQuery.input(z.object({ caseId: id, sessionId: id.optional(), startAt: z.date(), format: z.enum(["one_to_one", "salon", "workshop", "mixed"]),
    status: z.enum(["draft", "scheduled", "completed"]).default("completed"), changeReason: z.string().max(500).optional(), lateChangeConfirmed: z.boolean().default(false),
    sharedSummary: z.string().max(12000).optional(), supervision: supervisionInput,
    units: z.array(z.object({ courseKey: z.string().max(24), lessonNo: z.number().int().min(1).max(12).nullable().optional(), title: z.string().trim().min(2).max(180),
      learningPoints: z.string().max(10000).optional(), practiceEvidence: z.string().max(10000).optional() })).min(1).max(5),
    participants: z.array(z.object({ studentUserId: id, guardianLabel: z.string().max(64).optional(), guardianUserId: id.nullable().optional(),
      attendance: z.enum(["present", "late", "absent", "leave", "never", "on_leave", "withdrawn"]).default("present"), personalObservation: z.string().max(10000).optional(),
      privateNote: z.string().max(10000).optional(), feedbackText: z.string().max(12000).optional(),
      action: z.object({ title: z.string().trim().min(2).max(180), detail: z.string().max(6000).optional(), dueDate: dateText }).optional() })).min(1).max(30) }))
    .mutation(({ ctx, input }) => saveCourseSession(getDb(), ctx.user, input)),
  rescheduleSession: tutorQuery.input(z.object({ sessionId: id, startAt: z.date(), reason: z.string().trim().min(2).max(1000) }))
    .mutation(({ ctx, input }) => rescheduleCourseSession(getDb(), ctx.user, input)),
  cancelSession: tutorQuery.input(z.object({ sessionId: id, reason: z.string().trim().min(2).max(1000) }))
    .mutation(({ ctx, input }) => cancelCourseSession(getDb(), ctx.user, input)),
  rescheduleSupervision: tutorQuery.input(z.object({ supervisionId: id, visitAt: z.date(), reason: z.string().trim().min(2).max(1000) }))
    .mutation(({ ctx, input }) => rescheduleSupervision(getDb(), ctx.user, input)),
  cancelSupervision: tutorQuery.input(z.object({ supervisionId: id, reason: z.string().trim().min(2).max(1000) }))
    .mutation(({ ctx, input }) => cancelSupervision(getDb(), ctx.user, input)),
  pushFeedback: tutorQuery.input(z.object({ participantId: id, feedbackText: z.string().max(12000), recipientUserIds: z.array(id).min(1).max(30) }))
    .mutation(({ ctx, input }) => pushParticipantFeedback(getDb(), ctx.user, input)),
  upload: tutorQuery.input(z.object({ caseId: id, sessionId: id.nullable().optional(), participantId: id.nullable().optional(), taskId: id.nullable().optional(),
    kind: z.enum(["text", "audio", "image"]), body: z.string().max(12000).optional(), mediaData: z.string().max(5_600_000).optional(), mimeType: z.string().max(80).optional() }))
    .mutation(({ ctx, input }) => uploadCoachingDeliverable(getDb(), ctx.user, input)),
  monthlyPreview: tutorQuery.input(z.object({ caseId: id, month: monthText })).query(({ ctx, input }) => getCoachingMonthlyPreview(getDb(), ctx.user, input.caseId, input.month)),
  monthlyReports: tutorQuery.input(z.object({ caseId: id })).query(({ ctx, input }) => listCoachingMonthlyReports(getDb(), ctx.user, input.caseId)),
  saveMonthlyReport: tutorQuery.input(monthlyContent).mutation(({ ctx, input }) => saveCoachingMonthlyReport(getDb(), ctx.user, input)),
  pushMonthlyReport: tutorQuery.input(z.object({ reportId: id, recipientUserIds: z.array(id).min(1).max(30) }))
    .mutation(({ ctx, input }) => pushCoachingMonthlyReport(getDb(), ctx.user, input)),
  qualityFramework: tutorQuery.query(() => COACHING_QUALITY_FRAMEWORK),
  qualityReviews: tutorQuery.input(z.object({ caseId: id })).query(({ ctx, input }) => qualityReviews(getDb(), ctx.user, input.caseId)),
  qualityInbox: tutorQuery.query(({ ctx }) => qualityInbox(getDb(), ctx.user)),
  assignQualityReview: tutorQuery.input(z.object({ caseId: id, reviewType: z.enum(["self", "peer", "supervisor"]), reviewerId: id, periodKey: z.string().trim().min(2).max(24), dueAt: z.date() }))
    .mutation(({ ctx, input }) => assignQualityReview(getDb(), ctx.user, input)),
  submitSelfQualityReview: tutorQuery.input(qualityContent.extend({ caseId: id, periodKey: z.string().trim().min(2).max(24) }))
    .mutation(({ ctx, input }) => submitSelfQualityReview(getDb(), ctx.user, input)),
  submitQualityReview: tutorQuery.input(qualityContent.extend({ reviewId: id })).mutation(({ ctx, input }) => submitQualityReview(getDb(), ctx.user, input)),
  closeQualityReview: tutorQuery.input(z.object({ reviewId: id, closeEvidence: z.string().trim().min(2).max(12000) }))
    .mutation(({ ctx, input }) => closeQualityReview(getDb(), ctx.user, input)),
  records: tutorQuery.input(z.object({ caseId: id })).query(({ ctx, input }) => listCoachingExtendedRecords(getDb(), ctx.user, input.caseId)),
  revealRecords: tutorQuery.input(z.object({ caseId: id })).mutation(({ ctx, input }) => revealCoachingExtendedRecords(getDb(), ctx.user, input.caseId)),
  saveRecord: tutorQuery.input(coachingRecordInput).mutation(({ ctx, input }) => saveCoachingExtendedRecord(getDb(), ctx.user, input)),
  verifyFamilyAction: tutorQuery.input(z.object({ recordId: id, verificationNote: z.string().trim().min(2).max(6000) }))
    .mutation(({ ctx, input }) => verifyFamilyAction(getDb(), ctx.user, input)),
  familyActions: authedQuery.input(z.object({ caseId: id })).query(({ ctx, input }) => familyCoachingActions(getDb(), ctx.user, input.caseId)),
  submitFamilyAction: authedQuery.input(z.object({ recordId: id, evidence: z.string().trim().min(2).max(10000), result: z.string().trim().min(2).max(10000) }))
    .mutation(({ ctx, input }) => submitFamilyActionFeedback(getDb(), ctx.user, input)),
  revokeResource: tutorQuery.input(z.object({ caseId: id, resourceType: z.enum(["plan", "session_feedback", "deliverable", "monthly_report", "family_action"]), resourceId: id, recipientUserId: id }))
    .mutation(({ ctx, input }) => revokeFamilyResourceAccess(getDb(), ctx.user, input)),
  deliverySettings: tutorQuery.query(({ ctx }) => getCoachingDeliverySettings(getDb(), ctx.user)),
  saveDeliverySettings: tutorQuery.input(deliverySettingsInput).mutation(({ ctx, input }) => saveCoachingDeliverySettings(getDb(), ctx.user, input)),
  download: authedQuery.input(z.object({ deliverableId: id })).query(({ ctx, input }) => downloadCoachingDeliverable(getDb(), ctx.user, input.deliverableId)),
  lookupGuardian: tutorQuery.input(z.object({ phone: z.string().trim().regex(/^1\d{10}$/) })).query(async ({ ctx, input }) => {
    const db = getDb(); const orgId = requireOrgStaff(ctx.user);
    return db.select({ id: users.id, name: users.name, phone: users.phone }).from(users)
      .where(and(eq(users.phone, input.phone), eq(users.role, "user"), isNull(users.deletedAt), or(eq(users.orgId, orgId), isNull(users.orgId)))).limit(5);
  }),
  grantGuardian: tutorQuery.input(z.object({ caseId: id, guardianUserId: id, label: z.string().trim().min(1).max(64) }))
    .mutation(({ ctx, input }) => grantGuardian(getDb(), ctx.user, input)),
  revokeGuardian: tutorQuery.input(z.object({ grantId: id })).mutation(({ ctx, input }) => revokeGuardian(getDb(), ctx.user, input.grantId)),
  familyCases: authedQuery.query(({ ctx }) => listFamilyCoachingCases(getDb(), ctx.user)),
  familyFeedback: authedQuery.input(z.object({ caseId: id }).optional()).query(({ ctx, input }) => familyCoachingFeedback(getDb(), ctx.user, input?.caseId)),
  operations: tutorQuery.query(({ ctx }) => coachingOperations(getDb(), ctx.user)),
  staffWorkloads: tutorQuery.query(({ ctx }) => coachingStaffWorkloads(getDb(), ctx.user)),
  remindOperation: tutorQuery.input(z.object({ itemKey: z.string().trim().min(3).max(80) })).mutation(({ ctx, input }) => remindCoachingOperation(getDb(), ctx.user, input.itemKey)),
  notifications: authedQuery.query(({ ctx }) => coachingNotificationInbox(getDb(), ctx.user)),
  readNotification: authedQuery.input(z.object({ notificationId: id })).mutation(({ ctx, input }) => markCoachingNotificationRead(getDb(), ctx.user, input.notificationId)),
  retryNotification: tutorQuery.input(z.object({ notificationId: id })).mutation(({ ctx, input }) => retryCoachingNotification(getDb(), ctx.user, input.notificationId)),
  manualNotification: tutorQuery.input(z.object({ notificationId: id, reason: z.string().trim().min(2).max(500) }))
    .mutation(({ ctx, input }) => transferCoachingNotificationManual(getDb(), ctx.user, input)),
  notificationSettings: tutorQuery.query(({ ctx }) => getCoachingNotificationSettings(getDb(), ctx.user)),
  saveNotificationSettings: tutorQuery.input(z.object({ quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), suggestedCaseLoad: z.number().int().min(1).max(200) }))
    .mutation(({ ctx, input }) => saveCoachingNotificationSettings(getDb(), ctx.user, input)),
});
