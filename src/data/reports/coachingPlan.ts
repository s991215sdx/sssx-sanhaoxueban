/**
 * 学习力 1 对 1 陪跑训练方案生成器。
 * 参照《学习力陪跑训练方案》模板结构：画像诊断 → 总体框架 → 优先专题 →
 * 常态化盯办（问·画·讲）→ 每周检查表 → 协同分工 → 储备方法库。
 * 数据来自综合测评（E3 必填，MBTI/DISC/多元智能/学业目标可选），
 * 训练方法取自学习力训练系统 258 法（training/methods.ts）。
 * 纯函数、无副作用。
 */
import type { E3V27Result, MbtiResult, DiscResult } from "@contracts/assessments";
import type { AcademicsData } from "@contracts/academics";
import { calcGaps } from "@contracts/academics";
import type { MultiResult } from "@contracts/multi";
import { MULTI_DIM_LABEL } from "@contracts/multi";
import type { CombinedReport, CombinedSection } from "./types";
import { MBTI_REPORTS_A } from "./mbti-a";
import { MBTI_REPORTS_B } from "./mbti-b";
import { MBTI_REPORTS_C } from "./mbti-c";
import { MBTI_REPORTS_D } from "./mbti-d";
import { DISC_REPORTS } from "./disc";
import { E3V27_ROUTE_TRAINING, E3V27_ABILITY_TRAINING } from "../training/e3v27Training";
import { METHOD_BY_ID, BOARD_LABEL, type TrainingMethod } from "../training/methods";

const MBTI_REPORTS: Record<string, { name: string; headline: string }> = {
  ...MBTI_REPORTS_A,
  ...MBTI_REPORTS_B,
  ...MBTI_REPORTS_C,
  ...MBTI_REPORTS_D,
};

export type CoachingPlanInput = {
  name: string;
  grade: string | null;
  e3: E3V27Result;
  mbti?: MbtiResult | null;
  disc?: DiscResult | null;
  multi?: MultiResult | null;
  academics?: AcademicsData | null;
};

function methodBlock(m: TrainingMethod): string {
  const steps = m.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return (
    `**${m.name}**（${BOARD_LABEL[m.board]} · ${m.sub}）\n` +
    (m.purpose ? `目的：${m.purpose}\n` : "") +
    (steps ? `怎么做：\n${steps}\n` : "") +
    (m.schedule ? `频率：${m.schedule}` : "") +
    (m.tool && m.tool !== "无" ? `\n工具：${m.tool}` : "")
  );
}

