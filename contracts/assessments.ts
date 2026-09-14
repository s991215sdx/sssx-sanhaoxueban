/**
 * 三大测评（MBTI / DISC / E3 学业诊断）题库与计分器。
 * 前后端共享：纯类型、纯数据、纯函数，不依赖服务端或 React。
 */

export type AssessmentKind = "mbti" | "disc" | "e3";

/* ---------------------------------- MBTI ---------------------------------- */

export type MbtiDim = "EI" | "SN" | "TF" | "JP";
export type MbtiPole = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export type MbtiQuestion = {
  text: string;
  a: string;
  b: string;
  dim: MbtiDim;
  /** 选 A（0）时计入哪一极；选 B（1）计入 dim 的另一极。 */
  aPole: MbtiPole;
};

export type MbtiDims = Record<MbtiPole, number>;

export type MbtiResult = {
  type: string;
  dims: MbtiDims;
  summary: string;
};

const EI_QUESTIONS: MbtiQuestion[] = [
  { text: "课间十分钟，你更常在——", a: "和同学聊天、打闹，越聊越精神", b: "自己安静待着，看看书或发发呆", dim: "EI", aPole: "E" },
  { text: "周末同学约你出去玩，你的第一反应通常是——", a: "更想宅在家，做点自己的事", b: "挺期待的，喜欢大家一起热闹", dim: "EI", aPole: "I" },
  { text: "遇到一道不会的题，你一般会——", a: "直接开口问同学或老师", b: "先自己闷头琢磨很久", dim: "EI", aPole: "E" },
  { text: "参加完一场热闹的聚会之后，你常常觉得——", a: "有点累，想一个人静一静", b: "很兴奋，还有点意犹未尽", dim: "EI", aPole: "I" },
  { text: "小组讨论时，你更像哪一种——", a: "边说边想，常常抢着发言", b: "想清楚了才开口", dim: "EI", aPole: "E" },
  { text: "说到朋友，你更接近——", a: "有几个特别要好的就够了", b: "朋友越多越好，来者不拒", dim: "EI", aPole: "I" },
  { text: "刚进一个新班级，你通常——", a: "很快就和新同学熟络起来", b: "需要一段时间才慢慢熟", dim: "EI", aPole: "E" },
];

const SN_QUESTIONS: MbtiQuestion[] = [
  { text: "学一个新知识点时，你更喜欢——", a: "先看例题和具体步骤", b: "先搞懂背后的原理", dim: "SN", aPole: "S" },
  { text: "你更容易记住的是——", a: "有意思的故事和脑洞联想", b: "具体的事实和数据", dim: "SN", aPole: "N" },
  { text: "写作文时，你更擅长——", a: "写真实发生过的事", b: "编一个想象出来的故事", dim: "SN", aPole: "S" },
  { text: "做数学题时，你常常——", a: "喜欢琢磨有没有别的新解法", b: "按老师教的方法稳稳地做", dim: "SN", aPole: "N" },
  { text: "你更相信——", a: "亲眼看到、亲手做过的事", b: "直觉和「感觉会是这样」", dim: "SN", aPole: "S" },
  { text: "听课的时候，你更容易——", a: "联想到别的有趣的事，偶尔走神", b: "跟着老师的板书一步一步记", dim: "SN", aPole: "N" },
  { text: "给别人讲一件事时，你倾向于——", a: "按顺序把来龙去脉讲清楚", b: "先说重点和自己的想法", dim: "SN", aPole: "S" },
];

const TF_QUESTIONS: MbtiQuestion[] = [
  { text: "好朋友考砸了来找你倾诉，你会先——", a: "帮他分析到底是哪里出了问题", b: "先安慰他，照顾他的心情", dim: "TF", aPole: "T" },
  { text: "做重要决定时，你更看重——", a: "自己和大家心里的感受", b: "道理上到底对不对", dim: "TF", aPole: "F" },
  { text: "同学之间闹矛盾，你觉得——", a: "把是非对错讲清楚最重要", b: "别伤了和气最重要", dim: "TF", aPole: "T" },
  { text: "被老师批评之后，你更容易——", a: "心里难受好一阵", b: "想「说得对不对」，对就改", dim: "TF", aPole: "F" },
  { text: "你觉得自己更擅长——", a: "讲道理、摆事实说服别人", b: "察觉别人的情绪变化", dim: "TF", aPole: "T" },
  { text: "投票选班干部，你更可能投给——", a: "人缘好、待人热情的同学", b: "能力强、办事公正的同学", dim: "TF", aPole: "F" },
  { text: "如果别人说你「太较真」，你会觉得——", a: "这是夸奖，对就是对", b: "有点受伤，怀疑自己不合群", dim: "TF", aPole: "T" },
];

