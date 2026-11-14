/**
 * 人才测评题库（职场成人语境）。
 *
 * 说明：本文件的题项全部自编，不复用任何商业量表的题目原文。
 * 结构参考公开的学术框架——大五人格（Big Five）、DISC 四因子、特质情绪智力
 * 四因素十五维（Petrides 提出的 trait EI 结构）、工作价值观六类。
 * 因此报告只能称「依据××结构自编题本」，不得声称是 TEIQue / NEO-PI 等授权量表。
 *
 * v270：岗位加测从四套扩到五套——新增 mkt（渠道判断与投放），
 * mgmt 从 12 题扩到 20 题（补授权、反馈、推新流程、向上争取四种场合）。
 */

/* ============================== 一、大五人格 20 题 ============================== */

export type BigFiveDim = "N" | "C" | "E" | "A" | "O";

export const BIGFIVE_DIM_LABEL: Record<BigFiveDim, string> = {
  N: "情绪稳定",
  C: "尽责性",
  E: "外倾性",
  A: "宜人性",
  O: "开放性",
};

export type LikertItem = {
  id: string;
  text: string;
  /** true = 反向计分（6 - 原始分） */
  reverse?: boolean;
};

export type DimItem = LikertItem & { dim: string };

/** 5 点：非常不符合 / 不太符合 / 一半一半 / 比较符合 / 非常符合 */
export const BIGFIVE_ITEMS: DimItem[] = [
  { id: "B01", dim: "N", text: "工作被否定之后，我能很快缓过来，不会一整天都在想这件事。" },
  { id: "B02", dim: "N", text: "遇到突发状况，我容易先慌，然后才想起来该怎么办。", reverse: true },
  { id: "B03", dim: "N", text: "几件事同时压过来的时候，我手上的节奏基本不会乱。" },
  { id: "B04", dim: "N", text: "一件没做好的事，常常会影响我一整天的心情。", reverse: true },

  { id: "B05", dim: "C", text: "答应别人的时间点，我通常会留出余量，提前一点交。" },
  { id: "B06", dim: "C", text: "没人催的事情，我容易一拖再拖。", reverse: true },
  { id: "B07", dim: "C", text: "我会把要做的事列出来，做完一件划掉一件。" },
  { id: "B08", dim: "C", text: "细节上的小疏漏，我往往是事后才发现的。", reverse: true },

  { id: "B09", dim: "E", text: "陌生人多的场合，我很快就能找到能聊下去的话题。" },
  { id: "B10", dim: "E", text: "连着见几拨人、开几场会之后，我需要一个人待着才能缓过来。", reverse: true },
  { id: "B11", dim: "E", text: "冷场的时候，我通常是先开口的那个。" },
  { id: "B12", dim: "E", text: "能发消息说清的事，我不太愿意直接开口沟通。", reverse: true },

  { id: "B13", dim: "A", text: "别人跟我意见不同时，我会先想他为什么这么看。" },
  { id: "B14", dim: "A", text: "遇到反应比较慢的同事或客户，我会明显不耐烦。", reverse: true },
  { id: "B15", dim: "A", text: "为了配合团队，我愿意调整自己已经习惯的做法。" },
  { id: "B16", dim: "A", text: "我说话比较直，不太顾得上对方听了舒不舒服。", reverse: true },

  { id: "B17", dim: "O", text: "没做过的事，我先想到的是「可以试试」，而不是「会不会出问题」。" },
  { id: "B18", dim: "O", text: "我更愿意用已经验证过的做法，不太想换新方法。", reverse: true },
  { id: "B19", dim: "O", text: "跟本职无关的东西，我一般不会主动去了解。", reverse: true },
  { id: "B20", dim: "O", text: "比起「怎么做」，我更想知道「为什么会是这样」。" },
];

/* ============================ 二、工作价值观 18 题 ============================ */

export type ValueDim = "M" | "G" | "S" | "R" | "A" | "P";

export const VALUE_DIM_LABEL: Record<ValueDim, string> = {
  M: "金钱回报",
  G: "成长学习",
  S: "稳定安全",
  R: "认可尊重",
  A: "自主掌控",
  P: "规则遵从",
};

