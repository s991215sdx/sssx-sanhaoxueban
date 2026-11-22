import { mysqlTable, serial, bigint, int, varchar, text, json, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

const id = () => serial("id").primaryKey();
const orgId = () => bigint("org_id", { mode: "number", unsigned: true }).notNull();
const userId = (name = "user_id") => bigint(name, { mode: "number", unsigned: true }).notNull();
const createdAt = () => timestamp("created_at").notNull().defaultNow().$defaultFn(() => new Date());
const updatedAt = () => timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()).$defaultFn(() => new Date());

/** 学生目标、家庭期待与可核验依据分版本保存；不把家长期待冒充学生目标。 */
export const coachingGrowProfiles = mysqlTable("coaching_grow_profiles", {
  id: id(), orgId: orgId(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(),
  version: int("version").notNull(), previousId: bigint("previous_id", { mode: "number", unsigned: true }),
  studentGoal: text("student_goal").notNull(), parentExpectation: text("parent_expectation").notNull(),
  targetSchool: varchar("target_school", { length: 180 }).notNull().default(""), targetDate: varchar("target_date", { length: 10 }),
  targetSubjects: json("target_subjects").$type<{ subject: string; baseline: string; target: string }[]>().notNull(),
  currentSituation: text("current_situation").notNull(), evidence: text("evidence").notNull(),
  followUpActions: text("follow_up_actions").notNull(), nextContactAt: timestamp("next_contact_at"), retestDueAt: timestamp("retest_due_at"),
  changeReason: varchar("change_reason", { length: 500 }).notNull().default(""), createdBy: userId("created_by"), createdAt: createdAt(),
}, (table) => [
  uniqueIndex("coaching_grow_profiles_version_unique").on(table.caseId, table.version),
  index("coaching_grow_profiles_org_case_idx").on(table.orgId, table.caseId),
]);

/** 报告只存结论摘要与行动链；不从原始心理答案重新推断诊断。 */
export const coachingGrowReportLinks = mysqlTable("coaching_grow_report_links", {
  id: id(), orgId: orgId(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(),
  profileId: bigint("profile_id", { mode: "number", unsigned: true }).notNull(), resultId: bigint("result_id", { mode: "number", unsigned: true }).notNull(),
  conclusion: text("conclusion").notNull(), evidence: text("evidence").notNull(), trainingSuggestion: text("training_suggestion").notNull(),
  cycle: varchar("cycle", { length: 80 }).notNull(), ownerId: userId("owner_id"), reviewAt: timestamp("review_at").notNull(), createdBy: userId("created_by"), createdAt: createdAt(),
}, (table) => [
  uniqueIndex("coaching_grow_report_links_unique").on(table.profileId, table.resultId),
  index("coaching_grow_report_links_case_idx").on(table.orgId, table.caseId),
]);

export const coachingPlanConfirmations = mysqlTable("coaching_plan_confirmations", {
  id: id(), orgId: orgId(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), planId: bigint("plan_id", { mode: "number", unsigned: true }).notNull(),
  role: varchar("role", { length: 16 }).notNull(), userId: userId(), comment: text("comment").notNull().default(""), createdAt: createdAt(),
}, (table) => [
  uniqueIndex("coaching_plan_confirmations_unique").on(table.planId, table.role, table.userId),
  index("coaching_plan_confirmations_case_idx").on(table.orgId, table.caseId),
]);

/** 各类记录有独立服务端输入规则；同周期只能追加版本，不能覆盖已提交历史。 */
export const coachingExtendedRecords = mysqlTable("coaching_extended_records", {
  id: id(), orgId: orgId(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(),
  recordType: varchar("record_type", { length: 32 }).notNull(), periodKey: varchar("period_key", { length: 32 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(), payload: json("payload").$type<Record<string, unknown>>(),
  payloadCiphertext: text("payload_ciphertext"), sensitive: boolean("sensitive").notNull().default(false),
  status: varchar("status", { length: 24 }).notNull().default("completed"), version: int("version").notNull(),
  previousId: bigint("previous_id", { mode: "number", unsigned: true }), ownerId: userId("owner_id"), dueAt: timestamp("due_at"),
  changeReason: varchar("change_reason", { length: 500 }).notNull().default(""), createdBy: userId("created_by"),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("coaching_extended_records_version_unique").on(table.caseId, table.recordType, table.periodKey, table.version),
  index("coaching_extended_records_owner_due_idx").on(table.ownerId, table.status, table.dueAt),
  index("coaching_extended_records_org_case_idx").on(table.orgId, table.caseId),
]);

export const coachingSessionEvents = mysqlTable("coaching_session_events", {
  id: id(), orgId: orgId(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), sessionId: bigint("session_id", { mode: "number", unsigned: true }).notNull(),
  action: varchar("action", { length: 24 }).notNull(), previousStartAt: timestamp("previous_start_at"), nextStartAt: timestamp("next_start_at"),
  previousStatus: varchar("previous_status", { length: 24 }).notNull(), nextStatus: varchar("next_status", { length: 24 }).notNull(),
  snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(), reason: varchar("reason", { length: 1000 }).notNull(),
  actorUserId: userId("actor_user_id"), createdAt: createdAt(),
}, (table) => [index("coaching_session_events_session_idx").on(table.sessionId, table.createdAt)]);

export const coachingDeliverableRecipients = mysqlTable("coaching_deliverable_recipients", {
  id: id(), orgId: orgId(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), resourceType: varchar("resource_type", { length: 24 }).notNull(), resourceId: bigint("resource_id", { mode: "number", unsigned: true }).notNull(),
  recipientUserId: userId("recipient_user_id"), scope: varchar("scope", { length: 16 }).notNull().default("read"),
  active: boolean("active").notNull().default(true), createdBy: userId("created_by"),
  revokedBy: bigint("revoked_by", { mode: "number", unsigned: true }), revokedAt: timestamp("revoked_at"),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("coaching_deliverable_recipients_unique").on(table.resourceType, table.resourceId, table.recipientUserId),
  index("coaching_deliverable_recipients_user_idx").on(table.recipientUserId, table.active),
]);

export const coachingDeliverySettings = mysqlTable("coaching_delivery_settings", {
  id: id(), orgId: orgId(), h3Hours: int("h3_hours").notNull().default(24),
  weeklyPlanDay: int("weekly_plan_day").notNull().default(1), weeklyReviewDay: int("weekly_review_day").notNull().default(0),
  qualityVersion: varchar("quality_version", { length: 16 }).notNull().default("1.0"),
  retentionDays: int("retention_days").notNull().default(365), hardCaseLimit: int("hard_case_limit").notNull().default(0),
  s1Hours: int("s1_hours").notNull().default(8), s2Hours: int("s2_hours").notNull().default(2), s3Hours: int("s3_hours").notNull().default(24),
  updatedBy: userId("updated_by"), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex("coaching_delivery_settings_org_unique").on(table.orgId)]);

/** S4 必须逐项闭环；正文和证据加密，管理员 reveal 另行审计。 */
export const coachingCrisisFollowups = mysqlTable("coaching_crisis_followups", {
  id: id(), orgId: orgId(), caseId: bigint("case_id", { mode: "number", unsigned: true }).notNull(), exceptionId: bigint("exception_id", { mode: "number", unsigned: true }).notNull(),
  kind: varchar("kind", { length: 32 }).notNull(), detailCiphertext: text("detail_ciphertext").notNull(), evidenceCiphertext: text("evidence_ciphertext").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"), ownerId: userId("owner_id"), dueAt: timestamp("due_at").notNull(),
  completedAt: timestamp("completed_at"), createdBy: userId("created_by"), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [
  index("coaching_crisis_followups_exception_idx").on(table.exceptionId, table.status),
  index("coaching_crisis_followups_owner_due_idx").on(table.ownerId, table.status, table.dueAt),
]);
