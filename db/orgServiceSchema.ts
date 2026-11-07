import { mysqlTable, serial, bigint, int, varchar, text, json, timestamp, boolean, customType } from "drizzle-orm/mysql-core";

const longtext = customType<{ data: string }>({ dataType: () => "longtext" });
const id = () => serial("id").primaryKey();
const orgId = () => bigint("org_id", { mode: "number", unsigned: true }).notNull();
const userId = (name = "user_id") => bigint(name, { mode: "number", unsigned: true }).notNull();
/* 保留 CynosDB 的 CURRENT_TIMESTAMP 默认值；应用显式写入，避免与 mysql2 的 Date 写入时区不一致。 */
const createdAt = () => timestamp("created_at").notNull().defaultNow().$defaultFn(() => new Date());
const updatedAt = () => timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()).$defaultFn(() => new Date());

/** owner_user_id=0 为机构未分配池，其余为伴学师／管理员个人钱包。 */
export const orgPointAccounts = mysqlTable("org_point_accounts", {
  id: id(), orgId: orgId(), ownerUserId: userId("owner_user_id").notNull().default(0),
  balance: int("balance").notNull().default(0), initialized: boolean("initialized").notNull().default(true),
  createdAt: createdAt(), updatedAt: updatedAt(),
});

export const orgPointLedger = mysqlTable("org_point_ledger", {
  id: id(), orgId: orgId(), accountId: bigint("account_id", { mode: "number", unsigned: true }).notNull(),
  ownerUserId: userId("owner_user_id").notNull().default(0), actorUserId: userId("actor_user_id").notNull(),
  eventGroup: varchar("event_group", { length: 96 }).notNull(), eventKey: varchar("event_key", { length: 128 }).notNull().unique(),
  type: varchar("type", { length: 32 }).notNull(), amount: int("amount").notNull(),
  balanceBefore: int("balance_before").notNull(), balanceAfter: int("balance_after").notNull(),
  relatedAccountId: bigint("related_account_id", { mode: "number", unsigned: true }),
  relatedLedgerId: bigint("related_ledger_id", { mode: "number", unsigned: true }),
  activityId: bigint("activity_id", { mode: "number", unsigned: true }), assignmentId: bigint("assignment_id", { mode: "number", unsigned: true }),
  studentUserId: bigint("student_user_id", { mode: "number", unsigned: true }), kind: varchar("kind", { length: 48 }), reason: varchar("reason", { length: 500 }).notNull().default(""),
  createdAt: createdAt(),
});

export const assessmentActivities = mysqlTable("assessment_activities", {
  id: id(), orgId: orgId(), createdBy: userId("created_by"), requestKey: varchar("request_key", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 128 }).notNull(), note: varchar("note", { length: 500 }).notNull().default(""),
  dueAt: timestamp("due_at"), expiryPolicy: varchar("expiry_policy", { length: 24 }).notNull().default("auto_refund"),
  status: varchar("status", { length: 24 }).notNull().default("open"), createdAt: createdAt(),
});

export const assessmentActivityItems = mysqlTable("assessment_activity_items", {
  id: id(), activityId: bigint("activity_id", { mode: "number", unsigned: true }).notNull(),
  selectionKey: varchar("selection_key", { length: 48 }).notNull(), title: varchar("title", { length: 160 }).notNull(),
  includedKinds: json("included_kinds").$type<string[]>().notNull(), priceSnapshot: int("price_snapshot").notNull().default(0),
  category: varchar("category", { length: 32 }).notNull(), sortOrder: int("sort_order").notNull().default(0), createdAt: createdAt(),
});

