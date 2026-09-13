import type { KPSeed } from "./seed-types";

const CH = "第四章 几何图形初步";

export const chapter4: KPSeed[] = [
  {
    code: "G7-4-01",
    chapter: CH,
    title: "立体图形与平面图形",
    sortOrder: 14,
    summary: [
      { heading: "常见几何体", body: "柱体（棱柱、圆柱）：有两个互相平行且全等的底面；锥体（棱锥、圆锥）：只有一个底面和一个顶点；球：圆圆的曲面体。" },
      { heading: "从不同方向看", body: "同一个几何体，从正面、左面、上面看到的形状可能不同。如竖放的圆柱，从正面看是长方形，从上面看是圆。" },
      { heading: "展开图", body: "把几何体的表面沿某些棱剪开铺平，得到平面展开图。如圆柱侧面展开是长方形，圆锥侧面展开是扇形；正方体有 11 种展开图。" },
    ],
    example: {
      stem: "一个棱柱有 5 个面，它是几棱柱？",
      analysis: "棱柱的面 = 2 个底面 + 侧面。5-2=3 个侧面，说明底面是三角形。",
      answer: "三棱柱",
    },
    prereqCodes: [],
    commonErrors: [
      { cause: "概念不清", detail: "柱体与锥体混淆——关键看底面个数：柱体两个，锥体一个。" },
      { cause: "计算错误", detail: "数 n 棱柱的顶点、棱、面时公式记错（顶点 2n、棱 3n、面 n+2）。" },
    ],
    socratic: {
      keyConcepts: ["柱体", "锥体", "底面", "侧面展开", "从不同方向看"],
      probes: [
        "怎么一眼区分柱体和锥体？",
        "竖放的圆柱，从上面看和从正面看分别是什么图形？",
        "三棱柱有几个面、几个顶点、几条棱？有规律吗？",
      ],
      hints: ["观察身边的物体：易拉罐、金字塔、魔方各像什么几何体？", "数顶点时，上底面和下底面分开数。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "下列几何体中，属于柱体的是（ ）", options: ["圆锥", "棱柱", "球", "棱锥"], answer: "B", hint: "柱体有两个底面。", explanation: "棱柱有两个互相平行且全等的底面；锥体只有一个底面。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "正方体一共有几个面（ ）", options: ["4 个", "5 个", "6 个", "8 个"], answer: "C", hint: "上、下、前、后、左、右。", explanation: "正方体有 6 个面、8 个顶点、12 条棱。" },
      { type: "choice", stage: "practice", difficulty: 1, stem: "竖直放置的圆柱，从正面看到的平面图形是（ ）", options: ["圆", "长方形", "三角形", "梯形"], answer: "B", hint: "从上面看才是圆。", explanation: "从正面看圆柱是长方形，从上面看是圆。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "圆锥的侧面展开图是（ ）", options: ["长方形", "扇形", "三角形", "圆"], answer: "B", hint: "想想生日帽剪开铺平的样子。", explanation: "圆锥侧面展开是扇形；圆柱侧面展开才是长方形。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "一个棱柱有 5 个面，则它是 ____ 棱柱。", answer: "三|3", hint: "面数 = 底面 2 个 + 侧面 n 个。", explanation: "5-2=3 个侧面，底面是三角形，所以是三棱柱。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "下列说法正确的是（ ）", options: ["球从任何方向看都是圆", "圆锥有两个底面", "棱柱只有一个底面", "圆柱的侧面展开图是三角形"], answer: "A", hint: "回忆各几何体的特征。", explanation: "球从任何方向看都是圆；B、C 底面数说反了，D 应是长方形。" },
      { type: "fill", stage: "variant", difficulty: 3, stem: "n 棱柱有 ____ 个顶点（用含 n 的式子表示）。", answer: "2n", hint: "上底面 n 个顶点，下底面也是。", explanation: "上、下底面各 n 个顶点，共 2n 个。" },
    ],
  },
  {
    code: "G7-4-02",
    chapter: CH,
    title: "直线、射线、线段",
    sortOrder: 15,
    summary: [
      { heading: "三者的区别", body: "线段有两个端点，可以度量长度；射线有一个端点，向一方无限延伸；直线没有端点，向两方无限延伸。直线和射线都不能度量长度。" },
      { heading: "两个基本事实", body: "① 经过两点有且只有一条直线（两点确定一条直线）；② 两点之间的所有连线中，线段最短（两点之间，线段最短）。" },
      { heading: "线段的中点", body: "把线段分成相等两段的点叫中点。若 C 是 AB 的中点，则 AC=CB=AB/2，反过来也成立。" },
    ],
    example: {
      stem: "线段 AB=10 cm，C 是 AB 的中点，求 AC。",
      analysis: "中点把线段平分，AC = AB÷2。",
      answer: "AC = 5 cm",
    },
    prereqCodes: ["G7-4-01"],
    commonErrors: [
      { cause: "概念不清", detail: "比较直线与射线的“长短”——它们都无限长，无法度量。" },
      { cause: "计算错误", detail: "遇到双中点问题（M、N 分别是两段的中点）时不会用 MN=AB/2。" },
    ],
    socratic: {
      keyConcepts: ["端点", "无限延伸", "两点确定一条直线", "线段最短", "中点"],
      probes: [
        "直线、射线、线段，哪个能度量长度？为什么另外两个不行？",
        "“把弯曲的河道改直可以缩短航程”用的是什么数学道理？",
        "M 是 AC 中点，N 是 CB 中点，MN 和 AB 有什么关系？",
      ],
      hints: ["想想木匠弹墨线为什么要固定两个点。", "把 AB 分成 AC 和 CB 两段，MN 正好是各段的一半。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "下列说法正确的是（ ）", options: ["直线 AB 长 5 cm", "射线 AB 长 3 cm", "线段 AB 长 5 cm", "直线比射线长"], answer: "C", hint: "只有有两个端点的才能度量。", explanation: "直线、射线都无限延伸，不能度量长度；只有线段可以。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "经过平面上的两个点，可以画几条直线（ ）", options: ["1 条", "2 条", "无数条", "0 条"], answer: "A", hint: "回忆基本事实。", explanation: "两点确定一条直线。" },
      { type: "choice", stage: "practice", difficulty: 1, stem: "把弯曲的河道改直可以缩短航程，其中蕴含的数学道理是（ ）", options: ["两点确定一条直线", "两点之间，线段最短", "经过一点有无数条直线", "线段有两个端点"], answer: "B", hint: "“缩短”说明在比长短。", explanation: "两点之间，线段最短。" },
      { type: "fill", stage: "practice", difficulty: 1, stem: "线段 AB = 10 cm，点 C 是 AB 的中点，则 BC = ____ cm。", answer: "5", hint: "中点把线段平分成两段。", explanation: "BC = AB÷2 = 5 cm。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "点 C 在线段 AB 上，AC = 3，CB = 5，则 AB =（ ）", options: ["2", "8", "15", "无法确定"], answer: "B", hint: "C 在线段上，两段拼起来就是整段。", explanation: "AB = AC+CB = 3+5 = 8。" },
      { type: "fill", stage: "variant", difficulty: 2, stem: "平面内有 3 个不在同一直线上的点，过其中每两个点画直线，共可画 ____ 条。", answer: "3|3条", hint: "把三个点记为 A、B、C，逐对数。", explanation: "AB、AC、BC，共 3 条。" },
      { type: "choice", stage: "variant", difficulty: 3, stem: "线段 AB = 12，C 是 AB 上任意一点，M 是 AC 的中点，N 是 CB 的中点，则 MN =（ ）", options: ["6", "4", "8", "随 C 的位置变化"], answer: "A", hint: "MN = MC + CN，各是所在段的一半。", explanation: "MN = AC/2 + CB/2 = (AC+CB)/2 = AB/2 = 6，与 C 的位置无关。" },
    ],
  },
  {
    code: "G7-4-03",
    chapter: CH,
    title: "角与角的度量",
    sortOrder: 16,
    summary: [
      { heading: "角的概念与表示", body: "有公共端点的两条射线组成的图形叫角。表示方法：∠AOB（顶点字母在中间）、∠O、∠1、∠α。" },
      { heading: "度分秒", body: "角的度量是 60 进制：1°=60′，1′=60″。换算大单位化小单位乘 60，小单位化大单位除以 60。" },
      { heading: "角的分类", body: "锐角（0°~90°）、直角（90°）、钝角（90°~180°）、平角（180°）、周角（360°）。" },
    ],
    example: {
      stem: "把 36.5° 化成度分形式。",
      analysis: "整数部分是 36°；0.5° = 0.5×60′ = 30′。",
      answer: "36°30′",
    },
    prereqCodes: ["G7-4-02"],
    commonErrors: [
      { cause: "计算错误", detail: "度分秒按 100 进制换算，如把 36.5° 当成 36°5′。" },
      { cause: "概念不清", detail: "用三个字母表示角时，顶点字母没有写在中间。" },
    ],
    socratic: {
      keyConcepts: ["顶点", "度分秒", "60进制", "锐角", "钝角"],
      probes: [
        "1° 等于多少分？这个进率和我们熟悉的时间单位有什么关系？",
        "36.5° 是 36°5′ 吗？应该是多少？",
        "用三个字母表示角时，哪个字母必须写在中间？",
      ],
      hints: ["想想钟面：1 小时=60 分，角度也一样。", "钝角比直角大，但比平角小。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "1° 等于（ ）", options: ["10′", "60′", "100′", "360′"], answer: "B", hint: "角度是 60 进制。", explanation: "1°=60′，1′=60″。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "下列角中，是钝角的是（ ）", options: ["30°", "90°", "120°", "180°"], answer: "C", hint: "钝角大于 90° 且小于 180°。", explanation: "120° 在 90° 与 180° 之间，是钝角。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "36.5° 等于（ ）", options: ["36°5′", "36°30′", "36°50′", "36°3′"], answer: "B", hint: "0.5° 要乘 60 化成分。", explanation: "0.5×60=30，所以 36.5°=36°30′。" },
      { type: "fill", stage: "practice", difficulty: 2, stem: "45°24′ = ____°（用小数表示）。", answer: "45.4", hint: "24′ 要除以 60 化成度。", explanation: "24÷60=0.4，所以 45°24′=45.4°。" },
      { type: "choice", stage: "practice", difficulty: 2, stem: "时钟 3 点整时，时针与分针的夹角是（ ）", options: ["60°", "90°", "120°", "180°"], answer: "B", hint: "钟面 12 个大格共 360°，每个大格 30°。", explanation: "3 点整时针指向 3、分针指向 12，相隔 3 个大格：3×30°=90°。" },
      { type: "choice", stage: "variant", difficulty: 3, stem: "用一副三角板（30°、60°、90° 和 45°、45°、90°）不能拼出的角是（ ）", options: ["75°", "105°", "135°", "25°"], answer: "D", hint: "拼出的角都是 15° 的倍数。", explanation: "75°=30°+45°，105°=60°+45°，135°=90°+45°；25° 无法拼出。" },
      { type: "fill", stage: "variant", difficulty: 3, stem: "计算：90° - 36°48′ = ____。", answer: "53°12′|53°12'|53度12分", hint: "把 90° 借位成 89°60′ 再减。", explanation: "89°60′-36°48′ = 53°12′。" },
    ],
  },
  {
    code: "G7-4-04",
    chapter: CH,
    title: "角的比较与运算、余角和补角",
    sortOrder: 17,
    summary: [
      { heading: "角的和差与角平分线", body: "从角的顶点出发、把这个角分成两个相等角的射线，叫角平分线。若 OC 平分 ∠AOB，则 ∠AOC=∠COB=∠AOB/2。" },
      { heading: "余角与补角", body: "两角之和为 90° 时互余（如 35° 与 55°）；之和为 180° 时互补（如 70° 与 110°）。余角、补角只与度数有关，与位置无关。" },
      { heading: "重要性质", body: "同角（或等角）的余角相等；同角（或等角）的补角相等。这个性质常用于几何说理。" },
    ],
    example: {
      stem: "已知 ∠A = 35°，求它的余角和补角。",
      analysis: "余角 = 90°-35°；补角 = 180°-35°。",
      answer: "余角 55°，补角 145°",
    },
    prereqCodes: ["G7-4-03"],
    commonErrors: [
      { cause: "概念不清", detail: "余角、补角记混：互余是和为 90°，互补是和为 180°。" },
      { cause: "计算错误", detail: "“补角是余角的几倍”类问题列错方程，如把 180-x 与 90-x 写反。" },
    ],
    socratic: {
      keyConcepts: ["角平分线", "互余", "互补", "同角的补角相等"],
      probes: [
        "“互余”和“互补”分别要求和是多少度？怎么记不混？",
        "一个角会有余角的前提是什么？130° 的角有余角吗？",
        "“同角的补角相等”是什么意思？能举个例子吗？",
      ],
      hints: ["“余”字小，对应小的 90°；“补”字大，对应 180°。", "列方程时先写出：补角=180-x，余角=90-x。"],
    },
    questions: [
      { type: "choice", stage: "check", difficulty: 1, stem: "35° 角的余角是（ ）", options: ["55°", "145°", "65°", "35°"], answer: "A", hint: "互余：和为 90°。", explanation: "90°-35°=55°。" },
      { type: "choice", stage: "check", difficulty: 1, stem: "70° 角的补角是（ ）", options: ["20°", "110°", "30°", "100°"], answer: "B", hint: "互补：和为 180°。", explanation: "180°-70°=110°。" },
      { type: "choice", stage: "practice", difficulty: 1, stem: "OC 是 ∠AOB 的平分线，∠AOB = 80°，则 ∠AOC =（ ）", options: ["40°", "50°", "80°", "160°"], answer: "A", hint: "平分线把角分成相等的两份。", explanation: "∠AOC = 80°÷2 = 40°。" },
      { type: "choice", stage: "practice", difficulty: 3, stem: "一个角的补角是它的余角的 3 倍。设这个角为 x°，可列方程（ ）", options: ["180 - x = 3(90 - x)", "90 - x = 3(180 - x)", "180 - x = 3(90 + x)", "x = 3(90 - x)"], answer: "A", hint: "先分别写出补角和余角的式子。", explanation: "补角 180-x，余角 90-x，由题意 180-x=3(90-x)（解得 x=45）。" },
      { type: "fill", stage: "practice", difficulty: 1, stem: "若 ∠1 与 ∠2 互余，∠1 = 62°，则 ∠2 = ____°。", answer: "28", hint: "互余的两角和为 90°。", explanation: "∠2 = 90°-62° = 28°。" },
      { type: "fill", stage: "variant", difficulty: 3, stem: "一个角等于它的补角的 2 倍，则这个角是 ____°。", answer: "120", hint: "设这个角为 x，则 x=2(180-x)。", explanation: "x=360-2x，3x=360，x=120。" },
      { type: "choice", stage: "variant", difficulty: 2, stem: "若 ∠α 与 ∠β 都是 ∠γ 的补角，则 ∠α 与 ∠β 的关系是（ ）", options: ["互余", "互补", "相等", "无法确定"], answer: "C", hint: "回忆“同角的补角……”。", explanation: "同角的补角相等，所以 ∠α=∠β。" },
    ],
  },
];