const JP_QUESTIONS: MbtiQuestion[] = [
  { text: "你的作业通常是——", a: "提前按计划完成", b: "拖到最后才赶着做完", dim: "JP", aPole: "J" },
  { text: "周末计划被打乱时，你——", a: "无所谓，随机应变也挺好", b: "有点不爽，还是想按原计划", dim: "JP", aPole: "P" },
  { text: "你的书桌和书包——", a: "收拾得比较整齐，东西有固定位置", b: "有点乱，但自己找得到就行", dim: "JP", aPole: "J" },
  { text: "假期作业你一般——", a: "先痛快玩，快开学再集中火力", b: "每天做一点，早早就完成", dim: "JP", aPole: "P" },
  { text: "上学要带的东西，你通常——", a: "前一晚就收拾好", b: "出门前随手抓，偶尔会忘带", dim: "JP", aPole: "J" },
  { text: "面对「今天必须完成」的任务，你——", a: "压力越大反而越有状态", b: "不喜欢这样，宁可早点做完图个安心", dim: "JP", aPole: "P" },
  { text: "定了学习计划之后，你通常——", a: "会尽量按计划执行", b: "计划赶不上变化，看心情调整", dim: "JP", aPole: "J" },
];

/** 打散的维度出场顺序（每个维度恰好 7 次）。 */
const MBTI_DIM_SEQUENCE: MbtiDim[] = [
  "EI", "SN", "JP", "TF", "TF", "EI", "SN",
  "JP", "SN", "TF", "JP", "EI", "JP", "EI",
  "TF", "SN", "EI", "JP", "SN", "TF", "JP",
  "SN", "TF", "EI", "TF", "SN", "EI", "JP",
];

const MBTI_BANK: Record<MbtiDim, MbtiQuestion[]> = {
  EI: EI_QUESTIONS,
  SN: SN_QUESTIONS,
  TF: TF_QUESTIONS,
  JP: JP_QUESTIONS,
};

/** MBTI 题库：28 道迫选题，四个维度各 7 题，顺序已打散。 */
export const MBTI_QUESTIONS: MbtiQuestion[] = (() => {
  const cursor: Record<MbtiDim, number> = { EI: 0, SN: 0, TF: 0, JP: 0 };
  return MBTI_DIM_SEQUENCE.map((dim) => MBTI_BANK[dim][cursor[dim]++]);
})();

const MBTI_DIM_POLES: Record<MbtiDim, [MbtiPole, MbtiPole]> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

const MBTI_TRAIT_TEXT: Record<MbtiPole, string> = {
  E: "你从与人相处的热闹中获得能量，敢说敢问、朋友缘不错",
  I: "你在安静独处时最有能量，做事专注、想得比较深",
  S: "你踏实细致，重视具体事实和亲身经验，基本功容易打得牢",
  N: "你想象力丰富、点子多，喜欢琢磨原理和各种可能性",
  T: "你讲逻辑、分对错，遇到问题习惯先分析再下结论",
  F: "你温暖体贴、善解人意，很在意自己和他人的感受",
  J: "你有计划、有条理，定了目标就愿意一步一步落实",
  P: "你灵活随性、随机应变，压力之下反而常有超常发挥",
};

/**
 * MBTI 计分。answers[i]：0=选 A，1=选 B；长度须为 28。
 * 每一对维度中票数多者胜；平局取该对的第一个字母（E/S/T/J）。
 */
export function scoreMbti(answers: number[]): MbtiResult {
  if (answers.length !== MBTI_QUESTIONS.length) {
    throw new Error(`MBTI 答案数量应为 ${MBTI_QUESTIONS.length}，实际 ${answers.length}`);
  }
  const dims: MbtiDims = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
  answers.forEach((ans, i) => {
    const q = MBTI_QUESTIONS[i];
    const [first, second] = MBTI_DIM_POLES[q.dim];
    const pole = ans === 0 ? q.aPole : q.aPole === first ? second : first;
    dims[pole] += 1;
  });
  let type = "";
  const sentences: string[] = [];
  for (const dim of ["EI", "SN", "TF", "JP"] as MbtiDim[]) {
    const [first, second] = MBTI_DIM_POLES[dim];
    const winner = dims[first] >= dims[second] ? first : second;
    type += winner;
    sentences.push(MBTI_TRAIT_TEXT[winner]);
  }
  return { type, dims, summary: sentences.join("；") + "。" };
}

/* ---------------------------------- DISC ---------------------------------- */

export type DiscType = "D" | "I" | "S" | "C";

export type DiscQuestion = {
  text: string;
  a: string;
  b: string;
  /** 选 A（0）计入 aType，选 B（1）计入 bType。 */
  aType: DiscType;
  bType: DiscType;
};

