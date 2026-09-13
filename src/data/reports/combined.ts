/**
 * 「MBTI + DISC + E3 三阶九能」综合学习力分析报告生成器（V3.7 内容层）。
 *
 * V3.7：E3 学业诊断由「五维 V2.7」重构为「三阶九能 V3.7」（乐学/会学/善学三阶 ×
 * 每阶三能，共九能，外加条件系统三格与学能三项）；多元智能八维（主观自评）已从系统
 * 删除，仅保留多元智能五项（客观题）。新增家长卷（e3parent）与亲子 DISC 对照
 * （discParents）。
 *
 * 纯函数、无副作用：MBTI/DISC 学生本的类型详细文案通过参数传入（由调用方查表）；
 * 亲子 DISC 对照需要家长型的沟通建议，故引入 DISC_REPORTS（disc.ts 不依赖本文件，
 * 无循环依赖）。
 *
 * 章节 level 口径：≥3.8 正常（绿）/ ≥3.0 待提升（黄）/ <3.0 卡点（红）。
 * 口吻：正文用「你」（对学生），仅「给家长的话」一章用「孩子」。
 */

import type {
  DiscType,
  MbtiResult,
  DiscResult,
} from "@contracts/assessments";
import type { E3V37Result } from "@contracts/e3v37";
import type { E3V37ParentResult } from "@contracts/e3v37Parent";
import type { AcademicsData } from "@contracts/academics";
import { calcGaps, summarizeGaps } from "@contracts/academics";
import type { AnchorResult, AnchorKey } from "@contracts/careerAnchor";
import { ANCHOR_LABEL, ANCHOR_ORDER, buildAnchorReport } from "@contracts/careerAnchor";
import type { Multi5Result } from "@contracts/multi5";
import { buildMulti5Report, MULTI5_DIM_LABEL } from "@contracts/multi5";
import type { HollandResult } from "@contracts/holland";
import { HOLLAND_LABEL, buildHollandReport } from "@contracts/holland";
import type { MentalResult, MentalV2Result, MentalV2Band } from "@contracts/mentalHealth";
import { MENTAL_FACTOR_LABEL, isMentalV2 } from "@contracts/mentalHealth";
import type {
  CombinedReport,
  CombinedSection,
  CombinedLevel,
  CombinedOverviewCard,
  MbtiTypeReport,
  DiscTypeReport,
} from "./types";
import { DISC_REPORTS } from "./disc";

type TfPole = "T" | "F";

/** level → 红黄绿着色。 */
const LEVEL_TONE: Record<CombinedLevel, "green" | "amber" | "red"> = {
  正常: "green",
  待提升: "amber",
  卡点: "red",
};

/* ------------------------- 三阶九能：训练方向与优先级链 ------------------------- */

/** 九能 + 条件三格的一句话训练方向（按 label 索引；条件格 label 形如「条件·状态」）。 */
const E3V37_ABILITY_TIP: Record<string, string> = {
  动力: "每天记录一个「小胜利」，并把学习和你在乎的目标连起来——先解决「为什么学」，再谈怎么学",
  信心: "建一个「成就储蓄罐」：挑明显低于当前水平的内容连续拿几次满分，把「我能行」的证据攒回来",
  韧劲: "练「情绪暂停」——受挫先离开现场 3 分钟再回来；考砸当天只做逐题归因，不做自我否定",
  学懂: "课前 5 分钟预习、带一个问题去听课，不懂当天问掉——问题不过夜",
  记住: "学完一课先提炼 3 个关键词，再画一张结构图，最后合上书用自己的话复述一遍",
  会用: "错题三件套：当天写清错因（粗心/不会/概念不清）、三天后重做、同类题不再错才放过",
  计划: "把大目标拆成每周 3 件小事，每天列清单、完成打勾，先求「完成」再求「完美」",
  复盘: "每周一次三行复盘（哪里卡住、为什么、下周换什么做法）；考后固定做试卷分析三件事",
  智学: "AI 提问三步——把问题说清楚、追问一个细节、核对答案；作业先独立完成，再用 AI 查漏补缺",
  "条件·状态": "先稳睡眠与情绪：固定入睡时间、每天运动 20 分钟；状态稳了再谈学习效率",
  "条件·关系": "先修关系再谈学习：与家人约定「谈学习前先谈感受」，师生/同伴困扰主动向信任的大人求助",
  "条件·资源": "整理一个固定、安静的学习位，手机学习时定时隔离，把可自由支配的时间留出来",
  "学能·注意力": "每天 5 分钟舒尔特方格 + 学习时手机放另一个房间；先保睡眠，注意力最先被熬夜拖垮",
  "学能·工作记忆": "练「听记复述」（听一段音频后讲出要点）；做题把已知条件逐条写在草稿纸上，给大脑减负",
  "学能·加工速度": "每天 3 分钟限时口算/单词快扫；作业限时完成，考场先通览全卷、卡壳题果断跳过",
};

/**
 * 九能 + 条件三格 + 学能三项的「详细报告文字」素材表（V33.2，共 15 项）。
 * intro：这一能/格/项是什么、影响学习的哪个方面（2-3 句）；
 * tips：3-5 条具体可执行做法（拼装时按得分强弱差异化：卡点给补弱方案、正常给保持建议）。
 */
const E3V37_ABILITY_DETAIL: Record<string, { intro: string; tips: string[] }> = {
  动力: {
    intro:
      "动力是学习这台车的**发动机**，回答「我为什么而学」。它决定你愿不愿意主动坐下、能不能在没有催促时也能开始；动力不足时，方法再好也带不动。它由兴趣、目标感与内驱/外驱结构共同构成。",
    tips: [
      "每天睡前写一条「今天的小胜利」（弄懂一个知识点也算），攒「我在进步」的证据",
      "把学习和你在乎的事连起来：想考的学校、想做的工作，写成一句话贴在书桌前",
      "从最有兴趣的科目入手启动一天的学习，用「喜欢」带动「应该」",
      "减少用奖励/惩罚驱动：把「考好就给你买」换成「这周你比上周多搞定了什么」",
      "设一个「两周能看见」的近目标（如数学周测多对 2 题），近目标比远目标更点火",
    ],
  },
  信心: {
    intro:
      "信心（自我效能感）是你心里那句「**我能行**」。它影响你敢不敢挑战难题、考砸后能不能快速回弹；信心低的孩子不是不会，是不敢——遇到稍难的题先认定「我不会」，成绩自然被压住。",
    tips: [
      "建「成就储蓄罐」：连续几天挑明显低于当前水平的题做全对，把成功体验攒回来",
      "把「我不会」改写成「我暂时还没会」，并把不会的点写成一个具体问题",
      "每周回顾一次错题本：看看上个月不会的题现在会了多少，信心来自看得见的证据",
      "大考前不刷难题，刷「稳拿分」的中档题，用正确率稳住心态",
    ],
  },
  韧劲: {
    intro:
      "韧劲是受挫后的**回弹力**：考砸、被批评、卡壳之后，能不能继续学下去。它决定成绩的「下限稳定性」——韧劲弱时，一次失误可能带崩一整周的状态。",
    tips: [
      "练「情绪暂停」：受挫先离开现场 3 分钟（喝水、走动），情绪降了再回来做题",
      "考砸当天只做逐题归因（粗心/不会/概念不清），不做任何自我否定",
      "约定「24 小时重启仪式」：任何考砸 24 小时内必须完成复盘并重新开始正常学习",
      "每天运动 20 分钟或睡前做 3 次深呼吸，身体的稳定会带动情绪的稳定",
    ],
  },
  学懂: {
    intro:
      "学懂是课堂的**输入效率**——同样的 40 分钟，有人听懂八成、有人只进两成。它决定你课后要花几倍时间补课；预习、带着问题听课、当天清疑问是它的三个支点。",
    tips: [
      "课前 5 分钟翻一遍新课：只标「哪里看不懂」，带着 1-2 个问题去听课",
      "听课时优先听懂而不是记全：例题听懂思路，笔记课后补",
      "当天疑问当天清：课间问同学、问老师，或记下来晚上问 AI 学伴——问题不过夜",
      "听不懂时先回到上一节：多数听不懂是前置知识欠账，补前置比硬扛有效",
    ],
  },
  记住: {
    intro:
      "记住是把知识**搬进长期记忆**的功夫。听课懂不等于记得住——遗忘曲线决定了不主动加工的内容一周只剩两成；结构化整理和复述输出是对抗遗忘最有效的两个动作。",
    tips: [
      "学完一课先提炼 3 个关键词，再画一张结构图（思维导图/知识树都行）",
      "合上书用自己的话复述一遍，说不出来的地方就是没记住的地方",
      "按「当天→3 天后→1 周后」的节奏复习同一内容，比一次性死记硬背省一半时间",
      "睡前 10 分钟过一遍当天要点：睡眠是记忆的固化剂",
    ],
  },
  会用: {
    intro:
      "会用是**输出与迁移**——把学会的知识在题目和考场上用出来。很多人「听得懂、不会做」，缺口就在这里；错题管理与同类题迁移是它最核心的训练。",
    tips: [
      "错题三件套：当天写清错因（粗心/不会/概念不清）、三天后重做、同类题不再错才放过",
      "每道错题多问一句「这题在考哪个知识点」，把题目和知识挂回钩",
      "做完一类题总结一句「这类题的入手套路」，写在错题本首页",
      "每周做一次「讲题输出」：把一道典型题讲给同学或家长听，讲明白才算真会",
    ],
  },
  计划: {
    intro:
      "计划是学习的**导航系统**：目标拆成任务、任务排进时间。没有计划的学习靠心情驱动，忙的时候乱、闲的时候空；它直接决定你的时间利用率和弱科能不能被照顾到。",
    tips: [
      "把大目标拆成每周 3 件小事（如「本周数学函数错题清零」），小到今天就能动手",
      "每天列任务清单、完成打勾，先求「完成」再求「完美」",
      "给弱科固定「保底时段」（如每天晚饭后 20 分钟），不被作业挤占",
      "用番茄钟或限时闹钟兜底：25 分钟专注 + 5 分钟休息，比熬时间高效得多",
      "周日晚花 10 分钟排下周计划，并回看上周完成了几条",
    ],
  },
  复盘: {
    intro:
      "复盘是**元认知能力**——跳出来看自己的学习哪里有效、哪里空转。它是「同样的努力产生更大进步」的杠杆；不会复盘的人，同样的坑会踩很多次。",
    tips: [
      "每周一次三行复盘：哪里卡住了、为什么、下周换什么做法",
      "考后固定做试卷分析三件事：感谢自己拿到的分、感谢暴露的漏洞、把丢掉的分重新学一遍",
      "把错题按错因归类（粗心/不会/概念不清），错因集中在哪里，下周就练哪里",
      "复盘只定「一个」要改变的动作，多了执行不了",
      "每月回看一次分数趋势和错题本厚度，让进步可见",
    ],
  },
  智学: {
    intro:
      "智学是**用 AI 学习的能力**：会不会提问、追问、核验答案。AI 用得好是私人教练，用不好是抄答案机器——差距全在使用方法；它正在成为学习效率的新分水岭。",
    tips: [
      "AI 提问三步：把问题说清楚（年级+科目+具体卡点）、追问一个细节、核对答案是否合理",
      "作业先独立完成，再用 AI 查漏补缺——顺序反了，AI 就成了替你学习的机器",
      "让 AI 出「同类变式题」自测，而不是只要现成答案",
      "每周让 AI 按你的弱项出一次小练习，并对照课本核对其中的错误",
    ],
  },
  "条件·状态": {
    intro:
      "状态格是学习的「**电量**」：睡眠、饮食、运动与情绪精力。电量不足时，注意力和记忆力全面打折，任何方法都事倍功半；它是条件系统里最基础的一格。",
    tips: [
      "固定入睡时间，睡前半小时不碰手机；睡够觉比多刷题更提分",
      "每天运动 20 分钟（跳绳、快走都行），是性价比最高的状态调节剂",
      "情绪上头时先「暂停 3 分钟」再学习；连续低落超过两周，一定告诉家长或老师",
      "早餐吃好、白天多喝水，身体状态是注意力的物质基础",
    ],
  },
  "条件·关系": {
    intro:
      "关系格是学习的「**氛围组**」：家里谈学习的方式、师生与同伴关系。关系紧张时，大量精力被情绪消耗，根本轮不到学习；关系顺畅时，支持和督促才能真正进得去。",
    tips: [
      "与家人约定「谈学习前先谈感受」：先被理解，建议才听得进",
      "师生/同伴困扰主动向信任的大人求助，不独自硬扛",
      "每周和家里有一次「不谈学习」的闲聊时间，关系需要存款",
      "和老师沟通从具体问题入手（「这类题我哪里想错了」），比泛泛地问效果好",
    ],
  },
  "条件·资源": {
    intro:
      "资源格是学习的「**装备栏**」：固定的学习位置、顺手的工具、可支配的时间与家庭/学校支持。装备不齐时，学习总被环境和手机打断，效率在不知不觉间漏掉。",
    tips: [
      "整理一个固定、安静的学习位，桌上只放当前这一科的东西",
      "手机学习时开专注模式或定时隔离，消息提醒是最大的时间黑洞",
      "把可自由支配的时间写进计划（哪怕每天只有 40 分钟），有支配感才有主动性",
      "需要的资料/教辅一次性备齐放在手边，别在学习中频繁起身找东西",
    ],
  },
  "学能·注意力": {
    intro:
      "注意力是所有学习的**入口闸门**——听课、做题的第一步都是「把注意力放上去」。它反映当前持续专注的加工效率，不是智力，睡眠、状态和刻意练习都能明显提升它。",
    tips: [
      "每天 5 分钟舒尔特方格（5×5 数字格按顺序点读），坚持 3 个月见效",
      "学习时桌面只留当前任务，手机放到另一个房间",
      "用「25 分钟专注 + 5 分钟休息」的番茄节奏代替长时间硬扛",
      "睡不够时注意力最先崩：先保睡眠，再谈练习",
    ],
  },
  "学能·工作记忆": {
    intro:
      "工作记忆是大脑的「**临时工作台**」：听课时同时记住条件、步骤和结论，靠的就是它。它偏小时，听课容易「听了后句忘前句」、做题丢条件；它同样可练，与智力高低无关。",
    tips: [
      "练「听记复述」：听一段话（新闻/课文音频）后合上讲出要点，每天 5 分钟",
      "听课时动手记关键词，把「脑内记」分一部分给「纸上记」",
      "做题时把已知条件逐条标在草稿纸上，给工作记忆减负",
      "复杂内容拆小块学：一次只装 3-4 个要点，装多了会整体崩",
    ],
  },
  "学能·加工速度": {
    intro:
      "加工速度是大脑的「**运转速率**」：读题、提取知识、书写的快慢。它决定考场上「会做的题来不来得及做完」；速度慢不是笨，多是熟练度与状态问题，限时训练最有效。",
    tips: [
      "每天 3 分钟限时口算/单词快扫，给大脑做「提速热身」",
      "作业限时完成：给每科作业定一个合理时限，制造轻度时间压力",
      "考场时间分配策略：开卷先通览、一题卡 5 分钟就跳过，把速度用在会做的题上",
      "书写工整但不求漂亮，避免在卷面上过度耗时",
    ],
  },
};

