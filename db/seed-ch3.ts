import type { KPSeed } from "./seed-types";

const CH = "第三章 一元一次方程";

export const chapter3: KPSeed[] = [
  {
    code: "G7-3-01",
    chapter: CH,
    title: "方程与等式的性质",
    sortOrder: 10,
    summary: [
      { heading: "方程与一元一次方程", body: "含有未知数的等式叫方程。只含一个未知数，且未知数次数都是 1，两边都是整式的方程叫一元一次方程，如 2x-3=5。" },
      { heading: "方程的解", body: "使方程左右两边相等的未知数的值叫方程的解。检验方法：把值代入方程两边，分别计算看是否相等。" },
      { heading: "等式的性质", body: "性质1：等式两边加（或减）同一个数（或式子），结果仍相等。性质2：等式两边乘同一个数，或除以同一个不为 0 的数，结果仍相等。注意：除数不能为 0！" },
    ],
    example: {
      stem: "检验 x=2 是不是方程 3x-1=5 的解。",
      analysis: "把 x=2 代入左边：3×2-1=5，与右边相等。",
      answer: "x=2 是方程的解",
    },
    prereqCodes: ["G7-2-01"],
    commonErrors: [
      { cause: "概念不清", detail: "等式两边除以字母时，忽略该字母可能为 0。" },
      { cause: "概念不清", detail: "把 x²=4、x+y=1 这类误判为一元一次方程。" },
    ],
    socratic: {
      keyConcepts: ["方程", "一元一次方程", "方程的解", "等式性质", "除数不为0"],
      probes: [
        "一个式子要满足哪几个条件才是一元一次方程？x+2y=3 是吗？",
        "怎么检验一个数是不是方程的解？",
        "等式两边都除以 a，什么时候会出问题？",
      ],
      hints: ["“一元”指未知数的个数，“一次”指未知数的次数。", "天平类比：两边同时加减同样的重量，天平仍平衡。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "下列各式中，是一元一次方程的是（ ）", options: ["x + 2y = 3", "x² - 1 = 0", "2x - 3 = 5", "3x + 2"], answer: "C", hint: "一个未知数、次数为 1、是等式。", explanation: "A 有两个未知数，B 次数是 2，D 不是等式。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "x = 3 是下列哪个方程的解（ ）", options: ["x + 1 = 3", "2x - 3 = 3", "3x = 6", "x - 3 = 1"], answer: "B", hint: "把 x=3 逐一代入检验。", explanation: "B：2×3-3=3，左右相等；其余代入后不相等。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "下列运用等式性质的变形，一定正确的是（ ）", options: ["若 a=b，则 a+c=b-c", "若 a=b，则 a/c=b/c", "若 a=b，则 ac=bc", "若 ac=bc，则 a=b"], answer: "C", hint: "除法要考虑除数不能为 0。", explanation: "C 是性质2（乘法）。A 加减不一致；B 未说明 c≠0；D 当 c=0 时不成立。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "若 x = y，则下列变形不一定成立的是（ ）", options: ["x + 2 = y + 2", "3x = 3y", "x/a = y/a", "x - 1 = y - 1"], answer: "C", hint: "哪种运算附带条件？", explanation: "除以 a 要求 a≠0，题中未说明，所以不一定成立。" },
      { type: "fill", stage: "practice", difficulty: 1, stem: "方程 2x + 1 = 7 的解是 x = ____。", answer: "3", hint: "先试：两边减 1 得 2x=6。", explanation: "2x=6，x=3。代入检验：2×3+1=7 ✓。" },
      { type: "choice", stage: "variant", difficulty: 3, stem: "若关于 x 的方程 (m-1)x + 3 = 0 是一元一次方程，则 m 应满足（ ）", options: ["m = 1", "m ≠ 1", "m > 1", "m 为任意数"], answer: "B", hint: "“一次”要求 x 的系数不为 0。", explanation: "若 m=1，则 x 项消失，不再是方程；所以 m≠1。" },
      { type: "fill", stage: "variant", difficulty: 2, stem: "若 x = 2 是方程 ax - 3 = 1 的解，则 a = ____。", answer: "2", hint: "把 x=2 代入方程，转化成关于 a 的方程。", explanation: "2a-3=1，2a=4，a=2。" },
    ],
  },
  {
    code: "G7-3-02",
    chapter: CH,
    title: "解方程（一）：移项与合并",
    sortOrder: 11,
    summary: [
      { heading: "移项", body: "把方程中的某一项改变符号后，从等号一边移到另一边，叫移项。移项要变号——这其实是等式性质1的简化写法。" },
      { heading: "解方程三步", body: "① 移项：含未知数的项移到左边，常数项移到右边；② 合并同类项：化成 ax=b；③ 系数化为 1：两边同除以 a，得 x=b/a。" },
      { heading: "系数化为 1", body: "两边同除以未知数的系数。如 -3x=6，两边同除以 -3，x=-2。注意除以负数，结果符号不要错。" },
    ],
    example: {
      stem: "解方程：3x + 5 = 2x + 8。",
      analysis: "移项：3x-2x=8-5（2x 移来变 -2x，5 移去变 -5）；合并：x=3。",
      answer: "x = 3",
    },
    prereqCodes: ["G7-3-01", "G7-2-03"],
    commonErrors: [
      { cause: "计算错误", detail: "移项忘记变号，如 3x=5-x 移项得 3x-x=5。" },
      { cause: "计算错误", detail: "系数化为 1 时把除法做反，如 2x=6 得 x=1/3。" },
    ],
    socratic: {
      keyConcepts: ["移项", "变号", "合并同类项", "系数化为1"],
      probes: [
        "移项为什么要变号？它和等式性质1有什么关系？",
        "解方程 5x-3=2x+6，你的第一步做什么？",
        "方程 -2x=8，怎么把系数化为 1？",
      ],
      hints: ["想象把一项“搬”过等号，就要“翻脸”（变号）。", "目标形态永远是 ax=b。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "把方程 3x = 5 - x 中的 -x 移到左边，正确的是（ ）", options: ["3x - x = 5", "3x + x = 5", "3x = -x - 5", "3x + x = -5"], answer: "B", hint: "移项要变号。", explanation: "-x 移到左边变为 +x：3x+x=5。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "方程 2x - 4 = 0 的解是（ ）", options: ["x = 2", "x = -2", "x = 4", "x = 1/2"], answer: "A", hint: "先移项：2x=4。", explanation: "2x=4，x=2。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "解方程 5x - 3 = 2x + 6，得 x =（ ）", options: ["1", "3", "-3", "9/5"], answer: "B", hint: "2x 移到左边，-3 移到右边。", explanation: "5x-2x=6+3，3x=9，x=3。" },
      { type: "fill", stage: "practice", difficulty: 1, stem: "方程 3x + 1 = 10 的解是 x = ____。", answer: "3", hint: "1 移到右边变 -1。", explanation: "3x=9，x=3。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "解方程 (1/2)x - 1 = 2，得 x =（ ）", options: ["2", "6", "3/2", "5"], answer: "B", hint: "先移项，再两边同乘 2。", explanation: "(1/2)x=3，x=6。" },
      { type: "fill", stage: "variant", difficulty: 2, stem: "方程 7 - 2x = 3 的解是 x = ____。", answer: "2", hint: "-2x=3-7，注意符号。", explanation: "-2x=-4，x=2。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "已知 3x + 2 与 x - 4 的值相等，则 x =（ ）", options: ["-3", "3", "-1", "1"], answer: "A", hint: "先列方程 3x+2=x-4。", explanation: "3x-x=-4-2，2x=-6，x=-3。" },
    ],
  },
  {
    code: "G7-3-03",
    chapter: CH,
    title: "解方程（二）：去括号与去分母",
    sortOrder: 12,
    summary: [
      { heading: "去括号", body: "方程中有括号时，先用去括号法则去掉括号（括号前是负号各项都变号），再移项、合并、系数化为 1。" },
      { heading: "去分母", body: "方程两边同乘各分母的最小公倍数。两个易错点：① 不含分母的项也要乘；② 分子是多项式时，去分母后要给分子加括号。" },
      { heading: "完整流程", body: "去分母 → 去括号 → 移项 → 合并同类项 → 系数化为 1。五步顺序不乱，每步只干一件事。" },
    ],
    example: {
      stem: "解方程：(x-1)/2 - (x+1)/3 = 1。",
      analysis: "两边同乘 6：3(x-1)-2(x+1)=6（右边的 1 也要乘 6！）；去括号：3x-3-2x-2=6；合并：x-5=6。",
      answer: "x = 11",
    },
    prereqCodes: ["G7-3-02", "G7-2-04"],
    commonErrors: [
      { cause: "计算错误", detail: "去分母时，不含分母的项忘记乘最小公倍数。" },
      { cause: "计算错误", detail: "分子是多项式不加括号，如 (x+1)/3 去分母写成 -2x+1。" },
    ],
    socratic: {
      keyConcepts: ["去括号", "去分母", "最小公倍数", "分子加括号", "每一项都乘"],
      probes: [
        "去分母时，方程两边要乘什么数？",
        "为什么 (x-1)/2 去分母后要写成 3(x-1) 而不是 3x-1？",
        "方程里有个没有分母的“1”，去分母时它要不要乘？",
      ],
      hints: ["分数线除了表示除法，还有括号的作用。", "最小公倍数要乘到每一项上，一个都不能漏。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "解方程 2(x - 3) = 8，去括号得（ ）", options: ["2x - 3 = 8", "2x - 6 = 8", "x - 6 = 8", "2x + 6 = 8"], answer: "B", hint: "2 要乘括号里的每一项。", explanation: "2(x-3)=2x-6。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "方程 x/2 = 3，两边同乘 2 得（ ）", options: ["x = 6", "x = 3/2", "x = 5", "x = 1"], answer: "A", hint: "右边的 3 也要乘 2。", explanation: "x=6。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "解方程 (x+1)/2 = (x-1)/3，去分母正确的是（ ）", options: ["3(x+1) = 2(x-1)", "2(x+1) = 3(x-1)", "3x + 1 = 2x - 1", "x + 1 = x - 1"], answer: "A", hint: "两边同乘 6，分子是多项式要加括号。", explanation: "6×(x+1)/2=3(x+1)，6×(x-1)/3=2(x-1)。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "方程 2(x - 1) - 3(x + 1) = 0 的解是 x = ____。", answer: "-5", hint: "去括号后注意 -3 乘 (+1) 的符号。", explanation: "2x-2-3x-3=0，-x-5=0，x=-5。" },
      { type: "choice", stage: "practice", difficulty: 3, stem: "解方程 x - (x-1)/2 = 2，去分母（两边同乘 2）正确的是（ ）", options: ["2x - x - 1 = 4", "2x - (x - 1) = 4", "x - x - 1 = 2", "2x - (x - 1) = 2"], answer: "B", hint: "每一项都要乘 2；分子 x-1 要加括号。", explanation: "2·x - 2·(x-1)/2 = 2·2，即 2x-(x-1)=4。A 漏了括号，D 右边没乘。" },
      { type: "fill", stage: "variant", difficulty: 3, stem: "方程 (2x-1)/3 - 1 = x 的解是 x = ____。", answer: "-4", hint: "两边同乘 3，注意 -1 也要乘。", explanation: "2x-1-3=3x，2x-4=3x，x=-4。" },
      { type: "choice", stage: "variant", difficulty: 3, stem: "解方程 3(2x - 1) - 2(x + 2) = 5，得 x =（ ）", options: ["3", "4", "5", "6"], answer: "A", hint: "先分别去两个括号。", explanation: "6x-3-2x-4=5，4x=12，x=3。" },
    ],
  },
  {
    code: "G7-3-04",
    chapter: CH,
    title: "实际问题与一元一次方程",
    sortOrder: 13,
    summary: [
      { heading: "六步解题法", body: "审（读懂题意）→ 设（设未知数，带单位）→ 列（找等量关系列方程）→ 解（解方程）→ 验（检验是否符合实际）→ 答（写答语）。" },
      { heading: "找等量关系", body: "抓住题中的“共、比、是……的几倍、还剩”等关键词；列表或画线段图能帮你把数量关系看清楚。" },
      { heading: "常见模型", body: "行程：路程=速度×时间（相遇问题中，路程和=总距离）；价格：售价=标价×折数；配套：按比例分配（1 个螺钉配 2 个螺母→螺母数是螺钉数的 2 倍）。" },
    ],
    example: {
      stem: "甲、乙两地相距 20 km，小明、小华同时从两地出发相向而行，小明每小时走 5 km，小华每小时走 3 km，几小时后相遇？",
      analysis: "设 x 小时相遇。等量关系：小明走的路程 + 小华走的路程 = 20 km，即 5x+3x=20。",
      answer: "x = 2.5（2.5 小时后相遇）",
    },
    prereqCodes: ["G7-3-03"],
    commonErrors: [
      { cause: "审题失误", detail: "设未知数与所求不一致，或忘记统一单位（如分钟与小时混用）。" },
      { cause: "方法不会", detail: "配套问题中比例关系列反，如把“1 配 2”列成螺钉数×2=螺母数…方向搞错。" },
    ],
    socratic: {
      keyConcepts: ["设未知数", "等量关系", "路程=速度×时间", "检验"],
      probes: [
        "列方程解应用题的第一步是什么？为什么“设”的时候要带单位？",
        "相遇问题里，两人走的路程之间有什么关系？",
        "解出 x 之后，为什么还要“检验”？",
      ],
      hints: ["先问：这道题里哪个量是相等的？", "画一条线段表示总路程，标出两人各走的部分。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "甲、乙两人相距 20 km，同时出发相向而行，甲速 5 km/h，乙速 3 km/h。设 x 小时后相遇，可列方程（ ）", options: ["5x - 3x = 20", "5x + 3x = 20", "5x = 3x + 20", "(5 - 3)x = 20"], answer: "B", hint: "相遇时两人走的路程加起来等于总距离。", explanation: "路程和=总路程：5x+3x=20。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "“某数 x 的 3 倍比它的 2 倍大 5”，列方程为（ ）", options: ["3x + 2x = 5", "3x - 2x = 5", "3(x - 2) = 5", "2x - 3x = 5"], answer: "B", hint: "“A 比 B 大 5”即 A-B=5。", explanation: "3x-2x=5。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "一件商品按标价打九折出售，售价为 180 元。设标价为 x 元，可列方程（ ）", options: ["0.9x = 180", "x - 0.9 = 180", "9x = 180", "0.1x = 180"], answer: "A", hint: "售价 = 标价 × 折数。", explanation: "九折即 0.9 倍：0.9x=180。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "七年级一班有学生 45 人，男生比女生多 5 人。设女生有 x 人，可列方程 ____。", answer: "x+(x+5)=45|x+x+5=45|(x+5)+x=45|2x+5=45", hint: "男生人数怎么用 x 表示？", explanation: "男生 x+5 人，男女生之和为 45：x+(x+5)=45。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "一个两位数，十位数字比个位数字小 2。设个位数字为 x，这个两位数可表示为（ ）", options: ["10x + (x - 2)", "10(x - 2) + x", "x(x - 2)", "10x + x - 2"], answer: "B", hint: "十位数字是 x-2，十位上的数字要乘 10。", explanation: "十位 (x-2) 表示 10(x-2)，加个位 x：10(x-2)+x。" },
      { type: "fill", stage: "variant", difficulty: 3, stem: "某车间有 22 名工人，每人每天可生产螺钉 1200 个或螺母 2000 个，1 个螺钉需配 2 个螺母。设安排 x 名工人生产螺钉，为使每天的产品刚好配套，可列方程 ____。", answer: "2×1200x=2000(22-x)|2400x=2000(22-x)|2000(22-x)=2×1200x|2000(22-x)=2400x", hint: "螺母总数应该是螺钉总数的几倍？", explanation: "生产螺母的有 (22-x) 人；配套要求 螺母数=2×螺钉数：2000(22-x)=2×1200x。" },
      { type: "choice", stage: "variant", difficulty: 3, stem: "小明以 5 km/h 步行上学，出发 12 分钟后爸爸发现他忘带课本，以 15 km/h 骑车追赶。设爸爸 x 小时追上小明，可列方程（ ）", options: ["15x = 5(x + 0.2)", "15x = 5x + 0.2", "15(x - 0.2) = 5x", "15x + 0.2 = 5x"], answer: "A", hint: "12 分钟 = 0.2 小时；追上时两人路程相等，小明多走了 0.2 小时。", explanation: "追上时路程相等：爸爸走 15x，小明共走 5(x+0.2)，故 15x=5(x+0.2)。" },
    ],
  },
];