export type DiscDims = Record<DiscType, number>;

export type DiscResult = {
  primary: DiscType;
  dims: DiscDims;
  summary: string;
  /** 2 = 强迫选择新版（24 组四词，最像/最不像）；缺省为旧版二选一。 */
  version?: 2;
};

/** 每种类型各 6 题（作为 aType 出现 6 次，作为 bType 也出现 6 次，计分公平）。 */
const DISC_BANK: Record<DiscType, { text: string; a: string }[]> = {
  D: [
    { text: "班里组织比赛，你通常——", a: "特别想赢，会主动当带头的那个" },
    { text: "遇到很难的学习目标，你——", a: "越想越来劲，就想把它拿下" },
    { text: "和同学意见不一致时，你——", a: "会直接说出自己的想法，说服对方" },
    { text: "老师布置一个有挑战的任务，你——", a: "马上动手，边做边想办法" },
    { text: "如果考试成绩被别人超过，你——", a: "憋着一股劲，下次一定要追回来" },
    { text: "做小组作业时，你常常——", a: "自然而然成了拍板分活的人" },
  ],
  I: [
    { text: "课间或放学路上，你——", a: "总有聊不完的话，是气氛担当" },
    { text: "学到有趣的知识时，你——", a: "忍不住马上讲给别人听" },
    { text: "到一个新环境，你——", a: "很快就能和大家打成一片" },
    { text: "被老师在全班面前表扬后，你——", a: "能开心一整天，学习都更有劲" },
    { text: "小组展示时，你更喜欢——", a: "上台讲的那部分，越讲越兴奋" },
    { text: "你的情绪通常——", a: "写在脸上，开心不开心大家都看得出来" },
  ],
  S: [
    { text: "同学遇到麻烦找你帮忙，你——", a: "会耐心帮到底，哪怕自己慢一点" },
    { text: "比起新鲜刺激，你更喜欢——", a: "熟悉、稳定、有节奏的生活" },
    { text: "和别人发生分歧时，你——", a: "常常先退一步，不想让关系变僵" },
    { text: "定好的作息和习惯，你——", a: "能一直坚持，不太需要别人催" },
    { text: "家里或班里有矛盾时，你常常——", a: "是那个默默调和、照顾大家情绪的人" },
    { text: "面对突然的改变（比如换老师），你——", a: "需要一点时间才能适应" },
  ],
  C: [
    { text: "写作业或答卷时，你——", a: "会反复检查，容不得马虎" },
    { text: "对一条规则或步骤，你——", a: "喜欢先弄清楚为什么是这样" },
    { text: "你的笔记和作业本通常——", a: "工工整整，错题都标得清清楚楚" },
    { text: "开始一件重要的事之前，你——", a: "喜欢先把计划和步骤列清楚" },
    { text: "看到马虎出错的地方，你——", a: "会很在意，非得改过来才安心" },
    { text: "做选择题时，你常常——", a: "把每个选项都推敲一遍才下笔" },
  ],
};

/** 每种类型 6 题的 bType 轮换，保证四型作为 bType 也各出现 6 次。 */
const DISC_B_TYPES: Record<DiscType, DiscType[]> = {
  D: ["I", "S", "C", "I", "S", "C"],
  I: ["D", "S", "C", "D", "S", "C"],
  S: ["D", "I", "C", "D", "I", "C"],
  C: ["D", "I", "S", "D", "I", "S"],
};

const DISC_B_TEXT: Record<DiscType, Partial<Record<DiscType, string>>> = {
  D: {
    I: "和大家一起有说有笑地完成更有意思",
    S: "按自己熟悉的节奏慢慢来，不想冒险",
    C: "先把规则和细节想清楚，再决定动不动手",
  },
  I: {
    D: "自己说了算、快速推进更痛快",
    S: "安安静静把事情做好就行，不用太热闹",
    C: "宁愿少说话，也要把每个细节做对",
  },
  S: {
    D: "喜欢竞争和挑战，赢了特别有成就感",
    I: "喜欢认识新朋友，场面越热闹越开心",
    C: "比起顾全大家，更想把事情做到完美",
  },
  C: {
    D: "更看重效率和结果，差不多就行",
    I: "更看重气氛和感受，大家开心最重要",
    S: "更看重稳定和配合，不追求十全十美",
  },
};

/** 打散的类型出场顺序（每种类型恰好 6 次）。 */
const DISC_TYPE_SEQUENCE: DiscType[] = [
  "D", "I", "C", "S", "I", "S",
  "D", "C", "S", "D", "I", "C",
  "C", "D", "S", "I", "D", "I",
  "C", "S", "I", "C", "D", "S",
];

