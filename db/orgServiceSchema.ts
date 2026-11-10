import { mysqlTable, serial, bigint, int, varchar, text, json, timestamp, boolean, customType, index, uniqueIndex } from "drizzle-orm/mysql-core";

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

export const assessmentActivityEvents = mysqlTable("assessment_activity_events", {
  id: id(), activityId: bigint("activity_id", { mode: "number", unsigned: true }).notNull(),
  actorUserId: userId("actor_user_id"), type: varchar("type", { length: 32 }).notNull(),
  detail: text("detail").notNull(), previousDueAt: timestamp("previous_due_at"), nextDueAt: timestamp("next_due_at"), createdAt: createdAt(),
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
  growForm: json("grow_form").$type<Record<string, unknown>>(),
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
  issuedAt: timestamp("issued_at"), cancelledAt: timestamp("cancelled_at"),
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

/** 月报每次保存追加版本；数据快照、正文与推送对象均属于对应版本。 */
export const coachingMonthlyReports = mysqlTable("coaching_monthly_reports", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), orgId: orgId(),
  month: varchar("month", { length: 7 }).notNull(), version: int("version").notNull(),
  previousId: bigint("previous_id", { mode: "number", unsigned: true }),
  metricSnapshot: json("metric_snapshot").$type<Record<string, unknown>>().notNull(),
  goalProgress: text("goal_progress").notNull(), academicProgress: text("academic_progress").notNull(),
  taskExecution: text("task_execution").notNull(), learningMethod: text("learning_method").notNull(), habitFamily: text("habit_family").notNull(),
  meetingNotes: text("meeting_notes").notNull().default(""), nextActions: json("next_actions").$type<string[]>().notNull(), familyAction: text("family_action").notNull(),
  createdBy: userId("created_by"), pushedBy: bigint("pushed_by", { mode: "number", unsigned: true }), pushedAt: timestamp("pushed_at"), createdAt: createdAt(),
}, (table) => [
  uniqueIndex("coaching_monthly_reports_case_month_version_unique").on(table.caseId, table.month, table.version),
  index("coaching_monthly_reports_org_month_idx").on(table.orgId, table.month),
]);

/** 质量评分仅内部可见；pending 为待填写安排，提交后只允许追加新版本或记录整改关闭。 */
export const coachingQualityReviews = mysqlTable("coaching_quality_reviews", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), orgId: orgId(),
  reviewType: varchar("review_type", { length: 16 }).notNull(), reviewerId: userId("reviewer_id"), periodKey: varchar("period_key", { length: 24 }).notNull(),
  frameworkVersion: varchar("framework_version", { length: 16 }).notNull().default("1.0"), version: int("version").notNull().default(1),
  previousId: bigint("previous_id", { mode: "number", unsigned: true }),
  planScore: int("plan_score"), executionScore: int("execution_score"), archiveScore: int("archive_score"), familyScore: int("family_score"), reviewScore: int("review_score"),
  findings: text("findings").notNull().default(""), improvementActions: text("improvement_actions").notNull().default(""),
  status: varchar("status", { length: 16 }).notNull().default("pending"), dueAt: timestamp("due_at"),
  assignedBy: userId("assigned_by"), submittedAt: timestamp("submitted_at"),
  closedBy: bigint("closed_by", { mode: "number", unsigned: true }), closedAt: timestamp("closed_at"), closeEvidence: text("close_evidence").notNull().default(""),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("coaching_quality_reviews_version_unique").on(table.caseId, table.reviewType, table.reviewerId, table.periodKey, table.version),
  index("coaching_quality_reviews_reviewer_status_idx").on(table.reviewerId, table.status),
  index("coaching_quality_reviews_org_created_idx").on(table.orgId, table.createdAt),
]);

/** 同日检验只追加版本；机构与主档双重限定，避免跨机构串联。 */
export const coachingCheckins = mysqlTable("coaching_checkins", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), orgId: orgId(),
  supervisionId: bigint("supervision_id", { mode: "number", unsigned: true }),
  checkDate: varchar("check_date", { length: 10 }).notNull(), version: int("version").notNull(),
  previousId: bigint("previous_id", { mode: "number", unsigned: true }), changeReason: varchar("change_reason", { length: 500 }).notNull().default(""),
  completionRate: int("completion_rate").notNull(), accuracyRate: int("accuracy_rate").notNull(),
  actualCompletion: text("actual_completion").notNull(), gapReason: text("gap_reason").notNull(),
  errorCause: text("error_cause").notNull(), correction: text("correction").notNull(), evidence: text("evidence").notNull(),
  followUp: text("follow_up").notNull(), followUpDate: varchar("follow_up_date", { length: 10 }), tomorrowFirst: text("tomorrow_first").notNull(),
  feynmanConcept: text("feynman_concept").notNull(), feynmanOutput: text("feynman_output").notNull(),
  feynmanGrade: varchar("feynman_grade", { length: 1 }).notNull().default(""), feynmanStuck: text("feynman_stuck").notNull(),
  feynmanQuestion: text("feynman_question").notNull(), retestDate: varchar("retest_date", { length: 10 }),
  traces: json("traces").$type<string[]>().notNull(), traceEvidence: text("trace_evidence").notNull(), traceFollowUp: text("trace_follow_up").notNull(),
  createdBy: userId("created_by"), createdAt: createdAt(),
}, (table) => [
  uniqueIndex("coaching_checkins_case_date_version_unique").on(table.caseId, table.checkDate, table.version),
  index("coaching_checkins_case_date_version_idx").on(table.caseId, table.checkDate, table.version),
  index("coaching_checkins_org_date_idx").on(table.orgId, table.checkDate),
]);

