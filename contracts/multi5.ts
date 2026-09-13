/**
 * 多元智能五项客观题测评（multi5）题库、计分器与报告文案生成。
 *
 * 理论依据：本测评借鉴卡特尔（Cattell）流体智力与晶体智力理论，
 * 以「演绎推理、细节感知、数字计算、词义理解、空间定向」五项可客观
 * 评量的基础认知能力为维度，采用有唯一正确答案的客观题施测；
 * 结果反映当前学业相关认知能力的表现水平，而非智力高低的定论。
 *
 * 前后端共享：纯类型、纯数据、纯函数，不依赖服务端或 React。
 */

export type Multi5Key = "reasoning" | "detail" | "number" | "verbal" | "spatial";

/** 固定维序（题库分组、并列排序、结果展示均以此为基准顺序）。 */
export const MULTI5_DIM_ORDER: Multi5Key[] = ["reasoning", "detail", "number", "verbal", "spatial"];

/** 维度中文名。 */
export const MULTI5_DIM_LABEL: Record<Multi5Key, string> = {
  reasoning: "演绎推理",
  detail: "细节感知",
  number: "数字计算",
  verbal: "词义理解",
  spatial: "空间定向",
};

export type Multi5Question = {
  no: number;
  dim: Multi5Key;
  text: string;
  /** 四个选项。 */
  options: [string, string, string, string];
  /** 正确选项下标（仅服务端/计分可见，questions 接口下发时剔除）。 */
  answer: 0 | 1 | 2 | 3;
};

/** 下发给客户端的题干（不含答案）。 */
export type Multi5PublicQuestion = Omit<Multi5Question, "answer">;

export type Multi5Result = {
  /** 每维得分（该维正确数/题数*100，取整，0-100）。 */
  dims: Record<Multi5Key, number>;
  /** 综合水平：五维均值（取整，0-100）。 */
  overall: number;
  /** 细心指数：全卷答题正确率（取整，0-100）。 */
  carefulIndex: number;
  /** 每维答对数 / 题数明细。 */
  perDim: { key: Multi5Key; correct: number; total: number }[];
};

export type Multi5Band = "优秀" | "良好" | "中等" | "待提升";

export type Multi5DimReport = {
  key: Multi5Key;
  label: string;
  score: number;
  band: Multi5Band;
  feature: string;
  evalPoints: string[];
  studyAdvice: string[];
  careerAdvice: string[];
  growthAdvice: string[];
};

export type Multi5Report = {
  overall: number;
  carefulIndex: number;
  topKey: Multi5Key;
  theoryNote: string;
  dims: Multi5DimReport[];
};

/* ---------------- 题库（每维 8 题，按维度分组，难度有梯度） ---------------- */