/** 题干统一为「这件事对我有多重要」，5 点：很不重要 / 不太重要 / 一般 / 比较重要 / 非常重要 */
export const VALUE_ITEMS: DimItem[] = [
  { id: "V01", dim: "M", text: "收入有明显的上升空间，做得好就能多拿。" },
  { id: "V02", dim: "M", text: "业绩和奖金挂钩，干多干少收入差别明显。" },
  { id: "V03", dim: "M", text: "这份工作的收入能稳定支撑我的生活规划。" },

  { id: "V04", dim: "G", text: "能不断学到新东西，而不是重复已经会的。" },
  { id: "V05", dim: "G", text: "有难度不小的任务，做成之后能力确实长一截。" },
  { id: "V06", dim: "G", text: "有人愿意花时间教我，指出我做得不够好的地方。" },

  { id: "V07", dim: "S", text: "工作内容和工作节奏相对固定，不用总应付突然的变动。" },
  { id: "V08", dim: "S", text: "单位稳定，不太需要担心明天还有没有这份工作。" },
  { id: "V09", dim: "S", text: "职责边界清楚，知道自己该管什么、不该管什么。" },

  { id: "V10", dim: "R", text: "做得好会被人看见，当面说出来。" },
  { id: "V11", dim: "R", text: "有明确的职级或头衔，能体现我做到哪一步。" },
  { id: "V12", dim: "R", text: "我的意见在团队里有人认真听。" },

  { id: "V13", dim: "A", text: "一件事怎么做，主要由我自己定。" },
  { id: "V14", dim: "A", text: "不需要时时刻刻汇报进度，被盯着做事我会很难受。" },
  { id: "V15", dim: "A", text: "在我负责的范围里，我有最终决定权。" },

  { id: "V16", dim: "P", text: "流程和制度写得清楚，照章办事就行。" },
  { id: "V17", dim: "P", text: "大家按同一套标准做事，不搞例外。" },
  { id: "V18", dim: "P", text: "上级的安排有明确的依据，而不是临时起意。" },
];

/* ========================== 三、职场 DISC 24 组 ========================== */

export type WorkDiscGroup = { words: [string, string, string, string]; types: ["D" | "I" | "S" | "C", "D" | "I" | "S" | "C", "D" | "I" | "S" | "C", "D" | "I" | "S" | "C"] };

/** 每组四个词，选「最像我」与「最不像我」。四维在 24 组中均衡出现（各 24 次）。 */
export const WORK_DISC_GROUPS: WorkDiscGroup[] = [
  { words: ["讲话有感染力，能把人说动", "定了就干，不拖", "交出去的东西基本不用改", "情绪稳，很少跟人红脸"], types: ["I", "D", "C", "S"] },
  { words: ["敢拍板，也敢担后果", "愿意配合别人的安排", "能把场子热起来", "按流程一步步来"], types: ["D", "S", "I", "C"] },
  { words: ["想清楚了再开口", "话多，爱跟人分享", "不服输，盯着结果", "有耐心，听人把话讲完"], types: ["C", "I", "D", "S"] },
  { words: ["先顾别人的感受", "对细节要求高", "到新环境很快熟", "认准的事不轻易改"], types: ["S", "C", "I", "D"] },
  { words: ["难啃的客户迎上去", "点子多，爱试新路子", "同一件事能长期做下去", "先摸清情况再动手"], types: ["D", "I", "S", "C"] },
  { words: ["容易被团队气氛带动", "不爱抢风头", "答应的事一定兑现", "有话直说，不绕弯"], types: ["I", "S", "C", "D"] },
  { words: ["交付前一定自查一遍", "习惯安排和分工", "喜欢固定的工作节奏", "受不了场面冷下来"], types: ["C", "D", "S", "I"] },
  { words: ["委屈先自己消化", "凭感觉判断人", "压力大也顶得住", "出了问题必找原因"], types: ["S", "I", "D", "C"] },
  { words: ["目标定得比别人高", "凡事要问个究竟", "总认为事情会变好", "不喜欢计划被打乱"], types: ["D", "C", "I", "S"] },
  { words: ["说话能带动人", "最看不惯拖沓", "帮人不图回报", "桌面和文件井然有序"], types: ["I", "D", "S", "C"] },
  { words: ["决定前反复比较", "能配合集体安排", "敢做跟别人不一样的选择", "情绪都写在脸上"], types: ["C", "S", "D", "I"] },
  { words: ["听得多、说得少", "越有竞争越来劲", "记录和台账做得清楚", "跟谁都能聊上几句"], types: ["S", "D", "C", "I"] },
  { words: ["出了问题先认下来", "喜欢被认可", "守时守约", "不爱催别人"], types: ["D", "I", "C", "S"] },
  { words: ["热情外放", "谨慎周全", "可靠、扛得住", "当场就能定"], types: ["I", "C", "S", "D"] },
  { words: ["追求准确无误", "专挑难的单子", "爱说笑，会活跃气氛", "情绪起伏小"], types: ["C", "D", "I", "S"] },
  { words: ["愿意打配合", "对新鲜事好奇", "凡事有计划", "喜欢掌控全局"], types: ["S", "I", "C", "D"] },
  { words: ["看重结果", "看重关系", "看重气氛", "看重标准"], types: ["D", "S", "I", "C"] },
  { words: ["有冲突先打圆场", "有冲突敢顶回去", "有冲突讲道理", "有冲突先让一步"], types: ["I", "D", "C", "S"] },
  { words: ["对自己要求严", "投入时很尽兴", "对人宽容", "时间抓得紧"], types: ["C", "I", "S", "D"] },
  { words: ["团队里的倾听者", "团队里的把关人", "团队里的领头人", "团队里的气氛担当"], types: ["S", "C", "D", "I"] },
  { words: ["变化来了先行动", "变化来了先研究", "变化来了先稳住", "变化来了觉得新鲜"], types: ["D", "C", "S", "I"] },
  { words: ["受不了无聊", "受不了争吵", "受不了被管", "受不了将就"], types: ["I", "S", "D", "C"] },
  { words: ["很少凭一时冲动做事", "说一不二", "聊开了就停不下来", "很少发火"], types: ["C", "D", "I", "S"] },
  { words: ["认准的客户一直跟", "赢了还想赢", "到哪儿都有熟人", "认准的事做到位"], types: ["S", "D", "I", "C"] },
];

