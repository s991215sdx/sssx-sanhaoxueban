import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
  int,
  varchar,
  text,
  json,
  timestamp,
  boolean,
  customType,
} from "drizzle-orm/mysql-core";

/** LONGTEXT 列，用于存放压缩后的拍照图片（base64 dataURL）。 */
const longtext = customType<{ data: string }>({
  dataType: () => "longtext",
});

/* ---------------------------------- 知识图谱 ---------------------------------- */

export const knowledgePoints = mysqlTable("knowledge_points", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(), // G7-1-01
  // 学段/年级（0007 起）；DEFAULT 初中/初一 用于回填 0007 前的 G7 存量行，
  // 新写入一律在代码里显式赋值
  stage: mysqlEnum("stage", ["小学", "初中", "高中"]).notNull().default("初中"),
  grade: varchar("grade", { length: 16 }).notNull().default("初一"),
  // 学科（0008 起）；DEFAULT 数学 用于回填存量数学行，新写入显式赋值
  subject: varchar("subject", { length: 16 }).notNull().default("数学"),
  chapter: varchar("chapter", { length: 64 }).notNull(), // 第一章 有理数
  title: varchar("title", { length: 128 }).notNull(),
  // 精讲要点：[{heading, body}]
  summary: json("summary").$type<{ heading: string; body: string }[]>().notNull(),
  // 例题：{stem, analysis, answer}
  example: json("example")
    .$type<{ stem: string; analysis: string; answer: string }>()
    .notNull(),
  // 前置知识点 code 列表
  prereqCodes: json("prereq_codes").$type<string[]>().notNull(),
  // 常见错因：[{cause, detail}]
  commonErrors: json("common_errors")
    .$type<{ cause: string; detail: string }[]>()
    .notNull(),
  // 费曼对话：关键概念 + 追问
  socratic: json("socratic")
    .$type<{ keyConcepts: string[]; probes: string[]; hints: string[] }>()
    .notNull(),
  sortOrder: int("sort_order").notNull(),
});

export type KnowledgePoint = typeof knowledgePoints.$inferSelect;

/* ------------------------------------ 题库 ------------------------------------ */

export const questions = mysqlTable("questions", {
  id: serial("id").primaryKey(),
  kpId: bigint("kp_id", { mode: "number", unsigned: true }).notNull(),
  type: mysqlEnum("type", ["choice", "fill"]).notNull(),
  stage: mysqlEnum("stage", ["check", "practice", "variant"]).notNull(), // 先备检测/预习练习/变式训练
  difficulty: int("difficulty").notNull(), // 1-3
  stem: text("stem").notNull(),
  options: json("options").$type<string[] | null>(), // choice 时的选项
  answer: varchar("answer", { length: 255 }).notNull(),
  hint: varchar("hint", { length: 512 }).notNull(),
  explanation: text("explanation").notNull(),
});

export type Question = typeof questions.$inferSelect;

/* ---------------------------------- 学习者模型 --------------------------------- */

