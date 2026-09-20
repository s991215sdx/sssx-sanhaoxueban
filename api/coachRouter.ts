import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, tutorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { studentProfile, users } from "@db/schema";
import { hashPassword } from "./auth-router";
import { ACADEMIC_SUBJECTS, type AcademicsData } from "@contracts/academics";
import { sanitizeModules } from "@contracts/studentModules";
import { getStudentDetail, listStudents } from "./studentDetail";
import { isMyStudent } from "./tutorAccess";
import { tryChat } from "./ai";
import { THREE_TIER_PLANS } from "@/data/training/threeTierPlans";
import { E3V37_ABILITY_TRAINING } from "@/data/training/e3v37Training";
import { METHOD_BY_ID } from "@/data/training/methods";

/** 伴学师工作台：只能看到分配给自己的学员（管理员可看全部）。 */
export const coachRouter = createRouter({
  /** 我名下的学员列表。 */
  myStudents: tutorQuery.query(async ({ ctx }) => {
    const all = await listStudents(getDb());
    if (ctx.user.role === "admin") return all;
    // V56：名下 = 主管伴学师 或 student_tutor 多对多分配
    return all.filter((s) => s.tutorId === ctx.user.id || s.tutorIds.includes(ctx.user.id));
  }),

  /** 学员详情（伴学师仅可查自己名下学员）。 */
  studentDetail: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .query(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      return getStudentDetail(db, input.userId);
    }),

  /** 伴学师代学员填写成绩与目标（校验规则与学生端 profileRouter.saveAcademics 一致）。 */
  saveAcademics: tutorQuery
    .input(
      z.object({
        userId: z.number().int(),
        examName: z.string().max(64).default(""),
        subjects: z
          .array(
            z.object({
              name: z.enum(ACADEMIC_SUBJECTS),
              selfLevel: z.number().int().min(1).max(5).nullable(),
              fullScore: z.number().min(1).max(1500).nullable(),
              lastScore: z.number().min(0).max(1500).nullable(),
              targetScore: z.number().min(0).max(1500).nullable(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      const data: AcademicsData = { examName: input.examName, subjects: input.subjects, updatedAt: Date.now() };
      const value = data as unknown as Record<string, unknown>;
      if (existing) {
        await db.update(studentProfile).set({ academics: value }).where(eq(studentProfile.id, existing.id));
      } else {
        // 目标学员尚无档案记录时也允许创建（仅 admin 会走到这里）
        await db.insert(studentProfile).values({ userId: input.userId, academics: value });
      }
      return { ok: true as const };
    }),

  /** 开启/关闭学员端功能模块（测评中心恒可用；传空数组=恢复全功能）。伴学师只能管自己名下的学员。 */
  /** V53：伴学师/管理员帮学员重置登录密码（重置后为默认密码 123456，学员登录后应自行修改）。伴学师只能重置自己名下的学员。 */
  resetStudentPassword: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      const userRow = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!userRow) throw new Error("学员账号不存在");
      await db.update(users).set({ passwordHash: hashPassword("123456") }).where(eq(users.id, input.userId));
      return { ok: true as const, password: "123456" };
    }),

  /** V54：推送/收回学员报告。released=true 家长可直接查看全部报告；false 由伴学师把关（默认）。伴学师只能操作名下学员。 */
  setReportAccess: tutorQuery
    .input((v: unknown) => v as { userId: number; released: boolean })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      /* V55：推送时清掉「请伴学师推送」请求标记 */
      const releasePatch = input.released ? { reportPushRequestedAt: null } : {};
      if (existing) {
        await db.update(studentProfile).set({ reportReleased: !!input.released, ...releasePatch }).where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId: input.userId, reportReleased: !!input.released, ...releasePatch });
      }
      return { ok: true as const, released: !!input.released };
    }),

  setStudentModules: tutorQuery
    .input((v: unknown) => v as { userId: number; modules: string[] })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      const modules = sanitizeModules(input.modules);
      /* 只存「被关掉的之外、明确开启的」模块；传空数组表示恢复全功能（存 null） */
      const value = modules.length === 0 ? null : modules;
      if (existing) {
        await db.update(studentProfile).set({ enabledModules: value }).where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId: input.userId, enabledModules: value });
      }
      return { ok: true as const, modules: value };
    }),

  /** V57：AI 陪跑问诊——描述孩子近期遇到的问题，AI 结合三阶九能训练方案库给对策。
   *  AI 不可用时降级为规则匹配（按关键词命中能力 → 典型问题 + 简要方案 + 训练方法），功能永不硬失败。 */
  askAdvice: tutorQuery
    .input(
      z.object({
        question: z.string().min(4).max(2000),
        /** 伴学师判断主要相关的能力（九能之一），可空 */
        ability: z.string().max(32).nullable().optional(),
        /** 关联学员（带入诊断上下文，可空） */
        userId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let studentCtx: string | null = null;
      if (input.userId) {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
        const detail = await getStudentDetail(db, input.userId);
        const e3 = detail.assessments.e3 as { version?: string; abilities?: { label: string; score: number; level: string }[] } | undefined;
        const weak =
          e3?.version === "3.7" && e3.abilities
            ? e3.abilities.filter((a) => a.score < 3.8).map((a) => `${a.label} ${a.score}/5（${a.level}）`)
            : [];
        studentCtx = [
          `学员：${detail.profile?.name ?? detail.user.name ?? "未命名"}（${detail.profile?.grade ?? "年级未知"}${detail.profile?.school ? ` · ${detail.profile.school}` : ""}）`,
          e3?.version === "3.7"
            ? `学习力诊断弱项：${weak.join("、") || "无（九能全部 ≥3.8）"}`
            : e3
              ? "学习力诊断为旧版，建议请学员重测 V3.7"
              : "尚未做学习力诊断",
          detail.academics?.subjects?.length
            ? `学业现状与目标：${detail.academics.subjects.map((s) => `${s.name} ${s.lastScore ?? "?"}/${s.targetScore ?? "?"}`).join("、")}`
            : null,
        ].filter(Boolean).join("\n");
      }

      // 三阶九能方案库摘要（喂给 AI，保证口径与训练专栏一致）
      const libSummary = THREE_TIER_PLANS.map((p) => {
        const rx = E3V37_ABILITY_TRAINING[p.ability];
        return `- 【${p.tier}·${p.ability}】典型问题：${p.questions.join("；")}｜简要方案：${rx?.rationale ?? ""}`;
      }).join("\n");

      const sysPrompt = [
        "你是「三好学伴」的伴学教练，帮 K12 伴学师分析孩子近期遇到的学习问题并给出可执行对策。",
        "下面是本校的学习力陪跑训练方案库（三阶九能），你的对策必须与之一致：",
        libSummary,
        "",
        "回答规则：",
        "1. 先一句话判断问题主要对应哪一能（动力/信心/韧劲/学懂/记住/会用/计划/复盘/智学，或状态/关系/资源/注意力等工作记忆等条件学能）；",
        "2. 「现在就能做的三件事」——每件给出具体做法 + 频率 + 预计耗时，优先用方案库中的训练方法思路；",
        "3. 「一周观察点」——列出 2-3 个可观察的行为信号，判断对策是否起效；",
        "4. 「何时升级」——什么情况建议找更专业帮助或调整方案；",
        "5. 语气具体、温和、可操作，不要空话套话；不超过 600 字。",
      ].join("\n");
      const userPrompt = [
        studentCtx,
        input.ability ? `伴学师判断主要相关能力：${input.ability}` : null,
        `孩子近期遇到的问题：\n${input.question}`,
      ].filter(Boolean).join("\n\n");

      const ai = await tryChat(
        [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        { timeoutMs: 45000, maxTokens: 2500 },
      );
      if (ai) return { answer: ai, ai: true as const };

      /* —— AI 不可用：规则兜底 —— */
      const hit = matchAbility(input.question, input.ability ?? null);
      const rx = E3V37_ABILITY_TRAINING[hit.ability];
      const plan = THREE_TIER_PLANS.find((p) => p.ability === hit.ability);
      const methodNames = (rx?.methodIds ?? [])
        .map((id) => METHOD_BY_ID.get(id))
        .filter((m) => m != null)
        .map((m) => `${m.name}（${m.sub}）`)
        .join("、");
      const fallback = [
        `（AI 通道暂不可用，以下为方案库规则匹配结果）`,
        `问题判断：主要对应【${hit.tier}·${hit.ability}】。`,
        plan ? `典型表现：${plan.questions.join("；")}` : null,
        `简要方案：${rx?.rationale ?? "结合学员诊断结果匹配训练方法。"}`,
        methodNames ? `建议训练方法：${methodNames}` : null,
        rx?.note ? `补充约定：${rx.note}` : null,
      ].filter(Boolean).join("\n");
      return { answer: fallback, ai: false as const };
    }),
});

/** 规则兜底：伴学师指定能力优先；否则按关键词命中典型问题。 */
function matchAbility(question: string, prefer: string | null): { tier: string; ability: string } {
  const all = THREE_TIER_PLANS.map((p) => ({ tier: p.tier, ability: p.ability, questions: p.questions }));
  if (prefer) {
    const p = all.find((x) => x.ability === prefer);
    if (p) return { tier: p.tier, ability: p.ability };
  }
  let best: { tier: string; ability: string; score: number } | null = null;
  for (const p of all) {
    let score = 0;
    for (const q of p.questions) {
      for (let len = 4; len >= 2; len--) {
        for (let i = 0; i + len <= q.length; i++) {
          if (question.includes(q.slice(i, i + len))) score += len;
        }
      }
    }
    if (question.includes(p.ability)) score += 6;
    if (!best || score > best.score) best = { tier: p.tier, ability: p.ability, score };
  }
  return best && best.score > 0 ? { tier: best.tier, ability: best.ability } : { tier: "乐学", ability: "动力" };
}
