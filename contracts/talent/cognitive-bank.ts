/**
 * 工作能力（客观题）题本：言语理解 / 数字·逻辑 / 抽象·图形 三个维度，各 7 题，共 21 题。
 *
 * 两个版本：教育行业版（C 套）与通用版（G 套）。G 套抽象维与 C 套同题——
 * 抽象推理本来就不依赖行业背景。出卷只给题面，answer 键留在服务端计分用。
 */

export type CogTrack = "edu" | "general";

export type CogDim = "verbal" | "numeric" | "abstract";

export type CogItem = {
  id: string;
  dim: CogDim;
  /** 1 易 / 2 中 / 3 难：效度检查用（难对易错 = 疑似随机作答） */
  difficulty: 1 | 2 | 3;
  text: string;
  options: string[];
  /** 正确选项下标（0 起） */
  answer: number;
};

export const COG_TRACK_LABEL: Record<CogTrack, string> = {
  edu: "教育行业版",
  general: "通用版",
};

export const COG_DIM_LABEL: Record<CogDim, string> = {
  verbal: "言语理解",
  numeric: "数字/逻辑推理",
  abstract: "抽象/图形推理",
};

export const COGNITIVE_ITEMS_EDU: CogItem[] = [
  /* ============ 言语理解（C01–C07）：读懂信息、抓要点、政策/规则理解 ============ */
  {
    id: "C01",
    dim: "verbal",
    difficulty: 1,
    text: "某机构退费规则：开课前 7 天可全额退；开课后 7 天内退，扣 20%；开课超过 7 天不退。一位家长在开课后第 3 天申请退费，正确的处理是——",
    options: ["全额退", "扣 20% 后退还余款", "不退", "扣 20% 后再另收手续费"],
    answer: 1,
  },
  {
    id: "C02",
    dim: "verbal",
    difficulty: 2,
    text: "班主任说：「小王这周作业缺了三次，但每次问起都说『忘了带』，课堂上却能答上问题。我判断问题不在能力，在习惯。」班主任最想表达的是——",
    options: ["小王能力不行", "小王在撒谎", "小王的问题在于作业习惯，而非能力", "小王课堂表现不好"],
    answer: 2,
  },
  {
    id: "C03",
    dim: "verbal",
    difficulty: 2,
    text: "接到一位新家长来电：「孩子初二，数学一直在 70 分上下，想提一提。」在推荐方案前，最该先确认的是——",
    options: ["家长能接受什么价位", "孩子用什么教材、失分主要在哪个模块", "家长住在哪个区", "孩子喜不喜欢数学"],
    answer: 1,
  },
  {
    id: "C04",
    dim: "verbal",
    difficulty: 2,
    text: "规则：「凡报名两期及以上，赠一次模考；单期报名不赠。」与这条规则一致的说法是——",
    options: ["报名单期也赠模考", "报名两期赠模考", "报名两期不赠", "是否赠模考与报名期数无关"],
    answer: 1,
  },
  {
    id: "C05",
    dim: "verbal",
    difficulty: 3,
    text: "数据显示：把补课时间安排在周末晚上的学生，出勤率明显高于安排在工作日放学后的。最合理的解释是——",
    options: ["周末晚上学生更爱学习", "工作日放学后时间冲突多、出勤不稳定", "出勤率和时间段无关", "学生只在周末愿意补课"],
    answer: 1,
  },
  {
    id: "C06",
    dim: "verbal",
    difficulty: 2,
    text: "老师交代助教：「先按年级把名单分开，再在每个年级里按报名先后排，最后把需要补课时时的标出来。」正确的执行顺序是——",
    options: ["标补课 → 分年级 → 按报名排", "分年级 → 按报名先后排 → 标补课", "按报名先后排 → 分年级 → 标补课", "分年级 → 标补课 → 按报名排"],
    answer: 1,
  },
  {
    id: "C07",
    dim: "verbal",
    difficulty: 2,
    text: "向家长说明「退费到账时间」，最准确、最不易引起误解的说法是——",
    options: ["「很快就到账」", "「申请通过后，3 到 5 个工作日内到账。」", "「一般都会到账」", "「过几天就到了」"],
    answer: 1,
  },
  /* ============ 数字/逻辑推理（C08–C14）：算分、报价、排课、数据对比、逻辑链 ============ */
  {
    id: "C08",
    dim: "numeric",
    difficulty: 1,
    text: "客房预算 3.6 万。方案 A：每期 4800、共 8 期；方案 B：一口价 3.2 万。哪个总价更低？",
    options: ["方案 A", "方案 B", "一样", "无法比较"],
    answer: 1,
  },
  {
    id: "C09",
    dim: "numeric",
    difficulty: 2,
    text: "交了 6 期共 5400 元，已上 2 期。合同约定「按已上课期数扣费、余款全退，另扣 5% 手续费」。应退——",
    options: ["3420", "3600", "3240", "3510"],
    answer: 0,
  },
  {
    id: "C10",
    dim: "numeric",
    difficulty: 2,
    text: "排课表：A 教室 9:00–10:30 数学（张老师），10:00–11:30 英语（李老师）。这份安排的问题是——",
    options: ["两位老师时间重叠", "同一时间教室时间重叠 30 分钟", "两节课时长不一致", "没有问题"],
    answer: 1,
  },
  {
    id: "C11",
    dim: "numeric",
    difficulty: 3,
    text: "某课原价 400 元/次。优惠 A：买 10 次送 2 次；优惠 B：直接打 8 折。按实际使用 12 次算，哪个单次成本更低？",
    options: ["优惠 A", "优惠 B", "一样", "无法比较"],
    answer: 1,
  },
  {
    id: "C12",
    dim: "numeric",
    difficulty: 2,
    text: "一组数列：2、6、12、20、（ ），括号内应填——",
    options: ["26", "28", "30", "32"],
    answer: 2,
  },
  {
    id: "C13",
    dim: "numeric",
    difficulty: 2,
    text: "三个学生成绩：小明的分数比小华高，小华比小刚高。三人从高到低的顺序是——",
    options: ["小明、小华、小刚", "小华、小明、小刚", "小刚、小华、小明", "小明、小刚、小华"],
    answer: 0,
  },
  {
    id: "C14",
    dim: "numeric",
    difficulty: 2,
    text: "上月课时：张老师 32 节、满意度 4.2；李老师 28 节、满意度 4.6。规则「课时不低于 30 且满意度不低于 4.3」才评优。谁评优？",
    options: ["张老师", "李老师", "都不评优", "都评优"],
    answer: 2,
  },
  /* ============ 抽象/图形推理（C15–C21）：纯 g、学习潜力，不依赖经验与语言 ============ */
  {
    id: "C15",
    dim: "abstract",
    difficulty: 2,
    text: "字母序列：A、C、F、J、（ ），括号内应填——",
    options: ["L", "M", "N", "O"],
    answer: 3,
  },
  {
    id: "C16",
    dim: "abstract",
    difficulty: 2,
    text: "图形序列：○、△、○、△△、○、△△△、（ ），括号内应填——",
    options: ["○", "△", "□", "无法确定"],
    answer: 0,
  },
  {
    id: "C17",
    dim: "abstract",
    difficulty: 2,
    text: "类比：「老师 : 上课」相当于「医生 : （ ）」",
    options: ["医院", "看病", "药房", "病人"],
    answer: 1,
  },
  {
    id: "C18",
    dim: "abstract",
    difficulty: 2,
    text: "下列四组中，规律与其他三组不同的是——",
    options: ["2、4、8", "3、9、27", "5、10、20", "4、8、16"],
    answer: 1,
  },
  {
    id: "C19",
    dim: "abstract",
    difficulty: 3,
    text: "数字矩阵：第一行 3、4、12；第二行 5、2、10；第三行 6、3、（ ）。括号内应填——",
    options: ["9", "12", "18", "20"],
    answer: 2,
  },
  {
    id: "C20",
    dim: "abstract",
    difficulty: 2,
    text: "方向按「上 → 下 → 左 → 右」循环轮换。那么「右」的下一个方向是——",
    options: ["上", "下", "左", "右"],
    answer: 0,
  },
  {
    id: "C21",
    dim: "abstract",
    difficulty: 3,
    text: "规定：「若报了三期，则赠一次模考」。已知某学生没有获得模考赠课，可以推出——",
    options: ["他一定没报三期", "他一定报了三期", "他可能报了三期", "无法判断"],
    answer: 0,
  },
];

