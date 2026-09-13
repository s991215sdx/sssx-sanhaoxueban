import type { KPSeed } from "./seed-types";

const CH = "第一章 有理数";

export const chapter1: KPSeed[] = [
  {
    code: "G7-1-01",
    chapter: CH,
    title: "正数和负数",
    sortOrder: 1,
    summary: [
      { heading: "相反意义的量", body: "生活中常遇到成对的量：收入与支出、上升与下降、向东与向西。为了区分它们，我们把其中一种规定为正，相反的一种就为负。" },
      { heading: "正负数的定义", body: "像 3、1.5、+7 这样大于 0 的数叫正数；在正数前面加上“-”号的数（如 -3、-1.5）叫负数。正数前面的“+”可以省略。" },
      { heading: "0 的特殊地位", body: "0 既不是正数，也不是负数，它是正负数的分界。“0”不只是“没有”，还表示一个确定的基准，比如 0℃ 是一个真实的温度。" },
    ],
    example: {
      stem: "如果向东走 5 m 记作 +5 m，那么向西走 3 m 记作什么？",
      analysis: "“向东”和“向西”是一对相反意义的量。向东记为正，向西就记为负。",
      answer: "-3 m",
    },
    prereqCodes: [],
    commonErrors: [
      { cause: "概念不清", detail: "认为带“-”号的数一定是负数，忽略 a 本身可能为负（-a 可能是正数）。" },
      { cause: "概念不清", detail: "把 0 当成正数，或认为 0 表示“没有”而不理解它是基准。" },
    ],
    socratic: {
      keyConcepts: ["相反意义的量", "0既不是正数也不是负数", "基准", "正负"],
      probes: [
        "用你自己的话说说：什么是“相反意义的量”？能举两个生活中的例子吗？",
        "0 到底是不是正数？0℃ 是“没有温度”吗？",
        "如果一个数前面有负号，比如 -a，它一定是负数吗？为什么？",
      ],
      hints: [
        "想一想天气预报里的零上和零下是怎么表示的。",
        "试着说说“收入 100 元”的反面是什么，该记作什么。",
      ],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "下列各组量中，具有相反意义的是（ ）", options: ["身高增加 2 cm 与体重减少 1 kg", "向东走 5 m 与向南走 3 m", "收入 100 元与支出 50 元", "上升 2 m 与前进 3 m"], answer: "C", hint: "相反意义必须针对“同一种量”。", explanation: "收入与支出都是钱数，且意义相反；A 是两种不同的量，B、D 方向不同但不是相反关系。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "在 -3、0、1.5、-1/2 这四个数中，负数的个数是（ ）", options: ["1 个", "2 个", "3 个", "4 个"], answer: "B", hint: "0 算不算负数？", explanation: "-3 和 -1/2 是负数；0 既不是正数也不是负数；1.5 是正数。" },
      { type: "choice", stage: "practice", difficulty: 1, stem: "如果水位升高 3 m 记作 +3 m，那么水位下降 2 m 记作（ ）", options: ["+2 m", "-2 m", "+5 m", "-5 m"], answer: "B", hint: "升高为正，下降就是负。", explanation: "升高与下降相反，升高记“+”，下降记“-”，所以是 -2 m。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "某次考试班级平均分 85 分，小明考 92 分记作 +7 分，那么小华考 80 分应记作 ____ 分。", answer: "-5", hint: "80 比基准 85 低多少？", explanation: "以 85 分为基准，80-85=-5，记作 -5 分。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "下列说法正确的是（ ）", options: ["0 是正数", "0 是负数", "0 既不是正数也不是负数", "只有带“+”号的数才是正数"], answer: "C", hint: "0 是正、负数的分界。", explanation: "0 是分界，两边都不属于；正数的“+”可以省略，所以 D 也错。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "一袋大米包装袋上标有“净含量 (10±0.15) kg”，下列质量合格的是（ ）", options: ["9.80 kg", "10.16 kg", "10.09 kg", "10.20 kg"], answer: "C", hint: "合格范围是 10-0.15 到 10+0.15 之间。", explanation: "合格范围是 9.85 kg ~ 10.15 kg，只有 10.09 kg 在其中。" },
      { type: "fill", stage: "variant", difficulty: 2, stem: "如果把顺时针旋转 30° 记作 +30°，那么 -45° 表示 ____。", answer: "逆时针旋转45°|逆时针旋转45度|逆时针转45°|逆时针转45度", hint: "顺时针的相反方向是什么？", explanation: "顺时针记为正，负号就表示相反方向——逆时针旋转 45°。" },
    ],
  },
  {
    code: "G7-1-02",
    chapter: CH,
    title: "有理数与数轴",
    sortOrder: 2,
    summary: [
      { heading: "有理数的分类", body: "整数和分数统称有理数。整数包括正整数、0、负整数；分数包括正分数、负分数。" },
      { heading: "数轴三要素", body: "规定了原点、正方向和单位长度的直线叫数轴，三者缺一不可。通常取向右为正方向。" },
      { heading: "数轴上的点与数", body: "每个有理数都能用数轴上的一个点表示：正数在原点右侧，负数在原点左侧。数轴让“数”有了“形”，右边的数总比左边的大。" },
    ],
    example: {
      stem: "在数轴上表示 -2、0、1.5，并比较它们的大小。",
      analysis: "先画原点，标出正方向和单位长度；-2 在原点左边 2 格，1.5 在右边 1.5 格。",
      answer: "-2 < 0 < 1.5",
    },
    prereqCodes: ["G7-1-01"],
    commonErrors: [
      { cause: "概念不清", detail: "认为数轴上只能表示整数，不知道分数也能在数轴上表示。" },
      { cause: "审题失误", detail: "看反方向，把负数点到原点右侧，或读数时忽略正负。" },
    ],
    socratic: {
      keyConcepts: ["数轴", "原点", "正方向", "单位长度", "右边的数大"],
      probes: [
        "数轴有哪三个要素？少一个行不行？",
        "怎么用数轴一眼看出两个数谁大谁小？",
        "分数能在数轴上表示吗？比如 -1/2 在哪里？",
      ],
      hints: ["想一想温度计——它其实就是一条竖着的数轴。", "比较大小时，先想这个点在原点哪边。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "下列关于数轴的说法错误的是（ ）", options: ["数轴是一条直线", "数轴必须有原点、正方向和单位长度", "数轴上的点只能表示整数", "通常规定向右为正方向"], answer: "C", hint: "分数能不能在数轴上表示？", explanation: "每个有理数（包括分数）都能用数轴上的点表示，所以 C 错。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "数轴上表示 -2 的点在原点的（ ）", options: ["右侧 2 个单位", "左侧 2 个单位", "右侧 1/2 个单位", "无法确定"], answer: "B", hint: "负数在原点哪一侧？", explanation: "负数在原点左侧，-2 距原点 2 个单位。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "数轴上点 A 表示 -1，点 B 表示 3，A、B 两点间的距离是（ ）", options: ["2", "3", "4", "-4"], answer: "C", hint: "距离 = 右边减左边，也可以数格子。", explanation: "从 -1 到 3 共 4 个单位长度，距离为 4（距离没有负值）。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "下列各数中，在数轴上位于 -1 和 0 之间的数是（ ）", options: ["-3/2", "1/2", "-1/3", "2"], answer: "C", hint: "在 -1 和 0 之间，说明它比 0 小、比 -1 大。", explanation: "-1 < -1/3 < 0；-3/2 在 -1 左边，1/2 和 2 在 0 右边。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "数轴上，到原点距离等于 5 个单位长度的点表示的数是 ____。", answer: "5或-5|±5|-5和5|5和-5|5,-5|-5,5|5、-5", hint: "原点左边有没有这样的点？", explanation: "原点左、右两侧各有一个：+5 和 -5。只写一个是最常见的错误。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "点 P 在数轴上表示 -3，把点 P 向右移动 4 个单位长度后，表示的数是（ ）", options: ["-7", "1", "7", "-1"], answer: "B", hint: "向右移动就是加。", explanation: "-3 + 4 = 1，移动后的点表示 1。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "有理数 a 在数轴上的对应点位于原点左侧，则 a 一定是（ ）", options: ["正数", "负数", "0", "无法确定"], answer: "B", hint: "原点左边的数有什么共同点？", explanation: "原点左侧的点都表示负数。" },
    ],
  },
  {
    code: "G7-1-03",
    chapter: CH,
    title: "相反数与绝对值",
    sortOrder: 3,
    summary: [
      { heading: "相反数", body: "只有符号不同的两个数互为相反数，如 3 和 -3。0 的相反数是 0。在数轴上，互为相反数的两个点到原点距离相等。" },
      { heading: "绝对值", body: "数轴上表示数 a 的点到原点的距离，叫 a 的绝对值，记作 |a|。正数的绝对值是它本身，负数的绝对值是它的相反数，0 的绝对值是 0。" },
      { heading: "绝对值的非负性", body: "任何数的绝对值都大于或等于 0。若 |a|=|b|，则 a=b 或 a、b 互为相反数。" },
      { heading: "两个负数比较大小", body: "两个负数，绝对值大的反而小。如 |-3|>|-2|，所以 -3 < -2。" },
    ],
    example: {
      stem: "求 |-3| 和 -(-2) 的值。",
      analysis: "|-3| 表示 -3 到原点的距离；-(-2) 表示 -2 的相反数。",
      answer: "|-3| = 3；-(-2) = 2",
    },
    prereqCodes: ["G7-1-02"],
    commonErrors: [
      { cause: "概念不清", detail: "认为 -a 一定是负数，忽略 a 为负数或 0 的情况。" },
      { cause: "概念不清", detail: "“绝对值等于它本身的数是正数”——漏掉了 0。" },
      { cause: "计算错误", detail: "两个负数比较大小时，以为绝对值大的那个更大。" },
    ],
    socratic: {
      keyConcepts: ["相反数", "绝对值", "距离", "非负", "绝对值大的反而小"],
      probes: [
        "绝对值在数轴上表示什么？为什么它不可能是负数？",
        "如果 |a| = 5，a 一定是 5 吗？还有什么可能？",
        "-a 一定是负数吗？举个例子说明。",
      ],
      hints: ["想想数轴上离原点 3 格远的点有几个。", "-(-5) 是正数还是负数？"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "-5 的相反数是（ ）", options: ["-5", "5", "1/5", "-1/5"], answer: "B", hint: "相反数只改变符号。", explanation: "-5 的相反数是 5。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "|-3| 的值是（ ）", options: ["-3", "3", "±3", "0"], answer: "B", hint: "绝对值是距离。", explanation: "-3 到原点的距离是 3，绝对值不可能是负数。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "下列各组数中，互为相反数的是（ ）", options: ["3 与 -1/3", "-2 与 -(-2)", "|-4| 与 4", "0.5 与 2"], answer: "B", hint: "先化简每个数再看。", explanation: "-(-2)=2，2 与 -2 互为相反数；C 中两数都是 4，是相等不是相反。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "若 |a| = 7，则 a 的值为（ ）", options: ["7", "-7", "7 或 -7", "0"], answer: "C", hint: "到原点距离为 7 的点有几个？", explanation: "数轴上到原点距离为 7 的点有两个：7 和 -7。" },
      { type: "choice", stage: "practice", difficulty: 3, stem: "比较大小：-3/4（ ）-2/3", options: [">", "<", "=", "无法比较"], answer: "B", hint: "两个负数比大小，先比绝对值。", explanation: "|-3/4|=0.75，|-2/3|≈0.667，绝对值大的反而小，所以 -3/4 < -2/3。" },
      { type: "fill", stage: "variant", difficulty: 2, stem: "绝对值小于 3 的整数共有 ____ 个。", answer: "5|5个", hint: "把满足条件的整数一个一个列出来。", explanation: "-2、-1、0、1、2，共 5 个（注意包括 0）。" },
      { type: "choice", stage: "variant", difficulty: 3, stem: "若 |x - 2| = 0，则 x 的值为（ ）", options: ["0", "2", "-2", "无法确定"], answer: "B", hint: "绝对值等于 0 的数只有一个。", explanation: "绝对值为 0 说明 x-2=0，所以 x=2。" },
    ],
  },
  {
    code: "G7-1-04",
    chapter: CH,
    title: "有理数的加减法",
    sortOrder: 4,
    summary: [
      { heading: "加法法则", body: "同号两数相加，取相同符号，并把绝对值相加；异号两数相加，取绝对值较大者的符号，并用大绝对值减小绝对值。互为相反数的两数相加得 0。" },
      { heading: "减法法则", body: "减去一个数，等于加上这个数的相反数：a - b = a + (-b)。减法都可以转化成加法。" },
      { heading: "加减混合运算", body: "先把所有减法统一成加法，再按加法法则计算；可以运用交换律、结合律让计算更简便。" },
    ],
    example: {
      stem: "计算：(-3) + 5 和 3 - (-2)。",
      analysis: "第一题异号相加，|5|>|−3|，取正号，5-3=2；第二题减去 -2 等于加 +2。",
      answer: "2；5",
    },
    prereqCodes: ["G7-1-03"],
    commonErrors: [
      { cause: "计算错误", detail: "异号相加时符号取错，如 (-5)+3 算成 -8 或 +2。" },
      { cause: "方法不会", detail: "减去负数时忘记变号，如 3-(-2) 算成 1。" },
    ],
    socratic: {
      keyConcepts: ["同号相加", "异号相加", "绝对值", "减去等于加上相反数", "符号"],
      probes: [
        "异号两数相加，结果的符号由什么决定？",
        "为什么“减去一个负数”反而会让结果变大？用数轴或生活例子解释。",
        "你会把 5-(-3)+(-2) 全部改写成加法吗？",
      ],
      hints: ["想象温度计：零下 3 度上升 5 度是几度？", "减法转化口诀：减正等于加负，减负等于加正。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "计算 (-2) + 3 =（ ）", options: ["-5", "5", "-1", "1"], answer: "D", hint: "异号相加，谁的绝对值大？", explanation: "|3|>|-2|，取正号，3-2=1。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "计算 5 - (-2) =（ ）", options: ["3", "7", "-7", "-3"], answer: "B", hint: "减去 -2 等于加上什么？", explanation: "5-(-2)=5+2=7。" },
      { type: "choice", stage: "practice", difficulty: 1, stem: "计算 (-7) + (-3) =（ ）", options: ["-10", "10", "-4", "4"], answer: "A", hint: "同号两数相加。", explanation: "同取负号，绝对值相加：-(7+3)=-10。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "某地早晨气温 -3℃，中午上升了 8℃，中午的气温是（ ）", options: ["-5℃", "5℃", "11℃", "-11℃"], answer: "B", hint: "列式：-3 + 8。", explanation: "-3+8=5，中午气温 5℃。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "计算：(-2.5) + 1.5 + (-1) = ____", answer: "-2", hint: "先算前两个，或把能凑整的先结合。", explanation: "(-2.5)+1.5=-1，-1+(-1)=-2。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "计算 -1 + 2 - 3 + 4 =（ ）", options: ["2", "-2", "10", "0"], answer: "A", hint: "可以两两结合：(-1+2)+(-3+4)。", explanation: "(-1+2)+(-3+4)=1+1=2。" },
      { type: "fill", stage: "variant", difficulty: 2, stem: "比 -4 大 6 的数是 ____。", answer: "2", hint: "“大 6”就是加 6。", explanation: "-4+6=2。" },
    ],
  },
  {
    code: "G7-1-05",
    chapter: CH,
    title: "有理数的乘除与乘方",
    sortOrder: 5,
    summary: [
      { heading: "乘法法则", body: "两数相乘，同号得正，异号得负，并把绝对值相乘。几个不为 0 的数相乘，负因数个数为偶数时积为正，为奇数时积为负。" },
      { heading: "除法法则", body: "除以一个不为 0 的数，等于乘这个数的倒数。0 不能作除数。" },
      { heading: "乘方", body: "求 n 个相同因数 a 的积的运算叫乘方，记作 aⁿ。负数的奇次幂是负数，偶次幂是正数；特别注意 -2²=-4，而 (-2)²=4，底数不同结果完全不同。" },
    ],
    example: {
      stem: "计算：(-2)×(-3) 和 (-2)³。",
      analysis: "两数同号相乘得正；(-2)³ 表示 3 个 -2 相乘，负因数有 3 个（奇数）。",
      answer: "6；-8",
    },
    prereqCodes: ["G7-1-04"],
    commonErrors: [
      { cause: "概念不清", detail: "把 -2² 与 (-2)² 混为一谈，前者是 -4，后者是 4。" },
      { cause: "计算错误", detail: "多个负数连乘时数错负因数个数，符号定错。" },
    ],
    socratic: {
      keyConcepts: ["同号得正", "异号得负", "倒数", "乘方", "底数", "负因数个数"],
      probes: [
        "几个负数相乘，积的符号由什么决定？",
        "-2² 和 (-2)² 一样吗？各等于多少？为什么？",
        "为什么 0 不能作除数？",
      ],
      hints: ["负负得正：两个负数相乘结果为正。", "乘方先看底数是谁——括号很关键。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "计算 (-2) × (-3) =（ ）", options: ["-6", "6", "-5", "5"], answer: "B", hint: "同号得正。", explanation: "同号两数相乘得正，2×3=6。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "(-2)³ 的值是（ ）", options: ["-6", "6", "-8", "8"], answer: "C", hint: "3 个 -2 相乘，负因数有几个？", explanation: "(-2)×(-2)×(-2)=4×(-2)=-8。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "-2² 的值是（ ）", options: ["4", "-4", "2", "-2"], answer: "B", hint: "这里的底数是 2，还是 -2？", explanation: "-2² = -(2²) = -4，乘方只对 2 起作用；而 (-2)² = 4。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "计算 (-12) ÷ (-3) × 2 =（ ）", options: ["-8", "8", "-2", "2"], answer: "B", hint: "乘除同级，从左往右算。", explanation: "(-12)÷(-3)=4，4×2=8。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "计算：(-1)¹⁰⁰ + (-1)⁹⁹ = ____", answer: "0", hint: "指数是偶数还是奇数？", explanation: "(-1)¹⁰⁰=1（偶次幂），(-1)⁹⁹=-1（奇次幂），1+(-1)=0。" },
      { type: "choice", stage: "variant", difficulty: 3, stem: "下列各式结果为正数的是（ ）", options: ["(-2)×3", "(-3)³", "(-1)²⁰²⁴", "-(-5)×(-2)"], answer: "C", hint: "逐个判断符号。", explanation: "A=-6，B=-27，C=1（偶次幂为正），D=5×(-2)=-10。" },
      { type: "fill", stage: "variant", difficulty: 3, stem: "若 a、b 互为相反数，c、d 互为倒数，则 a + b + cd = ____", answer: "1", hint: "互为相反数的两数之和是多少？互为倒数的两数之积是多少？", explanation: "a+b=0，cd=1，所以原式=0+1=1。" },
    ],
  },
];
