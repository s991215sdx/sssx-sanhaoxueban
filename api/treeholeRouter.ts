import { z } from "zod";
import { and, desc, eq, gte } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { moodEntries } from "@db/schema";
import { dayStr } from "./helpers";
import { tryChat } from "./ai";

const SYSTEM_PROMPT =
  "你是初中生的知心树洞兼心理指导师。温暖、简短，先共情再给一个今晚就能做的小建议；" +
  "绝不说教、不用命令式语气、不使用医学名词。若内容涉及自伤或严重抑郁信号，" +
  "回复末尾要温和地建议寻求专业帮助并告知家长。回信 80-160 字。";

/** 自伤/严重信号：不走 AI，直接给温和而明确的引导（不编造热线号码）。 */
const CRISIS_RE = /自杀|自残|不想活|伤害自己/;
const CRISIS_REPLY =
  "看到你写下这些字，我很心疼，也很认真地想对你说：现在的难受是真的，" +
  "但它不会一直这样，你也不是一个人。请你今天就做一件事——把刚才这段话" +
  "原样告诉家长、班主任或学校心理老师中的任何一个人，当面说或发消息都可以。" +
  "这不丢人，是你在好好照顾自己。我会一直在这里，随时等你再来聊。";

/** 按心情分档的开场共情句。 */
const OPENINGS: Record<number, string> = {
  1: "听起来今天真的很不好受，谢谢你愿意说出来。",
  2: "今天有点沉甸甸的对吧？愿意讲出来，就已经轻松一点了。",
  3: "不算好也不算坏的一天，也值得被认真听见。",
  4: "能感觉到你今天状态还不错，替你开心。",
  5: "今天的心情很亮堂呀，把这份好心情记下来特别棒。",
};

/** 关键词反射类别：学业 / 人际 / 家庭 / 负荷 / 自控 / 作息 / 萌芽情感，每类备若干小行动。 */
const CATEGORY_RULES: { re: RegExp; reflect: string; actions: string[] }[] = [
  {
    re: /考试|成绩|分数|排名|考砸|没考好/,
    reflect: "考试和分数带来的压力，几乎每个认真的人都会遇到，说明你是真的在乎。",
    actions: [
      "今晚只做一件事：挑一道错题弄懂它，就算把这张卷子的价值拿回来了",
      "在纸上写下「这张卷子里我其实会了什么」，通常比想象的多",
      "睡前把明天最重要的一件小事写下来，只写一件，写完就放下",
    ],
  },
  {
    re: /朋友|同学|孤立|排挤|吵架|不理我/,
    reflect: "和别人相处的不舒服，有时候比做题还累，这种委屈说出来是对的。",
    actions: [
      "今晚先不急着解决，把想对对方说的话写在本子上，写完心里会轻一些",
      "给一个让你舒服的人发条消息，随便聊两句也好",
      "明天试着和其中一个人说一句平常的话，小小的主动就够了",
    ],
  },
  {
    re: /爸|妈|家长|唠叨|父母|家里/,
    reflect: "和最亲的人有摩擦最磨人，他们着急的背后往往是不知道怎么表达关心。",
    actions: [
      "今晚试试只说一件事：「我现在想先安静十分钟」，比憋着或顶回去都管用",
      "把想让爸妈知道的一句话写下来，找个人少的时候递给他们看",
      "先去做一件五分钟能完成的小事，把注意力从情绪里挪出来",
    ],
  },
  {
    re: /作业|写不完|熬夜|太多|任务|做不完/,
    reflect: "任务堆成山的时候，人会先被「做不完」的感觉压垮，而不是被事情本身。",
    actions: [
      "把今晚要做的事全列出来，只做第一件，做完再划掉——山是一块一块搬的",
      "给每件事限个时间，到点就停，没做完也先睡，明天效率会还回来",
      "挑最简单的一项先完成，用一个小勾启动今晚的状态",
    ],
  },
  {
    re: /游戏|手机|刷视频|停不下来|忍不住玩/,
    reflect: "想玩又自责的拉扯很常见，这不是你自制力差，是手机太懂怎么留住人。",
    actions: [
      "今晚把手机放到另一个房间充电，只试这一次，看看作业能快多少",
      "跟自己约定「先学 25 分钟再玩 10 分钟」，用手机闹钟守住这个交换",
      "把最容易点开的那个 App 暂时挪到文件夹第二页，多一步就少打开很多次",
    ],
  },
  {
    re: /睡|困|累|疲惫|没精神|失眠/,
    reflect: "累了不是偷懒，是身体在认真提醒你：该充电了。",
    actions: [
      "今晚比平时早 20 分钟关灯，睡前不碰手机，哪怕只做到这一天也算数",
      "现在去洗把脸或倒杯水，站起来走两圈，困意会退一点",
      "把担心的事写在纸上再睡，大脑确认「记下了」才肯休息",
    ],
  },
  {
    re: /喜欢|恋爱|心动|暗恋|表白/,
    reflect: "这个年纪心里住进一个人，是很自然也很美好的事，不用慌张也不用责怪自己。",
    actions: [
      "把这份心情写进只有你能看到的地方，安放好它，然后先做眼前的事",
      "把「想和 TA 一样优秀」变成今晚多弄懂一道题的动力",
      "先照顾好自己这学期的目标，好的感情经得起等一等",
    ],
  },
];