/** DISC 题库：24 道迫选题，D/I/S/C 各 6 题，顺序已打散。 */
export const DISC_QUESTIONS: DiscQuestion[] = (() => {
  const cursor: Record<DiscType, number> = { D: 0, I: 0, S: 0, C: 0 };
  return DISC_TYPE_SEQUENCE.map((t) => {
    const i = cursor[t]++;
    const bType = DISC_B_TYPES[t][i];
    const item = DISC_BANK[t][i];
    const bText = DISC_B_TEXT[t][bType];
    if (!bText) throw new Error(`DISC 题库配置缺失：${t} 题的 B 选项（${bType}）`);
    return { text: item.text, a: item.a, b: bText, aType: t, bType };
  });
})();

const DISC_TYPE_TEXT: Record<DiscType, string> = {
  D: "目标感强、有主见、不服输，喜欢挑战和掌控感；只是有时偏急，听不进劝。学习上适合用「打擂台、定挑战」的方式激励，把大目标拆成一场场能赢的小仗",
  I: "热情外向、爱说爱笑、人缘好，被肯定一句就来劲；只是容易坐不住、三分钟热度。多给展示和表达的机会（比如让他讲题），学习动力会明显更足",
  S: "温和踏实、有耐心、重感情，是让家长放心的孩子；只是不爱争、怕变化，有压力习惯憋在心里。适合稳定的节奏，多一点鼓励，少一点突然的高压",
  C: "认真细致、讲规矩、对自己要求高，正确率往往不错；只是容易纠结细节、怕犯错、行动偏慢。适合用清晰的步骤和标准来带，先完成再完美",
};

/**
 * DISC 计分。answers[i]：0=选 A，1=选 B；长度须为 24。
 * primary 为最高分维度（平局按 D>I>S>C 取前者）；
 * 若第二名与第一名分差 ≤1，summary 以「X 主导，Y 辅助」的组合形式呈现。
 */
export function scoreDisc(answers: number[]): DiscResult {
  if (answers.length !== DISC_QUESTIONS.length) {
    throw new Error(`DISC 答案数量应为 ${DISC_QUESTIONS.length}，实际 ${answers.length}`);
  }
  const dims: DiscDims = { D: 0, I: 0, S: 0, C: 0 };
  answers.forEach((ans, i) => {
    const q = DISC_QUESTIONS[i];
    dims[ans === 0 ? q.aType : q.bType] += 1;
  });
  const order: DiscType[] = ["D", "I", "S", "C"];
  const ranked = [...order].sort((x, y) => dims[y] - dims[x] || order.indexOf(x) - order.indexOf(y));
  const primary = ranked[0];
  const second = ranked[1];
  const combo = dims[primary] - dims[second] <= 1;
  const head = combo ? `${primary} 主导，${second} 辅助` : `${primary} 主导型`;
  const summary = combo
    ? `孩子是「${head}」的性格组合。${DISC_TYPE_TEXT[primary]}；同时也有明显的 ${second} 特质：${DISC_TYPE_TEXT[second]}。`
    : `孩子是「${head}」。${DISC_TYPE_TEXT[primary]}。`;
  return { primary, dims, summary };
}

/* ------------------------------ 家长版 DISC ------------------------------ */

/**
 * 家长版 DISC 题干（24 题，全部家庭/亲子场景，站在家长角度描述自己的行为倾向）。
 * 顺序与学生版 DISC_TYPE_SEQUENCE 完全一致，仅题干与选项文案改写为家庭场景。
 */