const BANK: Record<Multi5Key, { text: string; options: [string, string, string, string]; answer: 0 | 1 | 2 | 3 }[]> = {
  reasoning: [
    { text: "找规律填数：2，4，8，16，（ ）", options: ["30", "32", "34", "36"], answer: 1 },
    { text: "找规律填数：1，1，2，3，5，8，（ ）", options: ["11", "12", "13", "14"], answer: 2 },
    { text: "找规律填数：3，6，11，18，27，（ ）", options: ["36", "37", "38", "39"], answer: 2 },
    { text: "已知「所有的猫都是动物」，「咪咪是一只猫」，那么可以推出（ ）", options: ["咪咪是动物", "咪咪不是动物", "所有动物都是猫", "无法确定"], answer: 0 },
    { text: "甲比乙高，乙比丙高，那么（ ）", options: ["丙比甲高", "甲比丙高", "甲和丙一样高", "无法比较"], answer: 1 },
    { text: "学校规定：如果今天下雨，运动会就取消。今天下雨了，那么（ ）", options: ["运动会照常举行", "运动会取消", "运动会推迟到明天", "无法确定"], answer: 1 },
    { text: "找规律填数：1，4，9，16，25，（ ）", options: ["30", "32", "35", "36"], answer: 3 },
    { text: "「苹果」之于「苹果树」，如同「葡萄」之于（ ）", options: ["葡萄酒", "葡萄藤", "葡萄干", "葡萄园"], answer: 1 },
  ],
  detail: [
    { text: "下面哪一组数字与「5836247」完全相同？", options: ["5836247", "5836274", "5832647", "5863247"], answer: 0 },
    { text: "下面哪一组数字与「9461283」完全相同？", options: ["9461238", "9416283", "9461283", "9462183"], answer: 2 },
    { text: "在数字串「68696686」中，数字 6 出现了几次？", options: ["4 次", "5 次", "6 次", "7 次"], answer: 1 },
    { text: "下列词语中没有错别字的一项是（ ）", options: ["按装", "松驰", "部署", "振惊"], answer: 2 },
    { text: "「慢慢___走」中应填入（ ）", options: ["的", "得", "地", "着"], answer: 2 },
    { text: "「自___」一词中应填入（ ）", options: ["已", "己", "巳", "以"], answer: 1 },
    { text: "下列英语单词拼写正确的一项是（ ）", options: ["recieve", "riceive", "receve", "receive"], answer: 3 },
    { text: "下列诗句与「春风又绿江南岸」完全相同的一项是（ ）", options: ["春风又绿江南岸", "春风又绿江南坡", "春风又渡江南岸", "春分又绿江南岸"], answer: 0 },
  ],
  number: [
    { text: "36 + 47 = （ ）", options: ["81", "82", "83", "84"], answer: 2 },
    { text: "25 × 4 = （ ）", options: ["75", "90", "100", "125"], answer: 2 },
    { text: "1/2 + 1/4 = （ ）", options: ["1/6", "2/6", "3/4", "1/4"], answer: 2 },
    { text: "一本书 240 页，每天看 30 页，（ ）天可以看完", options: ["6 天", "7 天", "8 天", "9 天"], answer: 2 },
    { text: "0.3 + 0.45 = （ ）", options: ["0.48", "0.75", "0.72", "0.78"], answer: 1 },
    { text: "8 × 12 = （ ）", options: ["86", "92", "96", "108"], answer: 2 },
    { text: "一件商品原价 80 元，打八折后的价格是（ ）", options: ["56 元", "60 元", "64 元", "72 元"], answer: 2 },
    { text: "144 ÷ 12 = （ ）", options: ["11", "12", "13", "14"], answer: 1 },
  ],
  verbal: [
    { text: "「高兴」的近义词是（ ）", options: ["难过", "开心", "生气", "害怕"], answer: 1 },
    { text: "「光明」的反义词是（ ）", options: ["明亮", "温暖", "黑暗", "寒冷"], answer: 2 },
    { text: "「崎岖」一词的意思是（ ）", options: ["平坦宽阔", "山路不平", "风景优美", "人烟稀少"], answer: 1 },
    { text: "「持之以恒」中的「恒」意思是（ ）", options: ["常常", "很快", "暂时", "恒心、长久"], answer: 3 },
    { text: "「他做事总是半途而废」中「半途而废」的意思是（ ）", options: ["做到一半就放弃", "路上走了一半", "事情做得很快", "先休息再继续"], answer: 0 },
    { text: "下列词语中，感情色彩与其他三个不同的是（ ）", options: ["勤奋", "懒惰", "认真", "勇敢"], answer: 1 },
    { text: "「亡羊补牢」这个成语告诉我们（ ）", options: ["羊丢了就再也找不回来", "出了问题及时补救还不算晚", "修羊圈要趁羊没丢", "做事不要太着急"], answer: 1 },
    { text: "「幽静」的近义词是（ ）", options: ["喧闹", "热闹", "安静", "繁华"], answer: 2 },
  ],
  spatial: [
    { text: "一个箭头指向右方，把它顺时针旋转 90° 后，箭头指向（ ）", options: ["上", "下", "左", "右"], answer: 1 },
    { text: "把一张正方形纸对折一次、再对折一次，展开后折痕把纸分成了（ ）份", options: ["2 份", "3 份", "4 份", "5 份"], answer: 2 },
    { text: "一个正方体一共有（ ）个面", options: ["4 个", "5 个", "6 个", "8 个"], answer: 2 },
    { text: "从镜子里看钟面显示 3:00，实际时间是（ ）", options: ["3:00", "6:00", "9:00", "12:00"], answer: 2 },
    { text: "一排有 8 个小朋友，小明左边有 3 人，那么他右边有（ ）人", options: ["3 人", "4 人", "5 人", "6 人"], answer: 1 },
    { text: "一个圆柱体，从上往下看，看到的形状是（ ）", options: ["长方形", "圆形", "三角形", "正方形"], answer: 1 },
    { text: "你面向北方站立，右手边是（ ）方", options: ["东", "南", "西", "北"], answer: 0 },
    { text: "骰子相对两面的点数之和都是 7，如果上面是 2 点，那么下面是（ ）点", options: ["3 点", "4 点", "5 点", "6 点"], answer: 2 },
  ],
};

