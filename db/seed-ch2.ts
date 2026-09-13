import type { KPSeed } from "./seed-types";

const CH = "第二章 整式的加减";

export const chapter2: KPSeed[] = [
  {
    code: "G7-2-01",
    chapter: CH,
    title: "用字母表示数",
    sortOrder: 6,
    summary: [
      { heading: "为什么用字母表示数", body: "字母可以表示任意数，让规律写得更简洁、更一般。比如 n 表示任意整数时，2n 就表示所有偶数。" },
      { heading: "书写规范", body: "数字与字母相乘，乘号省略且数字写在前面：3a（不写 a3）；带分数与字母相乘要化成假分数；除法写成分数形式：a÷2 写成 a/2。" },
      { heading: "列代数式", body: "关键是抓住运算顺序的关键词：“和、差、积、商”“倍”“比……多/少”。“a 与 b 和的平方”是 (a+b)²，“a 与 b 的平方和”是 a²+b²，顺序不同式子完全不同。" },
    ],
    example: {
      stem: "用代数式表示：x 的 2 倍与 y 的差。",
      analysis: "“x 的 2 倍”是 2x，“与 y 的差”即减 y。",
      answer: "2x - y",
    },
    prereqCodes: [],
    commonErrors: [
      { cause: "概念不清", detail: "书写不规范，如把 3a 写成 a3，或除法仍用“÷”。" },
      { cause: "审题失误", detail: "“和的平方”与“平方和”不分，运算顺序列错。" },
    ],
    socratic: {
      keyConcepts: ["字母表示数", "书写规范", "运算顺序", "代数式"],
      probes: [
        "为什么 3a 不能写成 a3？",
        "“(a+b)²”和“a²+b²”意思一样吗？取 a=1, b=2 算一算。",
        "怎么用字母表示“任意一个偶数”？“任意三个连续整数”呢？",
      ],
      hints: ["想想数字与字母谁写在前面。", "把关键词圈出来：先算什么，再算什么。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "下列代数式书写规范的是（ ）", options: ["a×3", "3a", "a3", "1÷a"], answer: "B", hint: "数字在前，乘号省略。", explanation: "数字与字母相乘，数字写在前、乘号省略，写作 3a。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "“x 的 2 倍与 y 的差”用代数式表示为（ ）", options: ["2x - y", "2(x - y)", "x - 2y", "2y - x"], answer: "A", hint: "先表示“x 的 2 倍”，再作差。", explanation: "x 的 2 倍是 2x，与 y 的差即 2x-y。" },
      { type: "choice", stage: "practice", difficulty: 1, stem: "某商品原价 a 元，打八折后的价格是（ ）", options: ["8a 元", "0.8a 元", "(a-8) 元", "80%a"], answer: "B", hint: "八折就是原价的 80%。", explanation: "八折 = 原价 × 0.8，即 0.8a 元。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "一个两位数，十位数字是 a，个位数字是 b，这个两位数用代数式表示为 ____。", answer: "10a+b", hint: "十位上的 a 表示多少个十？", explanation: "十位数字 a 表示 a 个十，所以这个数是 10a+b，而不是 ab。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "“a 与 b 的和的平方”用代数式表示为（ ）", options: ["a + b²", "a² + b²", "(a + b)²", "2(a + b)"], answer: "C", hint: "先求和，再平方。", explanation: "先算 a+b，再整体平方，要加括号：(a+b)²。" },
      { type: "fill", stage: "variant", difficulty: 2, stem: "三个连续整数，中间一个是 n，则另外两个分别是 ____。", answer: "n-1和n+1|n-1,n+1|n-1 n+1|n-1和n+1|(n-1)和(n+1)|n-1与n+1", hint: "连续整数之间相差 1。", explanation: "中间是 n，前一个比它小 1 是 n-1，后一个比它大 1 是 n+1。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "长方形的长为 a，宽比长少 2，则宽为（ ）", options: ["a + 2", "a - 2", "2 - a", "2a"], answer: "B", hint: "“宽比长少 2”，谁减谁？", explanation: "宽 = 长 - 2 = a - 2。" },
    ],
  },
  {
    code: "G7-2-02",
    chapter: CH,
    title: "单项式与多项式",
    sortOrder: 7,
    summary: [
      { heading: "单项式", body: "由数或字母的积组成的式子叫单项式，单独的一个数或字母也是单项式。单项式中的数字因数叫系数（要连同符号）；所有字母的指数之和叫次数。" },
      { heading: "多项式", body: "几个单项式的和叫多项式。每个单项式叫多项式的项，不含字母的项叫常数项；次数最高的项的次数叫多项式的次数。" },
      { heading: "整式", body: "单项式和多项式统称整式。判断要点：分母里不含字母（1/x 不是整式）。" },
    ],
    example: {
      stem: "说出单项式 -3x²y 的系数和次数。",
      analysis: "数字因数是 -3（连同负号）；次数 = x 的指数 2 + y 的指数 1 = 3。",
      answer: "系数 -3，次数 3",
    },
    prereqCodes: ["G7-2-01"],
    commonErrors: [
      { cause: "概念不清", detail: "系数丢掉负号，如把 -3x²y 的系数说成 3。" },
      { cause: "计算错误", detail: "次数只算一个字母的指数，或把 π 当成字母计入次数。" },
    ],
    socratic: {
      keyConcepts: ["单项式", "系数", "次数", "多项式", "常数项", "整式"],
      probes: [
        "单项式的“次数”是怎么算的？-2x²y³ 的次数是几？",
        "πr² 的系数是 1 吗？π 是字母还是数？",
        "多项式 3x²-2x+1 有几项？常数项是哪一项？",
      ],
      hints: ["次数要把每个字母的指数加起来。", "π 是一个确定的数，不是字母。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "单项式 -2x²y 的系数和次数分别是（ ）", options: ["-2，2", "-2，3", "2，3", "-2，1"], answer: "B", hint: "系数带符号；次数是所有字母指数之和。", explanation: "系数是 -2；次数 = 2+1 = 3。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "下列各式中，是单项式的是（ ）", options: ["x + 1", "1/x", "-3ab", "(x+y)/2"], answer: "C", hint: "单项式里只有乘法，没有加减，分母不含字母。", explanation: "-3ab 是数与字母的积；A、D 含加法，B 分母含字母。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "多项式 3x² - 2x + 1 的项数和次数分别是（ ）", options: ["3，2", "2，3", "3，3", "3，1"], answer: "A", hint: "数一数有几个单项式；找最高次项。", explanation: "共 3 项；最高次项 3x² 的次数是 2，所以是三次三项式中的“二次三项式”。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "下列说法正确的是（ ）", options: ["单项式 x 没有系数", "2πr 的系数是 2", "单项式 -x²y 的次数是 3", "x + 1 是单项式"], answer: "C", hint: "π 是数；x 的系数是 1。", explanation: "-x²y 的次数 = 2+1 = 3；A 系数是 1，B 系数是 2π，D 是多项式。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "多项式 -x³ + 2x² - 5 的常数项是 ____。", answer: "-5", hint: "常数项要连同前面的符号。", explanation: "不含字母的项是 -5，注意符号不能丢。" },
      { type: "choice", stage: "variant", difficulty: 3, stem: "若单项式 2x^m y³ 的次数是 5，则 m =（ ）", options: ["2", "3", "5", "8"], answer: "A", hint: "次数 = m + 3。", explanation: "m+3=5，解得 m=2。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "下列单项式中，系数为 -2 且次数为 3 的是（ ）", options: ["2x³", "-2x²", "-2x³", "-3x²y"], answer: "C", hint: "两个条件要同时满足。", explanation: "-2x³ 系数 -2、次数 3；A 系数是 2，B 次数是 2，D 系数是 -3。" },
    ],
  },
  {
    code: "G7-2-03",
    chapter: CH,
    title: "同类项与合并同类项",
    sortOrder: 8,
    summary: [
      { heading: "同类项", body: "所含字母相同，并且相同字母的指数也相同的项叫同类项。几个常数项也是同类项。注意：与系数无关，与字母顺序无关。" },
      { heading: "合并法则", body: "合并同类项时，把系数相加，字母和字母的指数不变。如 3x²y + (-5x²y) = -2x²y。" },
      { heading: "为什么要合并", body: "合并同类项能把多项式化简，是整式加减的基础；化到最简后才便于代入求值。" },
    ],
    example: {
      stem: "合并同类项：5x² - 2x² + 3x²。",
      analysis: "三项都是 x² 的同类项，只需把系数 5、-2、3 相加。",
      answer: "6x²",
    },
    prereqCodes: ["G7-2-02"],
    commonErrors: [
      { cause: "概念不清", detail: "把 x 与 x² 当成同类项——字母相同但指数不同就不是。" },
      { cause: "计算错误", detail: "合并时把字母部分也“加”了，如 3a+2a=5a²。" },
    ],
    socratic: {
      keyConcepts: ["同类项", "字母相同", "指数相同", "系数相加", "字母部分不变"],
      probes: [
        "判断同类项要看哪两个条件？3x²y 和 -5yx² 是同类项吗？",
        "合并同类项时，什么变了、什么不变？",
        "3 和 -2 是同类项吗？为什么？",
      ],
      hints: ["字母顺序不影响：xy 和 yx 是一样的。", "想象 3 个苹果加 2 个苹果——“苹果”本身不会变。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "下列各组中，是同类项的是（ ）", options: ["3x 与 3y", "2x² 与 2x", "-ab² 与 5ab²", "3 与 a"], answer: "C", hint: "字母要相同，相同字母的指数也要相同。", explanation: "-ab² 与 5ab² 字母及指数完全相同；A、B、D 都不满足。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "合并同类项：3a + 2a =（ ）", options: ["5a", "6a", "5a²", "6a²"], answer: "A", hint: "系数相加，字母部分不变。", explanation: "(3+2)a = 5a。" },
      { type: "choice", stage: "practice", difficulty: 1, stem: "计算 5x² - 2x² + 3x² =（ ）", options: ["6x²", "6x⁶", "10x²", "6"], answer: "A", hint: "系数 5-2+3，字母部分照抄。", explanation: "(5-2+3)x² = 6x²。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "下列合并同类项正确的是（ ）", options: ["3a + 2b = 5ab", "5y² - 2y² = 3", "4x²y - 2x²y = 2x²y", "3a + a = 3a²"], answer: "C", hint: "只有同类项才能合并；合并后字母部分不变。", explanation: "C 正确；A 不是同类项，B 应为 3y²，D 应为 4a。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "若 3x^m y 与 -2x²y 是同类项，则 m = ____。", answer: "2", hint: "相同字母 x 的指数要相等。", explanation: "同类项要求 x 的指数相同，所以 m=2。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "化简 2a - 3b - a + 5b =（ ）", options: ["a + 2b", "a - 2b", "3a + 2b", "-3a + 8b"], answer: "A", hint: "先找出 a 的项和 b 的项分别合并。", explanation: "(2a-a)+(-3b+5b) = a+2b。" },
      { type: "fill", stage: "variant", difficulty: 2, stem: "计算：3ab - 5ab + 2ab = ____。", answer: "0", hint: "把系数相加：3-5+2。", explanation: "(3-5+2)ab = 0ab = 0。" },
    ],
  },
  {
    code: "G7-2-04",
    chapter: CH,
    title: "去括号与整式的加减",
    sortOrder: 9,
    summary: [
      { heading: "去括号法则", body: "括号前是“+”号，去掉括号后各项不变号；括号前是“-”号，去掉括号后各项都变号：-(2a-3b) = -2a+3b。" },
      { heading: "括号前有系数", body: "先用乘法分配律把系数乘到每一项，再去括号：-3(2x-y) = -6x+3y。每一项都要乘，符号一起算。" },
      { heading: "整式加减的步骤", body: "一“去”（去括号）、二“合”（合并同类项）。结果是多项式时，一般按某一字母降幂排列。" },
    ],
    example: {
      stem: "化简：3(a - 2b) - 2(a - b)。",
      analysis: "先分配：3a-6b 与 2a-2b，注意第二个括号前是 -2。去括号：3a-6b-2a+2b。再合并。",
      answer: "a - 4b",
    },
    prereqCodes: ["G7-2-03"],
    commonErrors: [
      { cause: "计算错误", detail: "括号前是负号时只给第一项变号，后面各项忘记变。" },
      { cause: "计算错误", detail: "括号前的系数只乘第一项，漏乘后面的项。" },
    ],
    socratic: {
      keyConcepts: ["去括号", "变号", "分配律", "每一项", "合并同类项"],
      probes: [
        "括号前是负号时，去括号要做什么？-(a-b) 等于什么？",
        "-3(2x-y) 中，-3 要乘几项？结果是什么？",
        "整式加减的两个步骤是什么？顺序能换吗？",
      ],
      hints: ["把“-”想成“乘以 -1”，每一项都要乘。", "去完括号先别急着算，把同类项用相同标记标出来。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "去括号：-(a - b) =（ ）", options: ["-a - b", "-a + b", "a - b", "a + b"], answer: "B", hint: "括号前是负号，每一项都要变号。", explanation: "-(a-b) = -a+b。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "去括号：a + (b - c) =（ ）", options: ["a + b - c", "a + b + c", "a - b - c", "a - b + c"], answer: "A", hint: "括号前是正号，各项不变号。", explanation: "a+(b-c) = a+b-c。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "化简 2x - (x - 3) =（ ）", options: ["x - 3", "x + 3", "3x - 3", "3x + 3"], answer: "B", hint: "去括号时 -3 要变号。", explanation: "2x-x+3 = x+3。常见错误是忘记 -3 变 +3。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "化简 3(a - 2b) - 2(a - b) =（ ）", options: ["a - 4b", "a - 8b", "a + 4b", "5a - 8b"], answer: "A", hint: "先把 3 和 -2 分别乘进括号。", explanation: "3a-6b-2a+2b = a-4b。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "化简：(2x² - 3x + 1) + (x² + 3x - 4) = ____。", answer: "3x²-3|3x^2-3", hint: "括号前都是“+”，直接去括号合并。", explanation: "2x²+x²-3x+3x+1-4 = 3x²-3。" },
      { type: "choice", stage: "variant", difficulty: 3, stem: "一个多项式加上 x² - 2x 得 3x² + x，这个多项式是（ ）", options: ["2x² + 3x", "4x² - x", "2x² - x", "4x² + 3x"], answer: "A", hint: "用和减去已知加数。", explanation: "(3x²+x)-(x²-2x) = 3x²+x-x²+2x = 2x²+3x。" },
      { type: "fill", stage: "variant", difficulty: 3, stem: "化简：-3(2x - y) + 2(x + y) = ____。", answer: "-4x+5y|-4x + 5y", hint: "-3 要乘两项，注意符号。", explanation: "-6x+3y+2x+2y = -4x+5y。" },
    ],
  },
];