const DISC_PARENT_ITEMS: { text: string; a: string; b: string }[] = [
  { text: "孩子写作业拖拉到很晚，你通常——", a: "直接定规矩：几点前必须写完，做不到就承担后果", b: "用聊天打趣的方式带动气氛，让他在轻松里加快速度" },
  { text: "家里聊起孩子这次考试成绩，你通常——", a: "轻松幽默地聊，先夸进步，再自然地带到问题", b: "直接指出问题，明确下次要达到的目标" },
  { text: "检查孩子作业发现错误时，你——", a: "逐题核对，把每个错误的原因都弄清楚", b: "点出关键错处让他马上改，不在细节上耗时间" },
  { text: "孩子顶嘴、和你对着干时，你——", a: "先稳住自己的情绪，等他平静后再慢慢沟通", b: "当场表明态度，把是非和规矩讲清楚" },
  { text: "安排孩子的周末时，你更喜欢——", a: "安排得热热闹闹，聚会、活动、户外运动换着来", b: "保持规律安稳的节奏，按平时习惯来就好" },
  { text: "孩子在学习上有情绪时，你——", a: "耐心陪着，先听他把话说完", b: "讲点开心的事、带他换个心情，先把情绪带起来" },
  { text: "给孩子定学习目标（如期末名次）时，你——", a: "定得有挑战性，定完就盯着他执行", b: "结合他的现状定得稳妥些，不想给太大压力" },
  { text: "辅导孩子功课时，你更像——", a: "讲究方法和步骤，一个知识点一个知识点讲透", b: "讲得生动有趣，用例子和故事带动他的兴趣" },
  { text: "孩子磨蹭（起床、出门、写作业）时，你——", a: "多提醒几次，耐着性子等他跟上节奏", b: "提前把流程和时间点列清楚，要求他按节点来" },
  { text: "孩子考砸了回到家，你通常——", a: "当天就谈：问题出在哪、下一步怎么办，直接定改进计划", b: "先安慰鼓励，等他缓过来再聊" },
  { text: "开完家长会回来，你通常——", a: "兴致勃勃地把老师讲的事说给全家听，聊出一大堆想法", b: "把老师反馈的问题逐条记下来，回来对照着落实" },
  { text: "孩子的书包、房间、作息这类日常事，你——", a: "有明确标准，东西摆放、作息时间都要求规整", b: "差不多就行，孩子舒服自在最重要，不想太较真" },
  { text: "发现孩子的学习方法有问题（比如只刷题不总结），你——", a: "先研究清楚问题根源，再给他设计一套改进方法", b: "直接叫停旧做法，要求他立刻换方式，边做边调整" },
  { text: "和孩子意见冲突（如报不报兴趣班）时，你——", a: "坚持自己的判断，想办法说服孩子按对的来", b: "更多顺着孩子的意愿，不想把关系弄僵" },
  { text: "孩子遇到挫折（比赛输了、落选）时，你——", a: "先陪伴安抚，给他时间和空间慢慢恢复", b: "鼓励他把不甘化成行动，马上开始下一次冲刺" },
  { text: "全家讨论一件事（如假期安排）时，你常常——", a: "是气氛担当，带动大家七嘴八舌聊得热闹", b: "听一圈之后直接拍板定方案" },
  { text: "孩子成绩被别人超过、排名下滑时，你——", a: "明显着急，会给他加压：「下次必须追回来」", b: "用轻松的方式化解：「一次而已」，先帮他找回信心" },
  { text: "陪孩子写作业时，你通常——", a: "喜欢陪在旁边互动，边聊边陪，气氛轻松", b: "安安静静陪着不打扰，他需要时再帮忙" },
  { text: "给孩子选教辅、报班时，你——", a: "仔细对比评价、大纲和口碑，研究透了再决定", b: "看准了就快速定下来，不想在选择上耗时间" },
  { text: "孩子在学校被表扬后，你——", a: "心里高兴但表达克制，怕他骄傲", b: "毫不吝啬地夸，热热闹闹地让他感受到肯定" },
  { text: "孩子和你分享学校的趣事时，你——", a: "特别投入，和他一起聊得眉飞色舞", b: "认真听，但会不自觉追问细节、纠正其中的问题" },
  { text: "对待定下的家规（如手机使用时间），你——", a: "规则定了就严格执行，自己也以身作则", b: "执行得比较弹性，看孩子状态差不多就行" },
  { text: "在教育孩子这件事上的家庭分工里，你常常——", a: "自然而然成了拿主意、定方向的那个", b: "更多做配合和补位，把家里的氛围维护好" },
  { text: "面对教育方式的改变（如换新方法、换学校），你——", a: "需要一点时间适应，更信任熟悉稳定的做法", b: "先把新方法研究清楚、做好对比，确认靠谱再接受" },
];

/**
 * 家长版 DISC 题库：24 道家庭/亲子场景迫选题。
 * 关键约束：逐题 aType/bType 与学生版 DISC_QUESTIONS 完全一致（直接派生，
 * 结构性保证），因此 scoreDisc 无需任何改动即可直接对家长答案计分。
 */
export const DISC_PARENT_QUESTIONS: DiscQuestion[] = DISC_QUESTIONS.map((q, i) => {
  const item = DISC_PARENT_ITEMS[i];
  if (!item) throw new Error(`家长版 DISC 题库配置缺失：第 ${i + 1} 题`);
  return { text: item.text, a: item.a, b: item.b, aType: q.aType, bType: q.bType };
});

/* --------------------------- DISC V2 强迫选择版 --------------------------- */

/**
 * DISC V2（国际通行强迫选择格式）：24 组，每组 4 个描述词（D/I/S/C 各一），
 * 每组选 1 个「最像我」+ 1 个「最不像我」（不能是同一个词）。
 * words[i] 的维度归属为 types[i]；每组内四种类型各出现一次，计分公平。
 */
export type DiscWordGroup = { words: string[]; types: DiscType[] };