export const assessmentAssignments = mysqlTable("assessment_assignments", {
  id: id(), activityItemId: bigint("activity_item_id", { mode: "number", unsigned: true }).notNull(),
  studentUserId: userId("student_user_id"), tutorUserId: userId("tutor_user_id"), kind: varchar("kind", { length: 32 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("pending"), resultId: bigint("result_id", { mode: "number", unsigned: true }),
  startedAt: timestamp("started_at"), completedAt: timestamp("completed_at"), cancelledAt: timestamp("cancelled_at"),
  expiredAt: timestamp("expired_at"), cancelledReason: varchar("cancelled_reason", { length: 500 }).notNull().default(""),
  retestOfAssignmentId: bigint("retest_of_assignment_id", { mode: "number", unsigned: true }),
  createdAt: createdAt(), updatedAt: updatedAt(),
});

export const coachingTaskVerifications = mysqlTable("coaching_task_verifications", {
  id: id(), taskId: bigint("task_id", { mode: "number", unsigned: true }).notNull(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(),
  version: int("version").notNull(), previousId: bigint("previous_id", { mode: "number", unsigned: true }),
  evidence: text("evidence").notNull(), result: text("result").notNull(), verifierId: userId("verifier_id"), createdAt: createdAt(),
});

export const coachingCases = mysqlTable("coaching_cases", {
  id: id(), orgId: orgId(), studentUserId: userId("student_user_id"), coachId: userId("coach_id"), supervisorId: userId("supervisor_id"),
  scenario: varchar("scenario", { length: 24 }).notNull().default("新生接手"), status: varchar("status", { length: 24 }).notNull().default("active"),
  goal: text("goal").notNull(), currentSituation: text("current_situation").notNull(), planSummary: text("plan_summary").notNull(),
  serviceStart: varchar("service_start", { length: 10 }).notNull(), serviceEnd: varchar("service_end", { length: 10 }).notNull(),
  phaseMode: varchar("phase_mode", { length: 24 }).notNull().default("one_to_one"), phaseChangeReason: varchar("phase_change_reason", { length: 500 }).notNull().default(""),
  phaseChangeConfirmedBy: bigint("phase_change_confirmed_by", { mode: "number", unsigned: true }), version: int("version").notNull().default(1),
  createdAt: createdAt(), updatedAt: updatedAt(),
});

export const coachingCaseScenarios = mysqlTable("coaching_case_scenarios", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), orgId: orgId(),
  scenario: varchar("scenario", { length: 8 }).notNull(), activeKey: varchar("active_key", { length: 64 }),
  startedAt: timestamp("started_at").notNull().defaultNow().$defaultFn(() => new Date()), endedAt: timestamp("ended_at"),
  createdBy: userId("created_by"), endedBy: bigint("ended_by", { mode: "number", unsigned: true }),
  changeReason: varchar("change_reason", { length: 500 }).notNull().default(""), createdAt: createdAt(),
});

export const coachingPlans = mysqlTable("coaching_plans", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), parentId: bigint("parent_id", { mode: "number", unsigned: true }),
  level: varchar("level", { length: 16 }).notNull(), title: varchar("title", { length: 160 }).notNull(), content: text("content").notNull(),
  startDate: varchar("start_date", { length: 10 }).notNull(), endDate: varchar("end_date", { length: 10 }).notNull(),
  sourceResultId: bigint("source_result_id", { mode: "number", unsigned: true }), status: varchar("status", { length: 24 }).notNull().default("draft"),
  version: int("version").notNull().default(1), confirmedBy: bigint("confirmed_by", { mode: "number", unsigned: true }), confirmedAt: timestamp("confirmed_at"),
  createdBy: userId("created_by"), createdAt: createdAt(),
});

export const coachingTasks = mysqlTable("coaching_tasks", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), planId: bigint("plan_id", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 180 }).notNull(), detail: text("detail").notNull(), ownerId: userId("owner_id"), verifierId: userId("verifier_id"),
  dueDate: varchar("due_date", { length: 10 }).notNull(), status: varchar("status", { length: 24 }).notNull().default("pending"),
  evidence: text("evidence").notNull(), result: text("result").notNull(), completedAt: timestamp("completed_at"),
  createdBy: userId("created_by"), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const coachingReviews = mysqlTable("coaching_reviews", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), period: varchar("period", { length: 16 }).notNull(),
  periodKey: varchar("period_key", { length: 24 }).notNull(), content: text("content").notNull(), nextActions: text("next_actions").notNull(),
  version: int("version").notNull().default(1), createdBy: userId("created_by"), createdAt: createdAt(),
});

export const coachingHandoffs = mysqlTable("coaching_handoffs", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), type: varchar("type", { length: 8 }).notNull(),
  fromUserId: userId("from_user_id"), toUserId: userId("to_user_id"), title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(), dueAt: timestamp("due_at"), status: varchar("status", { length: 24 }).notNull().default("pending"),
  acceptedAt: timestamp("accepted_at"), createdAt: createdAt(),
});

export const coachingEvents = mysqlTable("coaching_events", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), actorUserId: userId("actor_user_id"),
  type: varchar("type", { length: 40 }).notNull(), content: text("content").notNull(), visibility: varchar("visibility", { length: 16 }).notNull().default("internal"),
  createdAt: createdAt(),
});