/** 多元智能五项客观题库：40 道单选题，每维 8 题，按维度分组排列。 */
export const MULTI5_QUESTIONS: Multi5Question[] = MULTI5_DIM_ORDER.flatMap((dim) =>
  BANK[dim].map((q) => ({ ...q, dim })),
).map((q, i) => ({ ...q, no: i + 1 }));

/** 每维题数。 */
export const MULTI5_PER_DIM = 8;

/* ---------------- 计分 ---------------- */

/**
 * multi5 计分。answers[i]：第 i+1 题所选项下标（0-3）；长度须为 40。
 * - 维度得分 = 该维正确数 / 题数 * 100（取整）；
 * - 细心指数 = 全卷正确率（取整）；
 * - 综合水平 = 五维均值（取整）。
 */
export function scoreMulti5(answers: number[]): Multi5Result {
  if (answers.length !== MULTI5_QUESTIONS.length) {
    throw new Error(`多元智能五项测评题数应为 ${MULTI5_QUESTIONS.length}，实际 ${answers.length}`);
  }
  const correct: Record<Multi5Key, number> = { reasoning: 0, detail: 0, number: 0, verbal: 0, spatial: 0 };
  const total: Record<Multi5Key, number> = { reasoning: 0, detail: 0, number: 0, verbal: 0, spatial: 0 };
  answers.forEach((raw, i) => {
    if (!Number.isInteger(raw) || raw < 0 || raw > 3) {
      throw new Error(`第 ${i + 1} 题的选项应在 0-3 之间，实际 ${raw}`);
    }
    const q = MULTI5_QUESTIONS[i];
    total[q.dim] += 1;
    if (raw === q.answer) correct[q.dim] += 1;
  });
  const dims = MULTI5_DIM_ORDER.reduce((acc, key) => {
    acc[key] = Math.round((correct[key] / total[key]) * 100);
    return acc;
  }, {} as Record<Multi5Key, number>);
  const overall = Math.round(MULTI5_DIM_ORDER.reduce((s, k) => s + dims[k], 0) / MULTI5_DIM_ORDER.length);
  const carefulIndex = Math.round(
    (MULTI5_DIM_ORDER.reduce((s, k) => s + correct[k], 0) / MULTI5_QUESTIONS.length) * 100,
  );
  const perDim = MULTI5_DIM_ORDER.map((key) => ({ key, correct: correct[key], total: total[key] }));
  return { dims, overall, carefulIndex, perDim };
}

/* ---------------- 报告文案 ---------------- */

export const MULTI5_THEORY_NOTE =
  "本测评借鉴卡特尔（Cattell）流体智力与晶体智力理论编制：演绎推理、数字计算、空间定向偏向流体智力（面对新问题的加工能力），词义理解、细节感知偏向晶体智力（知识经验的积累与运用）。结果反映当前学业相关认知能力的表现水平，供学习规划参考。";

function bandOf(score: number): Multi5Band {
  if (score >= 80) return "优秀";
  if (score >= 60) return "良好";
  if (score >= 40) return "中等";
  return "待提升";
}