/** V2 作答：most[i]/least[i] 为第 i 组「最像/最不像」的词下标（0-3，且 most[i] ≠ least[i]）。 */
export type DiscV2Answers = { most: number[]; least: number[] };

export const DISC_V2_GROUP_COUNT = 24;

/** 学生版 V2 词组（校园/日常视角）。 */
export const DISC_V2_GROUPS: DiscWordGroup[] = [
  { words: ["爱说爱笑，爱交朋友", "说干就干，行动快", "认真细致，少出错", "脾气稳，不爱争执"], types: ["I", "D", "C", "S"] },
  { words: ["敢拍板，敢负责", "愿意迁就别人", "会活跃气氛", "讲规则，按步骤来"], types: ["D", "S", "I", "C"] },
  { words: ["想清楚了再开口", "表达欲强，爱分享", "不服输，喜欢赢", "有耐心，听人把话说完"], types: ["C", "I", "D", "S"] },
  { words: ["照顾别人的感受", "对细节要求高", "到新环境很快熟", "有主见，不轻易改主意"], types: ["S", "C", "I", "D"] },
  { words: ["遇到困难迎上去", "点子多，爱玩新花样", "做事有长性，不急躁", "先观察再行动"], types: ["D", "I", "S", "C"] },
  { words: ["容易被大家的情绪感染", "不爱出风头", "答应的事一定做到", "说话直接，不绕弯子"], types: ["I", "S", "C", "D"] },
  { words: ["做完先检查再交", "喜欢指挥和安排", "习惯固定的节奏", "讨厌冷场"], types: ["C", "D", "S", "I"] },
  { words: ["受了委屈先忍着", "凭感觉交朋友", "压力下也能顶住", "犯错会反复想原因"], types: ["S", "I", "D", "C"] },
  { words: ["目标定得高", "喜欢问「为什么」", "相信好事会发生", "不喜欢突然的变化"], types: ["D", "C", "I", "S"] },
  { words: ["说话有感染力", "讨厌拖拉", "帮助别人不求回报", "东西摆放有条理"], types: ["I", "D", "S", "C"] },
  { words: ["做决定前反复比较", "能迁就集体安排", "敢跟别人不一样", "开心就写在脸上"], types: ["C", "S", "D", "I"] },
  { words: ["倾听比说得多", "竞争来了很兴奋", "笔记做得工整", "朋友多，人缘好"], types: ["S", "D", "C", "I"] },
  { words: ["出了问题敢承担", "喜欢被表扬", "遵守约定和纪律", "不喜欢催别人"], types: ["D", "I", "C", "S"] },
  { words: ["热情洋溢", "谨慎小心", "忠诚可靠", "决策果断"], types: ["I", "C", "S", "D"] },
  { words: ["追求准确", "爱挑战难题", "爱讲笑话逗大家", "情绪平稳"], types: ["C", "D", "I", "S"] },
  { words: ["乐于配合", "好奇心强爱尝试", "计划性强", "掌控感强"], types: ["S", "I", "C", "D"] },
  { words: ["看重结果", "看重关系", "看重气氛", "看重标准"], types: ["D", "S", "I", "C"] },
  { words: ["遇冲突爱打圆场", "遇冲突敢顶回去", "遇冲突讲道理", "遇冲突先退让"], types: ["I", "D", "C", "S"] },
  { words: ["对自己要求严", "玩起来很投入", "对人包容", "时间抓得紧"], types: ["C", "I", "S", "D"] },
  { words: ["喜欢当倾听者", "喜欢当把关的人", "喜欢当队长", "喜欢当气氛担当"], types: ["S", "C", "D", "I"] },
  { words: ["变化来了先行动", "变化来了先研究", "变化来了想先稳住", "变化来了觉得新鲜"], types: ["D", "C", "S", "I"] },
  { words: ["讨厌无聊", "讨厌争吵", "讨厌被管束", "讨厌马虎"], types: ["I", "S", "D", "C"] },
  { words: ["很少凭冲动做事", "说话算数，敢坚持", "说到兴头上停不下", "很少发脾气"], types: ["C", "D", "I", "S"] },
  { words: ["认定的人一直在", "赢了还想赢", "到哪里都有朋友", "认定的事做到位"], types: ["S", "D", "I", "C"] },
];