/** 模块章「详细报告文字」折叠里，单个能/格/项的三层结构文案：①介绍 ②数据分析 ③详细建议。 */
function abilityDetailText(opts: {
  detailKey: string;
  name: string;
  score: number;
  level: string;
  focuses?: { kp: string; score: number; level: string; items: number[] }[];
  extraData?: string;
}): string {
  const d = E3V37_ABILITY_DETAIL[opts.detailKey];
  const intro = d?.intro ?? "";
  const tips = d?.tips ?? [];
  /* ② 数据分析：实际得分、判定等级、最需留意的关注点及题号 */
  const dataParts: string[] = [`本次测评「**${opts.name}**」得分 **${opts.score}/5 · ${opts.level}**`];
  if (opts.focuses && opts.focuses.length > 0) {
    dataParts.push(`关注点明细：${opts.focuses.map((f) => `「${f.kp}」${f.score}/5（${f.level}）`).join("、")}`);
    const weakest = [...opts.focuses].sort((x, y) => x.score - y.score)[0];
    dataParts.push(
      weakest.level === "正常"
        ? `各关注点均在正常线上，相对最弱的是「${weakest.kp}」${weakest.score}/5（第 ${weakest.items.join("、")} 题），可作为下一个微调点。`
        : `最需留意的关注点：「**${weakest.kp}**」${weakest.score}/5（${weakest.level}，第 ${weakest.items.join("、")} 题）。`,
    );
  }
  if (opts.extraData) dataParts.push(opts.extraData);
  /* ③ 详细建议：按强弱差异化——卡点给补弱方案、待提升给巩固方案、正常给保持建议 */
  const adviceKind =
    opts.level === "卡点"
      ? "补弱方案（按顺序做，先完成前两条再往下走）"
      : opts.level === "待提升"
        ? "巩固提升（已有基础，重点是把动作做稳定）"
        : "保持建议（这一项在正常线上，维持节奏即可）";
  return (
    `**① 这是什么**：${intro}\n` +
    `**② 数据分析**：${dataParts.join("；")}。\n` +
    `**③ 详细建议 · ${adviceKind}**：\n` +
    tips.map((t, i) => `${i + 1}. ${t}`).join("\n")
  );
}

/** 主卡点优先级链文案（V33.2 末位统一为「学能」，与报告五层结构 乐学/会学/善学/条件/学能 对齐）。 */
const E3V37_CHAIN_TEXT = "条件 → 乐学 → 会学 → 善学 → 学能";

/** 系统 key → 展示名（V33.2 命名统一：会学=行为系统、善学=加速系统；契约层 label 仍为旧称，报告层映射）。 */
const E3V37_SYS_DISPLAY: Record<string, string> = {
  乐学: "乐学（动力系统）",
  会学: "会学（行为系统）",
  善学: "善学（加速系统）",
};
function sysDisplay(sys: { key: string; label: string }): string {
  return E3V37_SYS_DISPLAY[sys.key] ?? sys.label;
}

/** 心理 V2 分级 → 章节红黄绿 level。 */
function mentalV2LevelToCombined(level: MentalV2Band): CombinedLevel {
  return level === "良好" ? "正常" : level === "关注" ? "待提升" : "卡点";
}

/** 主卡点优先级链：条件 → 乐学 → 会学 → 善学 → 学能（干预方向说明；与契约 E3V37_MAIN_BLOCK_CHAIN 对齐）。 */
const E3V37_CHAIN_INTERVENE: Record<string, string> = {
  条件: "重点是**稳地基**：先处理睡眠、情绪、关系与手机——条件不稳，一切方法都打折扣",
  乐学: "重点是**点燃与唤醒**：稳定情绪、提升学习兴趣、建立目标感与远大志向",
  会学: "重点是**跑顺日常闭环**：预习、带问题听课、作业独立限时、错题管理",
  善学: "重点是**策略与元认知**：目标拆解、考后复盘，并善用 AI 学习等高效工具",
  学能: "重点是**补加工效率**：注意力/工作记忆/加工速度专项训练（舒尔特方格、听记复述、限时口算），每周 3 次、坚持 3 个月",
};

/* ------------------------- 校园场景整合辅助 ------------------------- */

function findScene(scenes: { scene: string; text: string }[], keyword: string): string {
  return scenes.find((s) => s.scene.includes(keyword))?.text ?? "";
}

function mergeScene(mbtiText: string, discText: string, fallback: string): string {
  const parts = [mbtiText.trim(), discText.trim()].filter((t) => t.length > 0);
  return parts.length > 0 ? parts.join("\n") : fallback;
}

/* ------------------------- 性格 × 行为 → 学习力影响 ------------------------- */

/** DISC 四型的动物形象（家长沟通时常用的比喻）。 */
export const DISC_ANIMAL: Record<DiscType, string> = {
  D: "老虎（支配型）",
  I: "孔雀（影响型）",
  S: "考拉（稳定型）",
  C: "猫头鹰（谨慎型）",
};

/** 每种 DISC 主型对学习的典型影响（家长可读版）。 */
const DISC_LEARN_IMPACT: Record<DiscType, string> = {
  D: "**老虎型**的孩子目标感强、好胜、行动快：敢给自己定高目标，遇到难题不服输，竞赛和冲刺类任务最来劲。学习上常见的坑是「**快**」——审题快、检查少，会做的题也因粗心丢分；对背诵、整理错题这类「慢功夫」耐心不足，需要把「快」换成「**快而稳**」。",
  I: "**孔雀型**的孩子热情、爱表达、在人群中有能量：课堂参与度高，**讲题输出**是他们最强的学习方式。但学习容易「**以自我感受为中心**」：喜欢被关注、在乎别人评价，感兴趣的科目效率惊人、不感兴趣的能拖就拖；计划性和时间管理普遍偏弱，学习的账常常凭感觉而不是凭清单。",
  S: "**考拉型**的孩子温和、听话、配合度高：学习态度端正，老师布置的任务不折不扣完成，是让家长省心的类型。短板是「**主动性**」——习惯跟随，很少主动加码，遇到难题倾向于等讲解而不是自己先钻；需要外界给明确的目标和节奏，一旦目标具体，他们的**坚持力**反而是四型里最强的。",
  C: "**猫头鹰型**的孩子严谨、细致、追求完美：作业工整、正确率高、基础知识扎实，理科尤其容易出彩。常见的坑是「**慢**」——做题反复检查、起步偏慢，考场时间分配是软肋；对错误和批评敏感，一次考砸容易**内耗**好几天，需要大人帮忙把「完美」调成「完成优先」。",
};

/** J/P（计划性）对学习力影响的修饰句。 */
const JP_IMPACT: Record<"J" | "P", string> = {
  J: "MBTI 里带 **J（有计划）**，自律是你的放大器：定了的计划大概率能执行，上面这些行为特质更容易变成**稳定的好成绩**——你通常不需要人催，只需要有人帮你定对目标。",
  P: "MBTI 里带 **P（灵活随性）**，计划性是需要外力补的短板：学习节奏容易跟着兴趣和状态走，兴趣来了效率惊人、没兴趣就拖到截止前。建议用**外部节奏**兜底——固定作业清单、限时闹钟、每周复盘，比催你「自觉」有效得多。",
};

/** T/F（决策方式）对学习状态影响的修饰句。 */
const TF_IMPACT: Record<"T" | "F", string> = {
  T: "你偏 **T（理性）**：对事不对人，批评说得对你就改、改得很快；沟通时直接摆事实讲道理最有效，不太会因为语气受伤。",
  F: "你偏 **F（感性）**：很在乎关系和别人的评价——老师的一句鼓励能让你马力十足，一句当众的批评也可能让你蔫好几天。你的学习状态和**师生关系、家庭氛围**强相关，先照顾好感受，再谈道理。",
};

/** 每个 DISC 主型对应重点印证的两个九能（V3.7 ability key）。 */
const DISC_E3_ECHO: Record<DiscType, [string, string]> = {
  D: ["plan", "review"],
  I: ["apply", "review"],
  S: ["drive", "plan"],
  C: ["review", "understand"],
};

/** MBTI 八个字母的含义（逐项解读用）。 */
const MBTI_POLE_MEANING: Record<string, string> = {
  E: "外向——在互动中充电，喜欢表达自己、边说边想",
  I: "内向——在独处中充电，先想清楚再开口，独立思考更深",
  S: "务实——重细节和实例，例题先行、步骤扎实",
  N: "畅想——重原理和想象，举一反三，但容易跳步",
  T: "理性——对事不对人，讲逻辑，被指出问题改得快",
  F: "感性——重关系和他人的评价，被鼓励时状态最好",
  J: "有计划——自律、按清单推进，执行稳定",
  P: "灵活——随性应变、兴趣驱动，计划性偏弱",
};

/** DISC 主因子判定：最高分必选；与最高分差距 ≤1 分的因子一并纳入（最多 3 个，如 DI 型、ISC 型）。 */
export function getDiscCombo(dims: Record<DiscType, number>): DiscType[] {
  const sorted = (Object.entries(dims) as [DiscType, number][]).sort((a, b) => b[1] - a[1]);
  const top = sorted[0][1];
  return sorted
    .filter(([, v]) => top - v <= 1)
    .map(([k]) => k)
    .slice(0, 3);
}