export const COGNITIVE_ITEMS_GENERAL: CogItem[] = [
  /* ============ 言语理解（G01–G07） ============ */
  {
    id: "G01",
    dim: "verbal",
    difficulty: 1,
    text: "公司报销制度：一线城市住宿每晚 500 元以内据实报销，其他城市 350 元以内；超标部分自理。某员工在上海住了一晚 620 元，可报销——",
    options: ["620 元", "500 元", "350 元", "0 元"],
    answer: 1,
  },
  {
    id: "G02",
    dim: "verbal",
    difficulty: 2,
    text: "主管说：「小周这周交了三份报表，每次都有数字对不上，但问他口径他能讲清楚。我判断不是他不会，是没核对。」主管最想表达的是——",
    options: ["小周不会做报表", "小周在敷衍", "小周的问题在于核对习惯，而非能力", "小周说不清口径"],
    answer: 2,
  },
  {
    id: "G03",
    dim: "verbal",
    difficulty: 2,
    text: "客户来电：「我们要一套能记考勤、还能算加班的系统，预算先不谈。」在推荐方案前，最该先确认的是——",
    options: ["预算上限是多少", "现在用什么、最麻烦的是哪一步", "公司一共多少人", "老板是否支持"],
    answer: 1,
  },
  {
    id: "G04",
    dim: "verbal",
    difficulty: 2,
    text: "规则：「凡连续两年考核为 A 的员工，可申请一次外部培训；单年 A 不在此列。」与这条规则一致的说法是——",
    options: ["单年 A 也可申请", "连续两年 A 可申请", "连续两年 A 不可申请", "能否申请与年限无关"],
    answer: 1,
  },
  {
    id: "G05",
    dim: "verbal",
    difficulty: 3,
    text: "数据显示：把交付时间从周五提前到周三的团队，延期率明显低于周五交付的团队。最合理的解释是——",
    options: ["周三交付更吉利", "周五交付贴近周末，问题暴露晚、返工时间不足", "延期率与交付日无关", "这些团队只在周三效率高"],
    answer: 1,
  },
  {
    id: "G06",
    dim: "verbal",
    difficulty: 2,
    text: "主管交代：「先把客户按区域分开，再按签约时间排，最后把需要回访的标出来。」正确的执行顺序是——",
    options: ["标回访 → 分区域 → 按签约排", "分区域 → 按签约排 → 标回访", "按签约排 → 分区域 → 标回访", "分区域 → 标回访 → 按签约排"],
    answer: 1,
  },
  {
    id: "G07",
    dim: "verbal",
    difficulty: 2,
    text: "向客户说明「退款到账时间」，最准确、最不易引起误解的说法是——",
    options: ["「很快就到账」", "「审核通过后，3 到 5 个工作日内到账。」", "「一般都会到账」", "「过几天就到了」"],
    answer: 1,
  },
  /* ============ 数字/逻辑推理（G08–G14） ============ */
  {
    id: "G08",
    dim: "numeric",
    difficulty: 1,
    text: "采购预算 3.6 万。方案 A：每批 4800 元、共 8 批；方案 B：一口价 3.2 万。哪个总价更低？",
    options: ["方案 A", "方案 B", "一样", "无法比较"],
    answer: 1,
  },
  {
    id: "G09",
    dim: "numeric",
    difficulty: 2,
    text: "交了 6 期共 5400 元，已用 2 期。约定「按已用期数扣费、余款全退，另扣 5% 手续费」。应退——",
    options: ["3420 元", "3600 元", "3240 元", "3510 元"],
    answer: 0,
  },
  {
    id: "G10",
    dim: "numeric",
    difficulty: 2,
    text: "会议室安排：A 会议室 9:00–10:30 方案评审，10:00–11:30 客户来访。这份安排的问题是——",
    options: ["两位负责人时间重叠", "同一时间会议室重叠 30 分钟", "两场时长不一致", "没有问题"],
    answer: 1,
  },
  {
    id: "G11",
    dim: "numeric",
    difficulty: 3,
    text: "某服务原价 400 元/次。优惠 A：买 10 次送 2 次；优惠 B：直接打 8 折。按实际使用 12 次算，哪个单次成本更低？",
    options: ["优惠 A", "优惠 B", "一样", "无法比较"],
    answer: 1,
  },
  {
    id: "G12",
    dim: "numeric",
    difficulty: 2,
    text: "一组数列：2、6、12、20、（ ），括号内应填——",
    options: ["26", "28", "30", "32"],
    answer: 2,
  },
  {
    id: "G13",
    dim: "numeric",
    difficulty: 2,
    text: "三位同事的完成量：小陈比小林多，小林比小赵多。从多到少的顺序是——",
    options: ["小陈、小林、小赵", "小林、小陈、小赵", "小赵、小林、小陈", "小陈、小赵、小林"],
    answer: 0,
  },
  {
    id: "G14",
    dim: "numeric",
    difficulty: 2,
    text: "上月单量：张 32 单、满意度 4.2；李 28 单、满意度 4.6。规则「单量不低于 30 且满意度不低于 4.3」才评优。谁评优？",
    options: ["张", "李", "都不评优", "都评优"],
    answer: 2,
  },
  /* ============ 抽象/图形推理（G15–G21）：本来就不依赖行业，与 C 套同题 ============ */
  {
    id: "G15",
    dim: "abstract",
    difficulty: 2,
    text: "字母序列：A、C、F、J、（ ），括号内应填——",
    options: ["L", "M", "N", "O"],
    answer: 3,
  },
  {
    id: "G16",
    dim: "abstract",
    difficulty: 2,
    text: "图形序列：○、△、○、△△、○、△△△、（ ），括号内应填——",
    options: ["○", "△", "□", "无法确定"],
    answer: 0,
  },
  {
    id: "G17",
    dim: "abstract",
    difficulty: 2,
    text: "类比：「司机 : 驾驶」相当于「厨师 : （ ）」",
    options: ["厨房", "烹饪", "食材", "客人"],
    answer: 1,
  },
  {
    id: "G18",
    dim: "abstract",
    difficulty: 2,
    text: "下列四组中，规律与其他三组不同的是——",
    options: ["2、4、8", "3、9、27", "5、10、20", "4、8、16"],
    answer: 1,
  },
  {
    id: "G19",
    dim: "abstract",
    difficulty: 3,
    text: "数字矩阵：第一行 3、4、12；第二行 5、2、10；第三行 6、3、（ ）。括号内应填——",
    options: ["9", "12", "18", "20"],
    answer: 2,
  },
  {
    id: "G20",
    dim: "abstract",
    difficulty: 2,
    text: "方向按「上 → 下 → 左 → 右」循环轮换。那么「右」的下一个方向是——",
    options: ["上", "下", "左", "右"],
    answer: 0,
  },
  {
    id: "G21",
    dim: "abstract",
    difficulty: 3,
    text: "规定：「若提交完整材料，则进入复审」。已知某人没有进入复审，可以推出——",
    options: ["他一定没提交完整材料", "他一定提交了完整材料", "他可能提交了完整材料", "无法判断"],
    answer: 0,
  },
];

export function cogItemsFor(track: CogTrack = "edu"): CogItem[] {
  return track === "general" ? COGNITIVE_ITEMS_GENERAL : COGNITIVE_ITEMS_EDU;
}

/** 按题号判断作答走的是哪一套（G 开头 = 通用版） */
export function cogTrackOf(ans: Record<string, unknown>): CogTrack {
  return Object.keys(ans).some((k) => k.startsWith("G")) ? "general" : "edu";
}