/** 家长版 V2 词组（家庭/亲子视角，维度顺序与学生版逐组一致，保证亲子对照同尺可比）。 */
export const DISC_PARENT_V2_GROUPS: DiscWordGroup[] = [
  { words: ["爱热闹，爱招呼人", "定事快，说了就办", "做事细致，很少疏漏", "性情温和，不爱计较"], types: ["I", "D", "C", "S"] },
  { words: ["家里的事敢拿主意", "愿意迁就家人", "会活跃家里的气氛", "讲规矩，按章办事"], types: ["D", "S", "I", "C"] },
  { words: ["三思而后言", "爱说话，爱分享见闻", "要强，不甘落后", "有耐心，听人把话说完"], types: ["C", "I", "D", "S"] },
  { words: ["顾全家人的感受", "对细节要求高", "到哪儿都能很快熟络", "有主见，认定了不轻改"], types: ["S", "C", "I", "D"] },
  { words: ["难事来了顶得上", "点子多，爱尝新", "做事有耐性，不毛躁", "谋定而后动"], types: ["D", "I", "S", "C"] },
  { words: ["容易被气氛带动", "不爱出风头", "承诺的事一定兑现", "说话直来直去"], types: ["I", "S", "C", "D"] },
  { words: ["做完事必检查", "习惯张罗安排", "习惯安稳规律", "受不了冷场"], types: ["C", "D", "S", "I"] },
  { words: ["有委屈先自己消化", "凭眼缘交朋友", "压力再大扛得住", "出了问题必找原因"], types: ["S", "I", "D", "C"] },
  { words: ["目标定得高", "凡事爱问个究竟", "凡事往好处想", "不喜欢生活突然变动"], types: ["D", "C", "I", "S"] },
  { words: ["说话有感染力", "最看不惯拖拉", "帮人不图回报", "东西收拾得井井有条"], types: ["I", "D", "S", "C"] },
  { words: ["做决定前货比三家", "能迁就大家的安排", "敢于与众不同", "喜怒都挂在脸上"], types: ["C", "S", "D", "I"] },
  { words: ["听得多说得少", "越竞争越来劲", "记录清清楚楚", "朋友多，人缘广"], types: ["S", "D", "C", "I"] },
  { words: ["出了问题敢担责", "喜欢被夸奖", "重承诺守信用", "从不催逼家人"], types: ["D", "I", "C", "S"] },
  { words: ["热情爽朗", "谨慎周全", "踏实可靠", "当机立断"], types: ["I", "C", "S", "D"] },
  { words: ["一丝不苟", "专挑硬骨头啃", "爱说笑，会逗乐", "情绪平稳少波动"], types: ["C", "D", "I", "S"] },
  { words: ["乐于打配合", "对新鲜事物好奇", "凡事有计划", "一家之主的担当"], types: ["S", "I", "C", "D"] },
  { words: ["看重结果成效", "看重家人和睦", "看重家庭气氛", "看重规矩标准"], types: ["D", "S", "I", "C"] },
  { words: ["有分歧会打圆场", "有分歧敢坚持", "有分歧讲道理", "有分歧先让一步"], types: ["I", "D", "C", "S"] },
  { words: ["对自己要求严格", "玩起来放得开", "对家人包容", "时间观念强"], types: ["C", "I", "S", "D"] },
  { words: ["家里的倾听者", "家里把关的那个", "家里拿主意的那个", "家里的开心果"], types: ["S", "C", "D", "I"] },
  { words: ["变动来了马上应对", "变动来了先研究清楚", "变动来了想先稳住", "变动来了觉得新鲜"], types: ["D", "C", "S", "I"] },
  { words: ["受不了无聊", "受不了争吵", "受不了被管着", "受不了马虎"], types: ["I", "S", "D", "C"] },
  { words: ["从不冲动行事", "说一不二", "聊起来滔滔不绝", "很少发火"], types: ["C", "D", "I", "S"] },
  { words: ["认定的家人一心到底", "要强到底", "到哪儿都有熟人", "认定的事做到底"], types: ["S", "D", "I", "C"] },
];

/** 判断原始作答是否为 V2 结构（{ most, least }）。 */
export function isDiscV2Answers(x: unknown): x is DiscV2Answers {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return Array.isArray(o.most) && Array.isArray(o.least);
}

/** 由 dims 生成主型与 summary（V1/V2 共用）。 */
function discSummaryFromDims(dims: DiscDims): { primary: DiscType; summary: string } {
  const order: DiscType[] = ["D", "I", "S", "C"];
  const ranked = [...order].sort((x, y) => dims[y] - dims[x] || order.indexOf(x) - order.indexOf(y));
  const primary = ranked[0];
  const second = ranked[1];
  const combo = dims[primary] - dims[second] <= 1;
  const head = combo ? `${primary} 主导，${second} 辅助` : `${primary} 主导型`;
  const summary = combo
    ? `孩子是「${head}」的性格组合。${DISC_TYPE_TEXT[primary]}；同时也有明显的 ${second} 特质：${DISC_TYPE_TEXT[second]}。`
    : `孩子是「${head}」。${DISC_TYPE_TEXT[primary]}。`;
  return { primary, summary };
}