/** 组合型（2-3 个主因子分值接近）的融合分析。 */
export function buildDiscComboBlend(combo: DiscType[]): string {
  if (combo.length <= 1) return "";
  const names = combo.map((k) => `${k}（${DISC_ANIMAL[k].split("（")[0]}）`).join(" + ");
  const traits = combo.map((k) => DISC_FACTOR_MEANING[k].high).join("；");
  return (
    `你的高分因子有 ${combo.length} 个且非常接近，属于 **${combo.join("")} 混合型**（${names}）：${traits}。` +
    `组合型意味着你会**按场景切换模式**——${combo.length === 2 ? "两" : "三"}副面孔都是真实的你：面对挑战时一副、与人相处时一副。关键不是「改掉哪一面」，而是学会**在对的场景调用对的一面**。`
  );
}

/** DISC 单因子的高分/低分含义（逐项解读用）。 */
const DISC_FACTOR_MEANING: Record<DiscType, { high: string; low: string }> = {
  D: {
    high: "爱冒险、勇敢、目标感强、好胜——敢定高目标，遇到挑战不退缩",
    low: "不争不抢、配合度高，但目标感需要外界帮忙点燃",
  },
  I: {
    high: "热情、爱表达、喜欢成为人群焦点、在乎别人的评价——讲题输出是强项",
    low: "安静少言、表达欲不强，关注内心多于关注人群",
  },
  S: {
    high: "温和耐心、听话配合、坚持力强——布置的任务不打折",
    low: "求快求变、耐心偏弱，不喜欢一成不变",
  },
  C: {
    high: "严谨细致、追求完美、正确率高——基础扎实",
    low: "灵活、不拘小节，但细节把控和检查习惯偏弱",
  },
};

/* ------------------------- 亲子 DISC 对照素材 ------------------------- */

/** 各主型家长的管教风格倾向与风险。 */
const DISC_PARENT_STYLE: Record<DiscType, string> = {
  D: "目标导向、要求明确、行动快；风险是指令多、节奏快，容易变成催促与命令",
  I: "热情、爱表达、赏罚分明；风险是情绪化、当众说教，表扬和批评都太响亮",
  S: "温和、包容、有耐心；风险是回避冲突、原则不够坚定，容易「说了不算」",
  C: "重规则、重细节、标准高；风险是纠错多、肯定少，孩子容易觉得「怎么做都不够好」",
};

/** 各主型孩子面对管教的典型反应。 */
const DISC_CHILD_REACT: Record<DiscType, string> = {
  D: "吃软不吃硬：被强压会顶撞，给他选择权和挑战目标，反而配合",
  I: "面子薄、在乎评价：当众批评会记很久，公开肯定、私下提醒最有效",
  S: "表面顺从、内心有数：催促会引发拖延式抵抗，明确节奏加温和坚持最管用",
  C: "敏感且内耗：纠错过多会自我否定，先肯定、一次只提一个改进点",
};

/** 家长主型 × 孩子主型的典型冲突点。 */
const DISC_CONFLICT: Record<DiscType, Record<DiscType, string>> = {
  D: {
    D: "两虎相争：都强势、都要赢，管教容易演变成权力对抗——给孩子选择权，目标让他自己定",
    I: "家长重结果、孩子重感受：催促和当众批评最伤孔雀型孩子——先肯定再提要求",
    S: "催促式管教遇上慢性子：孩子表面答应、行动拖延，抵触藏在沉默里——给明确节奏，少吼多陪",
    C: "高要求遇上高敏感：盯错纠错会让孩子更怕错——先肯定做对的部分，一次只提一个改进点",
  },
  I: {
    D: "家长热情多变、孩子目标明确：别用情绪和唠叨压他，直接谈目标和规则更有效",
    I: "两个都情绪化：家里容易热闹也容易吵——批评别当众，约定「冷静三分钟」再沟通",
    S: "家长说得多、孩子听得烦：把长篇说教换成一条具体指令，说完就陪他做第一步",
    C: "家长随性、孩子较真：规则要说到做到，随意改口会让孩子失去安全感",
  },
  S: {
    D: "家长温和退让、孩子主见强：规则一旦退让就收不回，温和而坚定地守住底线",
    I: "家长包容、孩子爱表现：多给孩子展示的舞台，但原则问题不能靠「好好好」带过",
    S: "都回避冲突：家里表面平静、问题容易憋着——每周固定一次「说实话时间」",
    C: "两个都慢热：别急着催改变，给孩子消化的时间，用书面清单代替口头催促",
  },
  C: {
    D: "家长抠细节、孩子冲目标：少纠过程多看结果，把检查标准事先讲清楚",
    I: "家长重规则、孩子重氛围：批评对事更要对场合——私下说、先说优点",
    S: "家长纠错多、孩子配合好：别把孩子的顺从当没意见，多问一句「你自己怎么想」",
    C: "两个都追求完美：家里容易「只对事不对人」——记得先给情绪价值，再谈对错",
  },
};

/* ------------------------- 主函数 ------------------------- */

/** 综合报告可选扩展数据（多元智能八维已下线，仅保留客观五项）。 */
export type CombinedReportOptions = {
  multi5?: Multi5Result;
  anchor?: AnchorResult;
  holland?: HollandResult;
  /** 心理健康：V2（PHQ-9+GAD-7，现行）或旧版 V1 结果（历史数据兼容展示）。 */
  mental?: MentalResult | MentalV2Result;
  academics?: AcademicsData;
  /** E3 V3.7 家长卷结果（选做）。 */
  e3parent?: E3V37ParentResult;
  /** 家长 DISC 测评（label 如「妈妈」「爸爸」），用于亲子对照。 */
  discParents?: { label: string; result: DiscResult }[];
};

