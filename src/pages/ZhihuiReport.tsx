/**
 * V175 智慧生涯规划报告（13+ 页，按 mockup-v4 定稿样例）。
 * 数据源：zhihui.reportData（学科四维 + 霍兰德 + 成绩档案 + 未来期望 + 资料库）。
 * 打印：每页 A4 page-break，点「下载 / 打印」另存 PDF。
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  SUBJECT4D_BANK,
  SUBJECT4D_DIM_COLOR,
  SUBJECT4D_DIM_LABEL,
  SUBJECT4D_OPTIONS,
  SUBJECT4D_SUBJECTS,
  SUBJECT4D_INTERP,
  SUBJECT4D_OVERALL,
  subject4dBandLabel,
  type Subject4dResult,
} from "@contracts/subject4d";
import { HOLLAND_LABEL, hollandTopWithTies } from "@contracts/holland";
import HollandHexMap from "@/components/reports/HollandHexMap";

/* ---------- 设计令牌（与 mockup-v4 一致） ---------- */
const C = {
  olive: "#0B3D2E", oliveSoft: "#4B5F57", oliveMute: "#8FA39B",
  brand: "#0EA875", brandDeep: "#0B8A63", brandPale: "#D4F2E8",
  lime: "#3CC078", limePale: "#E4F7EC",
  paper: "#FFFFFF", bg: "#EAF3EE", cream: "#F0FAF5", line: "#E3EEE8",
};
const DIM_KEYS = ["兴趣", "能力倾向", "观念", "效能感"] as const;

/** 资料库多值字段统一清洗：数组/JSON/中英文逗号分隔 → 顿号串联，去重去空。 */
function cleanList(s: unknown, sep = "、" ): string {
  let t = String(s ?? "");
  for (const ch of "[]{}\"'") t = t.split(ch).join(sep);
  for (const ch of ",，;；") t = t.split(ch).join(sep);
  const seen = new Set<string>();
  return t.split(sep).map((x) => x.trim()).filter((x) => {
    if (!x || seen.has(x)) return false;
    seen.add(x); return true;
  }).join(sep);
}

/* ---------- 静态内容（升学路径 / 分数段矩阵 / 分年级规划，按讲座口径；后台模板表下版接入） ---------- */
const PATHWAYS: { tag: string; name: string; main?: boolean; cond: string; plan: string }[] = [
  { tag: "主力路径", name: "普通高考 · 院校专业组", main: true,
    cond: "凭高考裸分录取，本科线上即可填报普通批 45 个院校专业组平行志愿。",
    plan: "稳住年级排名，按冲稳保原则完成志愿填报。" },
  { tag: "强基计划", name: "基础学科拔尖",
    cond: "报考条件：高考报名即可报；校测门槛为高考成绩，录取按「高考≥85% + 校测 + 综合素质评价」合成。面向数学、物理、化学、生物、历史、哲学、古文字学等基础学科，适合单科极其优秀的学生。",
    plan: "若单科潜力突出，高二下前争取竞赛省级奖项，可作为强基备路开始准备。" },
  { tag: "综合评价", name: "降分录取机会",
    cond: "报考条件：按「高考 60% + 校测 30% + 学考 10%」合成录取，广东多校试点均需面试（多数含英文面试）；需提前准备报名申请表、获奖证书、文化课成绩、综合素质档案等材料，最高可降 52 分。适合大部分学生。",
    plan: "综评看重表达与综合素养，高三上学期关注招生简章发布。" },
  { tag: "港澳升学", name: "香港 / 澳门高校",
    cond: "报考条件：两条通道——①提前自主招生（每年 10—12 月首轮申请，可降分录取、先发预录取）；②高考裸分填报。多数需雅思/托福。",
    plan: "若家庭预算允许，高一即启动雅思长线学习，高二参加首考。" },
  { tag: "定向就业", name: "公费师范 / 军校 / 公安",
    cond: "报考条件：军警类需通过体检、政审与面试，年龄 17—20 周岁；公费师范 / 教师专项 / 卫生专项毕业后定向服务 6 年，免学费住宿费并享补贴。在提前批填报，不占普通批志愿。",
    plan: "适合追求稳定就业的家庭，可与其他路径同时准备、互不影响。" },
  { tag: "国际路线", name: "海外本科 / 中外合办",
    cond: "报考条件：英语系国家看「高考成绩 / 高中成绩单 / 国际考试成绩 + 雅思托福」；中外合办 4+0/3+0、国际本科 1+3/2+2/3+1 可不出国或分段出国；非英语国家有预科直通。费用较高，需家庭提前规划。",
    plan: "中外合作项目可作稳保志愿的「增值」选项，英语单科 115+ 更有优势。" },
];

const GRADE_PLANS: { grade: string; theme: string; items: string[] }[] = [
  { grade: "高一", theme: "定位与筑基", items: [
    "完成学科四维测评与霍兰德测评，确定选科组合",
    "稳住语数外基本盘，建立 1—2 门优势学科，年级排名前 20%",
    "启动雅思长线学习（目标港澳/海外路径的家庭），词汇与听力每日打卡",
    "参加 1—2 项教育部白名单赛事或研究性学习课题，积累综合素质档案素材",
    "寒暑假完成职业体验 / 研学活动，验证专业方向认知"] },
  { grade: "高二", theme: "冲刺学考与素材", items: [
    "学考全力冲 A（综评中学考占 10%，多校要求全 A）",
    "竞赛冲刺：争取省级奖项（强基校测与综评材料的核心筹码）",
    "雅思首考目标 6.0—6.5；港澳院校申请文书素材开始整理",
    "高二下：强基计划启动规划，目标校初步定位（窗口期：高二下—高三上）",
    "保持年级前 15%，建立目标院校近三年分数跟踪表"] },
  { grade: "高三", theme: "申报与考试季", items: [
    "上学期 10—12 月：港澳首轮申请开放，完成港大多元计划、港科大校长推荐等提前批申请（窗口期最关键）",
    "高三上：综评招生简章发布，准备报名申请表、个人陈述、获奖证明等申请材料",
    "3—4 月：强基计划报名；综评初审材料提交",
    "5—6 月：高考冲刺 + 强基 / 综评校测准备（面试含英文）",
    "6 月：高考 → 校测 → 按「冲稳保」原则完成 45 个平行志愿填报"] },
];

const MATRIX: { band: string; rows: [string, string][] }[] = [
  { band: "650 - 670 分", rows: [
    ["高考统招", "哈尔滨工业大学(深圳)、中山大学(热门专业)、浙江大学、南京大学、中国科学技术大学、武汉大学、西安交通大学"],
    ["强基计划", "中山大学、浙江大学、南京大学、中国科学技术大学、西安交通大学、哈尔滨工业大学"],
    ["综合评价", "南方科技大学、香港中文大学(深圳)、中山大学、深圳北理莫斯科大学"],
    ["港澳升学", "香港大学、香港科技大学、香港中文大学、香港城市大学"],
    ["境外留学", "剑桥大学、牛津大学、新加坡国立大学、南洋理工大学（世界前 50 强）"] ] },
  { band: "630 - 650 分", rows: [
    ["高考统招", "中山大学、华南理工大学、华东师范大学、北京外国语大学、南开大学、华中科技大学、武汉大学"],
    ["强基计划", "哈尔滨工业大学、西安交通大学、同济大学、北京师范大学、中山大学"],
    ["综合评价", "南方科技大学、香港中文大学(深圳)、深圳北理莫斯科大学"],
    ["港澳升学", "香港城市大学、香港理工大学（世界前 100 强）"],
    ["境外留学", "新加坡前二、澳洲八大、英国前 30"] ] },
  { band: "610 - 630 分", rows: [
    ["高考统招", "华南理工大学(中外)、中国农业大学、西北工业大学、重庆大学、中南大学、暨南大学、深圳大学(热门)"],
    ["强基计划", "东南大学、中国农业大学、兰州大学"],
    ["综合评价", "香港中文大学(深圳)、西交利物浦大学"],
    ["港澳升学", "香港浸会大学、澳门大学"],
    ["境外留学", "澳门大学、香港教育大学、海外世界前 200 强"] ] },
];