export const coachingHandoffs = mysqlTable("coaching_handoffs", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), type: varchar("type", { length: 8 }).notNull(),
  fromUserId: userId("from_user_id"), toUserId: userId("to_user_id"), title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(), dueAt: timestamp("due_at"), status: varchar("status", { length: 24 }).notNull().default("pending"),
  acceptedAt: timestamp("accepted_at"), createdAt: createdAt(),
  fromCoachId: bigint("from_coach_id", { mode: "number", unsigned: true }),
  fromSupervisorId: bigint("from_supervisor_id", { mode: "number", unsigned: true }),
  nextCoachId: bigint("next_coach_id", { mode: "number", unsigned: true }),
  nextSupervisorId: bigint("next_supervisor_id", { mode: "number", unsigned: true }),
  appliedAt: timestamp("applied_at"),
  /** H5 且 nextSupervisorId 为空：主管→指定学生／监护人的阶段交接，不是人员改派。 */
  monthlyReportId: bigint("monthly_report_id", { mode: "number", unsigned: true }),
  nextPlanId: bigint("next_plan_id", { mode: "number", unsigned: true }),
  familyActionId: bigint("family_action_id", { mode: "number", unsigned: true }),
  attachmentId: bigint("attachment_id", { mode: "number", unsigned: true }),
  familySnapshot: json("family_snapshot").$type<Record<string, unknown>>(),
  acceptedChannel: varchar("accepted_channel", { length: 32 }),
  acceptedComment: text("accepted_comment"),
}, (table) => [
  index("coaching_handoffs_recipient_status_idx").on(table.toUserId, table.status),
]);

export const coachingEvents = mysqlTable("coaching_events", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), actorUserId: userId("actor_user_id"),
  type: varchar("type", { length: 40 }).notNull(), content: text("content").notNull(), visibility: varchar("visibility", { length: 16 }).notNull().default("internal"),
  createdAt: createdAt(),
});

/** 异常主表只保存当前状态；每次处理与关闭证据追加到 actions，历史不覆盖。 */
export const coachingExceptions = mysqlTable("coaching_exceptions", {
  id: id(), orgId: orgId(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(),
  severity: varchar("severity", { length: 4 }).notNull(), category: varchar("category", { length: 32 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(), detail: text("detail").notNull(), sensitive: boolean("sensitive").notNull().default(false),
  status: varchar("status", { length: 16 }).notNull().default("open"), assigneeId: userId("assignee_id"), dueAt: timestamp("due_at").notNull(),
  createdBy: userId("created_by"), createdAt: createdAt(), updatedAt: updatedAt(),
  closedBy: bigint("closed_by", { mode: "number", unsigned: true }), closedAt: timestamp("closed_at"), closeEvidence: text("close_evidence"),
  detailCiphertext: text("detail_ciphertext"), closeEvidenceCiphertext: text("close_evidence_ciphertext"),
}, (table) => [
  index("coaching_exceptions_org_status_idx").on(table.orgId, table.status),
  index("coaching_exceptions_case_status_idx").on(table.caseId, table.status),
  index("coaching_exceptions_assignee_due_idx").on(table.assigneeId, table.dueAt),
]);

export const coachingExceptionActions = mysqlTable("coaching_exception_actions", {
  id: id(), exceptionId: bigint("exception_id", { mode: "number", unsigned: true }).notNull(),
  caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(),
  action: varchar("action", { length: 16 }).notNull(), note: text("note").notNull(), evidence: text("evidence").notNull(),
  noteCiphertext: text("note_ciphertext"), evidenceCiphertext: text("evidence_ciphertext"),
  actorUserId: userId("actor_user_id"), createdAt: createdAt(),
}, (table) => [index("coaching_exception_actions_exception_idx").on(table.exceptionId, table.createdAt),
  index("coaching_exception_actions_case_idx").on(table.caseId, table.exceptionId)]);

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
  timeBlocks: json("time_blocks").$type<Record<string, unknown>[]>(),
  signOutAt: timestamp("sign_out_at"), leaveReason: text("leave_reason"), makeupPlan: text("makeup_plan"), handoffNote: text("handoff_note"),
  cancelledAt: timestamp("cancelled_at"), cancelReason: varchar("cancel_reason", { length: 1000 }).notNull().default(""),
});

export const courseSessions = mysqlTable("course_sessions", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), orgId: orgId(), supervisionId: bigint("supervision_id", { mode: "number", unsigned: true }),
  coachId: userId("coach_id"), startAt: timestamp("start_at").notNull(), phase: varchar("phase", { length: 16 }).notNull(),
  format: varchar("format", { length: 24 }).notNull(), status: varchar("status", { length: 24 }).notNull().default("draft"),
  changeReason: varchar("change_reason", { length: 500 }).notNull().default(""), changeConfirmedBy: bigint("change_confirmed_by", { mode: "number", unsigned: true }),
  sharedSummary: text("shared_summary").notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
  cancelledAt: timestamp("cancelled_at"), cancelReason: varchar("cancel_reason", { length: 1000 }).notNull().default(""), cancelledBy: bigint("cancelled_by", { mode: "number", unsigned: true }),
});

