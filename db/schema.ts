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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type StudentProfile = typeof studentProfile.$inferSelect;

/** V56：学员-伴学师多对多分配。一个学员可挂多位伴学师（管理员在后台分配）；
 *  student_profile.tutor_id 保留为主管伴学师（= 本表第一条，向后兼容旧逻辑）。 */
export const studentTutor = mysqlTable("student_tutor", {
  id: serial("id").primaryKey(),
  studentUserId: bigint("student_user_id", { mode: "number", unsigned: true }).notNull(),
  tutorUserId: bigint("tutor_user_id", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type StudentTutor = typeof studentTutor.$inferSelect;

export const assessmentResults = mysqlTable("assessment_results", {
  id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().default(0),
  kind: mysqlEnum("kind", ["mbti", "disc", "e3", "e3parent", "multi", "multi5", "anchor", "holland", "mental", "mentalsdq", "mentalpa", "scl90", "discparent"]).notNull(),
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
  role: mysqlEnum("role", ["user", "tutor", "admin"]).default("user").notNull(),
  /** V59 SaaS：所属机构（organizations.id）。null = 平台超管（总系统）。 */
  orgId: bigint("org_id", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
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