export function buildCombinedReport(
  mbti: MbtiResult,
  mbtiReport: MbtiTypeReport,
  disc: DiscResult,
  discReport: DiscTypeReport,
  e3: E3V37Result,
  opts?: CombinedReportOptions,
): CombinedReport {
  const tf = mbti.type.charAt(2) as TfPole;
  const d = disc.primary;
  /** DISC 主因子组合：1-3 个（分值接近的因子都纳入评价，如 DI 型、ISC 型）。 */
  const discCombo = getDiscCombo(disc.dims);
  const discComboLabel = discCombo.join("");
  const discComboAnimals = discCombo.map((k) => DISC_ANIMAL[k].split("（")[0]).join("+");
  const discBlend = buildDiscComboBlend(discCombo);
  const academics = opts?.academics;
  const e3parent = opts?.e3parent;
  const discParents = opts?.discParents ?? [];

  /* 三阶九能速查数据 */
  const abilities = e3.abilities;
  const abilityByKey = new Map(abilities.map((a) => [a.key, a]));
  const strongNine = [...abilities].sort((a, b) => b.score - a.score)[0];
  const coreLine = e3.systems.core.map((s) => `${sysDisplay(s)} ${s.score}/5（${s.level}）`).join(" · ");
  const condCells = e3.systems.condition.cells;
  const condLine = condCells.map((c) => `${c.label} ${c.score}/5（${c.level}）`).join(" · ");
  const weakestCond = [...condCells].sort((a, b) => a.score - b.score)[0];
  /** 学能三项中最弱的一项（优先级链末位节点，与契约 mainBlock 链口径一致）。 */
  const weakestApt = [...e3.aptitude].sort((a, b) => a.score - b.score)[0];
  /** 优先级链节点：条件 → 乐学 → 会学 → 善学 → 学能。 */
  const chainNodes = [
    { node: "条件", label: `条件·${weakestCond.label}`, score: weakestCond.score, level: weakestCond.level, tip: E3V37_ABILITY_TIP[`条件·${weakestCond.label}`] },
    ...e3.systems.core.map((s) => {
      const sys = s.key;
      const weakestInSys = abilities.filter((a) => a.system === sys).sort((a, b) => a.score - b.score)[0];
      return { node: sys, label: sys, score: s.score, level: s.level, tip: weakestInSys ? `先抓「${weakestInSys.label}」：${E3V37_ABILITY_TIP[weakestInSys.label]}` : "" };
    }),
    { node: "学能", label: `学能·${weakestApt.label}`, score: weakestApt.score, level: weakestApt.level, tip: E3V37_ABILITY_TIP[`学能·${weakestApt.label}`] },
  ];
  const priorityText = e3.priorities
    .map((p, i) => `${i + 1}）「${p.label}」${p.score}/5（${p.level}）`)
    .join("；");

  /* 顶部概览卡（九宫格，最多 9 张；做了哪个测评显示哪张，每张带红黄绿 tone） */
  const mbtiScoreText = (["E", "I", "S", "N", "T", "F", "J", "P"] as const)
    .map((k) => `${k}${mbti.dims[k]}`)
    .join(" ");
  const discScoreText = (["D", "I", "S", "C"] as DiscType[])
    .map((k) => `${k}${disc.dims[k]}`)
    .join(" ");
  const overviewCards: CombinedOverviewCard[] = [
    {
      label: "MBTI 性格类型",
      value: `${mbti.type} · ${mbtiReport.name}`,
      note: `${mbtiScoreText}（每组两字母得分高者入选）`,
      tone: "green",
    },
    {
      label: "DISC 行为主型",
      value: `${discComboLabel} 型 · ${discReport.name}${discCombo.length > 1 ? `（${discComboAnimals}）` : ""}`,
      note: `四因子得分：${discScoreText}`,
      tone: "green",
    },
    {
      label: "学业诊断定位",
      value: e3.mainBlock ? `三阶九能 · 主卡点：${e3.mainBlock.label}` : "三阶九能 · 无红灯卡点",
      note: e3.systems.core.map((s) => `${s.key} ${s.score}/5`).join(" · "),
      tone: e3.mainBlock ? "red" : abilities.some((a) => a.level !== "正常") ? "amber" : "green",
    },
  ];
  const multi5 = opts?.multi5;
  if (multi5) {
    overviewCards.push({
      label: "多元智能五项",
      value: `综合 ${multi5.overall} 分`,
      note: `细心指数 ${multi5.carefulIndex}%（全卷正确率）`,
      tone: multi5.carefulIndex < 70 ? "amber" : "green",
    });
  }
  const anchor = opts?.anchor;
  if (anchor) {
    const [a1, a2] = anchor.top2;
    overviewCards.push({
      label: "职业锚",
      value: `${ANCHOR_LABEL[a1]} ${anchor.dims[a1].toFixed(1)} 分`,
      note: `第二锚：${ANCHOR_LABEL[a2]} ${anchor.dims[a2].toFixed(1)} 分（5 分制均分）`,
      tone: "green",
    });
  }
  const holland = opts?.holland;
  if (holland) {
    const h1 = holland.top3[0];
    overviewCards.push({
      label: "霍兰德职业兴趣",
      value: `代码 ${holland.code}`,
      note: `首位 ${HOLLAND_LABEL[h1]} ${holland.dims[h1].toFixed(1)} 分（5 分制均分）`,
      tone: "green",
    });
  }
  const mental = opts?.mental;
  const mentalV2 = mental && isMentalV2(mental) ? mental : null;
  const mentalLegacy = mental && !isMentalV2(mental) ? mental : null;
  if (mentalV2) {
    overviewCards.push({
      label: "心理健康",
      value: `PHQ-9 ${mentalV2.phq9}/27 · GAD-7 ${mentalV2.gad7}/21`,
      note: `分级「${mentalV2.level}」${mentalV2.selfHarm ? " · !!有自伤念头信号，请立即告诉家长/老师或拨打 12356!!" : "（筛查参考，非诊断）"}`,
      tone: mentalV2.level === "高风险" || mentalV2.level === "预警" || mentalV2.selfHarm ? "red" : mentalV2.level === "关注" ? "amber" : "green",
    });
  } else if (mentalLegacy) {
    /* 旧版 V1 结果：量表已升级为 PHQ-9+GAD-7，提示重测 */
    overviewCards.push({
      label: "心理健康",
      value: "量表已升级",
      note: "已升级为 PHQ-9 + GAD-7 专业版（16 题），请到测评中心重新测评",
      tone: "amber",
    });
  }
  const gapSummary = academics ? summarizeGaps(academics) : null;
  if (academics && gapSummary && gapSummary.totalGap != null) {
    overviewCards.push({
      label: "目标总差距",
      value: `${gapSummary.totalGap} 分`,
      note: `${gapSummary.filled} 科：最近 ${gapSummary.lastTotal} 分 → 目标 ${gapSummary.targetTotal} 分`,
      tone: gapSummary.totalGap >= 60 ? "red" : gapSummary.totalGap >= 25 ? "amber" : "green",
    });
  }
  if (e3parent || discParents.length > 0) {
    overviewCards.push({
      label: "家长参与",
      value: [e3parent ? "家长卷已测" : "", discParents.length > 0 ? `家长 DISC ${discParents.length} 人` : ""]
        .filter((t) => t.length > 0)
        .join(" · "),
      note: e3parent
        ? `认知盲区 ${e3parent.blindSpots.length} 项 · 「不了解」${e3parent.unknownCount} 项`
        : "家长已完成行为风格测评",
      tone: e3parent?.severeConflict ? "red" : e3parent && e3parent.blindSpots.length > 0 ? "amber" : "green",
    });
  }

  /* ①. 综合结论与行动方案：现状 → 诊断 → 方案（跨测评归纳，置于全篇最前） */
  const acadGapsAll = academics ? calcGaps(academics) : [];
  const biggestGapSubject = acadGapsAll
    .filter((g) => g.gap != null)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];

  const roadmapStep1 =
    academics && gapSummary && gapSummary.totalGap != null
      ? `${academics.examName || "最近大考"}：总分 ${gapSummary.lastTotal} 分 → 目标 ${gapSummary.targetTotal} 分，**总差距 ${gapSummary.totalGap} 分**（${gapSummary.filled} 科）。三阶九能现状：${coreLine}，${e3.mainBlock ? `主卡点 **${e3.mainBlock.label}**（${e3.mainBlock.score}/5）` : "九能暂无红灯卡点"}。`
      : `三阶九能现状：${coreLine}，${e3.mainBlock ? `主卡点 **${e3.mainBlock.label}**（${e3.mainBlock.score}/5）` : "九能暂无红灯卡点"}。成绩目标：到「我的 → 成绩与目标」填上后，这里会给出差距拆解。`;
  const gapTop3 = acadGapsAll
    .filter((g) => g.gap != null && g.gap > 0)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
    .slice(0, 3)
    .map((g) => `${g.name}（差 ${g.gap} 分）`)
    .join("、");
  const belowIce: string[] = [];
  for (const n of chainNodes) {
    if (n.level !== "正常") belowIce.push(`**!!${n.label} ${n.score}/5（${n.level}）!!**`);
  }
  belowIce.push(`${discComboLabel} 型（${discComboAnimals}）的行为惯性 + ${mbti.type}「${mbtiReport.name}」的性格特质`);
  if (multi5) {
    const w = (Object.entries(multi5.dims) as [keyof typeof multi5.dims, number][]).sort((a, b) => a[1] - b[1])[0];
    if (w && w[1] < 60) belowIce.push(`客观能力短板「${MULTI5_DIM_LABEL[w[0]]}」${w[1]} 分`);
    if (multi5.carefulIndex < 70) belowIce.push(`细心指数 ${multi5.carefulIndex}%`);
  }
  if (mentalV2 && mentalV2.level !== "良好") {
    belowIce.push(
      mentalV2.selfHarm
        ? `**!!心理状态：PHQ-9 ${mentalV2.phq9}/27 · GAD-7 ${mentalV2.gad7}/21（${mentalV2.level}），有自伤念头信号——先求助、先陪伴，成绩目标全部让路!!**`
        : `心理状态：PHQ-9 ${mentalV2.phq9}/27 · GAD-7 ${mentalV2.gad7}/21（${mentalV2.level}，先稳状态再抓学习）`,
    );
  } else if (mentalLegacy && mentalLegacy.positiveFactors.length > 0) {
    belowIce.push(`心理状态：${mentalLegacy.positiveFactors.slice(0, 2).map((f) => MENTAL_FACTOR_LABEL[f]).join("、")}略高（先稳状态再抓学习）`);
  }
  const roadmapStep2 =
    `**冰山上（看得见的）**：${gapTop3 ? `成绩差距最大的是 ${gapTop3}` : "成绩差距待填写后呈现"}。` +
    `**冰山下（看不见的根）**：${belowIce.join("；")}。成绩只是冰山一角，根子在水面下的动力、方法、管理、条件与性格。`;
  const roadmapPlanItems: NonNullable<CombinedSection["items"]> = chainNodes
    .filter((n) => n.level !== "正常")
    .map((n) => ({
      heading: `**优化${n.label}（${n.score}/5 · ${n.level}）**`,
      text: `干预方向：${E3V37_CHAIN_INTERVENE[n.node]}。${n.tip ? `**训练方向**：${n.tip}。` : ""}`,
      level: n.level,
    }));
  if (roadmapPlanItems.length === 0) {
    roadmapPlanItems.push({
      heading: "**三阶九能全部在正常线以上**",
      text: "保持节奏：每周对照九能自查一次，用试卷分析三件事把每次大考吃干榨净，让 AI 学伴陪你把优势继续拉大。",
      level: "正常",
    });
  }
  /* 概要总论：章首两段引导语下沉至此开头，再接主卡点链 + 红线 + 目标差距的收尾总论 */
  const closingSummary: string[] = [
    `你是 ${mbti.type}「${mbtiReport.name}」、DISC ${discComboLabel} 型「${discReport.name}」；三阶九能体检：${coreLine}。`,
    `**优先训练方向（前三优先）**：${priorityText}。这份报告的用法就三步：**第一步**理清现状与目标 → **第二步**用冰山模型找根因 → **第三步**按图索骥拿训练方案，**红色为需要优先干预的层**。`,
    e3.mainBlock
      ? `当前主卡点是「**${e3.mainBlock.label}**」（${e3.mainBlock.score}/5）：按优先级链 **${E3V37_CHAIN_TEXT}**，先把这一环补上来，后面的方法才真正见效。`
      : "三阶九能暂无红灯卡点，现阶段重点是保持节奏、把优势继续拉大。",
    ...(e3.redFlags.length > 0
      ? [`同时请记住：**${e3.redFlags.length} 条红线信号**先于一切学习目标——状态稳了，成绩才跟得上（详见「需要温柔关注的信号」一章）。`]
      : []),
    academics && gapSummary && gapSummary.totalGap != null
      ? `成绩总差距 ${gapSummary.totalGap} 分看着不小，按一学年 4 次大考拆开，每次总分只需多拿约 **${Math.ceil(gapSummary.totalGap / 4)} 分**——目标拆小之后，并没有那么远。`
      : "到「个人中心 · 成绩与目标」填上各科分数后，差距会被拆成一个个可执行的小台阶。",
    "分数是一时的，学习力是一辈子的——按上面的方案一步一步来，变化会比你想的更快发生。",
  ];
  const secConclusion: CombinedSection = {
    title: "综合结论与行动方案：现状 → 诊断 → 方案",
    closing: closingSummary,
    items: [
      { heading: "**第一步 · 理清现状与目标**", text: roadmapStep1 },
      { heading: "**第二步 · 分析问题、痛点与特点（冰山模型）**", text: roadmapStep2 },
      ...roadmapPlanItems.map((it, i) => ({
        ...it,
        heading: `**第三步 · 建议进步方案${roadmapPlanItems.length > 1 ? ` ${i + 1}` : ""}** ${it.heading}`,
      })),
    ],
  };

  /* ②③④. 乐学/会学/善学 三个模块章：各阶一两句总结论；三能的分项介绍不再可见区直出（V36：
     与「详细报告文字」折叠里的逐项详细解读重复，故删除，只保留 detailItems）。 */
  const SYS_MODULE_META: { sys: "乐学" | "会学" | "善学"; title: string; lead: string }[] = [
    { sys: "乐学", title: "乐学模块 · 动力系统", lead: "动力、信心、韧劲是这台学习车的**发动机**——先解决「为什么学」，再谈怎么学。" },
    { sys: "会学", title: "会学模块 · 行为系统", lead: "学懂、记住、会用是每天学习的**闭环动作**——底盘顺了，努力才不白费。" },
    { sys: "善学", title: "善学模块 · 加速系统", lead: "计划、复盘与 AI 智学是**加速器**——让同样的时间产生更大的进步。" },
  ];
  const secModules: CombinedSection[] = SYS_MODULE_META.map((m) => {
    const sysScore = e3.systems.core.find((c) => c.key === m.sys)!;
    const abs = abilities.filter((a) => a.system === m.sys);
    const strong = [...abs].sort((a, b) => b.score - a.score)[0];
    const weak = [...abs].sort((a, b) => a.score - b.score)[0];
    return {
      title: m.title,
      paragraphs: [
        `${m.sys}系统分 **${sysScore.score}/5（${sysScore.level}）**。${m.lead}`,
        `本阶最强「**${strong.label}**」${strong.score}/5，最需关注「**${weak.label}**」${weak.score}/5（${weak.level}）——补弱时可以从「${strong.label}」借力。`,
      ],
      /* 「详细报告文字」折叠：每能三层结构（介绍 → 数据分析 → 详细建议），末尾由页面接答题明细 */
      detailItems: abs.map((a) => ({
        heading: `**${a.label} · 详细解读** ${a.score}/5 · ${a.level}`,
        level: a.level as CombinedLevel,
        text: abilityDetailText({ detailKey: a.label, name: a.label, score: a.score, level: a.level, focuses: a.focuses }),
      })),
    };
  });

  /* ③. MBTI / DISC 自我认知素材卡（作为状态分析素材，并入「条件模块 · 支持系统」章的状态部分） */
  const discDimText = (["D", "I", "S", "C"] as DiscType[])
    .map((k) => `${k} ${disc.dims[k]} 分`)
    .join(" · ");
  const mbtiDimPairs: [string, string][] = [["E", "I"], ["S", "N"], ["T", "F"], ["J", "P"]];
  const mbtiDimText = mbtiDimPairs
    .map(([a, b]) => `${a} ${mbti.dims[a as keyof typeof mbti.dims]} ｜ ${b} ${mbti.dims[b as keyof typeof mbti.dims]}`)
    .join(" · ");
  const mbtiStateCard = {
    heading: `**性格素材 · MBTI** ${mbti.type}「${mbtiReport.name}」`,
    text:
          `得分：${mbtiDimText}。逐项解读（每组两字母谁高取谁）：\n` +
          mbtiDimPairs
            .map(([a, b]) => {
              const va = mbti.dims[a as keyof typeof mbti.dims];
              const vb = mbti.dims[b as keyof typeof mbti.dims];
              const diff = Math.abs(va - vb);
              const winner = va === vb ? null : va > vb ? a : b;
              const strength = winner == null ? "两侧均衡" : diff >= 3 ? `明显偏 **${winner}**` : `略偏 **${winner}**`;
              const meaning = winner ? `：${MBTI_POLE_MEANING[winner]}` : "：两种倾向你都有，看场景切换";
              return `· ${a} ${va} ｜ ${b} ${vb} → ${strength}${meaning}`;
            })
            .join("\n") +
          `\n**优点**：${mbtiReport.studyStrengths[0]}\n` +
          `**!!可能的卡点!!**：${mbtiReport.studyBlindspots[0]}\n` +
          `\n**① 这是什么 · 性格画像**：${mbtiReport.headline}。${mbtiReport.traits.slice(0, 4).join("；")}。\n` +
          `**② 数据分析**：四组偏好得分 ${mbtiDimText}——每组得分高的一极进入你的类型代码 ${mbti.type}；差值越大，该倾向越明显。\n` +
          `**③ 详细建议 · 学习优势这样用**：\n${mbtiReport.studyStrengths.slice(0, 4).map((t) => `· ${t}`).join("\n")}\n` +
          `**需要留意的盲点**：\n${mbtiReport.studyBlindspots.slice(0, 3).map((t) => `· ${t}`).join("\n")}\n` +
          `**发展建议**：\n${mbtiReport.suggestions.map((t) => `· ${t}`).join("\n")}`,
  };
  const discStateCard = {
        heading: `**行为素材 · DISC** ${discComboLabel} 型「${discReport.name}」`,
        text:
          (discBlend ? `${discBlend}\n` : "") +
          `得分：${discDimText}。逐因子解读（按得分从高到低排，越高越明显）：\n` +
          (Object.entries(disc.dims) as [DiscType, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([k, v], i) => {
              const short = DISC_ANIMAL[k].split("（")[0];
              const inCombo = discCombo.includes(k);
              const rank = i === 0 ? "主导，最明显" : inCombo ? "组合成员，同样明显" : i === 3 ? "最弱，不典型" : "不典型";
              const meaning = inCombo ? DISC_FACTOR_MEANING[k].high : DISC_FACTOR_MEANING[k].low;
              return `· **${k}（${short}）${v} 分** · ${rank}：${meaning}`;
            })
            .join("\n") +
          `\n**优点**：${discReport.name}的你，${discReport.keywords.slice(0, 4).join("、")}——这些特质让你在校园里有自己的节奏和位置。\n` +
          `**!!可能的卡点!!**：${discReport.obstacles[0]}\n` +
          `\n**① 这是什么 · 行为画像**：${discReport.headline}。${discReport.overview}\n` +
          `**② 数据分析**：四因子得分 ${discDimText}（单因子满分 12）；主型 ${discComboLabel} 型，即「${discReport.name}」——${discReport.keywords.slice(0, 5).join("、")}。\n` +
          `**③ 详细建议 · 可能阻碍你的行为（逐个自查）**：\n${discReport.obstacles.map((t) => `· ${t}`).join("\n")}\n` +
          `**你需要的支持**（可转给家长/老师）：\n${discReport.supports.slice(0, 4).map((t) => `· ${t}`).join("\n")}\n` +
          `**沟通方式**：${discReport.communicationTips.map((t) => t.replace(/。+$/, "")).join("；")}。`,
  };
  const blendStateCard = {
        heading: `**性格 × 行为 · 这样的你，学习力会怎样被影响**`,
        text: (() => {
          const jpL = mbti.type.charAt(3) as "J" | "P";
          const tfL = mbti.type.charAt(2) as "T" | "F";
          const animal = DISC_ANIMAL[disc.primary];
          const [k1, k2] = DISC_E3_ECHO[disc.primary];
          const n1 = abilityByKey.get(k1);
          const n2 = abilityByKey.get(k2);
          const echo =
            n1 && n2
              ? `这些性格与行为特点，在三阶九能体检里能直接印证：「**${n1.label}**」${n1.score}/5（${n1.level}）、「**${n2.label}**」${n2.score}/5（${n2.level}）。` +
                (n1.level !== "正常" || n2.level !== "正常"
                  ? `**!!分数偏低的能力，正是性格行为倾向最容易「漏分」的地方!!**——不是你不够努力，是天性顺手的方式在这里不占便宜，需要刻意练。`
                  : `这两个相关能力目前都在正常线上，说明孩子已经把性格里的优势用到了学习上，继续保持。`)
              : "";
          return (
            `把性格和行为放在一起看，这类组合对孩子的学习影响其实非常明显：\n` +
            `**性格面**：${mbti.type}「${mbtiReport.name}」（${mbtiReport.tags.slice(0, 4).join("、")}）。\n` +
            `**行为面**：DISC 主型 ${discComboLabel} 型，也就是常说的**${discCombo.length > 1 ? discComboAnimals : animal}**（组合解读见上方 DISC 卡）。\n` +
            `**对学习的影响**：\n` +
            discCombo.map((k) => DISC_LEARN_IMPACT[k]).join("\n") +
            `\n` +
            `${JP_IMPACT[jpL]}\n` +
            `${TF_IMPACT[tfL]}\n` +
            echo
          );
        })(),
  };

  /* ④. 条件模块 · 支持系统（条件三格不进总分，但干预第一优先；并入心理/MBTI/DISC 素材、家长卷对照、亲子 DISC、校园场景卡） */
  /* 心理健康卡（V33.2）：V2 显示 PHQ-9/GAD-7 分数 + 分级解释 + 建议（selfHarm 醒目求助提示）；旧版 V1 给升级重测卡 */
  const mentalCard: NonNullable<CombinedSection["items"]>[number] | null = mentalV2
    ? {
        heading: `**心理健康 · PHQ-9 + GAD-7 专业筛查** 「${mentalV2.level}」${mentalV2.selfHarm ? " · !!有自伤念头信号!!" : ""}`,
        level: mentalV2.selfHarm ? "卡点" : mentalV2LevelToCombined(mentalV2.level),
        text:
          `**② 数据分析**：PHQ-9 抑郁筛查 **${mentalV2.phq9}/27 分 · 「${mentalV2.phq9Level}」**；GAD-7 焦虑筛查 **${mentalV2.gad7}/21 分 · 「${mentalV2.gad7Level}」**；综合分级「**${mentalV2.level}**」（取两表较重者）；得分 ≥2 的题共 ${mentalV2.positives}/16 项。分级口径：0-4 良好 / 5-9 关注 / 10-14 预警 / ≥15 高风险。\n` +
          (mentalV2.selfHarm
            ? `**!!最重要的求助提示!!**：这次筛查中，「有不如死掉或伤害自己的念头」一题不是「完全不会」——请**一定**告诉家长或信任的老师，必要时拨打全国心理援助热线 **12356** 或前往专业心理/医疗机构。这不是矫情，是对自己负责；成绩目标在这件事面前全部让路。\n`
            : "") +
          `**分级解释与建议**：${mentalV2.summary}\n` +
          `（本量表为三甲医院常用筛查工具，结果仅供筛查参考，不构成医学诊断。）`,
      }
    : mentalLegacy
      ? {
          heading: "**心理健康 · 量表已升级，请重新测评**",
          level: "待提升",
          text:
            `你上次完成的是旧版心理健康筛查（30 题十因子版，结果为「${mentalLegacy.level}」）。量表已升级为 **PHQ-9 + GAD-7 专业版**（三甲医院心理科通用筛查工具，16 题，约 3 分钟）——旧结果不再解读，请到「测评中心 → 心理健康」重新完成一次，这里会给出 PHQ-9 / GAD-7 的分数与分级解释。`,
        }
      : null;
  const condViewOf = (keys: string[]) =>
    (e3parent?.condView ?? [])
      .filter((cv) => keys.includes(cv.key))
      .map(
        (cv) =>
          `· 家长观察「${cv.label}」：${cv.parentView}${cv.studentScore != null ? `；你的自评对应题均分 ${cv.studentScore}/5（${cv.studentLevel}）` : ""}。${cv.note}`,
      )
      .join("\n");
  const condCellOf = (label: string) => condCells.find((c) => c.label === label)!;
  const stateCell = condCellOf("状态");
  const relCell = condCellOf("关系");
  const resCell = condCellOf("资源");
  const secCondItems: NonNullable<CombinedSection["items"]> = [
    {
      heading: `**状态格（精力与情绪）** ${stateCell.score}/5 · ${stateCell.level}`,
      level: stateCell.level as CombinedLevel,
      text: abilityDetailText({
        detailKey: "条件·状态",
        name: "状态格（精力与情绪）",
        score: stateCell.score,
        level: stateCell.level,
        extraData:
          `对应测评第 50-56 题（睡眠、情绪精力与上学意愿）` +
          `。**行为特质素材**：${d} 型「${discReport.name}」在压力下——${discReport.underPressure}` +
          (e3parent && condViewOf(["state"]) ? `。**家长对照**：\n${condViewOf(["state"])}` : ""),
      }),
    },
    /* 心理健康卡：V2 出 PHQ-9/GAD-7 分数与分级解释；旧版提示升级重测 */
    ...(mentalCard ? [mentalCard] : []),
    /* MBTI / DISC 自我认知素材：作为状态分析素材并入状态部分 */
    mbtiStateCard,
    discStateCard,
    blendStateCard,
    {
      heading: `**关系格（亲子/师生/同伴）** ${relCell.score}/5 · ${relCell.level}`,
      level: relCell.level as CombinedLevel,
      text: abilityDetailText({
        detailKey: "条件·关系",
        name: "关系格（亲子/师生/同伴）",
        score: relCell.score,
        level: relCell.level,
        extraData:
          `对应测评第 57-61 题（亲子沟通、师生与同伴关系）` +
          (e3parent && condViewOf(["relParent", "relSchool"]) ? `。**家长对照**：\n${condViewOf(["relParent", "relSchool"])}` : ""),
      }),
    },
    {
      heading: `**资源格（环境/工具/时间/支持）** ${resCell.score}/5 · ${resCell.level}`,
      level: resCell.level as CombinedLevel,
      text: abilityDetailText({
        detailKey: "条件·资源",
        name: "资源格（环境/工具/时间/支持）",
        score: resCell.score,
        level: resCell.level,
        extraData:
          `对应测评第 62-67 题（学习环境、工具、时间与支持）` +
          (e3parent && condViewOf(["resEnv", "resTime", "resSupport", "aiPhone"]) ? `。**家长对照**：\n${condViewOf(["resEnv", "resTime", "resSupport", "aiPhone"])}` : ""),
      }),
    },
  ];
  /* DISC 量尺归一：V2 新版原生 0–24；V1 旧版 0–12 ×2，亲子对照同尺可比 */
  const discNorm = (r: DiscResult, k: DiscType) => (r.dims[k] ?? 0) * (r.version === 2 ? 1 : 2);
  /* 亲子 DISC 对照：每位家长与学生主型的差异分析（逐维度差值冲突标注 + 冲突点 + 管教风格建议），最多 2 张卡 */
  for (const p of discParents.slice(0, 2)) {
    const pp = p.result.primary;
    const parentAnimal = DISC_ANIMAL[pp].split("（")[0];
    const childAnimal = DISC_ANIMAL[d].split("（")[0];
    /* 逐维度 |学生-家长| 差值（0–24 统一量尺）：|Δ|≥6 强烈冲突（排最前），4–5 需留意 */
    const dimDeltas = (["D", "I", "S", "C"] as DiscType[])
      .map((k) => ({ k, student: discNorm(disc, k), parent: discNorm(p.result, k), abs: Math.abs(discNorm(disc, k) - discNorm(p.result, k)) }));
    const strongClashes = dimDeltas.filter((x) => x.abs >= 6).sort((a, b) => b.abs - a.abs);
    const watchDims = dimDeltas.filter((x) => x.abs >= 4 && x.abs < 6);
    const clashLine =
      strongClashes.length > 0 || watchDims.length > 0
        ? `**逐维度差值（你 vs ${p.label}，0–24 统一量尺）**：` +
          [
            ...strongClashes.map(
              (x) => `**!!⚠ ${x.k} 维强烈冲突!!**（你 ${x.student} / ${p.label} ${x.parent}，差 ${x.abs} 分）`,
            ),
            ...watchDims.map((x) => `⚠ ${x.k} 维需留意（你 ${x.student} / ${p.label} ${x.parent}，差 ${x.abs} 分）`),
          ].join("；") +
          `。${strongClashes.length > 0 ? "差值越大的维度，日常管教里越容易「频道对不上」——强烈冲突维度请优先按下方建议调整沟通方式。" : "这两个维度已临近冲突线，沟通时多留意。"}\n`
        : `**逐维度差值（你 vs ${p.label}）**：四个维度差值都在 3 分以内（${dimDeltas.map((x) => `${x.k} 差 ${x.abs}`).join("、")}），行为频道总体接近，沟通天然省力。\n`;
    secCondItems.push({
      heading: `**亲子 DISC 对照 · ${p.label}（${pp} 型·${parentAnimal}）× 你（${d} 型·${childAnimal}）**${strongClashes.length > 0 ? ` · !!⚠ ${strongClashes.map((x) => x.k).join("/")} 维强烈冲突!!` : ""}`,
      level: strongClashes.length > 0 ? "卡点" : watchDims.length > 0 ? "待提升" : relCell.level === "卡点" ? "卡点" : undefined,
      text:
        clashLine +
        `${p.label}是 **${pp} 型（${DISC_REPORTS[pp].name}）** 家长：${DISC_PARENT_STYLE[pp]}。\n` +
        `你是 **${d} 型（${discReport.name}）** 孩子：${DISC_CHILD_REACT[d]}。\n` +
        `**!!可能的冲突点!!**：${DISC_CONFLICT[pp][d]}。\n` +
        `**管教风格改进建议**（与你这个类型沟通最有效的方式）：${discReport.communicationTips.slice(0, 3).map((t) => t.replace(/。+$/, "")).join("；")}。`,
    });
  }
  if (e3.redFlags.length > 0) {
    secCondItems.push({
      heading: `**!!红线提醒 · 共 ${e3.redFlags.length} 条!!**`,
      level: "卡点",
      text:
        e3.redFlags.map((t) => `· ${t}`).join("\n") +
        (e3.lifeEventLevel === "高风险"
          ? `\n生活事件总分 ${e3.lifeEventScore}/24（**高风险**）：先做支持与稳定化，红线命中期间暂缓学业加压。`
          : ""),
    });
  }
  /* 校园场景卡：MBTI/DISC 社交与行为风格在校园场景的样子，作为状态素材保留在本章 */
  secCondItems.push({
    heading: "**校园场景里的你**（性格与行为风格在课堂/自习/考场/集体中的样子）",
    text:
      `**课堂上的你**：${mergeScene(findScene(mbtiReport.scenes, "课堂"), findScene(discReport.scenes, "课堂"), "你在课堂上有自己的节奏，守住「**听懂比记全重要**」的原则，疑问当场标记、课后勤问，课堂就是你性价比最高的学习场。")}\n` +
      `**自习与作业时的你**：${mergeScene(findScene(mbtiReport.scenes, "自习"), findScene(discReport.scenes, "写作业"), "自习时间是你拉开差距的地方：先花几分钟回忆当天内容再动笔，**独立限时**完成作业，效果远胜磨到深夜。")}\n` +
      `**考场上的你**：${mergeScene(findScene(mbtiReport.scenes, "考试"), findScene(discReport.scenes, "考场"), "考场上记住两条：开卷先**通览全卷**标记难易；卡壳题先跳过做记号。**会做的题全拿下**，就是超常发挥。")}\n` +
      `**同学和老师眼中的你**：${mergeScene(findScene(mbtiReport.scenes, "小组"), findScene(discReport.scenes, "同学眼中"), "你在集体中有自己独特的位置，不必模仿别人的发光方式——把你的**优势**用在小组合作里，大家自然会看到。")}`,
  });
  const secCond: CombinedSection = {
    title: "条件模块 · 支持系统",
    paragraphs: [
      `条件三格（**不进总分，但干预顺序排在最前**）：${condLine}。`,
      `学习状态单选：「**${e3.motivationLabel}**」（赋分 ${e3.motivationScore}/5）${e3.motivationScore <= 2 ? "——你最近在「为什么而学」上比较累，这不是懒，是需要被照顾的信号。" : e3.motivationScore >= 4 ? "——学习对你而言是有内在劲头的，请保护好它。" : "——能为目标坚持，但还谈不上享受，注意别让状态继续下滑。"}`,
      `**学习提醒**：条件系统是所有方法的土壤——按优先级链，条件亮红灯时**先修条件再谈方法**。${mental ? "心理健康测评、" : ""}MBTI/DISC 性格行为特质已作为状态分析素材并入下方状态格部分${e3parent ? "，家长卷的观察对照也一并列出" : ""}。`,
    ],
    items: secCondItems,
  };

  /* ④b. 亲子对照与沟通建议（条件大类独立成章：家长卷认知对照 × 亲子 DISC 冲突，合并出冲突点清单与改进方案） */
  let secParentChild: CombinedSection | null = null;
  if (e3parent || discParents.length > 0) {
    const conflicts: string[] = [];
    const tips: string[] = [];
    if (e3parent?.severeConflict) {
      conflicts.push("**!!严重亲子冲突信号!!**（家长卷）：家庭近期发生了严重亲子冲突——先修复关系与安全感，再谈学习要求。");
      tips.push("**红线期原则**：暂停加压与说教，先恢复日常陪伴（一起吃饭、散步、不谈学习的闲聊），必要时寻求学校心理老师或专业机构支持。");
    }
    for (const p of discParents) {
      const pp = p.result.primary;
      const deltas = (["D", "I", "S", "C"] as DiscType[]).map((k) => ({
        k,
        abs: Math.abs(discNorm(disc, k) - discNorm(p.result, k)),
      }));
      const strong = deltas.filter((x) => x.abs >= 6).sort((a, b) => b.abs - a.abs);
      conflicts.push(
        strong.length > 0
          ? `**${p.label}（${pp} 型）× 你（${d} 型）· DISC 频道冲突**：${strong.map((x) => `${x.k} 维差 ${x.abs} 分`).join("、")}（0–24 量尺，≥6 为强烈冲突）——${DISC_CONFLICT[pp][d]}。`
          : `${p.label}（${pp} 型）× 你（${d} 型）：DISC 四维度差值均在安全区（最大 ${Math.max(...deltas.map((x) => x.abs))} 分），行为频道总体接近；仍需留意——${DISC_CONFLICT[pp][d]}。`,
      );
    }
    if (disc) {
      tips.push(
        `**与你（${d} 型）沟通最有效的方式**：${discReport.communicationTips.slice(0, 3).map((t) => t.replace(/。+$/, "")).join("；")}。`,
      );
    }
    if (e3parent) {
      if (e3parent.overestimates.length > 0) {
        conflicts.push(
          `**家长更看好的方面**（高估 ${e3parent.overestimates.length} 项）：${e3parent.overestimates.map((x) => `${x.kp}（家长 ${x.parentScore} / 你 ${x.studentScore}）`).join("、")}——期待高于你的实际感受，容易变成无形压力。`,
        );
        tips.push("高估项：和家长一起看孩子的实际作答，把「我以为你行」换成「我们一起看看难在哪」。");
      }
      if (e3parent.underestimates.length > 0) {
        conflicts.push(
          `**家长没看到的闪光点**（低估 ${e3parent.underestimates.length} 项）：${e3parent.underestimates.map((x) => `${x.kp}（家长 ${x.parentScore} / 你 ${x.studentScore}）`).join("、")}——你的努力值得被看见，建议主动展示给家长。`,
        );
        tips.push("低估项：孩子主动展示一次（讲一道题、翻一次错题本），比辩解十次更有效。");
      }
      const badCond = e3parent.condView.filter((cv) => cv.note.includes("状况较差"));
      if (badCond.length > 0) {
        conflicts.push(`**家长认为较差的方向**：${badCond.map((cv) => cv.label).join("、")}——需要家校一起核实真因，优先处理。`);
      }
      if (e3parent.unknownCount >= 3) {
        conflicts.push(`**家长了解程度不足**：认知对照题中「不了解」${e3parent.unknownCount} 项（了解程度「${e3parent.unknownLevel}」）——先补上了解，再谈管教。`);
      }
      tips.push("把这一章家长和孩子一起看：孩子说说自评的理由，家长说说观察的依据——先对齐事实，再讨论方法。");
    }
    tips.push("每周留一次「不谈学习」的亲子时间；批评对事不对人，先肯定再提一个（只提一个）改进点。");
    secParentChild = {
      title: "亲子对照与沟通建议（家长卷 × 家长 DISC）",
      paragraphs: [
        e3parent
          ? `**家长卷**：家长对孩子学习状态的了解程度「**${e3parent.unknownLevel}**」（不了解 ${e3parent.unknownCount} 项），观察与孩子自评的明显差异 **${e3parent.blindSpots.length} 项**（高估 ${e3parent.overestimates.length} / 低估 ${e3parent.underestimates.length}）${e3parent.severeConflict ? "；!!并出现严重亲子冲突信号!!" : ""}。`
          : "家长卷尚未填写——填写后这里会给出家长观察与孩子自评的认知对照（可到「测评中心 → 家长卷」补填）。",
        discParents.length > 0
          ? `**家长 DISC**：${discParents.map((p) => `${p.label}（${p.result.primary} 型）`).join("、")} × 你（${d} 型）——类型没有好坏，冲突来自频道差异，可调的是沟通方式。`
          : "家长 DISC 尚未测评——测后这里会给出亲子行为频道对照（可到「测评中心 → 家长 DISC」补测）。",
      ],
      items: [
        {
          heading: `**冲突点清单 · 共 ${conflicts.length} 条**（按优先级排序）`,
          level: conflicts.some((c) => c.includes("!!")) ? "卡点" : conflicts.length > 1 ? "待提升" : undefined,
          text: conflicts.map((t, i) => `${i + 1}. ${t}`).join("\n"),
        },
        {
          heading: "**沟通优化建议**（给家长，也给孩子）",
          text: tips.map((t, i) => `${i + 1}. ${t}`).join("\n"),
        },
      ],
    };
  }

  /* ⑤. 学能模块 · 能力系统（学能筛查三项 + 多元智能五项） */
  const aptLine = e3.aptitude.map((a) => `${a.label} ${a.score}/5（${a.level}）`).join(" · ");
  const secAptParas: string[] = [
    `学能三项：${aptLine}。这三项**反映当前加工效率，不是智力**，也不代表潜力上限——睡眠、状态和刻意练习都能改变它们。`,
  ];
  const secAptItems: NonNullable<CombinedSection["items"]> = [];
  /* 学能筛查三项逐项卡（单独报告不进总分，放在多元智能五项之前）：三层结构（介绍+数据分析+详细建议） */
  for (const a of e3.aptitude) {
    secAptItems.push({
      heading: `**学能 · ${a.label}** ${a.score}/5 · ${a.level}`,
      level: a.level as CombinedLevel,
      text: abilityDetailText({
        detailKey: `学能·${a.label}`,
        name: a.label,
        score: a.score,
        level: a.level,
        extraData: `${a.note}；对应测评第 ${a.label === "注意力" ? 68 : a.label === "工作记忆" ? 69 : 70} 题（反向计分）。学能三项单独报告、不进总分`,
      }),
    });
  }
  if (multi5) {
    const m5r = buildMulti5Report(multi5);
    const m5sorted = [...m5r.dims].sort((a, b) => b.score - a.score);
    const m5top = m5sorted[0];
    const m5bottom = m5sorted[m5sorted.length - 1];
    secAptParas.push(
      `多元智能五项（客观作答）：**综合 ${multi5.overall} 分、细心指数 ${multi5.carefulIndex}%**；最强「${m5top.label}」${m5top.score} 分，最弱「${m5bottom.label}」${m5bottom.score} 分。`,
    );
    secAptParas.push(
      `**学习提醒**：${weakestApt.level !== "正常" ? `学能里「${weakestApt.label}」当前偏弱（${weakestApt.score}/5），听课做题会在效率上吃亏，跟着训练计划练起来就能涨；` : "学能三项都在正常线上，效率底子不错；"}${multi5.carefulIndex < 70 ? `细心指数 ${multi5.carefulIndex}% 偏低，**粗心丢分**可能正在悄悄吃掉你的分数——考场检查两条铁律（开卷先通览 2 分钟、一题卡 5 分钟就跳过）请刻进习惯。` : "细心指数在线，继续保持检查习惯。"}`,
    );
    for (const dim of m5r.dims) {
      secAptItems.push({
        heading: `**${dim.label}** ${dim.score} 分 · ${dim.band}`,
        level: dim.band === "待提升" ? "待提升" : "正常",
        text:
          `${dim.feature}\n` +
          (dim.evalPoints[0] ? `**表现观察**：${dim.evalPoints[0]}\n` : "") +
          (dim.studyAdvice[0] ? `**学习建议**：${dim.studyAdvice[0]}` : "") +
          (dim.growthAdvice[0] ? `\n**提升玩法**：${dim.growthAdvice[0]}` : ""),
      });
    }
  } else {
    secAptParas.push(
      `**学习提醒**：${weakestApt.level !== "正常" ? `学能里「${weakestApt.label}」当前偏弱（${weakestApt.score}/5），听课做题会在效率上吃亏，跟着训练计划练起来就能涨。` : "学能三项都在正常线上，效率底子不错。"}（尚未完成多元智能五项客观测评，完成后这里会补上五项能力详解。）`,
    );
  }
  const secApt: CombinedSection = {
    title: "学能模块 · 能力系统",
    paragraphs: secAptParas,
    items: secAptItems.length > 0 ? secAptItems : undefined,
  };

  /* ⑥. 兴趣与方向（霍兰德 + 职业锚，分值降序 + 代码/top3） */
  let secCareer: CombinedSection | null = null;
  if (anchor || holland) {
    const paras: string[] = [
      "这一章回答「**什么样的努力方式最适合你**」：职业锚看你内心最在乎的驱动力，霍兰德看你的兴趣类型——它们不谈天赋高低，只帮你把劲用在对的地方。",
    ];
    const items: NonNullable<CombinedSection["items"]> = [];
    if (anchor) {
      const ar = buildAnchorReport(anchor);
      const sorted = ANCHOR_ORDER.map((k: AnchorKey) => ({ k, v: anchor.dims[k] })).sort((a, b) => b.v - a.v);
      paras.push(
        `**职业锚八型得分（从高到低）**：${sorted.map((x) => `${ANCHOR_LABEL[x.k]} ${x.v.toFixed(1)}`).join(" · ")}。第一锚「**${ANCHOR_LABEL[sorted[0].k]}**」是你最强的学习驱动——${ar.top2[0]?.studyImpact[0] ?? ""}`,
      );
      ar.top2.forEach((t, i) => {
        items.push({
          heading: `**职业锚 · ${t.label}** ${t.score.toFixed(1)} 分 · 第 ${i + 1} 锚`,
          text:
            `**① 这是什么**：${t.feature}\n` +
            `**② 数据分析**：八型得分 ${sorted.map((x) => `${ANCHOR_LABEL[x.k]} ${x.v.toFixed(1)}`).join(" · ")}（5 分制均分，从高到低）——「**${t.label}**」排第 ${i + 1}，是你最看重的驱动力之一。\n` +
            `**③ 详细建议 · 学习上的优势驱动**：${t.studyImpact[0]}。` +
            t.studyImpact.slice(1).map((s) => `\n· ${s}。`).join("") +
            `\n**更容易投入的方向**：${t.workStyle}；被认可的方式：${t.recognition}。相关职业领域参考：${t.careerFields.slice(0, 4).join("、")}。`,
        });
      });
    }
    if (holland) {
      const hr = buildHollandReport(holland);
      paras.push(
        `**霍兰德职业兴趣代码 ${holland.code}**：${holland.top3.map((k, i) => `${HOLLAND_LABEL[k]} ${holland.dims[k].toFixed(1)} 分（第 ${i + 1} 位）`).join("、")}。`,
      );
      holland.top3.forEach((key, i) => {
        const dd = hr.dims.find((x) => x.key === key);
        if (!dd) return;
        items.push({
          heading: `**霍兰德 · ${dd.label}** ${dd.score.toFixed(1)} 分 · 代码第 ${i + 1} 位`,
          text:
            `**① 这是什么**：${dd.trait}\n` +
            `**② 数据分析**：六型得分 ${hr.dims.map((x) => `${x.label} ${x.score.toFixed(1)}`).join(" · ")}（5 分制均分）——你的兴趣代码「${hr.code}」，本型位列第 ${i + 1}。${hr.top3[i]?.focus ?? ""}\n` +
            `**③ 详细建议 · 对学习的影响**：\n${dd.studyImpact.map((s) => `· ${s}`).join("\n")}\n` +
            `**方向参考**：匹配职业方向 ${dd.careers.slice(0, 4).join("、")}；大学专业举例 ${dd.majors.slice(0, 4).join("、")}。`,
        });
      });
    }
    secCareer = { title: "兴趣与方向", paragraphs: paras, items: items.length > 0 ? items : undefined };
  }

  /* ⑧. 需要温柔关注的信号（心理红线 + 生活事件高风险并入） */
  const flagBullets: string[] = [...e3.redFlags];
  if (e3.motivationScore <= 2) {
    flagBullets.push(
      "**状态自评偏低**：你最近在「为什么而学」这件事上比较累，可能正处在勉强应付甚至抵触的状态。这不是你的错，也不是懒——请把它当作一个需要被照顾的信号，先跟信任的大人**聊聊感受**，再谈学习安排。",
    );
  }
  if (e3.lifeEventLevel !== "正常") {
    flagBullets.push(
      `**近期生活事件影响不小**（总分 ${e3.lifeEventScore}/24 · ${e3.lifeEventLevel}）：这段时间你经历了一些学业之外的压力（家庭、人际或环境变化），还在坚持上学和完成作业，已经很不容易。状态波动是正常的，先照顾好**睡眠和情绪**，学习的账可以慢一点再算。`,
    );
  }
  if (flagBullets.length === 0) {
    flagBullets.push(
      "目前没有触发需要特别关注的信号：你的**情绪状态**、上学意愿和生活压力总体平稳。也请记得，状态是会变化的——如果之后有持续低落、不想上学或睡不好的日子，主动告诉家人或老师，是**成熟**而不是麻烦别人。",
    );
  }
  const secFlags: CombinedSection = {
    title: "需要温柔关注的信号",
    bullets: flagBullets,
  };

  /* ⑩. 给家长的话（分块卡片结构：一句开场引导 + 每张卡只讲一件事） */
  const tipsText = discReport.communicationTips
    .slice(0, 3)
    .map((t) => t.replace(/。+$/, ""))
    .join("；");
  const parentItems: NonNullable<CombinedSection["items"]> = [
    {
      heading: "**这一章只记三件事**",
      big: true,
      level: "待提升",
      text: "①如果「需要温柔关注的信号」一章有内容，**优先处理那一章**，再谈成绩。②本周只盯一件事——作业**独立限时**完成。③沟通只改一个动作——私下说、先肯定再提问题。",
    },
    {
      heading: "**怎么和 TA 说话最听得进**",
      text: `孩子的行为主型是 ${d} 型「${discReport.name}」。和孩子沟通顺畅的关键：${tipsText}。孩子喜欢的老师风格，也提示了家庭的沟通方向——${discReport.teacherFit}`,
    },
    {
      heading: "**陪写作业怎么陪**",
      text: `孩子目前的阶段重点是「${e3.mainBlock?.label ?? e3.priorities[0]?.label ?? "保持现有节奏"}」。${e3.priorities.length > 0 ? `当前前三优先的训练方向：${priorityText}。` : "目前没有触发警戒的训练方向，保持现有节奏。"}陪伴时做「**安静的同路人**」而不是监工：孩子在学，家长在旁边做自己的事，需要时再出手。检查作业只看「有没有**独立完成**」和「错因有没有写」，不必逐题盯着改。`,
    },
    {
      heading: "**关于动力和奖励**",
      text: `孩子的**外驱依赖指数 ${e3.extDrive}/5**（越高越依赖批评、奖励等外部推动${e3.extDrive >= 3.5 ? "——**!!偏高!!**，外部驱动用多了内驱就长不出来，请逐步减少批评和奖励驱动" : "，在正常范围"}），**内驱水平指数 ${e3.intDrive}/5**。家庭能做的最有力的事，是少谈分数、多聊「学会了什么」和「未来想成为什么样的人」。把学习主权慢慢还给孩子，动力才会从里面长出来。`,
    },
    ...(academics && gapSummary && gapSummary.totalGap != null
      ? [
          {
            heading: "**分数差距怎么聊**",
            text: `请先肯定孩子敢写下目标的**勇气**——很多孩子连写都不敢写。总差距 ${gapSummary.totalGap} 分听起来大，按一学年 4 次大考拆，每次大考总分只需多拿约 **${Math.ceil(gapSummary.totalGap / 4)} 分**、平均每科 ${Math.max(1, Math.round(gapSummary.totalGap / 4 / Math.max(1, gapSummary.filled)))} 分左右。建议只和孩子定「**下一次考试**」的小目标，达成先庆祝，再谈下一步。别拿差距和别人家孩子比，比较只会消耗动力。`,
          },
        ]
      : []),
    {
      heading: "**特别提醒**",
      text:
        tf === "F"
          ? "孩子对批评的**语气和场合**比较敏感。同样的意见，私下、先肯定再指出问题，孩子听得进去；当众或带着情绪的指责，可能让孩子关上耳朵好几天。冲突激烈时，请先照顾情绪，等双方平静后再谈学习——**关系在，教育才在**。"
          : "孩子讲道理、重事实，沟通时可以直接谈问题本身，但请同样做到「**对事不对人**」：指出具体哪件事可以改进，而不是评价「你怎么总是这样」。就事论事的氛围里，孩子的**配合度**会明显更高。",
    },
  ];
  if (e3parent && (e3parent.severeConflict || e3parent.blindSpots.length > 0)) {
    const parts: string[] = [];
    if (e3parent.severeConflict) {
      parts.push("家长卷显示近半年家庭存在**!!严重亲子冲突!!**：请先修复关系、暂缓学业加压——关系在，教育才在。");
    }
    if (e3parent.overestimates.length > 0) {
      parts.push(
        `家长观察比孩子自评**明显更乐观**的方面：${e3parent.overestimates.map((b) => `「${b.kp}」（家长 ${b.parentScore} / 孩子 ${b.studentScore}）`).join("、")}——这些是孩子没说出口的难处，请多听少断。`,
      );
    }
    if (e3parent.underestimates.length > 0) {
      parts.push(
        `家长观察比孩子自评**明显更悲观**的方面：${e3parent.underestimates.map((b) => `「${b.kp}」（家长 ${b.parentScore} / 孩子 ${b.studentScore}）`).join("、")}——孩子比自己以为的被低估时容易委屈，请把肯定说出口。`,
      );
    }
    if (e3parent.unknownCount > 0) {
      parts.push(`认知对照中有 ${e3parent.unknownCount} 项家长填了「不了解」（了解程度：${e3parent.unknownLevel}）——不了解的部分，正是陪跑中最值得先补的亲子对话。`);
    }
    parentItems.push({
      heading: "**家长认知对照提醒**",
      text: `${e3parent.summary}\n${parts.join("\n")}`,
    });
  }
  if (discParents.length > 0) {
    parentItems.push({
      heading: "**管教风格建议**",
      text: discParents
        .slice(0, 2)
        .map((p) => {
          const pp = p.result.primary;
          return `${p.label}（${pp} 型）：${DISC_CONFLICT[pp][d]}；与孩子沟通最有效的三个动作——${discReport.communicationTips.slice(0, 3).map((t) => t.replace(/。+$/, "")).join("；")}`;
        })
        .join("\n"),
    });
  }
  parentItems.push({
    heading: "**最后一句**",
    text: "孩子的状态和安全感，是所有学习方法生效的前提——**先照顾好状态，再谈任何成绩目标**。",
  });
  const secParents: CombinedSection = {
    title: "给家长的话",
    paragraphs: ["这一章写给家长。不用全记住，每张卡只讲一件事，先从第一张做起。"],
    items: parentItems,
  };

  /* ⑪. 学习力训练点子速查（只列点子不展开；训练路由改用 V3.7 能力名 + 一句话训练方向） */
  const ideaBullets: string[] = [];
  /* 优点巩固 */
  ideaBullets.push(
    `**优点 · ${strongNine.label} ${strongNine.score}/5**：继续用它当发动机——每周用它带一次弱项学习（比如用「${strongNine.label}」的方式啃最弱的科目）。`,
  );
  ideaBullets.push(
    `**优点 · ${mbti.type} 性格优势**：${mbtiReport.studyStrengths[0]}——把它固定成每周的习惯动作，而不是偶尔发挥。`,
  );
  /* 卡点：按 V3.7 前三优先（含主卡点去重）给一句话训练方向 */
  const blockPool = [...(e3.mainBlock ? [e3.mainBlock] : []), ...e3.priorities]
    .filter((p) => p.level !== "正常")
    .filter((p, i, arr) => arr.findIndex((x) => x.label === p.label) === i);
  for (const p of blockPool) {
    ideaBullets.push(
      `**!!卡点 · ${p.label} ${p.score}/5!!**：${E3V37_ABILITY_TIP[p.label] ?? "先查清这个环节卡在哪里，再按陪跑方案逐项练"}`,
    );
  }
  ideaBullets.push(
    `**!!卡点 · ${disc.primary} 型行为惯性!!**：针对「${discReport.obstacles[0]}」——每周自查一次，出现就当场记下来并换一个做法试一周。`,
  );
  if (biggestGapSubject) {
    ideaBullets.push(
      `**!!问题 · ${biggestGapSubject.name}差距 ${biggestGapSubject.gap} 分!!**：每天给这科固定 20 分钟限时练，优先练最近错题的同类型。`,
    );
  }
  if (mentalV2 && (mentalV2.level !== "良好" || mentalV2.selfHarm)) {
    ideaBullets.push(
      mentalV2.selfHarm
        ? `**!!问题 · 心理状态（PHQ-9 ${mentalV2.phq9}/27 · GAD-7 ${mentalV2.gad7}/21 · ${mentalV2.level}，有自伤念头信号）!!**：先求助再谈学习——今天就把结果告诉家长或信任的老师，必要时拨打心理援助热线 12356。`
        : `**!!问题 · 心理状态（PHQ-9 ${mentalV2.phq9}/27 · GAD-7 ${mentalV2.gad7}/21 · ${mentalV2.level}）!!**：先稳状态再抓学习——规律睡眠、每天 10 分钟放松练习，两周后复测对比。`,
    );
  } else if (mentalLegacy && mentalLegacy.positiveFactors.length > 0) {
    const names = mentalLegacy.positiveFactors.slice(0, 3).map((f) => MENTAL_FACTOR_LABEL[f]).join("、");
    ideaBullets.push(
      `**!!问题 · 心理状态（${names}略高）!!**：先稳状态再抓学习——规律睡眠、每天 10 分钟放松练习，必要时告诉家长或老师。`,
    );
  }
  const secIdeas: CombinedSection = {
    title: "学习力训练点子速查",
    paragraphs: [
      "把全篇分析到的**优点、卡点、问题**汇总在这里，每条只配对应的训练点子——具体怎么一步步操作，见伴学师页面的**陪跑方案**，由伴学师带你逐个落地。",
      "点子名称前的字母是训练系统分类：**P=心理建设类 · D=动力与心态类 · X=习惯与方法类**；**红色条目优先处理**。",
    ],
    bullets: ideaBullets,
    items: [
      {
        heading: "**心法 · 人生即游乐场**",
        text: "把每次大考当成游乐场里的一局：有输有赢，**赢得起也输得起**。考砸了不是「我不行」，是这一局的攻略还没摸透——复盘完，再来一局。",
      },
      {
        heading: "**心法 · 证明你行，而不是证明你不行**",
        text: "这套测评和训练的每个动作，都是为了攒「**你很厉害**」的证据：自我效能感来自一次次「我做到了」。分数是一时的，学习力是一辈子的。",
      },
      {
        heading: "**技法 · 自主学习七步法**",
        text: "**预习中心**（先自己摸一遍，带着问题听课）→ **小试牛刀**（做几道题验证）→ **批改订正** → **讲题输出**（费曼学法：能给别人讲明白才算真会）→ **错题归纳**（错因写清、三天后重做）→ **树洞心情**（情绪有出口）→ **档案诊断**（定期回看进步轨迹）。七步跑成闭环，学习就有了自己的发动机。",
      },
      {
        heading: "**技法 · 试卷分析三件事 + 三空间**",
        text: "三件事：①**感谢自己**——「感谢我通过努力拿到了这些分」；②**感谢丢分**——「幸好不是中高考，漏洞暴露得正是时候」；③**把丢掉的分重新学一遍**。三空间：**会做但做错的**→ 标出错因，考场检查习惯补上；**听一次就会的**→ 用费曼输出讲一遍，变成自己的；**听了依然不会的**→ 暂时放一放，先把能拿的分拿稳。",
      },
      {
        heading: "**技法 · 让 AI 当你的私人教练**",
        text: "把这份报告发给你的 **AI 学伴**，让它按你的性格类型和薄弱能力出每周计划、陪你讲题、帮你批改复盘。未来人的核心能力是**提出需求的能力**——过程交给 AI 辅助，你负责想清楚「我要什么」。",
      },
    ],
  };

  /* ⑫. 附录 · 三阶九能观察点得分表（逐题明细表格由页面在该章节下方渲染） */
  const secAppendix: CombinedSection = {
    title: "附录 · 三阶九能观察点得分表",
    paragraphs: [
      "下方表格按 乐学（动力/信心/韧劲）→ 会学（学懂/记住/会用）→ 善学（计划/复盘/智学），再附条件三格与学能三项，列出 **各关注点与 70 道评分题的逐题得分**（反向题已按「6－圈选数」换算，分数越低越需要关注）。红黄绿口径：**红 <3.0 为卡点 · 黄 3.0-3.7 为待提升 · 绿 ≥3.8 为正常**；任一关注点均分 ≤2.0 时，该能直接判为「卡点」。",
    ],
  };

  /* 章节组装：综合结论 → 乐学/会学/善学模块 → 学能模块 → 条件模块 → 亲子对照（条件大类）→ 兴趣与方向 → 信号 → 家长 → 训练点子速查 → 附录 */
  const sections: CombinedSection[] = [secConclusion, ...secModules, secApt, secCond];
  if (secParentChild) sections.push(secParentChild);
  if (secCareer) sections.push(secCareer);
  sections.push(secFlags, secParents, secIdeas, secAppendix);

  return {
    title: "学习力综合分析报告",
    subtitle: "MBTI × DISC × 三阶九能 · 性格行为与学业诊断全观",
    overviewCards,
    sections,
  };
}