export const courseCatalog = mysqlTable("course_catalog", {
  id: id(), orgId: orgId(), courseKey: varchar("course_key", { length: 24 }).notNull(), version: varchar("version", { length: 16 }).notNull().default("1.0"),
  title: varchar("title", { length: 64 }).notNull(), audience: varchar("audience", { length: 32 }).notNull(), purpose: varchar("purpose", { length: 64 }).notNull(),
  description: text("description").notNull(), rhythm: varchar("rhythm", { length: 255 }).notNull(), outline: json("outline").$type<unknown[]>().notNull(),
  active: boolean("active").notNull().default(true), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const studySupervisionRecords = mysqlTable("study_supervision_records", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), studentUserId: userId("student_user_id"), supervisorId: userId("supervisor_id"),
  visitAt: timestamp("visit_at").notNull(), phase: varchar("phase", { length: 16 }).notNull(), mode: varchar("mode", { length: 24 }).notNull().default("direct"),
  signInAt: timestamp("sign_in_at"), selfStudyMinutes: int("self_study_minutes").notNull().default(0), alignment: text("alignment").notNull(),
  checks: text("checks").notNull(), exitCheck: text("exit_check").notNull(), followUp: text("follow_up").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("draft"), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const courseSessions = mysqlTable("course_sessions", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), orgId: orgId(), supervisionId: bigint("supervision_id", { mode: "number", unsigned: true }),
  coachId: userId("coach_id"), startAt: timestamp("start_at").notNull(), phase: varchar("phase", { length: 16 }).notNull(),
  format: varchar("format", { length: 24 }).notNull(), status: varchar("status", { length: 24 }).notNull().default("draft"),
  changeReason: varchar("change_reason", { length: 500 }).notNull().default(""), changeConfirmedBy: bigint("change_confirmed_by", { mode: "number", unsigned: true }),
  sharedSummary: text("shared_summary").notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const courseSessionUnits = mysqlTable("course_session_units", {
  id: id(), sessionId: bigint("session_id", { mode: "number", unsigned: true }).notNull(), courseKey: varchar("course_key", { length: 24 }).notNull(),
  lessonNo: int("lesson_no"), title: varchar("title", { length: 180 }).notNull(), snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
  learningPoints: text("learning_points").notNull(), practiceEvidence: text("practice_evidence").notNull(), sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const courseParticipants = mysqlTable("course_participants", {
  id: id(), sessionId: bigint("session_id", { mode: "number", unsigned: true }).notNull(), studentUserId: userId("student_user_id"),
  guardianLabel: varchar("guardian_label", { length: 64 }).notNull().default(""), attendance: varchar("attendance", { length: 24 }).notNull().default("present"),
  personalObservation: text("personal_observation").notNull(), privateNote: text("private_note").notNull(), actionTaskId: bigint("action_task_id", { mode: "number", unsigned: true }),
  feedbackText: text("feedback_text").notNull(), feedbackAt: timestamp("feedback_at"), feedbackVersion: int("feedback_version").notNull().default(0),
  createdAt: createdAt(), updatedAt: updatedAt(),
});

/** 附件正文保存在私有数据库字段，列表不返回；下载须重新校验权限并写审计事件。 */
export const coachingDeliverables = mysqlTable("coaching_deliverables", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), sessionId: bigint("session_id", { mode: "number", unsigned: true }),
  participantId: bigint("participant_id", { mode: "number", unsigned: true }), taskId: bigint("task_id", { mode: "number", unsigned: true }),
  kind: varchar("kind", { length: 24 }).notNull(), body: text("body").notNull(), mediaData: longtext("media_data"), mimeType: varchar("mime_type", { length: 80 }),
  sizeBytes: int("size_bytes").notNull().default(0), visibility: varchar("visibility", { length: 24 }).notNull().default("internal"),
  version: int("version").notNull().default(1), previousId: bigint("previous_id", { mode: "number", unsigned: true }),
  uploadedBy: userId("uploaded_by"), pushedAt: timestamp("pushed_at"), expiresAt: timestamp("expires_at"), disposedAt: timestamp("disposed_at"), createdAt: createdAt(),
});

/** 多监护人逐个账号授权；不共享学生密码，撤销后下载权限立即失效。 */
export const coachingGuardianGrants = mysqlTable("coaching_guardian_grants", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), guardianUserId: userId("guardian_user_id"),
  label: varchar("label", { length: 64 }).notNull(), active: boolean("active").notNull().default(true),
  createdBy: userId("created_by"), createdAt: createdAt(), updatedAt: updatedAt(),
});