/* ========================= 四、特质情商 30 题（7 点） ========================= */

export type EqDim =
  | "AD" | "AS" | "SC" | "MO" | "EE" | "EM" | "ER" | "EX"
  | "IC" | "RE" | "SA" | "SM" | "TE" | "HA" | "OP";

export type EqFactor = "WB" | "SCF" | "EMO" | "SOC";

export const EQ_DIM_LABEL: Record<EqDim, string> = {
  AD: "适应性", AS: "直率", SC: "自信", MO: "自我激励",
  EE: "情绪感知", EM: "情绪管理（他人）", ER: "情绪调节", EX: "情绪表达",
  IC: "冲动控制", RE: "人际关系", SA: "社会意识", SM: "压力管理",
  TE: "同理心", HA: "快乐", OP: "乐观",
};

export const EQ_FACTOR_LABEL: Record<EqFactor, string> = {
  WB: "幸福感",
  SCF: "自我控制",
  EMO: "情绪性",
  SOC: "社会性",
};

/** 因素构成：幸福感 3 维、自我控制 3 维、情绪性 4 维、社会性 3 维；适应性/自我激励为独立维度。 */
export const EQ_FACTOR_DIMS: Record<EqFactor, EqDim[]> = {
  WB: ["HA", "OP", "SC"],
  SCF: ["ER", "IC", "SM"],
  EMO: ["TE", "EE", "EX", "RE"],
  SOC: ["EM", "AS", "SA"],
};

export const EQ_STANDALONE_DIMS: EqDim[] = ["AD", "MO"];