/**
 * DISC V2 计分：每组「最像」维度 +1、「最不像」维度 -1（净分 -24..+24），
 * 再归一到 0–24 量尺（12 + 净分/2，可能出现 .5），与旧版报告图表同尺展示。
 * groups 传家长版词组即可对家长作答计分（维度映射一致）。
 */
export function scoreDiscV2(ans: DiscV2Answers, groups: DiscWordGroup[] = DISC_V2_GROUPS): DiscResult {
  if (ans.most.length !== groups.length || ans.least.length !== groups.length) {
    throw new Error(`DISC V2 答案数量应为 ${groups.length} 组`);
  }
  const net: DiscDims = { D: 0, I: 0, S: 0, C: 0 };
  groups.forEach((g, i) => {
    const m = ans.most[i];
    const l = ans.least[i];
    if (m == null || l == null || m < 0 || m > 3 || l < 0 || l > 3 || m === l) {
      throw new Error(`DISC V2 第 ${i + 1} 组作答无效（最像与最不像须为不同的词）`);
    }
    net[g.types[m]] += 1;
    net[g.types[l]] -= 1;
  });
  const dims: DiscDims = { D: 12 + net.D / 2, I: 12 + net.I / 2, S: 12 + net.S / 2, C: 12 + net.C / 2 };
  const { primary, summary } = discSummaryFromDims(dims);
  return { primary, dims, summary, version: 2 };
}

/* ----------------------------------- E3 ---------------------------------- */
/* E3 学业诊断已升级为 V2.7 五维优化版，题库与计分见 ./e3v27。 */

import {
  E3V27_MOTIVATION_OPTIONS,
  E3V27_SCAN_ASPECTS,
  E3V27_LOSS_REASONS,
  E3V27_SCORE_TRENDS,
} from "./e3v27";
import type {
  E3V27Stage,
  E3V27Question,
  E3V27Result,
} from "./e3v27";

export {
  E3V27_QUESTIONS,
  E3V27_STAGE_LABEL,
  E3V27_MOTIVATION_OPTIONS,
  E3V27_MOTIVATION_SCORE,
  E3V27_SCAN_ASPECTS,
  E3V27_SCAN_SUBJECTS,
  E3V27_LOSS_REASONS,
  E3V27_SCORE_TRENDS,
  E3V27_OPEN_QUESTIONS,
  E3V27_RATING_COUNT,
  E3V27_LIFE_EVENT_COUNT,
  scoreE3V27,
  scoreE3V27Items,
  E3V27_SUBSCALE_DEFS,
  e3StageOf,
  isE3V27Result,
} from "./e3v27";
export type {
  E3V27Stage,
  E3V27DimKey,
  E3V27Question,
  E3V27SubjectScan,
  E3V27ScanAspect,
  E3V27ScoreTrend,
  E3V27Input,
  E3Level,
  E3V27Dim,
  E3V27Subscale,
  E3V27Weakness,
  E3V27Route,
  E3V27Result,
  E3V27ItemScore,
  E3MotivationKey,
} from "./e3v27";

/* ------------------------------- 接口共享类型 ------------------------------ */

export type MbtiQuestionSet = { kind: "mbti"; questions: MbtiQuestion[] };
export type DiscQuestionSet = { kind: "disc"; questions: DiscQuestion[] };
export type E3QuestionSet = {
  kind: "e3";
  /** 按学生学段下发的版本。 */
  stage: E3V27Stage;
  stageLabel: string;
  /** 73 道评分题。 */
  ratings: E3V27Question[];
  motivationOptions: typeof E3V27_MOTIVATION_OPTIONS;
  /** 学科快扫配置。 */
  scanSubjects: string[];
  scanAspects: typeof E3V27_SCAN_ASPECTS;
  lossReasons: typeof E3V27_LOSS_REASONS;
  scoreTrends: typeof E3V27_SCORE_TRENDS;
  /** 8 道生活事件（0-3 分）。 */
  lifeEvents: E3V27Question[];
  openQuestions: string[];
};
export type AssessmentQuestionSet = MbtiQuestionSet | DiscQuestionSet | E3QuestionSet;

export type MbtiOutcome = { kind: "mbti"; result: MbtiResult };
export type DiscOutcome = { kind: "disc"; result: DiscResult };
export type E3Outcome = { kind: "e3"; result: E3V27Result };
export type AssessmentOutcome = MbtiOutcome | DiscOutcome | E3Outcome;

/* ------------------------------ E3 V3.7 三阶九能 ------------------------------ */
/* V3.7 题库与计分（学生卷 + 家长卷），导出名均带 E3V37 前缀，与 V2.7 无冲突。 */

export * from "./e3v37";
export * from "./e3v37Parent";