/** 每维固定文案（特征 / 学习建议 / 职业建议 / 成长建议）。 */
const DIM_COPY: Record<
  Multi5Key,
  { feature: string; studyAdvice: string[]; careerAdvice: string[]; growthAdvice: string[] }
> = {
  reasoning: {
    feature:
      "演绎推理是从已知条件出发、按逻辑规则推出结论的能力，是数学证明、科学探究和阅读理解中「讲道理」的底层引擎。",
    studyAdvice: [
      "数学：做几何证明和应用题时，把每一步「为什么成立」写在旁边，养成完整推理链的习惯",
      "物理/化学：遇到实验结论题，先说条件、再说依据、最后说结论，练习三段式表达",
      "语文/英语：阅读理解的推断题，先回原文找证据句，再判断哪个选项「一定能推出」",
    ],
    careerAdvice: [
      "推理能力突出者适合需要严密逻辑的方向：数学、计算机科学、法律、工程、科研",
      "日常可多接触编程、数独、逻辑谜题和辩论，把推理兴趣转化为可迁移的专长",
      "该能力是多数理工科与规则型职业（审计、司法、系统分析）的共同基础",
    ],
    growthAdvice: [
      "每周做 2-3 道数列/逻辑推理题，做完讲一遍自己的推理过程",
      "下棋、玩策略类游戏时，养成「先想两步再落子」的习惯",
      "遇到结论先问「证据是什么、有没有反例」，训练批判性思维",
    ],
  },
  detail: {
    feature:
      "细节感知是快速准确地比对、辨异和校对的能力，决定审题是否看全条件、作业是否少出错别字和计算誊写错误。",
    studyAdvice: [
      "语文/英语：写完作业用「指读法」检查一遍错别字和拼写，重点关注形近字、易混词",
      "数学：审题时圈出数字和单位，誊写答案后再核对一遍原题，减少「看错了」的失分",
      "化学/生物：观察实验现象时按「颜色、状态、气味、变化前后」逐项记录，训练有序观察",
    ],
    careerAdvice: [
      "细节感知突出者适合对准确性要求高的方向：会计审计、编辑校对、医学检验、质量工程",
      "实验科学（化学、生物、医学）高度依赖细致的观察与记录能力",
      "可把「找不同、校对」类小游戏作为日常训练，保持细节敏锐度",
    ],
    growthAdvice: [
      "建立「错题本·粗心专栏」，把每次看错、抄错的题归类，找出自己最容易错的点",
      "做完练习强制留出 2 分钟检查时间，先查数字再查字词",
      "练习慢读题：每道题读两遍再动笔，第一遍了解大意、第二遍抓条件",
    ],
  },
  number: {
    feature:
      "数字计算是快速准确地进行口算、心算与数感估算的能力，是数学、物理、化学等理科学习的「基本功」和速度来源。",
    studyAdvice: [
      "数学：每天 5 分钟口算打卡（四则混合运算、分数小数互化），先把正确率做到 100% 再提速",
      "物理：公式计算前先估算数量级，算完用估算结果检验答案是否合理",
      "化学：方程式配平和质量计算多动手算，避免只会列式不会算结果",
    ],
    careerAdvice: [
      "数字计算突出者适合与数量打交道的方向：数学、金融、统计、工程、数据科学",
      "经济、会计、精算等职业以快速准确的数字处理为核心竞争力",
      "可参加口算、速算或数学竞赛类活动，把数感优势沉淀为学科特长",
    ],
    growthAdvice: [
      "生活里主动算账：购物找零、折扣换算、时间规划都先心算再核对",
      "错题中若是计算失误，单独标记并重算三遍，找出错在哪一步",
      "玩 24 点、数独等数字游戏，在兴趣中提升运算流畅度",
    ],
  },
  verbal: {
    feature:
      "词义理解是准确把握词语含义、近义辨析与语境用法的能力，是语文阅读、英语词汇和各学科审题的共同基础。",
    studyAdvice: [
      "语文：准备一个「词语辨析本」，把易混近义词（如幽静/安静）连同例句一起积累",
      "英语：背单词时同时记一个搭配和一句例句，在语境中掌握词义而非死记中文释义",
      "全科审题：遇到陌生术语先拆字猜义、再回上下文验证，减少因词义误解的失分",
    ],
    careerAdvice: [
      "词义理解突出者适合以语言为核心的方向：中文、外语、新闻、法律、教育",
      "翻译、编辑、文案等职业要求对词义的细微差别高度敏感",
      "广泛阅读是词义能力最好的长期投资，文学与科普并重",
    ],
    growthAdvice: [
      "每天精读一段课外文字，划出 3 个好词并口头造句",
      "遇到不认识的词先猜后查，把「猜对率」当成小游戏",
      "每周复述一篇文章的大意，练习用自己的话准确表达",
    ],
  },
  spatial: {
    feature:
      "空间定向是在头脑中对图形、方位和立体结构进行旋转、展开与转换的能力，是几何、地理读图和工程制图的底层能力。",
    studyAdvice: [
      "数学：立体几何题先动手画展开图和三视图，把脑中的想象落到纸面上验证",
      "地理：读图训练用「上北下南」先定向，再描述相对方位和路线",
      "物理：画受力分析图、光路图时注意方向与位置关系，图形准确是解题前提",
    ],
    careerAdvice: [
      "空间定向突出者适合与图形空间打交道的方向：建筑、工程、地理信息、医学影像、设计",
      "机械制图、飞行员、外科医生等职业对空间想象要求极高",
      "积木、模型、魔方、制图软件都是低成本高回报的空间训练",
    ],
    growthAdvice: [
      "玩拼图、折纸、魔方时，先预测结果再动手验证，训练心理旋转",
      "看地图出行时自己规划路线，并在脑中「预演」一遍转向",
      "把课本里的平面图试着想成立体实物，再对照实物模型检查",
    ],
  },
};