export const mastery = mysqlTable("mastery", {
  id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  kpId: bigint("kp_id", { mode: "number", unsigned: true }).notNull(),
  score: int("score").notNull().default(0), // 0-100
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Mastery = typeof mastery.$inferSelect;

export const attempts = mysqlTable("attempts", {
  id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  questionId: bigint("question_id", { mode: "number", unsigned: true }).notNull(),
  kpId: bigint("kp_id", { mode: "number", unsigned: true }).notNull(),
  stage: varchar("stage", { length: 32 }).notNull(),
  correct: boolean("correct").notNull(),
  given: varchar("given", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Attempt = typeof attempts.$inferSelect;

/* ----------------------------------- 错题本 ----------------------------------- */

export const errorLogs = mysqlTable("error_logs", {
  id: serial("id").primaryKey(),
  kpId: bigint("kp_id", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  stem: text("stem").notNull(), // 题干（可手录或来自题库）
  cause: mysqlEnum("cause", [
    "概念不清",
    "审题失误",
    "计算错误",
    "方法不会",
    "粗心大意",
  ]).notNull(),
  note: varchar("note", { length: 512 }),
  // 提分区间：1=会了但错（送分区） 2=讲一遍就会（提分区） 3=讲了也不会（攻坚区）
  band: int("band").notNull().default(2),
  // 拍照上传的错题照片（压缩后 base64 dataURL，可空）
  imageData: longtext("image_data"),
  rootKpId: bigint("root_kp_id", { mode: "number", unsigned: true }), // 回溯出的根因知识点
  status: mysqlEnum("status", ["active", "mastered"]).notNull().default("active"),
  variantStreak: int("variant_streak").notNull().default(0), // 变式连续答对数
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ErrorLog = typeof errorLogs.$inferSelect;

/* ---------------------------------- 间隔复习 ---------------------------------- */

export const reviewItems = mysqlTable("review_items", {
  id: serial("id").primaryKey(),
  errorLogId: bigint("error_log_id", { mode: "number", unsigned: true }).notNull(),
  dueDate: varchar("due_date", { length: 10 }).notNull(), // YYYY-MM-DD
  stageIndex: int("stage_index").notNull(), // 0..4 → 1/3/7/15/30 天
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at"),
});

export type ReviewItem = typeof reviewItems.$inferSelect;

/* ---------------------------------- 预习会话 ---------------------------------- */

export const previewSessions = mysqlTable("preview_sessions", {
  id: serial("id").primaryKey(),
  kpId: bigint("kp_id", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  prereqTotal: int("prereq_total").notNull().default(0),
  prereqCorrect: int("prereq_correct").notNull().default(0),
  practiceTotal: int("practice_total").notNull().default(0),
  practiceCorrect: int("practice_correct").notNull().default(0),
  feynmanConceptsHit: json("feynman_concepts_hit").$type<string[]>().notNull(),
  classQuestions: json("class_questions").$type<string[]>().notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PreviewSession = typeof previewSessions.$inferSelect;

export const chatMessages = mysqlTable("chat_messages", {
  id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  sessionId: bigint("session_id", { mode: "number", unsigned: true }).notNull(),
  role: mysqlEnum("role", ["tutor", "student"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;

/* ---------------------------------- 学生档案 ---------------------------------- */

export const studentProfile = mysqlTable("student_profile", {
  id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  name: varchar("name", { length: 64 }).notNull().default("同学"),
  grade: varchar("grade", { length: 32 }).notNull().default("初一"),
  /** v191 校园模式注册：班级（如「高一(3)班」，校园渠道注册时必填） */
  className: varchar("class_name", { length: 32 }),
  school: varchar("school", { length: 128 }),
  targetSchool: varchar("target_school", { length: 128 }),
  dailyMinutes: int("daily_minutes").notNull().default(45), // 每天可用学习时长（分钟）
  mbti: varchar("mbti", { length: 8 }),
  disc: varchar("disc", { length: 8 }),
  // E3 学业陪跑诊断摘要（三阶九项均分、涂档、六型倾向、红线等）
  diagnosis: json("diagnosis").$type<Record<string, unknown>>(),
  // 学科自评与中考目标（见 contracts/academics.ts 的 AcademicsData）
  academics: json("academics").$type<Record<string, unknown>>(),
  // 分配给哪位伴学师（users.id；null=未分配）
  tutorId: bigint("tutor_id", { mode: "number", unsigned: true }),
  /** 学员端功能开关（v50）：null=全功能；数组=仅开启这些模块（测评中心恒可用） */
  enabledModules: json("enabled_modules").$type<string[] | null>(),
  onboarded: boolean("onboarded").notNull().default(false),
  /** V54：报告推送开关——false=测评报告由伴学师把关，家长暂不可见；true=已推送，家长可直接查看（伴学师/管理员在后台切换） */
  reportReleased: boolean("report_released").notNull().default(false),
  /** V55：家长「请伴学师推送报告」的请求时间（推送后清空） */
  reportPushRequestedAt: timestamp("report_push_requested_at"),
  /** v82：伴学师额外推送开放的测评种类（INVITE_ASSESS_KINDS 的 key 数组；null=无额外推送）。
   *  对绑定了测评套餐的扫码注册学员，未在套餐内、但在此列表里的测评也会显示在测评中心。 */
  releasedAssessments: json("released_assessments").$type<string[] | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type StudentProfile = typeof studentProfile.$inferSelect;

/** V72：成绩多次记录——每次保存「学业目标/成绩」都追加一条历史（含考试名与各科分数），
 *  用于成绩变化曲线；student_profile.academics 始终为最近一次（报告计算口径不变）。 */
export const academicRecords = mysqlTable("academic_records", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  examName: varchar("exam_name", { length: 64 }).notNull().default(""),
  subjects: json("subjects").$type<Record<string, unknown>[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AcademicRecord = typeof academicRecords.$inferSelect;

/** V56：学员-伴学师多对多分配。一个学员可挂多位伴学师（管理员在后台分配）；
 *  student_profile.tutor_id 保留为主管伴学师（= 本表第一条，向后兼容旧逻辑）。
 *  v169：reportAccess=该伴学师是否可查看本学员的测评报告/解析/陪练对话（B 端付费控制，
 *  默认 true 兼容存量）；reportAccessExpiresAt=权限到期时间（null=永久，到期自动收回）。 */
export const studentTutor = mysqlTable("student_tutor", {
  id: serial("id").primaryKey(),
  studentUserId: bigint("student_user_id", { mode: "number", unsigned: true }).notNull(),
  tutorUserId: bigint("tutor_user_id", { mode: "number", unsigned: true }).notNull(),
  reportAccess: boolean("report_access").notNull().default(true),
  reportAccessExpiresAt: timestamp("report_access_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type StudentTutor = typeof studentTutor.$inferSelect;

export const assessmentResults = mysqlTable("assessment_results", {
  id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  kind: mysqlEnum("kind", ["mbti", "disc", "e3", "e3parent", "multi", "multi5", "anchor", "holland", "mental", "mentalsdq", "mentalpa", "scl90", "discparent", "subject", "subject4d"]).notNull(),
  result: json("result").$type<Record<string, unknown>>().notNull(),
  /** 原始作答（题目选项/评分），供伴学师查看答题明细。 */
  answers: json("answers").$type<Record<string, unknown> | number[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AssessmentResult = typeof assessmentResults.$inferSelect;

/* ---------------------------------- 试卷分析 ---------------------------------- */

export type PaperItemSeed = {
  no: number; // 题号
  result: "right" | "wrong" | "half"; // 做对/做错/半对
  band?: 1 | 2 | 3; // 错题的提分区间
  kpCode?: string;
  cause?: string;
  note?: string;
  score?: number; // 该题分值（缺省按 5 分计）
};

export const papers = mysqlTable("papers", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 128 }).notNull(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  examDate: varchar("exam_date", { length: 10 }),
  score: varchar("score", { length: 32 }), // 如 "82/100"
  images: json("images").$type<string[]>().notNull(), // 压缩后的试卷照片 base64 dataURL
  items: json("items").$type<PaperItemSeed[]>().notNull(),
  // 分析摘要：{ bandCounts, topCauses, advice[], linkedErrorIds[] }
  summary: json("summary").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Paper = typeof papers.$inferSelect;

/* ---------------------------------- 树洞心情 ---------------------------------- */

export const moodEntries = mysqlTable("mood_entries", {
  id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  mood: int("mood").notNull(), // 1-5（很糟→很好）
  tags: json("tags").$type<string[]>().notNull(), // 如 ["学业","人际","家庭"]
  content: text("content").notNull(),
  reply: text("reply").notNull(), // 树洞的回信
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MoodEntry = typeof moodEntries.$inferSelect;

/* ---------------------------------- 当日计划 ---------------------------------- */

export type PlanItemSeed = {
  kind: "review" | "band1" | "band2" | "band3" | "preview" | "feynman" | "rest";
  title: string;
  kpCode?: string;
  errorId?: number;
  minutes: number;
  done?: boolean;
};

export const dailyPlans = mysqlTable("daily_plans", {
  id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD（每人每天一份，重生成覆盖）
  minutes: int("minutes").notNull(),
  items: json("items").$type<PlanItemSeed[]>().notNull(),
  note: varchar("note", { length: 512 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DailyPlan = typeof dailyPlans.$inferSelect;

/* ------------------------------ 伴学师·七步法导学 ----------------------------- */

export const guideSessions = mysqlTable("guide_sessions", {
  id: serial("id").primaryKey(),
  date: varchar("date", { length: 10 }).notNull(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  step: int("step").notNull().default(0), // 0-7：当前进行到哪一步（7=完成）
  answers: json("answers").$type<Record<string, string>>().notNull(), // stepKey → 学生的回答
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type GuideSession = typeof guideSessions.$inferSelect;

/* ---------------------------------- 课堂录音 ---------------------------------- */

export const recordings = mysqlTable("recordings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 128 }).notNull(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  recDate: varchar("rec_date", { length: 10 }).notNull(),
  kpCodes: json("kp_codes").$type<string[]>().notNull(), // 关联知识点
  durationSec: int("duration_sec"),
  transcript: text("transcript"), // 转写/课堂笔记文本（可空）
  note: varchar("note", { length: 512 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Recording = typeof recordings.$inferSelect;

/* ------------------------------ 引导学习会话（错题深练） ----------------------------- */

export type TutorMessage = { role: "tutor" | "student"; content: string };

export const tutorSessions = mysqlTable("tutor_sessions", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  errorId: bigint("error_id", { mode: "number", unsigned: true }).notNull(), // 关联错题
  kpId: bigint("kp_id", { mode: "number", unsigned: true }).notNull(), // 当前引导的知识点（可能是根因）
  questionId: bigint("question_id", { mode: "number", unsigned: true }), // 复习后重做的那道题
  // 阶段：review=看复习卡 quiz=重做检验 tutor=苏格拉底引导 done=完成
  phase: mysqlEnum("phase", ["review", "quiz", "tutor", "done"]).notNull().default("review"),
  conceptsHit: json("concepts_hit").$type<string[]>().notNull(), // 引导中命中的关键概念
  messages: json("messages").$type<TutorMessage[]>().notNull(), // 引导对话记录
  turn: int("turn").notNull().default(0), // 学生发言轮数
  understood: boolean("understood").notNull().default(false), // 引导判定搞懂
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TutorSession = typeof tutorSessions.$inferSelect;

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  /** 手机号登录账号（手机号即账号；Kimi OAuth 用户此列为空） */
  phone: varchar("phone", { length: 20 }),
  /** 密码散列（scrypt，含盐），永不返回给前端 */
  passwordHash: varchar("password_hash", { length: 255 }),
  role: mysqlEnum("role", ["user", "tutor", "admin", "jiaowu"]).default("user").notNull(),
  /** V59 SaaS：所属机构（organizations.id）。null = 平台超管（总系统）。 */
  orgId: bigint("org_id", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
  /** v96：学员删除（软删）时间。null=正常；非 null=已删除——从各列表/登录隐藏，
   *  保留 2 个月（RETENTION_MS）内可在回收站恢复，到期由 purgeExpiredStudents 物理清除。 */
  deletedAt: timestamp("deleted_at"),
  /** v99：执行软删的操作者（users.id）——回收站按"谁删的"做伴学师可见性判定。 */
  deletedBy: bigint("deleted_by", { mode: "number", unsigned: true }),
  /** v170：伴学师属性——其邀请二维码注册的新学员默认可查看测评报告（B 端付费老师一次配置，
   *  后续扫码学员自动带报告权限；个别学员仍可由管理员在分配/分配报告里单独覆盖）。 */
  inviteReportDefault: boolean("invite_report_default").notNull().default(false),
});

/* ---------------------------------- SaaS 机构（租户） --------------------------------- */

/** 合作机构：一套独立的三好学伴系统（品牌独立、账号独立、数据隔离）。由平台超管在总系统开通。 */
export const organizations = mysqlTable("organizations", {
  id: serial("id").primaryKey(),
  /** 机构全称：如「东莞上上升学教育咨询有限公司」 */
  name: varchar("name", { length: 128 }).notNull(),
  /** 对外品牌名（商标名）：登录后全站展示，如「上上升学 · 三好伴学」 */
  brandName: varchar("brand_name", { length: 128 }).notNull(),
  /** 品牌 Logo URL（可选；空则只显示品牌名） */
  logoUrl: varchar("logo_url", { length: 512 }),
  /** 停用后：机构账号登录即见停用提示，管理端置灰 */
  active: boolean("active").notNull().default(true),
  /** 机构级设置（JSON）：xuanke.scoreWeight = 选科成绩权重%（0-60，空=默认：校园机构35/通用机构40） */
  settings: json("settings").$type<{ xuanke?: { scoreWeight?: number } }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/* ---------------------------------- 注册邀请渠道 --------------------------------- */

/** 注册邀请渠道：管理员按推广渠道生成二维码（地推/异业合作/线上社群等），扫码注册绑定渠道。 */
export const inviteChannels = mysqlTable("invite_channels", {
  id: serial("id").primaryKey(),
  /** 渠道码：出现在二维码链接 /invite/{code} 里 */
  code: varchar("code", { length: 24 }).notNull().unique(),
  /** 渠道名：如「地推-万达广场点位」 */
  name: varchar("name", { length: 64 }).notNull(),
  /** 渠道类型：地推 / 异业合作 / 线上社群 / 老带新 / 其他 */
  kind: varchar("kind", { length: 24 }).notNull().default("地推"),
  /** 备注：对接人、点位、合作方等 */
  note: varchar("note", { length: 255 }),
  /** 停用后二维码失效，不再接受新注册 */
  active: boolean("active").notNull().default(true),
  /** 归属伴学师（users.id）：伴学师自建渠道非空，经此码注册的学员自动挂到该伴学师名下；机构渠道为 null */
  tutorId: bigint("tutor_id", { mode: "number", unsigned: true }),
  /** V59 SaaS：发码人所属机构，注册学员继承该机构（平台超发的码为 null） */
  orgId: bigint("org_id", { mode: "number", unsigned: true }),
  /** v80：是否对本渠道注册学员开放测评报告查看（相当于图1「自动查看报告」总开关） */
  reportAccess: boolean("report_access").notNull().default(false),
  /** v80：开放哪些测评报告（INVITE_REPORT_KINDS 的 key 数组；null=不开放任何报告） */
  reportKinds: json("report_kinds").$type<string[]>(),
  /** v82：是否对本渠道注册学员绑定「测评套餐」（注册后一站式连做勾选的测评，其余隐藏） */
  assessmentAccess: boolean("assessment_access").notNull().default(false),
  /** v82：绑定的测评种类（INVITE_ASSESS_KINDS 的 key 数组；"all"=全部测评） */
  assessmentKinds: json("assessment_kinds").$type<string[]>(),
  /** v191 校园模式：true=本渠道为校园专用入口——注册免手机号，只填姓名+班级+年级（学校/年级可固定） */
  campus: boolean("campus").notNull().default(false),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InviteChannel = typeof inviteChannels.$inferSelect;

/** 邀请注册记录：每位扫码注册的家长一条（含渠道归属，用于渠道效果统计）。 */
export const inviteRegistrations = mysqlTable("invite_registrations", {
  id: serial("id").primaryKey(),
  channelId: bigint("channel_id", { mode: "number", unsigned: true }).notNull(),
  /** 冗余存渠道码，渠道删除/改名后记录仍可追溯 */
  channelCode: varchar("channel_code", { length: 24 }).notNull(),
  /* V51 极简注册：不再采集家长称呼/学生姓名/年级（历史记录保留展示，新记录为 null） */
  parentName: varchar("parent_name", { length: 64 }),
  studentName: varchar("student_name", { length: 64 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  grade: varchar("grade", { length: 16 }),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InviteRegistration = typeof inviteRegistrations.$inferSelect;

/* ---------------------------------- 伴学处方（开方） --------------------------------- */

/** V61：伴学师开方——勾选方案库训练方法 + 自写补充方案，推送给学员端查看。 */
export const studentPrescriptions = mysqlTable("student_prescriptions", {
  id: serial("id").primaryKey(),
  /** 学员（users.id） */
  studentUserId: bigint("student_user_id", { mode: "number", unsigned: true }).notNull(),
  /** 开方的伴学师/管理员（users.id） */
  tutorUserId: bigint("tutor_user_id", { mode: "number", unsigned: true }).notNull(),
  /** 勾选的训练方法快照：[{id,name,sub,board,ability}] */
  methods: json("methods").notNull(),
  /** 伴学师自写的补充方案（可空） */
  customText: text("custom_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StudentPrescription = typeof studentPrescriptions.$inferSelect;
export type InsertStudentPrescription = typeof studentPrescriptions.$inferInsert;

/* ------------------------------ 智慧生涯规划 · 数据底座 ------------------------------ */

/** 专业底层库（天生智慧 1152+ 专业 × 27 字段），后台上传 JSON 导入。 */
export const majorLib = mysqlTable("major_lib", {
  id: serial("id").primaryKey(),
  menleiCode: varchar("menlei_code", { length: 8 }).notNull().default(""),
  menlei: varchar("menlei", { length: 16 }).notNull().default(""),
  catCode: varchar("cat_code", { length: 16 }).notNull().default(""),
  cat: varchar("cat", { length: 32 }).notNull().default(""),
  code: varchar("code", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  level: varchar("level", { length: 16 }).notNull().default("本科"),
  addedYear: varchar("added_year", { length: 8 }).notNull().default(""),
  oneLiner: text("one_liner"),
  jobs: text("jobs"),
  intro: text("intro"),
  goal: text("goal"),
  require: text("require"),
  knowledge: text("knowledge"),
  kaoyan: text("kaoyan"),
  courses: text("courses"),
  famous: text("famous"),
  employment: text("employment"),
  malePct: varchar("male_pct", { length: 16 }),
  femalePct: varchar("female_pct", { length: 16 }),
  degree: varchar("degree", { length: 64 }),
  regions: text("regions"),
  industries: text("industries"),
  occupations: text("occupations"),
  salary: text("salary"),
  schools: text("schools"),
  internship: text("internship"),
  certs: text("certs"),
});

export type MajorLibRow = typeof majorLib.$inferSelect;

/** 职业库：工作内容/职业技能/发展前景等，20 条种子随 0029 迁移插入，后台可扩充。 */
export const careerLib = mysqlTable("career_lib", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  category: varchar("category", { length: 64 }).notNull().default(""),
  duties: json("duties").$type<string[]>(),
  content: text("content"),
  skillsPro: json("skills_pro").$type<string[]>(),
  skillsGen: json("skills_gen").$type<string[]>(),
  prospect: text("prospect"),
  path: text("path"),
  trend: text("trend"),
});

export type CareerLibRow = typeof careerLib.$inferSelect;

/** 广东院校专业分数库（3 年专业最低分/位次 + 26 预估位次），后台上传 JSON 导入。 */
export const gdScores = mysqlTable("gd_scores", {
  id: serial("id").primaryKey(),
  year: int("year").notNull().default(2025),
  kelei: varchar("kelei", { length: 16 }).notNull().default(""),
  batch: varchar("batch", { length: 32 }).notNull().default(""),
  schoolCode: varchar("school_code", { length: 16 }).notNull().default(""),
  school: varchar("school", { length: 128 }).notNull().default(""),
  groupCode: varchar("group_code", { length: 32 }).notNull().default(""),
  groupName: varchar("group_name", { length: 255 }).notNull().default(""),
  majorCode: varchar("major_code", { length: 16 }).notNull().default(""),
  majorFull: varchar("major_full", { length: 255 }).notNull().default(""),
  major: varchar("major", { length: 128 }).notNull().default(""),
  req: varchar("req", { length: 64 }).notNull().default(""),
  plan: int("plan"),
  years: varchar("years", { length: 16 }).notNull().default(""),
  fee: varchar("fee", { length: 32 }).notNull().default(""),
  menlei: varchar("menlei", { length: 16 }).notNull().default(""),
  cat: varchar("cat", { length: 64 }).notNull().default(""),
  y1Min: int("y1_min"),
  y1Rank: int("y1_rank"),
  y2Min: int("y2_min"),
  y2Rank: int("y2_rank"),
  y3Min: int("y3_min"),
  y3Rank: int("y3_rank"),
  estRank26: int("est_rank26"),
  /** 2025 专业组数据 */
  gCount: int("g_count"),
  gMin: int("g_min"),
  gRank: int("g_rank"),
  /** 2025 专业录取（y1=2025，y2=2024，y3=2023） */
  y1Count: int("y1_count"),
  y1Batch: varchar("y1_batch", { length: 32 }).notNull().default(""),
  y1Plan: int("y1_plan"),
  y2Count: int("y2_count"),
  y2Batch: varchar("y2_batch", { length: 32 }).notNull().default(""),
  y2Plan: int("y2_plan"),
  y3Count: int("y3_count"),
  y3Max: int("y3_max"),
  y3MaxRank: int("y3_max_rank"),
  y3Batch: varchar("y3_batch", { length: 32 }).notNull().default(""),
  y3Plan: int("y3_plan"),
  city: varchar("city", { length: 32 }).notNull().default(""),
  tier: varchar("tier", { length: 16 }).notNull().default(""),
  tags: varchar("tags", { length: 255 }).notNull().default(""),
});

export type GdScoreRow = typeof gdScores.$inferSelect;

/** 分年级条件准备规划模板：分数段 × 年级 × 升学路径。 */
export const gradePlans = mysqlTable("grade_plans", {
  id: serial("id").primaryKey(),
  /** 分数段标签，如 "特控线以上"、"本科线-特控线" */
  band: varchar("band", { length: 32 }).notNull().default(""),
  grade: varchar("grade", { length: 8 }).notNull().default(""),
  path: varchar("path", { length: 32 }).notNull().default(""),
  title: varchar("title", { length: 128 }).notNull().default(""),
  content: text("content"),
  sort: int("sort").notNull().default(0),
});

export type GradePlanRow = typeof gradePlans.$inferSelect;

/** 学员未来期望：允许留空；伴学师后台可编辑；系统可兜底建议。 */
export const studentAspirations = mysqlTable("student_aspirations", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().unique(),
  /** 标准化后的目标院校/专业/职业（取自三库标准名） */
  school: varchar("school", { length: 128 }),
  schoolRaw: varchar("school_raw", { length: 128 }),
  major: varchar("major", { length: 128 }),
  majorRaw: varchar("major_raw", { length: 128 }),
  career: varchar("career", { length: 128 }),
  careerRaw: varchar("career_raw", { length: 128 }),
  source: mysqlEnum("source", ["student", "tutor", "system"]).notNull().default("student"),
  updatedBy: bigint("updated_by", { mode: "number", unsigned: true }),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type StudentAspirationRow = typeof studentAspirations.$inferSelect;

/** 院校库（掌上高考院校基础信息总表 2991 所 × 49 字段），后台上传 JSON 导入，按省份归类。 */
export const universityLib = mysqlTable("university_lib", {
  id: serial("id").primaryKey(),
  zsId: varchar("zs_id", { length: 16 }).notNull().default(""),
  name: varchar("name", { length: 128 }).notNull().unique(),
  province: varchar("province", { length: 16 }).notNull().default(""),
  city: varchar("city", { length: 32 }).notNull().default(""),
  district: varchar("district", { length: 32 }).notNull().default(""),
  schoolType: varchar("school_type", { length: 32 }).notNull().default(""),
  level: varchar("level", { length: 16 }).notNull().default(""),
  nature: varchar("nature", { length: 16 }).notNull().default(""),
  tags: varchar("tags", { length: 255 }).notNull().default(""),
  pageTags: varchar("page_tags", { length: 255 }).notNull().default(""),
  foundYear: varchar("found_year", { length: 16 }).notNull().default(""),
  area: varchar("area", { length: 32 }).notNull().default(""),
  supervisor: varchar("supervisor", { length: 64 }).notNull().default(""),
  zsWebsite: varchar("zs_website", { length: 255 }).notNull().default(""),
  zsPhone: varchar("zs_phone", { length: 255 }).notNull().default(""),
  website: varchar("website", { length: 255 }).notNull().default(""),
  motto: varchar("motto", { length: 255 }).notNull().default(""),
  alias: varchar("alias", { length: 128 }).notNull().default(""),
  formerNames: varchar("former_names", { length: 255 }).notNull().default(""),
  intro: text("intro"),
  introShort: text("intro_short"),
  doctor: varchar("doctor", { length: 64 }).notNull().default(""),
  doctorDetail: text("doctor_detail"),
  master: varchar("master", { length: 64 }).notNull().default(""),
  masterDetail: text("master_detail"),
  keyDisciplines: varchar("key_disciplines", { length: 128 }).notNull().default(""),
  dfc: text("dfc"),
  departments: text("departments"),
  campus: text("campus"),
  canteen: text("canteen"),
  dorm: text("dorm"),
  scholarship: text("scholarship"),
  aid: text("aid"),
  malePct: varchar("male_pct", { length: 16 }).notNull().default(""),
  femalePct: varchar("female_pct", { length: 16 }).notNull().default(""),
  logoUrl: varchar("logo_url", { length: 512 }).notNull().default(""),
  campusPhotos: text("campus_photos"),
  dormPhotos: text("dorm_photos"),
  history: text("history"),
  ranking: varchar("ranking", { length: 255 }).notNull().default(""),
  subjectEval: varchar("subject_eval", { length: 128 }).notNull().default(""),
  academicians: varchar("academicians", { length: 64 }).notNull().default(""),
  libraryBooks: varchar("library_books", { length: 64 }).notNull().default(""),
  labs: varchar("labs", { length: 64 }).notNull().default(""),
  baoyan: varchar("baoyan", { length: 64 }).notNull().default(""),
  videoUrl: varchar("video_url", { length: 512 }).notNull().default(""),
  address: varchar("address", { length: 255 }).notNull().default(""),
  zsCode: varchar("zs_code", { length: 16 }).notNull().default(""),
  detailUrl: varchar("detail_url", { length: 512 }).notNull().default(""),
});

export type UniversityLibRow = typeof universityLib.$inferSelect;

/** V175 学生未来期望（智慧生涯报告「未来期望」卡；允许留空，source 标记学员/伴学师/系统建议）。 */
export const studentExpectations = mysqlTable("student_expectations", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("student_id").notNull(),
  school: varchar("school", { length: 128 }).notNull().default(""),
  majorCat: varchar("major_cat", { length: 64 }).notNull().default(""),
  careers: varchar("careers", { length: 255 }).notNull().default(""),
  source: mysqlEnum("source", ["student", "tutor", "system"]).notNull().default("student"),
  note: varchar("note", { length: 500 }).notNull().default(""),
  updatedBy: int("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

/* ------------------------------ v220 学校版专版（粤华打样） ----------------------------- */

/** v220 选科意向：家长/学生从三大推荐确认或自定义（custom 必填理由），按轮次组织。 */
export const subjectIntentions = mysqlTable("subject_intentions", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }),
  roundNo: int("round_no").notNull().default(1),
  choice: mysqlEnum("choice", ["rec1", "rec2", "rec3", "custom"]).notNull(),
  subjects: json("subjects").$type<string[]>().notNull(),
  reason: varchar("reason", { length: 500 }).notNull().default(""),
  source: mysqlEnum("source", ["parent", "student", "tutor"]).notNull().default("parent"),
  term: varchar("term", { length: 64 }).notNull().default(""),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SubjectIntention = typeof subjectIntentions.$inferSelect;

/** v220 意向轮次：管理员开启/关闭，家长端只对 open 轮可提交。 */
export const intentionRounds = mysqlTable("intention_rounds", {
  id: serial("id").primaryKey(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull(),
  roundNo: int("round_no").notNull(),
  label: varchar("label", { length: 64 }).notNull().default(""),
  status: mysqlEnum("status", ["open", "closed"]).notNull().default("open"),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type IntentionRound = typeof intentionRounds.$inferSelect;

/** v220 预警中心：心理红线 / 学业下滑 / 动力预警，处置留痕可审计。 */
export const warningEvents = mysqlTable("warning_events", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }),
  type: mysqlEnum("type", ["mental_redline", "academic_drop", "low_motivation"]).notNull(),
  level: mysqlEnum("level", ["关注", "预警", "高风险"]).notNull().default("关注"),
  detail: json("detail").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["open", "acknowledged", "resolved"]).notNull().default("open"),
  handledBy: bigint("handled_by", { mode: "number", unsigned: true }),
  handledAt: timestamp("handled_at"),
  handleNote: varchar("handle_note", { length: 500 }).notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WarningEvent = typeof warningEvents.$inferSelect;

/** v220 催办提醒：未参测学生名单推给班主任/年级主任/管理员（学校脱敏场景不靠手机号）。 */
export const reminders = mysqlTable("reminders", {
  id: serial("id").primaryKey(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }),
  studentId: bigint("student_id", { mode: "number", unsigned: true }).notNull(),
  kind: mysqlEnum("kind", ["unassessed"]).notNull().default("unassessed"),
  message: varchar("message", { length: 500 }).notNull().default(""),
  audience: mysqlEnum("audience", ["tutor", "admin", "jiaowu"]).notNull().default("admin"),
  audienceUserId: bigint("audience_user_id", { mode: "number", unsigned: true }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Reminder = typeof reminders.$inferSelect;

/** v223 测评中心批量推送记录：管理员组选测评推送给学生，留痕可审计。 */
export const campusAssessPushes = mysqlTable("campus_assess_pushes", {
  id: serial("id").primaryKey(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }),
  kinds: json("kinds").$type<string[]>().notNull(),
  userIds: json("user_ids").$type<number[]>().notNull(),
  userCount: int("user_count").notNull().default(0),
  note: varchar("note", { length: 200 }).notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CampusAssessPush = typeof campusAssessPushes.$inferSelect;