const DEFAULT_REFLECT = "这些感受没有对错，愿意把它们说出口，你已经在照顾自己了。";
const DEFAULT_ACTIONS = [
  "今晚睡前做三次深呼吸，然后写下一件今天还算顺利的小事",
  "去喝一杯温水，伸个懒腰，给身体一个小小的照顾",
  "把现在脑子里最乱的那件事写下来，写下来就没那么乱了",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 规则引擎兜底：开场共情 → 关键词反射 → 今晚就能做的小行动 → 低落时承诺明天减量。 */
function ruleReply(mood: number, content: string): string {
  const parts: string[] = [OPENINGS[mood] ?? OPENINGS[3]];
  const rule = CATEGORY_RULES.find((r) => r.re.test(content));
  if (rule) {
    parts.push(rule.reflect);
    parts.push(`今晚可以试试：${pick(rule.actions)}。`);
  } else {
    parts.push(DEFAULT_REFLECT);
    parts.push(`今晚可以试试：${pick(DEFAULT_ACTIONS)}。`);
  }
  if (mood <= 2) {
    parts.push("明天的学习计划我会帮你减一点量，先照顾好自己。");
  }
  return parts.join("");
}

/** 把 DB 时间戳对齐为 UTC+8 日期串（与 dashboard 的统计口径一致）。 */
function entryDay(createdAt: Date): string {
  return new Date(createdAt.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export const treeholeRouter = createRouter({
  /** 树洞倾诉：优先 AI 共情回信，失败降级到规则引擎；自伤信号固定走安全回复。 */
  talk: authedQuery
    .input(
      z.object({
        mood: z.number().int().min(1).max(5),
        tags: z.array(z.string().max(16)).max(6),
        content: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      let reply: string;
      if (CRISIS_RE.test(input.content)) {
        reply = CRISIS_REPLY;
      } else {
        const ai = await tryChat([
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `心情评分：${input.mood}/5；标签：${input.tags.join("、") || "无"}；想说的话：${input.content}`,
          },
        ]);
        reply = ai && ai.length > 10 ? ai : ruleReply(input.mood, input.content);
      }
      await db.insert(moodEntries).values({
        userId,
        mood: input.mood,
        tags: input.tags,
        content: input.content,
        reply,
      });
      return { reply };
    }),

  /** 心情记录（倒序，默认 20 条）。 */
  history: authedQuery
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      return db
        .select()
        .from(moodEntries)
        .where(eq(moodEntries.userId, userId))
        .orderBy(desc(moodEntries.createdAt))
        .limit(input?.limit ?? 20);
    }),

  /** 近 7 天每天平均心情（无记录的日期缺省）。 */
  weekMood: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const since = new Date(Date.now() + 8 * 3600 * 1000 - 8 * 86400 * 1000);
    const rows = await db
      .select({ mood: moodEntries.mood, createdAt: moodEntries.createdAt })
      .from(moodEntries)
      .where(and(eq(moodEntries.userId, userId), gte(moodEntries.createdAt, since)));
    const daySet = new Set<string>();
    for (let i = 6; i >= 0; i--) daySet.add(dayStr(-i));
    const agg = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      const day = entryDay(r.createdAt);
      if (!daySet.has(day)) continue;
      const a = agg.get(day) ?? { sum: 0, n: 0 };
      a.sum += r.mood;
      a.n += 1;
      agg.set(day, a);
    }
    return [...daySet]
      .filter((day) => agg.has(day))
      .map((day) => {
        const a = agg.get(day)!;
        return { day, mood: Math.round((a.sum / a.n) * 10) / 10 };
      });
  }),

  /** 今日心情均值与条数（供计划引擎降载判断）。 */
  todayMood: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const since = new Date(Date.now() + 8 * 3600 * 1000 - 2 * 86400 * 1000);
    const rows = await db
      .select({ mood: moodEntries.mood, createdAt: moodEntries.createdAt })
      .from(moodEntries)
      .where(and(eq(moodEntries.userId, userId), gte(moodEntries.createdAt, since)));
    const today = dayStr();
    const todays = rows.filter((r) => entryDay(r.createdAt) === today);
    if (todays.length === 0) return { avg: null, count: 0 };
    const sum = todays.reduce((s, r) => s + r.mood, 0);
    return { avg: Math.round((sum / todays.length) * 10) / 10, count: todays.length };
  }),
});