/** 7 点：完全不符合 → 完全符合。每维 2 题，其中一题为反向题。 */
export const EQ_ITEMS: DimItem[] = [
  { id: "E01", dim: "AD", text: "工作方式突然要改，我能很快调整过来，不太受影响。" },
  { id: "E02", dim: "AD", text: "环境一变，我要很久才能重新找到状态。", reverse: true },
  { id: "E03", dim: "AS", text: "不同意的时候，我会当场把话说清楚。" },
  { id: "E04", dim: "AS", text: "明明心里不认同，我通常还是会顺着对方说。", reverse: true },
  { id: "E05", dim: "SC", text: "交给我一件事，我基本相信自己做得好。" },
  { id: "E06", dim: "SC", text: "被人当面质疑能力的时候，我会怀疑自己是不是真的不行。", reverse: true },
  { id: "E07", dim: "MO", text: "没人盯着的时候，我也能把事情按自己的标准做完。" },
  { id: "E08", dim: "MO", text: "没有外部压力和奖惩，我很难推动自己开始。", reverse: true },
  { id: "E09", dim: "EE", text: "对方嘴上说没事，我通常能看出他其实不舒服。" },
  { id: "E10", dim: "EE", text: "我常常搞不清自己为什么会突然情绪低落。", reverse: true },
  { id: "E11", dim: "EM", text: "场面僵住的时候，我有办法让对方缓和下来。" },
  { id: "E12", dim: "EM", text: "别人情绪上来了，我一般只能等着他自己过去。", reverse: true },
  { id: "E13", dim: "ER", text: "被当众挑错，我也能先把事情处理完，再处理情绪。" },
  { id: "E14", dim: "ER", text: "情绪一上来，我很难控制住自己说什么。", reverse: true },
  { id: "E15", dim: "EX", text: "我很容易把「我很在意这件事」讲给对方听。" },
  { id: "E16", dim: "EX", text: "心里想什么，我很少让别人知道。", reverse: true },
  { id: "E17", dim: "IC", text: "做重要决定前，我会先把该问的问清楚。" },
  { id: "E18", dim: "IC", text: "话一出口我就后悔，这种情况不少。", reverse: true },
  { id: "E19", dim: "RE", text: "离开一家单位之后，我还跟不少老同事保持来往。" },
  { id: "E20", dim: "RE", text: "维持长期关系对我来说很费劲，我常常懒得联系。", reverse: true },
  { id: "E21", dim: "SA", text: "换个场合，我很快能判断出这里该怎么说话。" },
  { id: "E22", dim: "SA", text: "在陌生的圈子或场合里，我常不知道该把自己放在什么位置。", reverse: true },
  { id: "E23", dim: "SM", text: "几件事同时压着，我也能排出先后、一件件处理。" },
  { id: "E24", dim: "SM", text: "压力大的时候，我容易整晚睡不好、白天也提不起劲。", reverse: true },
  { id: "E25", dim: "TE", text: "跟我立场不同的人，我也能理解他为什么那么想。" },
  { id: "E26", dim: "TE", text: "别人讲他的难处，我心里想的是「这有什么好难的」。", reverse: true },
  { id: "E27", dim: "HA", text: "多数日子里，我对自己的状态是满意的。" },
  { id: "E28", dim: "HA", text: "我经常觉得日子没什么意思。", reverse: true },
  { id: "E29", dim: "OP", text: "对接下来要做的事，我总体上是有期待的。" },
  { id: "E30", dim: "OP", text: "事情还没开始，我就先想到了最坏的结果。", reverse: true },
];

/* ======================= 五、岗位加测：五套 ======================= */

export type DutyPackKey = "sales" | "service" | "admin" | "mgmt" | "mkt";

export type DutyOption = { text: string; score: number };
export type DutyItem =
  | { id: string; kind: "likert"; text: string; reverse?: boolean }
  | { id: string; kind: "choice"; text: string; options: DutyOption[]; note?: string };