export function buildCoachingPlan(input: CoachingPlanInput): CombinedReport {
  const { name, grade, e3, mbti, disc, multi, academics } = input;
  const weakSubs = e3.subscales.filter((n) => n.level !== "正常").sort((a, b) => a.score - b.score);
  const strongSubs = e3.subscales.filter((n) => n.level === "正常").sort((a, b) => b.score - a.score);
  const routes = e3.routes;
  const mbtiReport = mbti ? MBTI_REPORTS[mbti.type] : null;
  const discReport = disc ? DISC_REPORTS[disc.primary] : null;
  const gaps = academics ? calcGaps(academics).filter((g) => g.gap != null) : [];

  const overviewCards = [
    { label: "学员", value: name, note: grade ?? "年级未填" },
    { label: "五维得分", value: e3.dims.map((dd) => dd.score).join(" / "), note: e3.dims.map((dd) => dd.key).join(" · ") + "（满分 5）" },
    { label: "五维定位", value: e3.priority, note: `${routes.length} 条训练路由命中` },
    ...(mbti ? [{ label: "性格类型", value: mbti.type, note: mbtiReport?.name ?? "" }] : []),
    ...(disc ? [{ label: "行为主型", value: `${disc.primary} 型`, note: discReport?.name ?? "" }] : []),
  ];

  /* 一、学生画像与诊断 */
  const secProfile: CombinedSection = {
    title: "一、学生画像与测评诊断",
    items: [
      {
        heading: "**基本情况**",
        text:
          `${name}，${grade ?? "年级未填"}。` +
          (mbti ? `性格类型 ${mbti.type}「${mbtiReport?.name ?? ""}」；` : "") +
          (disc ? `行为主型 ${disc.primary} 型「${discReport?.name ?? ""}」；` : "") +
          (multi ? `优势智能「${MULTI_DIM_LABEL[multi.top3[0]]}」。` : "") +
          (academics?.examName ? `最近大考：${academics.examName}。` : ""),
      },
      {
        heading: "**优势面**（陪跑中的借力点）",
        text:
          strongSubs.length > 0
            ? strongSubs.map((n) => `${n.label}（${n.score}/5）`).join("、") + "——这些观察点状态在线，补弱时从这里借力。"
            : "各观察点都需要建设，从最下面「优先专题」的第一个开始，一次只练一个。",
      },
      {
        heading: "**症结面**（按严重度排序）",
        text:
          weakSubs.length > 0 || routes.length > 0
            ? weakSubs.map((n) => `${n.label}（${n.score}/5 · ${n.level}）`).join("、") +
              `。五维定位「${e3.priority}」。` +
              (routes.length > 0 ? `命中训练路由：${routes.map((r) => r.issue).join("、")}。` : "")
            : "五维与观察点全部正常，进入保持与拔高阶段。",
      },
      ...(gaps.length > 0
        ? [{
            heading: "**学业差距**（最近大考 → 目标）",
            text: gaps
              .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
              .map((g) => `${g.name} ${g.lastScore}→${g.targetScore}（差 ${g.gap} 分）`)
              .join("；") + "。差距最大的科目优先保证每天的学习时间。",
          }]
        : []),
    ],
  };

  /* 二、陪跑总体框架 */
  const secFrame: CombinedSection = {
    title: "二、陪跑总体框架",
    items: [
      {
        heading: "**第 1-2 周** · 优先专题",
        text: routes.length > 0
          ? `主攻「${routes[0].issue}」专题（方案见第三部分），一次只落一个新动作，先恢复「连续」再提质量。`
          : "全部正常：以保持节奏为主，每周回顾一次数据。",
      },
      {
        heading: "**第 3 周起** · 常态化盯办",
        text: "每周 1 对 1 固定盯三件事：① 提问（每日留 1 题 + 问 AI）② 错题（收录 + 写错因 + 重做）③ 讲出来（费曼输出）。详见第四部分。",
      },
      {
        heading: "**每月** · 复盘校准",
        text: "对比两周数据曲线（学习时长、答题量、错题重做对数）；建议每 8 周用同表复测一次 V2.7 诊断，与首测对比写入阶段反馈；达标转维持，未达标从储备方法库换方法组合。",
      },
    ],
    paragraphs: [
      "三条原则贯穿全程：① 先给证据再谈问题——用他自己的进步当起点；② 中断正常化、门槛降到最低；③ 每次陪跑只新增一个动作。",
    ],
  };

  /* 三、优先专题训练（训练路由前 2 条，全量步骤） */
  const topicItems: NonNullable<CombinedSection["items"]> = [];
  for (const r of routes.slice(0, 2)) {
    const rx = E3V27_ROUTE_TRAINING[r.issue];
    const blocks = [`**触发条件**：${r.trigger}`, `**承接动作**：${r.action}`, rx?.rationale ?? ""];
    const methodIds = [...(rx?.methodIds ?? [])];
    if (r.issue === "学习能力偏低") {
      for (const w of e3.weaknesses) {
        if (w.no >= 36 && w.no <= 45) methodIds.push(...(E3V27_ABILITY_TRAINING[w.kp] ?? []));
      }
    }
    const seen = new Set<string>();
    for (const id of methodIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const m = METHOD_BY_ID.get(id);
      if (m) blocks.push(methodBlock(m));
    }
    if (rx?.note) blocks.push(`**补充约定**：${rx.note}`);
    topicItems.push({
      heading: `专题：${r.issue} → ${r.action}`,
      level: "卡点",
      text: blocks.filter(Boolean).join("\n\n"),
    });
  }
  const secTopic: CombinedSection | null =
    topicItems.length > 0
      ? {
          title: "三、优先专题训练方案（第 1-2 周主攻）",
          paragraphs: ["每个专题配了若干训练方法（《学习力训练系统》），**按顺序启用**，第一个做到位了再开第二个。"],
          items: topicItems,
        }
      : null;

  /* 四、常态化盯办三要点（问 · 错 · 讲，落到 App 功能） */
  const secRoutine: CombinedSection = {
    title: "四、常态化盯办三要点（问 · 错 · 讲）",
    items: [
      {
        heading: "**要点一：提问** · 每天留 1 题 + 问 AI",
        text: "① 每天学习结束前留 1 道没搞懂的题（写不出也行，留空算赢）；② 在 App 首页「全能伴学入口」把题拍给或说给 AI 听；③ 追问话术固定：「请用苏格拉底式引导我，不要直接给答案，一个一个问」。",
      },
      {
        heading: "**要点二：错题** · 收录 + 错因 + 重做",
        text: "① 当天错题当天拍照收进 App 错题本（AI 自动识别知识点与错因，孩子只需核对）；② 每道写一行错因；③ 按系统安排的 1/3/7/15/30 天间隔重做，做对就翻篇——错题本越用越薄。",
      },
      {
        heading: "**要点三：讲出来** · 费曼输出",
        text: "① 每预习完一个知识点，在 App 里完成「讲给 AI 听」；② 每周面谈现场抽讲一个知识点，卡住处标记，转成下周题单；③ 讲不通的地方就是明天要问 AI 的题。",
      },
    ],
  };

  /* 五、每周检查表 */
  const secCheck: CombinedSection = {
    title: "五、每周检查表（面谈时填写）",
    items: [
      { heading: "每日留题", text: "本周留题 ≥ 5 天（留空也算）＿＿＿＿ 天" },
      { heading: "问 AI", text: "全能入口或苏格拉底对话记录 ≥ 5 条＿＿＿＿ 条" },
      { heading: "错题收录", text: "新收录 ≥ 5 道，每道有错因＿＿＿＿ 道" },
      { heading: "错题重做", text: "到期复习完成率 ≥ 80%＿＿＿＿ %" },
      { heading: "费曼讲题", text: "完成「讲给 AI 听」≥ 2 个知识点＿＿＿＿ 个" },
      { heading: "学习数据", text: "App 答题数 / 预习完成数环比上升或持平＿＿＿＿" },
    ],
  };

  /* 六、协同分工 */
  const secTeam: CombinedSection = {
    title: "六、老师端与家庭端协同",
    items: [
      {
        heading: "**伴学师**",
        text: "每周 1 次 1 对 1；定方向、教方法；数据点评只「看见式」陈述事实，不评价对错；做得好的当场具体表扬行为，不表扬「人」。",
      },
      {
        heading: "**家长**",
        text:
          (discReport ? `孩子是 ${disc!.primary} 型「${discReport.name}」：${discReport.communicationTips[0]}。` : "") +
          "只鼓励不唠叨；看到 App 里的打卡和错题记录时，当天发一句具体表扬（「今天你自己整理了错题，厉害」）；避免拿分数和别人家孩子比较。",
      },
      {
        heading: "**学员本人**",
        text: "三个日常动作：留题、收错题、讲出来；情绪有波动可去 App「树洞」说说话；目标卡放文具袋。",
      },
    ],
  };

  /* 七、储备方法库（其余命中路由，按需启用） */
  const reserveItems: NonNullable<CombinedSection["items"]> = [];
  for (const r of routes.slice(2)) {
    const rx = E3V27_ROUTE_TRAINING[r.issue];
    const names = (rx?.methodIds ?? [])
      .map((id) => METHOD_BY_ID.get(id))
      .filter((m): m is TrainingMethod => m != null)
      .map((m) => `${m.name}（${BOARD_LABEL[m.board]}）`)
      .join("、");
    reserveItems.push({
      heading: `${r.issue} → ${r.action}`,
      text: (names ? `${names}。` : "") + (rx?.rationale ?? ""),
    });
  }
  const secReserve: CombinedSection | null =
    reserveItems.length > 0
      ? {
          title: "七、储备方法库（按需启用，一次只加一个）",
          items: reserveItems,
        }
      : null;

  const sections: CombinedSection[] = [secProfile, secFrame];
  if (secTopic) sections.push(secTopic);
  sections.push(secRoutine, secCheck, secTeam);
  if (secReserve) sections.push(secReserve);

  return {
    title: `${name} · 学习力 1 对 1 陪跑训练方案`,
    subtitle: `依据综合测评结果编制 · ${new Date().toLocaleDateString("zh-CN")}`,
    overviewCards,
    sections,
  };
}