/* ------------------------- E3 三阶九能单列报告 ------------------------- */

/** 三阶九能学业诊断报告（E3 单科详版 tab 用）：诊断结论 + 九能逐项 + 短板清单 + 条件与学能 + 信号。 */
export function buildE3Report(e3: E3V37Result): CombinedReport {
  const abilities = e3.abilities;
  const strongNine = [...abilities].sort((a, b) => b.score - a.score)[0];
  const weakNine = [...abilities].sort((a, b) => a.score - b.score)[0];
  const coreLine = e3.systems.core.map((s) => `${sysDisplay(s)} ${s.score}/5（${s.level}）`).join(" · ");
  const nineLine = abilities.map((a) => `${a.label} ${a.score}/5（${a.level}）`).join("、");
  const condCells = e3.systems.condition.cells;
  const weakestCond = [...condCells].sort((a, b) => a.score - b.score)[0];

  /* 顶部概览卡：三阶系统 + 条件最低格 + 主卡点 + 学习状态 */
  const overviewCards: CombinedOverviewCard[] = e3.systems.core.map((s) => ({
    label: s.label,
    value: `${s.score} / 5`,
    note: s.level,
    tone: LEVEL_TONE[s.level],
  }));
  overviewCards.push(
    {
      label: `条件·${weakestCond.label}（最低格）`,
      value: `${weakestCond.score} / 5`,
      note: `${weakestCond.level} · 条件不进总分，干预第一优先`,
      tone: LEVEL_TONE[weakestCond.level],
    },
    {
      label: "主卡点",
      value: e3.mainBlock ? e3.mainBlock.label : "无",
      note: e3.mainBlock ? `${e3.mainBlock.score}/5 · 按优先级链 ${E3V37_CHAIN_TEXT.replace(/ → /g, "→")} 判定` : "九能与条件均无红灯",
      tone: e3.mainBlock ? "red" : "green",
    },
    {
      label: "学习状态",
      value: e3.motivationLabel,
      note: `状态单选赋分 ${e3.motivationScore}/5`,
      tone: e3.motivationScore <= 2 ? "red" : e3.motivationScore === 3 ? "amber" : "green",
    },
  );

  const secConcl: CombinedSection = {
    title: "诊断结论",
    paragraphs: [
      `三阶系统分——${coreLine}。九能定位：${nineLine}。`,
      e3.mainBlock
        ? `**主卡点**：「**${e3.mainBlock.label}**」${e3.mainBlock.score}/5（按优先级链 **${E3V37_CHAIN_TEXT}** 取最低分红灯）。**前三优先**：${e3.priorities.map((p) => `「${p.label}」${p.score}/5（${p.level}）`).join("；")}。`
        : `九能与条件系统**没有红灯卡点**；相对最弱的是「${weakNine.label}」${weakNine.score}/5，最强的是「${strongNine.label}」${strongNine.score}/5，补弱时可以从它借力。`,
      `**学习状态单选**「${e3.motivationLabel}」（赋分 ${e3.motivationScore}/5）；**外驱依赖指数** ${e3.extDrive}/5（5-7 题原始均分，越高越依赖外部推动${e3.extDrive >= 3.5 ? "——**!!依赖偏高!!**" : ""}），**内驱水平指数** ${e3.intDrive}/5。`,
      ...(e3.validity.suspectInertia || e3.validity.contradictions.length > 0
        ? [
            `**作答有效性提示**：${e3.validity.suspectInertia ? "存在连续 8 题以上同一数值的疑似惯性作答；" : ""}${e3.validity.contradictions.length > 0 ? `发现 ${e3.validity.contradictions.length} 处正反题矛盾作答（${e3.validity.contradictions[0]}）` : ""}结果仅供参考，建议陪跑中面谈核实。`,
          ]
        : []),
    ],
  };

  const abilityItems = abilities.map((a) => {
    const weakestFocus = [...a.focuses].sort((x, y) => x.score - y.score)[0];
    const tip = E3V37_ABILITY_TIP[a.label] ?? "";
    const text = weakestFocus
      ? weakestFocus.level === "正常"
        ? `关注点明细：${a.focuses.map((f) => `「${f.kp}」${f.score}/5`).join("、")}——全部在正常线以上。**本周行动（保持）**：${tip}。`
        : `**最低关注点**：「${weakestFocus.kp}」${weakestFocus.score}/5（${weakestFocus.level}，第 ${weakestFocus.items.join("、")} 题）。**本周行动**：${tip}。`
      : `**本周行动**：${tip}。`;
    return {
      heading: `**${a.label}** ${a.score}/5 · ${a.level}`,
      level: a.level as CombinedLevel,
      text,
    };
  });
  const secAbilities: CombinedSection = {
    title: "九能逐项结论与本周行动",
    paragraphs: [
      "每能只有两件事：**现在的状态**和**本周就做的一个动作**。先把「卡点」项的动作做完，再做「待提升」的。",
    ],
    items: abilityItems,
  };

  /* 明显短板：反向后均分 ≤2.0 的关注点（触及该线时整个能被强制判为卡点） */
  const redFocuses = abilities.flatMap((a) =>
    a.focuses.filter((f) => f.score <= 2.0).map((f) => ({ ability: a.label, ...f })),
  );
  const secWeak: CombinedSection | null =
    redFocuses.length > 0
      ? {
          title: "明显短板清单",
          paragraphs: [
            "以下关注点换算后均分 **≤2.0**，直接触及红线（所在能力被强制判为「卡点」），是最具体的短板证据，伴学师会据此匹配单项训练。",
          ],
          bullets: redFocuses.map(
            (f) => `「**${f.kp}**」（${f.ability} · 第 ${f.items.join("、")} 题）均分 ${f.score}/5 · 卡点`,
          ),
        }
      : null;

  const secCondApt: CombinedSection = {
    title: "条件与学能",
    paragraphs: [
      `条件三格（**不进总分，但干预第一优先**）：${condCells.map((c) => `${c.label} ${c.score}/5（${c.level}）`).join(" · ")}。${e3.systems.condition.note}。`,
      `学能三项：${e3.aptitude.map((a) => `${a.label} ${a.score}/5（${a.level}）`).join(" · ")}。${e3.aptitude[0]?.note ?? "反映当前加工效率，不是智力，也不代表潜力上限"}。`,
      `生活事件总分 **${e3.lifeEventScore}/24（${e3.lifeEventLevel}）**${e3.lifeEventLevel === "正常" ? "，近期没有明显的学业外压力冲击。" : "——先照顾好睡眠和情绪，状态稳了再谈学习效率。"}`,
      ...(e3.redFlags.length > 0
        ? [`**!!心理红线 ${e3.redFlags.length} 条!!**：\n${e3.redFlags.map((t) => `· ${t}`).join("\n")}`]
        : []),
    ],
  };

  const flagBullets = [...e3.redFlags];
  if (e3.motivationScore <= 2) {
    flagBullets.push("**状态自评偏低**：最近在「为什么而学」上比较累。先和信任的大人聊聊感受，再谈学习安排。");
  }
  if (e3.lifeEventScore >= 4) {
    flagBullets.push("**近期生活事件影响不小**：先照顾好睡眠和情绪，学习的账可以慢一点算。");
  }
  const secFlags: CombinedSection | null =
    flagBullets.length > 0
      ? { title: "需要温柔关注的信号", bullets: flagBullets }
      : null;

  const sections: CombinedSection[] = [secConcl, secAbilities];
  if (secWeak) sections.push(secWeak);
  sections.push(secCondApt);
  if (secFlags) sections.push(secFlags);

  return {
    title: `学业诊断报告（三阶九能 · ${e3.stageLabel}）`,
    subtitle: "E3 学业诊断 V3.7 · 乐学 × 会学 × 善学（外加条件系统与学能三项）",
    overviewCards,
    sections,
  };
}