export const DUTY_PACKS: Record<DutyPackKey, { name: string; blurb: string; minutes: number; items: DutyItem[] }> = {
  sales: {
    name: "拒绝恢复力",
    blurb: "一天几十次触达、多数没有下文，看你能不能在回落之后重新拿起下一次。",
    minutes: 6,
    items: [
      { id: "S01", kind: "likert", text: "连着被拒绝几次之后，我再联系下一个时态度会明显变得敷衍。", reverse: true },
      { id: "S02", kind: "likert", text: "客户直接结束对话，我更多想的是「这次哪里没问对」。" },
      { id: "S03", kind: "likert", text: "一天下来没开单，晚上我会反复难受，影响第二天状态。", reverse: true },
      { id: "S04", kind: "likert", text: "主动联系一个完全陌生的人之前，我不太需要靠打气才能出发。" },
      { id: "S05", kind: "likert", text: "被客户当面质疑「你不专业」，我会想立刻证明自己，而不是先听他说完。", reverse: true },
      { id: "S06", kind: "likert", text: "我会主动要一个「现在不买」的客户转介绍。" },
      { id: "S07", kind: "likert", text: "连续三个月业绩不理想，我仍然相信自己能翻过来。" },
      {
        id: "S08", kind: "choice", text: "上午联系了 30 位家长，28 位没下文，1 位态度很差，1 位说「再看看」。下午还有 30 个名单，你会——",
        options: [
          { text: "先停下来复盘上午的说法，改一版再联系", score: 3 },
          { text: "换一批名单继续联系，先把量堆上去", score: 2 },
          { text: "找主管聊一聊，把情绪放下来再联系", score: 2 },
          { text: "今天先做整理和回访，明天再联系新名单", score: 0 },
        ],
      },
      {
        id: "S09", kind: "choice", text: "家长说「你们太贵了，隔壁便宜一半」，最接近你第一反应的是——",
        options: [
          { text: "先问清楚他拿什么在比，把差异讲成他能算的账", score: 3 },
          { text: "马上给一个折扣或赠课，先把单留住", score: 1 },
          { text: "把我们的服务和效果讲一遍，让他知道值这个价", score: 2 },
          { text: "尊重他的选择，留个联系方式，以后再联系", score: 1 },
        ],
      },
      {
        id: "S10", kind: "choice", text: "一个已经聊了两周、看起来很有意向的家长突然不回消息了，你会——",
        options: [
          { text: "换一个由头再触达一次，比如发一条跟他孩子相关的具体信息", score: 3 },
          { text: "直接问「是不是不考虑了」，要一个明确答复", score: 1 },
          { text: "先放着，等他主动联系", score: 0 },
          { text: "每天发一条催问，直到他回", score: 0 },
        ],
      },
    ],
  },

  service: {
    name: "情绪劳动耐受",
    blurb: "被家长误解、被指责「教得不好」时，你是真的消化了，还是压着等它攒成一口气。",
    minutes: 6,
    items: [
      { id: "L01", kind: "likert", text: "家长在群里发火，我第一反应是先把他说的具体问题摘出来。" },
      { id: "L02", kind: "likert", text: "明明不是我的问题，我也能先接下来，事后再澄清。" },
      { id: "L03", kind: "likert", text: "一天接待好几个情绪不好的家长之后，我回家会不想说话。", reverse: true },
      { id: "L04", kind: "likert", text: "被家长当面说「你不负责」，我会记很久。", reverse: true },
      { id: "L05", kind: "likert", text: "我能在家长情绪最激动的时候，还保持语气平稳。" },
      { id: "L06", kind: "likert", text: "为了让家长满意，我常常答应一些自己其实做不到的事。", reverse: true },
      { id: "L07", kind: "likert", text: "工作里的委屈，我下班后能找到合适的方式放掉。" },
      {
        id: "L08", kind: "choice", text: "晚上十点，家长发来一长段话，说孩子这次考差了「都是你们没教好」，你会——",
        options: [
          { text: "先回一句「我看到了，明天上午我把孩子的学习记录整理给您」，把时间挪到白天", score: 3 },
          { text: "当场把孩子的作业和上课记录一条条发过去解释", score: 1 },
          { text: "先道歉安抚，等第二天再说", score: 2 },
          { text: "第二天上班再回，先把手机放下", score: 2 },
        ],
      },
      {
        id: "L09", kind: "choice", text: "家长要求你每天额外给孩子加半小时答疑，但你的排期已经满了，你会——",
        options: [
          { text: "说清现在排不下的原因，给一个能落地的替代方案和时间点", score: 3 },
          { text: "先答应下来，自己挤时间做", score: 1 },
          { text: "直接说不行，让他找机构协调", score: 1 },
          { text: "答应，但实际做不到，先拖着", score: 0 },
        ],
      },
      {
        id: "L10", kind: "choice", text: "一个学生连续两周不交作业，家长却认为是你的问题，你会——",
        options: [
          { text: "把这两周的跟进记录整理出来，跟家长一起看事实，再定下一步", score: 3 },
          { text: "先承担下来，避免冲突", score: 1 },
          { text: "强调这是学生自己的问题，责任不在我", score: 1 },
          { text: "要求换一个学生", score: 0 },
        ],
      },
    ],
  },

  admin: {
    name: "细致准确",
    blurb: "排课、名单、金额——错一个数字就要重来一遍。这组题有对错，请按材料作答。",
    minutes: 8,
    items: [
      {
        id: "A01", kind: "choice",
        text: "排课表：A 教室 9:00–10:30 数学（张老师），10:00–11:30 英语（李老师）。这份安排的问题是——",
        options: [
          { text: "同一间教室时间重叠 30 分钟", score: 3 },
          { text: "两位老师时间重叠", score: 0 },
          { text: "两节课时长不一致", score: 0 },
          { text: "没有问题", score: 0 },
        ],
      },
      {
        id: "A02", kind: "choice",
        text: "名单：报名 12 人，实到 11 人，签到表上「王梓涵」出现两次、签到 13 次。应核对的是——",
        options: [
          { text: "重复签到那一条，以及缺席的是哪一位", score: 3 },
          { text: "报名人数是否写错", score: 0 },
          { text: "签到表是否需要重印", score: 0 },
          { text: "没有问题，按 13 人计", score: 0 },
        ],
      },
      {
        id: "A03", kind: "choice",
        text: "金额：单价 480，报 3 期，优惠「第 3 期半价」。应收——",
        options: [
          { text: "1200", score: 3 },
          { text: "1440", score: 0 },
          { text: "1080", score: 0 },
          { text: "1320", score: 0 },
        ],
      },
      {
        id: "A04", kind: "choice",
        text: "日期：课程从 3 月 30 日（周一）起，每周一次，共 4 次。第 4 次是——",
        options: [
          { text: "4 月 20 日，周一", score: 3 },
          { text: "4 月 19 日，周日", score: 0 },
          { text: "4 月 27 日，周一", score: 0 },
          { text: "4 月 21 日，周二", score: 0 },
        ],
      },
      {
        id: "A05", kind: "choice",
        text: "课表：周一至周五 18:00–20:00 排满，周六 9:00–12:00 空着。家长要求「工作日晚 7 点后的一对一」，你能给的最早时段是——",
        options: [
          { text: "周六上午，或工作日 20:00 之后（需确认是否允许）", score: 3 },
          { text: "工作日 19:00，把原有课往后挪", score: 0 },
          { text: "没有时间，直接拒绝", score: 0 },
          { text: "先答应 19:00，到时候再协调", score: 0 },
        ],
      },
      {
        id: "A06", kind: "choice",
        text: "退费：交了 6 期共 5400，上了 2 期，合同写「按已上课期数扣费，余款全退，另扣 5% 手续费」。应退——",
        options: [
          { text: "3420", score: 3 },
          { text: "3600", score: 0 },
          { text: "3240", score: 0 },
          { text: "3510", score: 0 },
        ],
      },
      {
        id: "A07", kind: "choice",
        text: "同一份表格里：A 学生写了「已缴费」，B 学生写了「已交费」，C 学生空着。最该做的是——",
        options: [
          { text: "统一用词，并向 C 的学生家长确认缴费状态", score: 3 },
          { text: "把 B 改成「已缴费」就好", score: 1 },
          { text: "空着就按未缴费处理", score: 0 },
          { text: "不用管，自己看得懂", score: 0 },
        ],
      },
      {
        id: "A08", kind: "choice",
        text: "家长发来「孩子这周六下午 3 点来」，但周六下午 3 点已有另一个学生占了这个老师。你会——",
        options: [
          { text: "先回「这个时段已满，我确认后十分钟内给您答复」，再去排", score: 3 },
          { text: "直接答应，到时候再跟老师协调", score: 0 },
          { text: "回「不行」，不给替代方案", score: 1 },
          { text: "先不回复，等有空再说", score: 0 },
        ],
      },
      { id: "A09", kind: "likert", text: "发出去的表格，我会先自己填一遍，看会不会有填不下去的地方。" },
      { id: "A10", kind: "likert", text: "同一个数字，我习惯再核一遍才敢往外发。" },
      { id: "A11", kind: "likert", text: "事情多的时候，我会先把容易出错的几项挑出来单独记。" },
      { id: "A12", kind: "likert", text: "别人催得急，我就先发出去，错了再改。", reverse: true },
    ],
  },

  mgmt: {
    name: "领导动机与决策",
    blurb: "很多人业务做得很好，一提带人就躲——这组题看的是你愿不愿意管人、怎么定事、敢不敢说重话。",
    minutes: 10,
    items: [
      { id: "M01", kind: "likert", text: "带人这件事本身让我有兴趣，不只是把它当成升职的台阶。" },
      { id: "M02", kind: "likert", text: "要开口指出下属做得不好，我会觉得为难，宁愿自己做。", reverse: true },
      { id: "M03", kind: "likert", text: "看到别人卡住，我会主动过去教方法，而不是替他做完。" },
      { id: "M04", kind: "likert", text: "团队里有人状态差，我会专门找时间跟他谈。" },
      { id: "M05", kind: "likert", text: "我更愿意自己把业绩做到第一，而不是带出一支能打的队伍。", reverse: true },
      { id: "M06", kind: "likert", text: "就算要处理人和人的矛盾，我也愿意坐这个位置。" },
      {
        id: "M07", kind: "choice", text: "一位老员工业绩不错，但常在团队里抱怨、影响氛围，你会——",
        options: [
          { text: "单独谈一次，说清具体影响，给出改进的期限和标准", score: 3 },
          { text: "先观察，等他自己的问题暴露出来", score: 0 },
          { text: "调开他的座位或分组，减少影响面", score: 1 },
          { text: "为了业绩先不动他", score: 0 },
        ],
      },
      {
        id: "M08", kind: "choice", text: "两个方案：A 稳妥，能保 80 分；B 有风险，可能 100 也可能 50。时间只够选一个，你会——",
        options: [
          { text: "先看这件事输不输得起，输得起就上 B", score: 3 },
          { text: "选 A，稳一点总没错", score: 1 },
          { text: "选 B，不搏没有超额回报", score: 1 },
          { text: "把事情交上去，让上面定", score: 0 },
        ],
      },
      {
        id: "M09", kind: "choice", text: "团队连续两个月没达标，你会先做哪件事？",
        options: [
          { text: "把过程数据拆开，看是量不够、转化不行、还是人不对", score: 3 },
          { text: "先开会鼓劲，把士气提起来", score: 1 },
          { text: "调整目标，让数字看起来合理", score: 0 },
          { text: "换掉表现最差的两个人", score: 1 },
        ],
      },
      {
        id: "M10", kind: "choice", text: "你自己判断该做的一件事，上级明确不同意，你会——",
        options: [
          { text: "把判断依据讲清楚，请他明确风险由谁承担；仍不同意就执行，并留下记录", score: 3 },
          { text: "照他说的做，不再提", score: 1 },
          { text: "当面争到底，争不下来再说", score: 0 },
          { text: "表面答应，实际按自己的做", score: 0 },
        ],
      },
      {
        id: "M11", kind: "choice", text: "一个能力很强但不太服管的骨干提出「要么给我升职，要么我走」，你会——",
        options: [
          { text: "先问清他要的到底是什么（钱、权、还是被认可），再给一个有时间表的答复", score: 3 },
          { text: "马上答应升职，先留住人", score: 1 },
          { text: "直接放他走，团队不能开这个口子", score: 1 },
          { text: "拖着不表态，看他会不会自己冷静", score: 0 },
        ],
      },
      {
        id: "M12", kind: "choice", text: "开会时两个人当场吵起来，你会——",
        options: [
          { text: "先叫停情绪，把两人各自的主张复述一遍，再回到要决定的那件事上", score: 3 },
          { text: "让他们吵完，吵清楚也好", score: 0 },
          { text: "当场各打五十大板，散会再说", score: 1 },
          { text: "先站队支持更有道理的一方", score: 1 },
        ],
      },
      /* v270 起扩到 20 题：原来 12 题撑着「领导动机」一维，用它单独判「能不能带人」偏薄。
         新增 8 题补的是管理真正会撞上的四种场合：授权、反馈、推新流程、向上争取。 */
      { id: "M13", kind: "likert", text: "把事交给别人做，我总是担心他做不好，最后往往自己重做一遍。", reverse: true },
      { id: "M14", kind: "likert", text: "下属提出一个比我更好的做法，我会直接采用，不在意是谁提的。" },
      { id: "M15", kind: "likert", text: "团队里有人长期不达标，我会拖很久才去处理。", reverse: true },
      { id: "M16", kind: "likert", text: "我愿意花时间教一个人，哪怕他半年内还派不上用场。" },
      {
        id: "M17", kind: "choice", text: "你带 5 个人：一个能力最强但不太服管，另外四个服管但能力一般。季度目标压下来，你会——",
        options: [
          { text: "把最难的一段交给他，同时把标准和节点定死，用结果换他的空间", score: 3 },
          { text: "先压服他，杀一儆百", score: 1 },
          { text: "把最强的人晾着，靠另外四个稳一点", score: 0 },
          { text: "让他带一个新人，把他的精力占住", score: 2 },
        ],
      },
      {
        id: "M18", kind: "choice", text: "你要推一个新流程，老员工普遍抵触，说「以前也这么过来的」。你会——",
        options: [
          { text: "找两个愿意试的人先跑两周，拿数据说话，再全组推", score: 3 },
          { text: "开会讲清楚为什么必须改，然后强制执行", score: 2 },
          { text: "先放一放，等他们自己想通", score: 0 },
          { text: "谁抵触就换谁", score: 1 },
        ],
      },
      {
        id: "M19", kind: "choice", text: "上级给了一个明显完不成的目标，团队已经连续加班一个月。你会——",
        options: [
          { text: "带着数据和资源缺口去谈：要人、要时间，或者明确砍掉一部分", score: 3 },
          { text: "接住，回来再压给团队", score: 0 },
          { text: "当场拒绝，说做不到", score: 1 },
          { text: "自己把最难的活干了，让团队正常下班", score: 1 },
        ],
      },
      {
        id: "M20", kind: "choice", text: "年底评优只有一个名额：A 业绩第一但常抢别人的单；B 业绩第三但带出了两个新人。你会——",
        options: [
          { text: "给 B，并在团队里讲清楚：这个奖奖的是让团队变强的人", score: 3 },
          { text: "给 A，业绩说话", score: 1 },
          { text: "给 A，私下再补偿 B", score: 1 },
          { text: "两个都不给，留到明年再说", score: 0 },
        ],
      },
    ],
  },

  mkt: {
    name: "渠道判断与投放",
    blurb: "推广岗不考你会不会逼单，考的是「钱和内容投出去，能不能换回名单」——判断依据、成本口径、复盘习惯。",
    minutes: 6,
    items: [
      { id: "K01", kind: "likert", text: "一条渠道三天没起量，我会先怀疑渠道不行，换一个再说。", reverse: true },
      { id: "K02", kind: "likert", text: "投出去的钱，我记不清每一笔换回了多少条名单。", reverse: true },
      { id: "K03", kind: "likert", text: "写一条给家长看的文案，比跟家长当面聊更让我有成就感。" },
      { id: "K04", kind: "likert", text: "同一个活动连做三次没效果，我还能耐心把第四次改明白。" },
      {
        id: "K05", kind: "choice", text: "3000 块预算、一周时间、目标 60 条本地初三家长留资，你会先做哪件事？",
        options: [
          { text: "先花 300 块测三条不同素材，看哪条留资成本最低，再把剩下的钱压到最好那条", score: 3 },
          { text: "直接找本地最大的家长群群主，一次投完", score: 1 },
          { text: "印 2000 份单页，去三所学校门口发", score: 1 },
          { text: "先做一张海报，发朋友圈让老师转发", score: 0 },
        ],
      },
      {
        id: "K06", kind: "choice", text: "一场线下讲座来了 40 个家长、留了 25 个电话。第二天打过去，8 个不接、5 个说不需要。你会先做什么？",
        options: [
          { text: "把 25 个按到场时长和提问情况分层，先跟最投入的 8 个约面谈", score: 3 },
          { text: "复盘讲座内容哪里没讲好", score: 2 },
          { text: "给 25 个人统一发一条活动回顾和资料", score: 1 },
          { text: "把不接电话的再打两遍", score: 0 },
        ],
      },
      {
        id: "K07", kind: "choice", text: "两个渠道：A 留资成本 12 元/条、到店率 10%；B 成本 40 元/条、到店率 45%。你怎么看？",
        options: [
          { text: "算到店成本：A 是 120 元一个到店，B 是 89 元，B 更划算", score: 3 },
          { text: "选 B，质量好比数量重要", score: 2 },
          { text: "选 A，名单多，后面慢慢筛", score: 1 },
          { text: "两个都投，各一半", score: 1 },
        ],
      },
      {
        id: "K08", kind: "choice", text: "校长要求「这个月必须带来 200 条名单」，你判断现有渠道最多 120 条。你会——",
        options: [
          { text: "算清缺口，列出要新开哪几个渠道、各要多少预算和时间，带着方案去谈", score: 3 },
          { text: "直接说做不到，让他改目标", score: 1 },
          { text: "加大现有渠道投放量，先把数字凑上", score: 1 },
          { text: "先答应下来，做不到再说", score: 0 },
        ],
      },
      {
        id: "K09", kind: "choice", text: "一条短视频跑了 5000 播放、0 留资，你会先看什么？",
        options: [
          { text: "看完播率和跳出点，判断是内容没留住人，还是结尾没给下一步", score: 3 },
          { text: "看是不是平台限流了", score: 1 },
          { text: "换一条视频重发", score: 0 },
          { text: "加投放，让更多人看到", score: 0 },
        ],
      },
      {
        id: "K10", kind: "choice", text: "一场地推结束：发了 800 张单页、加了 30 个微信、3 个问了价格。这次活动你怎么记？",
        options: [
          { text: "记清发放量、加微率、问价率、单条成本，以及哪个点位、哪个时段最好", score: 3 },
          { text: "只记加了 30 个微信", score: 1 },
          { text: "记个总数，下次注意", score: 0 },
          { text: "不记，效果好下次再做", score: 0 },
        ],
      },
    ],
  },
};

/* ============================ 六、量表信息 ============================ */

export type TalentPartKey = "bigfive" | "value" | "discwork" | "eq" | DutyPackKey;

export const PART_META: Record<TalentPartKey, { name: string; short: string; minutes: number; items: number }> = {
  bigfive: { name: "大五人格", short: "20 题", minutes: 5, items: 20 },
  value: { name: "工作价值观", short: "18 题", minutes: 4, items: 18 },
  discwork: { name: "职场 DISC", short: "24 组", minutes: 7, items: 24 },
  eq: { name: "特质情商", short: "30 题", minutes: 8, items: 30 },
  sales: { name: "拒绝恢复力", short: "10 题", minutes: 6, items: 10 },
  service: { name: "情绪劳动耐受", short: "10 题", minutes: 6, items: 10 },
  admin: { name: "细致准确", short: "12 题", minutes: 8, items: 12 },
  mkt: { name: "渠道判断与投放", short: "10 题", minutes: 6, items: 10 },
  mgmt: { name: "领导动机与决策", short: "20 题", minutes: 10, items: 20 },
};