const MENLEI_GROUPS = [
  { label: "自然科学", sub: "探究自然规律", items: [
    { n: "理学", d: "基础科学，读研深造的沃土", c: 12 }, { n: "工学", d: "应用技术主力，就业面最宽", c: 31 },
    { n: "农学", d: "现代农业与生态文明", c: 7 }, { n: "医学", d: "周期长、门槛高、社会刚需", c: 11 } ] },
  { label: "社会科学", sub: "研究社会运行", items: [
    { n: "经济学", d: "财经商贸与宏观分析", c: 4 }, { n: "管理学", d: "组织运营与商业决策", c: 9 },
    { n: "法学", d: "规则、社会治理与公共安全", c: 6 }, { n: "教育学", d: "育人方法与运动科学", c: 2 } ] },
  { label: "人文科学", sub: "关注人与表达", items: [
    { n: "文学", d: "语言、文化与传播", c: 3 }, { n: "历史学", d: "以古鉴今，史料与史观", c: 1 },
    { n: "哲学", d: "思辨与价值追问", c: 1 }, { n: "艺术学", d: "创作、设计与表演", c: 5 } ] },
];

/** 高中学科 → 关联门类（门类推荐指数 · 学科潜力映射） */
const SUBJECT_MENLEI: Record<string, string[]> = {
  语文: ["文学", "教育学"],
  数学: ["理学", "工学"],
  英语: ["文学", "经济学", "管理学"],
  物理: ["工学", "理学"],
  化学: ["理学", "医学", "工学"],
  生物: ["医学", "农学", "理学"],
  历史: ["历史学", "哲学", "文学"],
  政治: ["法学", "教育学"],
  地理: ["理学", "工学"],
};