export const courseSessionUnits = mysqlTable("course_session_units", {
  id: id(), sessionId: bigint("session_id", { mode: "number", unsigned: true }).notNull(), courseKey: varchar("course_key", { length: 24 }).notNull(),
  lessonNo: int("lesson_no"), title: varchar("title", { length: 180 }).notNull(), snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
  learningPoints: text("learning_points").notNull(), practiceEvidence: text("practice_evidence").notNull(), sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const courseParticipants = mysqlTable("course_participants", {
  id: id(), sessionId: bigint("session_id", { mode: "number", unsigned: true }).notNull(), studentUserId: userId("student_user_id"),
  guardianLabel: varchar("guardian_label", { length: 64 }).notNull().default(""), guardianUserId: bigint("guardian_user_id", { mode: "number", unsigned: true }),
  attendance: varchar("attendance", { length: 24 }).notNull().default("present"),
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
  uploadedBy: userId("uploaded_by"), pushedAt: timestamp("pushed_at"), expiresAt: timestamp("expires_at"), disposedAt: timestamp("disposed_at"),
  disposalReason: varchar("disposal_reason", { length: 1000 }).notNull().default(""), disposedBy: bigint("disposed_by", { mode: "number", unsigned: true }), createdAt: createdAt(),
});

/** 多监护人逐个账号授权；不共享学生密码，撤销后下载权限立即失效。 */
export const coachingGuardianGrants = mysqlTable("coaching_guardian_grants", {
  id: id(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), guardianUserId: userId("guardian_user_id"),
  label: varchar("label", { length: 64 }).notNull(), active: boolean("active").notNull().default(true),
  createdBy: userId("created_by"), createdAt: createdAt(), updatedAt: updatedAt(),
});

/** 仅记录站内通知；sent 与 delivered 分开，未读不代表未送达。 */
export const coachingNotifications = mysqlTable("coaching_notifications", {
  id: id(), orgId: orgId(), caseId: bigint("case_id", { mode: "number", unsigned: true }), recipientId: userId("recipient_id"),
  type: varchar("type", { length: 40 }).notNull(), channel: varchar("channel", { length: 16 }).notNull().default("in_app"),
  title: varchar("title", { length: 180 }).notNull(), body: varchar("body", { length: 1000 }).notNull().default(""),
  priority: varchar("priority", { length: 16 }).notNull().default("normal"), status: varchar("status", { length: 16 }).notNull().default("pending"),
  notBefore: timestamp("not_before").notNull(), sentAt: timestamp("sent_at"), deliveredAt: timestamp("delivered_at"), readAt: timestamp("read_at"),
  failedAt: timestamp("failed_at"), failureReason: varchar("failure_reason", { length: 500 }).notNull().default(""),
  retryCount: int("retry_count").notNull().default(0), manualReason: varchar("manual_reason", { length: 500 }).notNull().default(""), manualAt: timestamp("manual_at"),
  idempotencyKey: varchar("idempotency_key", { length: 191 }).notNull(), createdBy: bigint("created_by", { mode: "number", unsigned: true }),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("coaching_notifications_idempotency_unique").on(table.idempotencyKey),
  index("coaching_notifications_recipient_status_idx").on(table.recipientId, table.status, table.notBefore),
  index("coaching_notifications_org_created_idx").on(table.orgId, table.createdAt),
  index("coaching_notifications_case_idx").on(table.caseId),
]);

/** 机构级提醒节奏与建议负荷；负荷只预警，不作为接案硬上限。 */
export const coachingNotificationSettings = mysqlTable("coaching_notification_settings", {
  id: id(), orgId: orgId(), quietStart: varchar("quiet_start", { length: 5 }).notNull().default("22:00"),
  quietEnd: varchar("quiet_end", { length: 5 }).notNull().default("07:00"), suggestedCaseLoad: int("suggested_case_load").notNull().default(20),
  updatedBy: bigint("updated_by", { mode: "number", unsigned: true }), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex("coaching_notification_settings_org_unique").on(table.orgId)]);

export * from "./coachingDeliverySchema";