/** 每维按档位的评估结果描述。 */
const DIM_EVAL: Record<Multi5Key, Record<Multi5Band, string[]>> = {
  reasoning: {
    优秀: [
      "面对陌生的规律和逻辑问题，能迅速抓住条件之间的因果关系",
      "数列推理与三段论类题目正确率很高，推理链完整、很少跳步",
      "具备把生活情境抽象成逻辑命题并得出结论的能力",
      "推理能力已超出同龄人平均水平，是理科学习的显著优势",
    ],
    良好: [
      "多数推理题能稳定做对，条件清晰时推理顺畅",
      "面对多步推理偶有跳步或中途丢失条件的情况",
      "对「一定能推出」和「可能推出」的区分基本清楚",
    ],
    中等: [
      "简单规律能发现，但条件一多就容易顾此失彼",
      "做推断时常凭感觉下结论，缺少一步步验证的习惯",
      "需要把推理过程写出来才能保持正确率",
    ],
    待提升: [
      "对规律和因果关系的捕捉目前比较吃力，常靠猜测作答",
      "面对逻辑题容易放弃中间步骤，直接选「看着像」的选项",
      "建议从最基础的一步推理练起，先求对、再求快",
    ],
  },
  detail: {
    优秀: [
      "形近字、易混数字和拼写差异的辨别又快又准",
      "在长串信息比对中几乎不出错，校对能力很强",
      "审题时能注意到别人容易忽略的小条件和小差别",
      "细心程度是同龄人中的佼佼者，作业和卷面极少低级失误",
    ],
    良好: [
      "大多数比对题能准确完成，偶有个别漏看",
      "注意力集中时出错很少，疲劳时正确率略有下降",
      "对常见易混点（的/地/得、形近字）掌握较好",
    ],
    中等: [
      "简单比对新不显眼时能做对，信息变长后错误增多",
      "形近字和数字誊写错误时有发生",
      "缺少做完后回头检查的习惯",
    ],
    待提升: [
      "长串信息比对错误较多，容易漏看、看错关键细节",
      "错别字和誊写错误可能是当前主要的非智力失分点",
      "需要建立固定的检查流程来兜底",
    ],
  },
  number: {
    优秀: [
      "口算、心算又快又准，四则混合运算几乎零失误",
      "对数量关系有良好的直觉，估算合理、检验意识强",
      "分数、小数、折扣等换算熟练，理科计算不吃亏",
      "计算能力是当前学习的显著加速器",
    ],
    良好: [
      "常规计算正确率较高，速度也不错",
      "多步计算偶尔在中间步骤出错",
      "面对大数或分数混合运算时需要草稿辅助",
    ],
    中等: [
      "基本运算掌握尚可，但速度和稳定性有波动",
      "遇到多步计算容易抄错或算错中间结果",
      "估算和验算的习惯尚未养成",
    ],
    待提升: [
      "基础口算正确率偏低，是理科学习的主要瓶颈之一",
      "对数量关系的直觉较弱，算完难以判断答案是否合理",
      "需要从每日短时口算训练开始，先把正确率补起来",
    ],
  },
  verbal: {
    优秀: [
      "对词义的理解准确细腻，近义词辨析几乎不失分",
      "成语和词语的感情色彩、使用语境把握到位",
      "词汇积累厚实，为阅读理解和写作提供了坚实底座",
      "语言类学科学习明显省力",
    ],
    良好: [
      "常见词语理解准确，近义词辨析基本可靠",
      "遇到生僻成语时偶有误判，但能结合语境修正",
      "词汇量能支撑日常阅读和表达",
    ],
    中等: [
      "常见词理解尚可，近义词的细微差别容易混淆",
      "成语含义时有张冠李戴，需要加强积累",
      "词义不清偶尔会拖慢审题和阅读速度",
    ],
    待提升: [
      "词汇积累偏薄，词义判断常靠印象",
      "近义词和成语辨析是当前明显的失分点",
      "建议以每日小剂量积累配合语境造句稳步补课",
    ],
  },
  spatial: {
    优秀: [
      "心理旋转、展开折叠和方位判断准确迅速",
      "能在脑中稳定地操作立体图形，空间想象清晰",
      "读图、识方位类问题几乎不费力",
      "空间能力是几何与地理学习的显著优势",
    ],
    良好: [
      "常见旋转与折叠问题能正确想象，偶尔需要动手验证",
      "方位判断可靠，镜像类问题基本掌握",
      "面对复杂立体结构时需要画图辅助",
    ],
    中等: [
      "简单旋转能想象，复杂折叠和镜像判断容易出错",
      "对三维结构的理解依赖实物或图示",
      "空间题正确率不够稳定",
    ],
    待提升: [
      "心理旋转和方位转换目前比较困难",
      "立体图形的想象容易「转不动」，需要大量实物参照",
      "建议从积木、折纸等动手活动起步，逐步建立空间表象",
    ],
  },
};

/** 依据计分结果生成完整报告文案。 */
export function buildMulti5Report(result: Multi5Result): Multi5Report {
  const topKey = [...MULTI5_DIM_ORDER].sort(
    (a, b) => result.dims[b] - result.dims[a] || MULTI5_DIM_ORDER.indexOf(a) - MULTI5_DIM_ORDER.indexOf(b),
  )[0];
  const dims: Multi5DimReport[] = MULTI5_DIM_ORDER.map((key) => {
    const score = result.dims[key];
    const band = bandOf(score);
    const copy = DIM_COPY[key];
    return {
      key,
      label: MULTI5_DIM_LABEL[key],
      score,
      band,
      feature: copy.feature,
      evalPoints: DIM_EVAL[key][band],
      studyAdvice: copy.studyAdvice,
      careerAdvice: copy.careerAdvice,
      growthAdvice: copy.growthAdvice,
    };
  });
  return {
    overall: result.overall,
    carefulIndex: result.carefulIndex,
    topKey,
    theoryNote: MULTI5_THEORY_NOTE,
    dims,
  };
}