/* ---------- SVG 工具 ---------- */
function PyramidChart() {
  const layers = [["学科表现", C.brand], ["学科效能感 · 燃料", "#3E7CB1"], ["学科观念 · 指南针", "#8E6BC0"], ["学科能力倾向 · 动力", "#F0A92E"], ["学科兴趣 · 船舵", "#E4572E"]];
  return (
    <svg width="340" height="330" viewBox="0 0 320 330">
      {layers.map((L, i) => {
        const y = 14 + i * 62, wT = 130 + i * 36, wB = 130 + (i + 1) * 36, cx = 160;
        return (
          <g key={L[0]}>
            <polygon points={`${cx - wT / 2},${y} ${cx + wT / 2},${y} ${cx + wB / 2},${y + 54} ${cx - wB / 2},${y + 54}`} fill={L[1]} opacity={i === 0 ? 1 : 0.88} />
            <text x={cx} y={y + 30} textAnchor="middle" fill="#fff" fontSize={i === 0 ? 14 : 11.5} fontWeight={600}>{L[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function StackBar({ subjects }: { subjects: { n: string; v: number[] }[] }) {
  const W = 780, H = 330, padL = 40, padB = 62, padT = 14, max = 20;
  const k = (H - padB - padT) / max, bw = 46, gap = (W - padL - 10) / subjects.length;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {[0, 5, 10, 15, 20].map((g) => {
        const y = H - padB - g * k;
        return (<g key={g}><line x1={padL} y1={y} x2={W - 6} y2={y} stroke="#E8F1EC" /><text x={padL - 8} y={y + 4} textAnchor="end" fontSize={10} fill={C.oliveMute}>{g}</text></g>);
      })}
      {subjects.map((d, i) => {
        const x = padL + i * gap + (gap - bw) / 2;
        let acc = 0;
        return (
          <g key={d.n}>
            {d.v.map((v, j) => {
              const hh = v * k, y = H - padB - acc - hh;
              acc += hh;
              return (<g key={j}><rect x={x} y={y} width={bw} height={hh} fill={DIMC[j]} rx={j === 3 ? 4 : 0} /><text x={x + bw / 2} y={y + hh / 2 + 4} textAnchor="middle" fontSize={10} fill="#fff" fontWeight={600}>{v}</text></g>);
            })}
            <text x={x + bw / 2} y={H - padB + 18} textAnchor="middle" fontSize={12} fill={C.olive} fontWeight={600}>{d.n}</text>
            <text x={x + bw / 2} y={H - padB + 36} textAnchor="middle" fontSize={11} fill={C.brand} fontWeight={700}>{(d.v.reduce((a, b) => a + b, 0) / 4).toFixed(1)}</text>
          </g>
        );
      })}
    </svg>
  );
}
const DIMC = [C_heat(), "#F0A92E", "#8E6BC0", "#3E7CB1"];
function C_heat() { return "#E4572E"; }

function Radar({ items }: { items: { label: string; value: number }[] }) {
  const cx = 165, cy = 145, R = 105, N = 6;
  let pts = "";
  for (let i = 0; i <= N; i++) {
    const j = i % N, a = -Math.PI / 2 + (j * 2 * Math.PI) / N, r = (R * items[j]!.value) / 100;
    pts += `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)} `;
  }
  return (
    <svg width="330" height="290" viewBox="0 0 330 290">
      {[1, 2, 3, 4, 5].map((ring) => {
        let p = "";
        for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / N; p += `${cx + (R * ring) / 5 * Math.cos(a)},${cy + (R * ring) / 5 * Math.sin(a)} `; }
        return <polygon key={ring} points={p} fill="none" stroke="#E8F1EC" />;
      })}
      {items.map((t, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
        return (<g key={t.label}><line x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke="#E8F1EC" />
          <text x={cx + (R + 30) * Math.cos(a)} y={cy + (R + 30) * Math.sin(a) - 2} textAnchor="middle" fontSize={12} fontWeight={700} fill={C.oliveSoft}>{t.label}</text>
          <text x={cx + (R + 30) * Math.cos(a)} y={cy + (R + 30) * Math.sin(a) + 13} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.brandDeep}>{t.value}</text></g>);
      })}
      <polygon points={pts} fill={C.brand} opacity={0.25} stroke={C.brand} strokeWidth={2} />
      {items.map((t, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / N, r = (R * t.value) / 100;
        return <circle key={i} cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r={4} fill={C.brand} />;
      })}
    </svg>
  );
}

function SouChart() {
  const cs: [number, number, string, string, string][] = [
    [230, 150, "#0EA875", "个体特征", "学科潜力 · 霍兰德兴趣"],
    [470, 150, "#3E7CB1", "选科要求", "高校专业选考科目要求"],
    [350, 150, "#8E6BC0", "学以致用", "专业 → 职业 匹配"],
  ];
  return (
    <svg width="700" height="280" viewBox="0 0 700 280">
      {cs.map((c) => (<g key={c[3]}><circle cx={c[0]} cy={c[1]} r={110} fill={c[2]} opacity={0.22} />
        <text x={c[0]} y={c[1] - 6} textAnchor="middle" fontSize={16} fontWeight={700} fill={c[2]}>{c[3]}</text>
        <text x={c[0]} y={c[1] + 16} textAnchor="middle" fontSize={11} fill={C.oliveSoft}>{c[4]}</text></g>))}
      <text x={350} y={36} textAnchor="middle" fontSize={13} fontWeight={700} fill={C.olive}>既能报考 · 又适合学　｜　既能学以致用 · 又适合从事</text>
    </svg>
  );
}

function Donut({ combo }: { combo: [string, string, string][] }) {
  const cx = 125, cy = 125, R = 95, r = 55;
  const cols = [C.brand, "#3E7CB1", "#8E6BC0"];
  let a0 = -Math.PI / 2;
  const segs = combo.map((c, i) => {
    const a1 = a0 + (1 / 3) * 2 * Math.PI;
    const seg = { c, col: cols[i], a0, a1 };
    a0 = a1;
    return seg;
  });
  const label = combo.map((c) => c[0]).join(" + ");
  return (
    <svg width="250" height="250" viewBox="0 0 250 250">
      {segs.map((s, i) => {
        const p1 = [cx + R * Math.cos(s.a0), cy + R * Math.sin(s.a0)], p2 = [cx + R * Math.cos(s.a1), cy + R * Math.sin(s.a1)],
          p3 = [cx + r * Math.cos(s.a1), cy + r * Math.sin(s.a1)], p4 = [cx + r * Math.cos(s.a0), cy + r * Math.sin(s.a0)];
        return <path key={i} d={`M${p1} A${R},${R} 0 0 1 ${p2} L${p3} A${r},${r} 0 0 0 ${p4} Z`} fill={s.col} />;
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={16} fontWeight={700} fill={C.olive}>{label}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={11} fill={C.oliveMute}>3+1+2 推荐组合</text>
    </svg>
  );
}

function DimBars({ dims }: { dims: [string, number, string][] }) {
  return (
    <svg width="100%" viewBox="0 0 780 190">
      {dims.map((d, i) => {
        const y = 16 + i * 44;
        return (<g key={d[0]}>
          <text x={0} y={y + 18} fontSize={13} fill={C.olive} fontWeight={600}>{d[0]}</text>
          <rect x={130} y={y} width={560} height={26} rx={13} fill="#EEF5F1" />
          <rect x={130} y={y} width={(560 * d[1]) / 5} height={26} rx={13} fill={d[2]} />
          <text x={130 + (560 * d[1]) / 5 + 12} y={y + 19} fontSize={14} fontWeight={700} fill={d[2]}>{d[1].toFixed(1)}</text>
        </g>);
      })}
    </svg>
  );
}

/* ---------- 页面骨架 ---------- */
function Page({ no, children, tall = true }: { no: number; children: React.ReactNode; tall?: boolean }) {
  return (
    <div className="zh-page" style={{ minHeight: tall ? 1120 : 560 }}>
      {children}
      <div className="pfoot"><span><i className="pdot" />EVALUATION REPORT</span><span>{String(no).padStart(2, "0")}</span></div>
    </div>
  );
}

function SecTitle({ n, title, sub }: { n: string | number; title: string; sub?: string }) {
  return (
    <div className="sec-title">
      <span className="n">{n}</span><h3>{title}</h3>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

/* ---------- 主组件 ---------- */
/** 报告主体：独立页与内嵌（测评报告栏目）共用；printId 仅独立页传（打印字号规则按 id 匹配）。 */
export function ZhihuiReportBody({ studentId, printId }: { studentId?: number; printId?: string }) {
  const { data, isLoading } = trpc.zhihui.reportData.useQuery({ studentId });

  const s4d = data?.subject4d?.result as Subject4dResult | null | undefined;
  const holland = data?.holland?.result as { dims?: Record<string, number>; top3?: string[]; code?: string; summary?: string } | null | undefined;
  const academics = data?.academics?.subjects ?? [];
  const exp = data?.expectations;
  const grade = data?.student.grade === "junior" ? "初三" : data?.student.grade === "senior" ? "高三" : data?.student.grade === "高二" ? "高二" : "高一";

  /* 选科推荐：首选 = 物理/历史潜力高者；再选 = 剩余 5 科潜力 Top2（物理首选时化学加权优先） */
  const combos = useMemo(() => {
    if (!s4d) return null;
    const p = (n: string) => s4d.subjects[n as keyof typeof s4d.subjects]?.潜力指数 ?? 3;
    const firstPhys = p("物理") >= p("历史");
    const rest = ["化学", "生物", "历史", "政治", "地理"].filter((s) => s !== (firstPhys ? "历史" : "物理"));
    const scored = rest.map((s) => ({ s, v: p(s) + (firstPhys && s === "化学" ? 0.4 : 0) })).sort((a, b) => b.v - a.v);
    const first = firstPhys ? "物理" : "历史";
    const c1: [string, string, string][] = [[first, "首选", ""], [scored[0]!.s, "再选", ""], [scored[1]!.s, "再选", ""]];
    const alt2 = [scored[0]!.s, scored[2]!.s];
    const alt3 = firstPhys ? ["政治", scored[0]!.s] : [scored[1]!.s, scored[2]!.s];
    return { c1, second: [first, ...alt2], third: [firstPhys ? "物理" : "历史", ...alt3].slice(0, 3) };
  }, [s4d]);

  const subjectRows = useMemo(() => {
    if (!s4d) return [];
    return SUBJECT4D_SUBJECTS.map((n) => {
      const r = s4d.subjects[n];
      return { n, v: r ? [r.兴趣, r.能力倾向, r.观念, r.效能感].map((x) => Math.round(x * 10) / 10) : [0, 0, 0, 0] };
    });
  }, [s4d]);

  const holItems = useMemo(() => {
    const d = holland?.dims ?? {};
    return ["R", "I", "A", "S", "E", "C"].map((k) => ({
      label: `${k}·${HOLLAND_LABEL[k as keyof typeof HOLLAND_LABEL] ?? k}`,
      value: Math.round(((d[k] ?? 3) / 5) * 100),
    }));
  }, [holland]);

  const totalScore = useMemo(() => academics.reduce((s, a) => s + (a.lastScore ?? 0), 0), [academics]);
  const reportNo = useMemo(() => {
    const d = data?.subject4d?.createdAt ? new Date(data.subject4d.createdAt) : new Date();
    return `ZH${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${data?.student.id ?? 0}`;
  }, [data]);

  /* 门类推荐指数：霍兰德门类权重(×2) + 推荐专业类命中(+3) + 学科四维 Top3 映射(4/3/2)；
     首选历史时自然科学门类折半（呼应「理工农医多要求物理+化学」的选科门槛） */
  const menleiRec = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    const sc: Record<string, number> = {};
    const add = (m: string, v: number) => { if (m) sc[m] = (sc[m] ?? 0) + v; };
    for (const [m, w] of Object.entries(data.menleiW ?? {})) add(m, w * 2);
    for (const c of data.majorCats ?? []) add(c.menlei, 3);
    const s4 = data.subject4d?.result as Subject4dResult | null | undefined;
    if (s4?.subjects) {
      const top = SUBJECT4D_SUBJECTS.map((n) => ({ n, v: s4.subjects[n]?.潜力指数 ?? 0 }))
        .sort((a, b) => b.v - a.v).slice(0, 3);
      top.forEach((t, i) => { for (const m of SUBJECT_MENLEI[t.n] ?? []) add(m, 4 - i); });
      const phys = s4.subjects["物理"]?.潜力指数 ?? 3;
      const hist = s4.subjects["历史"]?.潜力指数 ?? 3;
      if (hist > phys) for (const m of ["理学", "工学", "农学", "医学"]) if (sc[m]) sc[m] = sc[m]! * 0.5;
    }
    const mx = Math.max(0, ...Object.values(sc));
    const rec: Record<string, number> = {};
    if (mx > 0) for (const [m, v] of Object.entries(sc)) {
      if (v <= 0) continue;
      const r = Math.round(55 + (43 * v) / mx);
      if (r >= 60) rec[m] = Math.min(98, r);
    }
    return rec;
  }, [data]);
  const [openMenlei, setOpenMenlei] = useState<string | null>(null);

  if (isLoading) return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  if (!data) return <p className="py-10 text-center text-olive-mute">报告数据加载失败</p>;

  const expLabel = exp?.school || exp?.majorCat || exp?.careers
    ? { school: exp?.school || "（尚未填写，可由伴学师引导补充）", major: exp?.majorCat || "（待定）", careers: exp?.careers || "（待定）" }
    : null;
  const majorCats = data.majorCats ?? [];
  const careerPicks = data.careerPicks ?? [];
  const menleiCatMap: Record<string, string[]> = Object.fromEntries((data.menleiCats ?? []).map((m) => [m.menlei, m.cats]));
  const targetRows = (data.targetSchool?.rows ?? []).filter((r) => r.y1Min != null).slice(0, 6);

  return (
    <div className="zh-root" id={printId}>
      <style>{ZH_CSS}</style>
      <div className="mb-4 flex flex-wrap items-center gap-3 no-print">
        <h1 className="text-[20px] font-bold text-olive">选科及升学规划报告</h1>
        <span className="text-[12.5px] text-olive-mute">{data.student.name} · {grade} · 报告编号 {reportNo}</span>
        <button type="button" onClick={() => window.print()} className="ml-auto rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-cream hover:bg-lime">
          下载 / 打印
        </button>
      </div>

      {/* 1 封面 */}
      <Page no={1}>
        <div className="flex flex-1 flex-col items-start justify-center">
          <div className="klabel" style={{ marginBottom: 18 }}>EVALUATION REPORT · 三好生涯测评</div>
          <h1 style={{ fontSize: 30, letterSpacing: 2, lineHeight: 1.4 }}>选科及升学规划<br />测评报告</h1>
          <div style={{ marginTop: 26, width: 64, height: 4, background: C.brand, borderRadius: 2 }} />
          <p style={{ marginTop: 26, color: C.oliveSoft, fontSize: 15, lineHeight: 2.2 }}>认识自我 · 认识世界 · 树立目标 · 制定计划</p>
        </div>
        <div className="card cover-card" style={{ width: 340 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 22px", fontSize: 14 }}>
            <span className="muted">姓　　名</span><span style={{ fontWeight: 600 }}>{data.student.name}</span>
            <span className="muted">年　　级</span><span style={{ fontWeight: 600 }}>{grade}</span>
            <span className="muted">报告编号</span><span style={{ fontWeight: 600 }}>{reportNo}</span>
            <span className="muted">报告日期</span><span style={{ fontWeight: 600 }}>{new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
        </div>
      </Page>

      {/* 2 Part1 概览 */}
      <Page no={2}>
        <div className="part-tag">PART 1</div>
        <h2>测评结果概览</h2>
        <p className="muted" style={{ marginTop: 16 }}>
          亲爱的{data.student.name}同学，你好！这份报告基于你完成的<b>学科四维测评</b>{holland ? "与<b>职业兴趣测评</b>" : ""}，从学科表现、专业方向、职业倾向三个层面，帮助你认识自己、了解世界、树立目标。测评结果没有好坏之分，它只是一面镜子，为你接下来的选科与升学规划提供参考。
        </p>
        <SecTitle n={1} title="学科表现金字塔模型" sub="学科表现 = 兴趣 + 能力倾向 + 观念 + 效能感" />
        <div className="card flexrow" style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          <PyramidChart />
          <div className="side-col" style={{ width: 330, fontSize: 13, lineHeight: 2.1 }}>
            <p><b style={{ color: "#E4572E" }}>学科兴趣 · 船舵</b>——决定你在学科学习中的发展方向。</p>
            <p><b style={{ color: "#C77F0E" }}>学科能力倾向 · 动力系统</b>——学好该学科的能力、策略与方法。</p>
            <p><b style={{ color: "#8E6BC0" }}>学科观念 · 指南针</b>——是否理解为什么学、能否学以致用。</p>
            <p><b style={{ color: "#3E7CB1" }}>学科效能感 · 燃料系统</b>——对自己能否学好该学科的自信程度。</p>
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>学科潜力指数 =（兴趣 + 能力倾向 + 观念 + 效能感）÷ 4</p>
          </div>
        </div>
        <SecTitle n={2} title="学科表现分析" sub="九科 · 四维度 · 满分 5 分" />
        {subjectRows.length ? <StackBar subjects={subjectRows} /> : <p className="muted">尚未完成学科四维测评，请先到测评中心完成。</p>}
        <div style={{ display: "flex", gap: 18, fontSize: 12, justifyContent: "center" }}>
          {DIM_KEYS.map((d, i) => (<span key={d}><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: DIMC[i], marginRight: 5 }} />{SUBJECT4D_DIM_LABEL[d]}</span>))}
        </div>
        <SecTitle n={3} title="现在的成绩" sub="最近一次校内考试（档案录入）" />
        <div className="tw">
        <table>
          <thead><tr><th>学科</th>{academics.map((a) => <th key={a.name}>{a.name}</th>)}</tr></thead>
          <tbody><tr><td><b>分数</b></td>{academics.map((a) => <td key={a.name}>{a.lastScore ?? "—"}</td>)}</tr></tbody>
        </table>
        </div>
      </Page>

      {/* 3 霍兰德 + SOU */}
      <Page no={3}>
        <SecTitle n={4} title="霍兰德职业兴趣分析" sub={holland?.code ? `你的类型：${holland.code}` : "尚未完成霍兰德测评"} />
        {holland ? (
          <div className="grid2">
            <div className="card" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}><Radar items={holItems} /></div>
            <div style={{ fontSize: 13, lineHeight: 2.1 }}>
              {/* v180：优势标注与六型地图同一标准——前三含并列，全部突出 */}
              {hollandTopWithTies(holland.dims, 3).map((t, i) => (<p key={t} style={{ marginTop: i ? 8 : 0 }}><span className="tag t-hi">{t} 型 {Math.round(((holland.dims?.[t] ?? 0) / 5) * 100)}</span></p>))}
              <div className="card" style={{ marginTop: 14, padding: "14px 20px" }}>
                <div className="klabel" style={{ marginBottom: 8 }}>个人侧写</div>
                <p style={{ fontSize: 13, lineHeight: 2 }}>{holland.summary ?? ""}</p>
              </div>
            </div>
          </div>
        ) : <p className="muted">完成霍兰德职业兴趣测评后，这里会生成你的 RIASEC 兴趣雷达图。</p>}
        {/* v179：六型学科专业地图紧跟雷达图（六型 → 学科专业大类与能力） */}
        <SecTitle n={5} title="霍兰德六型 · 学科专业地图" sub={holland?.code ? `你的类型：${holland.code} · 优势方向已高亮` : "完成霍兰德测评后高亮你的优势方向"} />
        <HollandHexMap dims={holland?.dims ?? null} top3={holland?.top3 ?? null} />
        <SecTitle n={6} title="SOU 专业 & 职业测评模型" sub="主客观统一 Subjective & Objective Unity" />
        <div className="card" style={{ textAlign: "center" }}><SouChart /></div>
      </Page>

      {/* 4 期望 + 选科 + 分差 */}
      <Page no={4}>
        <SecTitle n={7} title="未来期望" sub="树立目标，解决为什么而学" />
        {expLabel ? (
          <div style={{ background: C.limePale, border: "1px solid #CDEBDD", borderRadius: 16, padding: "28px 32px" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 16, padding: "11px 0" }}><span style={{ fontSize: 22 }}>🎯</span>我期望就读<b style={{ color: C.brandDeep }}>{expLabel.school}</b>{exp?.source === "system" ? "（系统建议）" : exp?.source === "tutor" ? "（伴学师协助填写）" : ""}</div>
            <div className="divider" style={{ margin: "6px 0" }} />
            <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 16, padding: "11px 0" }}><span style={{ fontSize: 22 }}>📚</span>我期望学习<b style={{ color: C.brandDeep }}>{expLabel.major}</b>专业</div>
            <div className="divider" style={{ margin: "6px 0" }} />
            <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 16, padding: "11px 0" }}><span style={{ fontSize: 22 }}>💼</span>我期望从事<b style={{ color: C.brandDeep }}>{expLabel.careers}</b></div>
          </div>
        ) : (
          <div className="card"><p className="muted">还没想好也很正常。做完测评后可让伴学师引导你填写期望（支持简称如「中大」→中山大学）；伴学师没来得及填写时，系统会按测评结果给出建议目标。</p></div>
        )}
        <SecTitle n={8} title="推荐选科组合" sub="3+1+2 模式 · 依据学科潜力指数与 SOU 筛选" />
        {combos ? (
          <>
            <div className="card flexrow" style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <span style={{ display: "inline-block", background: C.brand, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 14px", borderRadius: 99, marginBottom: 10 }}>第一推荐</span>
                <Donut combo={combos.c1} />
              </div>
              <div className="side-col" style={{ width: 400, fontSize: 14, lineHeight: 2.2 }}>
                {combos.c1.map(([sub, tag], i) => (<div key={sub}><i style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: DIMC[i === 0 ? 0 : i], marginRight: 8 }} />{tag} · <b>{sub}</b></div>))}
                <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>首选{combos.c1[0]![0]}覆盖最广的专业面；再选按学科潜力指数排序（物理首选时化学加权优先，满足绝大多数理工类「物理+化学」选考要求）。</p>
              </div>
            </div>
            <div className="grid2" style={{ marginTop: 16 }}>
              <div className="card" style={{ background: "#fff" }}><b style={{ fontSize: 16, color: C.olive }}>{combos.second.join(" + ")}</b><span className="tag t-hi" style={{ marginLeft: 10 }}>第二推荐</span></div>
              <div className="card" style={{ background: "#fff" }}><b style={{ fontSize: 16, color: C.olive }}>{combos.third.join(" + ")}</b><span className="tag t-hi" style={{ marginLeft: 10 }}>第三推荐</span></div>
            </div>
          </>
        ) : <p className="muted">完成学科四维测评后生成推荐组合。</p>}
        <SecTitle n={9} title="距离目标还有多远" sub={exp?.school ? `目标：${exp.school}${exp.majorCat ? ` · ${exp.majorCat}` : ""}` : "填写未来期望后生成分差表"} />
        {exp?.school && targetRows.length ? (
          <>
            <div className="tw">
            <table>
              <thead><tr><th>院校专业组</th><th>专业</th><th>2025 最低分</th><th>2025 最低位次</th><th>2026 预估位次</th></tr></thead>
              <tbody>{targetRows.map((r) => (<tr key={r.id}><td style={{ textAlign: "left", paddingLeft: 14 }}>{r.school}（{r.groupName}）</td><td style={{ textAlign: "left", paddingLeft: 14 }}>{r.major}</td><td>{r.y1Min ?? "—"}</td><td>{r.y1Rank ?? "—"}</td><td>{r.estRank26 ?? "—"}</td></tr>))}</tbody>
            </table>
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>数据来源：广东院校专业分数库 · 近三年录取明细与 2026 预估位次，每年随录取数据更新。</p>
          </>
        ) : <p className="muted">{exp?.school ? "目标院校近三年录取数据匹配中，可联系伴学师在资料库核对。" : "在「未来期望」填写目标院校后，这里会生成真实分差对照表。"}</p>}
      </Page>

      {/* Part2 学科详情 ×9（v179 起页码 5-13） */}
      {SUBJECT4D_SUBJECTS.map((name, idx) => {
        const r = s4d?.subjects[name];
        return (
          <Page key={name} no={5 + idx}>
            {idx === 0 && (<><div className="part-tag">PART 2</div><h2>学科表现分析</h2></>)}
            <SecTitle n={idx + 1} title={`学科表现分析 · ${name}`} sub={r ? `潜力指数 ${r.潜力指数.toFixed(2)}` : "尚未测评"} />
            {r ? (
              <>
                <DimBars dims={DIM_KEYS.map((d) => [SUBJECT4D_DIM_LABEL[d], r[d], SUBJECT4D_DIM_COLOR[d]] as [string, number, string])} />
                <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                  {DIM_KEYS.map((d) => {
                    const band = r[d] >= 4 ? "高" : r[d] >= 2.5 ? "中" : "低";
                    return (
                      <div key={d} className="card" style={{ borderLeft: `4px solid ${SUBJECT4D_DIM_COLOR[d]}` }}>
                        <b style={{ color: SUBJECT4D_DIM_COLOR[d] }}>{SUBJECT4D_DIM_LABEL[d]} · {r[d].toFixed(1)} {subject4dBandLabel(r[d])}</b>
                        <p style={{ fontSize: 13, lineHeight: 2, marginTop: 8 }}>{SUBJECT4D_INTERP[name][d][band]}</p>
                      </div>
                    );
                  })}
                </div>
                {r.潜力指数 >= 3.8 && (<div className="card" style={{ marginTop: 14 }}><div className="klabel" style={{ marginBottom: 6 }}>优势表现</div><p style={{ fontSize: 13, lineHeight: 2 }}>{SUBJECT4D_OVERALL[name]}</p></div>)}
                <div className="card flexrow" style={{ marginTop: 14, display: "flex", gap: 60, fontSize: 15 }}>
                  <span>当前分数<b style={{ color: C.brandDeep, fontSize: 22, marginLeft: 10 }}>{academics.find((a) => a.name === name)?.lastScore ?? "—"}</b></span>
                  <span>希望达到<b style={{ color: C.brandDeep, fontSize: 22, marginLeft: 10 }}>{academics.find((a) => a.name === name)?.targetScore ?? "—"}</b></span>
                  <span className="muted" style={{ marginLeft: "auto", alignSelf: "center", fontSize: 12 }}>—— 课堂效率 + 错题复盘 + 每周专题训练，一学期后可见明显提升</span>
                </div>
              </>
            ) : <p className="muted">完成学科四维测评后，这里会生成 {name} 的四维画像与解读。</p>}
          </Page>
        );
      })}

      {/* Part3 门类图 */}
      <Page no={14}>
        <div className="part-tag">PART 3</div>
        <h2>认识世界 · 本科 12 大学科门类</h2>
        <p className="muted" style={{ marginTop: 12 }}>按自然科学 / 社会科学 / 人文科学三排归纳，绿色徽标为结合你测评结果的推荐门类，点开门类可查看下设专业类。</p>
        <div style={{ marginTop: 18 }}>
          {MENLEI_GROUPS.map((g) => (
            <div key={g.label} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ background: C.brand, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 99 }}>{g.label}</span>
                <span style={{ fontSize: 12, color: C.oliveMute }}>{g.sub}</span>
              </div>
              <div className="menlei-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {g.items.map((it) => {
                  const rec = menleiRec[it.n];
                  const open = openMenlei === it.n;
                  const cats = menleiCatMap[it.n] ?? [];
                  return (
                    <div key={it.n} onClick={() => setOpenMenlei(open ? null : it.n)}
                      style={{ position: "relative", background: rec != null ? "#F0FAF5" : "#fff", border: rec != null ? `1.5px solid ${C.brand}` : "1px solid #E8F1EC", borderRadius: 12, padding: "16px 18px", cursor: "pointer" }}>
                      {rec != null && (
                        <span style={{ position: "absolute", top: 10, right: 12, background: C.brand, color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99 }}>推荐 {rec}%</span>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <b style={{ fontSize: 16, color: C.olive }}>{it.n}</b>
                        {rec == null && <span style={{ fontSize: 12, color: C.oliveMute }}>{it.c} 类</span>}
                      </div>
                      <div style={{ fontSize: 12, color: C.oliveSoft, marginTop: 6 }}>{it.d}</div>
                      <div style={{ fontSize: 12, color: C.brand, fontWeight: 600, marginTop: 8 }}>{open ? "收起 ⌃" : `${it.c} 个专业类 ⌄`}</div>
                      {open && (
                        <div style={{ marginTop: 10, borderTop: "1px dashed #E8F1EC", paddingTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(cats.length ? cats : [`共 ${it.c} 个专业类（资料库同步中）`]).map((c) => (
                            <span key={c} style={{ background: "#fff", border: "1px solid #D4F2E8", color: C.oliveSoft, fontSize: 12, padding: "3px 10px", borderRadius: 8 }}>{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Page>

      {/* Part3 适合专业&职业 */}
      <Page no={15}>
        <SecTitle n={1} title="适合的专业 & 职业" sub={holland?.code ? `你的霍兰德代码为 ${holland.code}` : "完成霍兰德测评后按兴趣代码推荐"} />
        <div className="ribbon">专业</div>
        <div className="colhead" style={{ marginTop: 14 }}><span>学科门类</span><span /><span>专业类</span></div>
        {majorCats.length ? majorCats.map((m) => (
          <div key={m.code} className="pairrow"><span className="a">{m.menlei}</span><span className="arrow">——</span><span className="b">{m.cat}</span></div>
        )) : <p className="muted">资料库专业推荐生成中。</p>}
        <div className="ribbon alt" style={{ marginTop: 16 }}>职业</div>
        <div className="colhead" style={{ marginTop: 14 }}><span>职业大类</span><span /><span>职业名称</span></div>
        {careerPicks.length ? careerPicks.map((c) => (
          <div key={c.id} className="pairrow"><span className="a">{c.category.split("·")[0]?.trim()}</span><span className="arrow">——</span><span className="b">{c.name}</span></div>
        )) : <p className="muted">资料库职业推荐生成中。</p>}
        <p className="muted" style={{ marginTop: 18, fontSize: 12 }}>以上推荐由 SOU 模型生成：先按选科要求筛出「能报考」的专业群，再按霍兰德适配性排序取前 5；职业由专业学以致用关系 + 个人兴趣双重匹配。</p>
      </Page>

      {/* Part3 专业详情 + 职业详情 */}
      <Page no={16}>
        <SecTitle n={2} title="适合学习的专业详情" sub="专业底层库共 1100+ 专业，以下为你的 Top 推荐" />
        {majorCats.slice(0, 2).map((m, i) => (
          <div key={m.code} style={{ marginBottom: 26 }}>
            <div className="major-head"><span className="tab">你适合学习的</span><span style={{ fontSize: 18, fontWeight: 700, color: C.brandDeep }}>专业</span><span className="idx">{i + 1}　{m.cat}</span></div>
            <div className="card"><p style={{ fontSize: 13, lineHeight: 2.1 }}>{(m.intro || m.oneLiner || `${m.cat}是${m.menlei}门类下的专业大类。`).replace(/\\n/g, " ")}</p></div>
            {m.courses && (<><div style={{ margin: "18px 0 12px", textAlign: "center", fontSize: 15, fontWeight: 700, color: C.brandDeep }}>· 专业大类课程 ·</div>
              <div className="card" style={{ background: "#fff" }}><p style={{ fontSize: 13, lineHeight: 2.2 }}>{cleanList(m.courses).split("、").slice(0, 10).join("　·　")}</p></div></>)}
            <div className="grid2" style={{ marginTop: 14 }}>
              {m.industries && <div className="card"><div className="klabel" style={{ marginBottom: 8 }}>专业应用领域</div><p style={{ fontSize: 13, lineHeight: 2 }}>{cleanList(m.industries, "　·　")}</p></div>}
              {m.jobs && <div className="card"><div className="klabel" style={{ marginBottom: 8 }}>就业方向</div><p style={{ fontSize: 13, lineHeight: 2 }}>{cleanList(m.jobs)}</p></div>}
            </div>
          </div>
        ))}
        <SecTitle n={3} title="适合从事的职业详情" sub="职业数据库 100+ 职业，以下为你的 Top 推荐" />
        {careerPicks.slice(0, 1).map((c) => (
          <div key={c.id}>
            <div className="major-head"><span className="tab">你适合从事的</span><span style={{ fontSize: 18, fontWeight: 700, color: C.brandDeep }}>职业</span><span className="idx">1　{c.name}</span></div>
            <div className="card">
              <p style={{ fontSize: 13, lineHeight: 2.1 }}><b>职业描述：</b>{c.content}</p>
              <div className="divider" />
              <p style={{ fontSize: 13, lineHeight: 2.1 }}><b>职业内容：</b>{cleanList(c.duties)}</p>
            </div>
            <div className="grid2" style={{ marginTop: 14 }}>
              <div className="card"><div className="klabel" style={{ marginBottom: 8 }}>职业技能 · 专业</div><p style={{ fontSize: 13, lineHeight: 2 }}>{cleanList(c.skillsPro)}</p></div>
              <div className="card"><div className="klabel" style={{ marginBottom: 8 }}>职业技能 · 通用</div><p style={{ fontSize: 13, lineHeight: 2 }}>{cleanList(c.skillsGen)}</p></div>
            </div>
            <div className="card" style={{ marginTop: 14 }}><div className="klabel" style={{ marginBottom: 8 }}>发展前景</div><p style={{ fontSize: 13, lineHeight: 2 }}>{c.prospect}</p></div>
          </div>
        ))}
      </Page>

      {/* Part4 目标院校规划 */}
      <Page no={17}>
        <div className="part-tag">PART 4</div>
        <SecTitle n={1} title="目标院校规划" sub={exp?.school ? `目标：${exp.school}${exp.majorCat ? ` · ${exp.majorCat}` : ""}` : "填写未来期望后生成冲稳保对照"} />
        {targetRows.length ? (
          <>
            <div className="tw">
            <table>
              <thead><tr><th>院校（专业组）</th><th>2026 招生专业</th><th>2025 最低分</th><th>2026 预估位次</th></tr></thead>
              <tbody>{targetRows.slice(0, 8).map((r) => (<tr key={r.id}><td style={{ textAlign: "left", paddingLeft: 14 }}>{r.school}<div style={{ fontSize: 11, fontWeight: 400, color: C.oliveMute }}>{r.groupName}</div></td><td style={{ textAlign: "left", paddingLeft: 14 }}>{r.majorFull || r.major}</td><td>{r.y1Min ?? "—"}</td><td>{r.estRank26 ?? "—"}</td></tr>))}</tbody>
            </table>
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>冲 / 稳 / 保 按你的当前总分 {totalScore || "—"} 与录取位次对照生成；院校专业分数库每年随广东录取数据更新。</p>
          </>
        ) : <p className="muted">{exp?.school ? "未匹配到该院校近三年录取数据，可联系伴学师在资料库核对院校名称（支持简称）。" : "在「未来期望」填写目标院校后生成。"}</p>}
      </Page>

      {/* Part4 升学路径 */}
      <Page no={18}>
        <div className="part-tag">PART 4 · 续</div>
        <h2>升学路径规划</h2>
        <p className="muted" style={{ marginTop: 12 }}>同样的分数，通过多元升学可以录取到更多、更好、更合适的大学与专业。以下每条路径都附报考条件，请你与家长、伴学师对照自身情况，确定主路与备路。</p>
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          {PATHWAYS.map((p) => (
            <div key={p.tag} className="card" style={p.main ? { border: "1.5px solid #0EA875", background: "#F0FAF5" } : undefined}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span style={{ minWidth: 34, height: 34, borderRadius: 10, background: p.main ? C.brand : C.brandPale, color: p.main ? "#fff" : C.brandDeep, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.main ? "★" : "·"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}><b style={{ fontSize: 15, color: C.olive }}>{p.tag}</b><span style={{ fontSize: 12, color: C.brandDeep, fontWeight: 600 }}>{p.name}</span></div>
                  <p style={{ fontSize: 12, color: C.oliveSoft, lineHeight: 1.9, marginTop: 6 }}><b style={{ color: C.olive }}>{p.cond.slice(0, 4)}</b>{p.cond.slice(4)}</p>
                  <p style={{ fontSize: 12, color: C.brandDeep, lineHeight: 1.9, marginTop: 4 }}>▸ {p.plan}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Page>

      {/* Part4 分数段矩阵 */}
      <Page no={19}>
        <SecTitle n={2} title="你的分数能走哪些路" sub="物理类 · 按分数段查看可报路径与院校" />
        <div id="matrix">
          {MATRIX.map((b) => (
            <div key={b.band} style={{ background: "#fff", border: "1px solid #E3EEE8", borderRadius: 14, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ padding: "15px 22px", background: "#F7FBF9" }}><b style={{ fontSize: 15, color: C.olive }}>{b.band} · {totalScore ? (totalScore >= Number(b.band.slice(0, 3)) && totalScore <= Number(b.band.slice(6, 9)) ? "你的档" : "") : ""}</b><span style={{ fontSize: 12, color: C.oliveMute, marginLeft: 10 }}>5 条路径可报</span></div>
              <div style={{ padding: "14px 22px 18px" }}>
                {b.rows.map(([tag, list]) => (<div key={tag} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                  <span style={{ minWidth: 76, height: 24, background: C.brand, color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>{tag}</span>
                  <span style={{ fontSize: 12.5, color: C.oliveSoft, lineHeight: 1.9 }}>{list}</span>
                </div>))}
              </div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>每个分数段均可报 5 条路径；矩阵数据每年随广东录取数据库更新。</p>
      </Page>

      {/* Part4 分年级规划 */}
      <Page no={20}>
        <SecTitle n={3} title="分年级条件准备规划" sub={`你现在${grade} · 各阶段该做什么一目了然`} />
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {GRADE_PLANS.map((g) => (
            <div key={g.grade} className="card" style={g.grade === grade ? { border: "1.5px solid #0EA875", background: "#F0FAF5" } : undefined}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
                <b style={{ fontSize: 17, color: C.olive }}>{g.grade}</b>
                <span style={{ fontSize: 12, color: C.brandDeep, fontWeight: 700 }}>{g.theme}</span>
                {g.grade === grade && <span style={{ marginLeft: "auto", fontSize: 11, background: C.brand, color: "#fff", padding: "2px 10px", borderRadius: 99 }}>你在这里</span>}
              </div>
              {g.items.map((t, i) => (<div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, color: C.oliveSoft, lineHeight: 1.9, marginBottom: 4 }}>
                <span style={{ minWidth: 18, height: 18, borderRadius: "50%", background: C.brandPale, color: C.brandDeep, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 3 }}>{i + 1}</span><span>{t}</span>
              </div>))}
            </div>
          ))}
        </div>
      </Page>

      {/* 测评明细 */}
      <Page no={21}>
        <div className="part-tag">APPENDIX</div>
        <h2>测评明细</h2>
        <p className="muted" style={{ marginTop: 12 }}>本页为原始作答明细，供伴学师咨询解读与家长存档，可随报告一并打印。</p>
        {s4d ? SUBJECT4D_SUBJECTS.map((name) => {
          const ans = (data.subject4d?.answers as Record<string, number[]> | null)?.[name] ?? [];
          return (
            <div key={name} style={{ marginTop: 14 }}>
              <div className="ribbon alt">{name}</div>
              <div className="tw">
              <table style={{ marginTop: 8 }}>
                <thead><tr><th style={{ width: 40 }}>题</th><th style={{ textAlign: "left" }}>题目</th><th style={{ width: 100 }}>作答</th></tr></thead>
                <tbody>
                  {SUBJECT4D_BANK[name].map((item, i) => (<tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ textAlign: "left", paddingLeft: 14, fontSize: 12 }}>{item.text}</td>
                    <td>{SUBJECT4D_OPTIONS[ans[i] ?? 2] ?? "—"}</td>
                  </tr>))}
                </tbody>
              </table>
              </div>
            </div>
          );
        }) : <p className="muted" style={{ marginTop: 12 }}>完成学科四维测评后，这里展示 108 题逐题作答。</p>}
      </Page>

      {/* 免责 */}
      <Page no={22} tall={false}>
        <div className="part-tag">声明</div>
        <h2>免责声明</h2>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {["本报告基于测评者当时的状态作答生成，测评结果反映的是现阶段的特点与倾向，并非对个人能力高下的评判。",
            "报告中的专业、职业与院校推荐仅供升学规划参考，不构成任何报考或从业的决定性建议，请结合学业成绩、家庭意愿与当年招生政策综合决策。",
            "测评结果涉及个人信息，仅由学员本人及授权的教师、家长查看，请勿外传。"].map((t, i) => (
            <div key={i} className="card" style={{ display: "flex", gap: 16 }}>
              <span className="n" style={{ width: 30, height: 30, borderRadius: "50%", background: C.brand, color: "#fff", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{i + 1}</span>
              <p style={{ fontSize: 13, lineHeight: 2 }}>{t}</p>
            </div>
          ))}
        </div>
      </Page>
    </div>
  );
}

/* ---------- 打印样式（与 mockup 一致的书页感） ---------- */
const ZH_CSS = `
.zh-root { background: ${C.bg}; padding: 8px 0 40px; }
.zh-page { background: ${C.paper}; margin: 24px auto; padding: 52px 56px 72px; position: relative; box-shadow: 0 2px 14px rgba(11,61,46,.08); border-radius: 4px; max-width: 940px; display: flex; flex-direction: column; }
.zh-page h1 { color: ${C.olive}; }
.zh-page h2 { font-size: 22px; color: ${C.olive}; }
.pfoot { position: absolute; bottom: 22px; left: 56px; right: 56px; display: flex; justify-content: space-between; font-size: 10px; letter-spacing: 3px; color: ${C.oliveMute}; }
.pdot { width: 7px; height: 7px; border-radius: 50%; background: ${C.brand}; display: inline-block; margin-right: 6px; }
.klabel { font-size: 12px; letter-spacing: 3px; color: ${C.oliveMute}; }
.card { background: ${C.cream}; border: 1px solid ${C.line}; border-radius: 12px; padding: 22px 26px; }
.muted { color: ${C.oliveSoft}; font-size: 13px; line-height: 2; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.divider { height: 1px; background: ${C.line}; margin: 24px 0; }
.part-tag { display: inline-flex; align-items: center; gap: 10px; color: ${C.brandDeep}; font-size: 13px; letter-spacing: 4px; font-weight: 600; margin-bottom: 14px; }
.part-tag::before { content: ""; width: 26px; height: 2px; background: ${C.brand}; }
.sec-title { display: flex; align-items: center; gap: 12px; margin: 32px 0 16px; }
.sec-title .n { width: 30px; height: 30px; border-radius: 50%; background: ${C.brand}; color: #fff; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: none; }
.sec-title h3 { font-size: 17px; color: ${C.olive}; }
.sec-title .sub { font-size: 12px; color: ${C.oliveMute}; margin-left: auto; }
.tag { display: inline-block; padding: 3px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; }
.t-hi { background: ${C.brandPale}; color: ${C.brandDeep}; }
.pairrow { display: grid; grid-template-columns: 1fr 30px 1fr; align-items: center; margin-bottom: 10px; }
.pairrow .a { background: #fff; border: 1px solid ${C.line}; border-radius: 8px; padding: 9px 14px; font-size: 13px; text-align: center; font-weight: 600; }
.pairrow .b { background: ${C.limePale}; border: 1px solid #CDEBDD; border-radius: 8px; padding: 9px 14px; font-size: 13px; text-align: center; color: ${C.brandDeep}; font-weight: 600; }
.pairrow .arrow { text-align: center; color: ${C.oliveMute}; font-size: 14px; }
.colhead { display: grid; grid-template-columns: 1fr 30px 1fr; text-align: center; font-size: 12px; color: ${C.brandDeep}; font-weight: 700; margin-bottom: 12px; }
.major-head { display: flex; align-items: center; gap: 14px; margin: 6px 0 18px; }
.major-head .tab { background: ${C.brand}; color: #fff; font-size: 15px; font-weight: 700; padding: 8px 20px; border-radius: 10px 10px 10px 0; }
.major-head .idx { background: ${C.brandPale}; color: ${C.brandDeep}; font-size: 18px; font-weight: 700; padding: 8px 22px; border-radius: 0 10px 10px 0; }
.ribbon { display: inline-block; background: ${C.brand}; color: #fff; font-size: 14px; font-weight: 700; padding: 6px 22px 6px 14px; border-radius: 0 99px 99px 0; }
.ribbon.alt { background: ${C.olive}; }
table { border-collapse: collapse; width: 100%; }
th { background: ${C.brandPale}; color: ${C.brandDeep}; font-size: 13px; padding: 10px 8px; border: 1px solid #CDEBDD; }
td { font-size: 13px; padding: 9px 8px; border: 1px solid #E8F1EC; text-align: center; }
/* ---------- 移动端阅读优化（≤768px）：满屏书页、栅格堆叠、表格横滑、整体放大 ---------- */
@media (max-width: 768px) {
  .zh-root { background: #fff; padding: 0 0 24px; }
  .zh-page { margin: 0 auto 14px; padding: 26px 16px 36px; max-width: 100%; min-height: auto !important; border-radius: 0; box-shadow: none; border-bottom: 1px solid ${C.line}; zoom: 1.12; }
  .zh-page svg { max-width: 100%; height: auto; }
  .pfoot { position: static; margin-top: 26px; padding-top: 10px; border-top: 1px dashed ${C.line}; }
  .zh-page h2 { font-size: 19px; }
  .card { padding: 16px 18px; }
  .muted { font-size: 14px; line-height: 1.95; }
  .grid2 { grid-template-columns: 1fr; }
  .menlei-grid { grid-template-columns: 1fr !important; }
  .flexrow { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
  .side-col, .cover-card { width: auto !important; max-width: 100%; }
  .sec-title { flex-wrap: wrap; margin: 24px 0 14px; gap: 8px; }
  .sec-title .sub { margin-left: 0; width: 100%; }
  .tw { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .tw table { min-width: 460px; }
  th { font-size: 12px; padding: 9px 6px; }
  td { font-size: 12.5px; padding: 9px 6px; }
  .pairrow { grid-template-columns: 1fr 20px 1fr; gap: 4px; }
  .pairrow .a, .pairrow .b { padding: 8px 8px; font-size: 12.5px; }
  .major-head { flex-wrap: wrap; gap: 8px; }
  .major-head .tab { font-size: 13px; padding: 6px 14px; }
  .major-head .idx { font-size: 14px; padding: 6px 14px; }
  .part-tag { letter-spacing: 2px; }
  .klabel { letter-spacing: 2px; }
}
@media print {
  .no-print { display: none !important; }
  .zh-root { background: #fff; padding: 0; }
  /* 每页至少撑满一张 A4 可印区域，页与页零留白；内容超出自动跨页不裁剪 */
  .zh-page { box-shadow: none; margin: 0; border-radius: 0; page-break-after: always; max-width: none; min-height: 262mm !important; height: auto; padding: 14px 22px 40px; }
  .zh-page:last-child { page-break-after: auto; }
  .pfoot { bottom: 8px; left: 22px; right: 22px; }
  .zh-page .card { padding: 9px 14px; }
  .sec-title { margin: 12px 0 8px; }
  .zh-page h2 { font-size: 20px; }
  .zh-page p { margin: 2px 0; line-height: 1.85; }
  .muted { line-height: 1.8; }
  .divider { margin: 12px 0; }
  th { padding: 7px 6px; }
  td { padding: 6px; }
  .zh-page svg { max-height: 250px; }
  .part-tag { margin-bottom: 8px; }
}
`;

/* ---------- 独立页面（/zhihui-report）：带打印根 id 与页头 ---------- */
export default function ZhihuiReport() {
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get("studentId") ? Number(searchParams.get("studentId")) : undefined;
  return <ZhihuiReportBody studentId={studentId} printId="report-print-root" />;
}
