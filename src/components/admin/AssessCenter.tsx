/**
 * v223 测评中心（校园版管理端）：测评组合/单项测评目录 + 报告效果图与功能介绍 + 组选批量推送。
 * 参考行业标杆「评估工具库 + 组合框」交互：左侧目录选测评 → 右侧勾选学生 → 一键推送，
 * 推送走 v82 已验证的 releasedAssessments 解锁机制，学生客户端立即可见可测。
 */
import { useMemo, useState } from "react";
import { Layers, Plus, Check, X, Search, Send, Clock, Users as UsersIcon, FileText, ChevronDown, ChevronUp, ChevronRight, History } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { G, Card, SecTitle, Pill } from "./SchoolConsole";

/* ---------------------------------- 测评目录（静态物料） ---------------------------------- */

type CatalogItem = {
  key: string;
  combo: boolean;
  name: string;
  kinds: string[];
  tags: string[];
  purpose: string;
  crowd: string;
  minutes: number;
  /** v224：两张效果图可切换——[0]=报告封面页，[1]=报告图表内页 */
  imgs: [string, string];
  why: string[];
  gain: string[];
  theory: string;
};

const KIND_LABEL: Record<string, string> = {
  subject4d: "学科四维测评（九科）",
  holland: "霍兰德职业兴趣",
  e3: "学习力诊断 E3",
  multi5: "多元智能五项",
  mental: "心理健康筛查",
  e3parent: "家长卷 · 家庭支持",
  discparent: "家长 DISC（家庭版）",
  mbti: "MBTI 性格快测",
  disc: "DISC 行为风格（学生版）",
  subject: "学科能力测评",
  anchor: "职业锚测评",
};

const CATALOG: CatalogItem[] = [
  {
    key: "xuanke", combo: true, name: "选科及升学规划组合",
    kinds: ["subject4d", "holland"],
    tags: ["选科", "升学规划", "粤华必测"],
    purpose: "学科四维 × 霍兰德 × 月考成绩交叉印证，输出三大选科推荐与升学规划报告",
    crowd: "高一", minutes: 40, imgs: ["/assess/xuanke-cover.png", "/assess/xuanke.png"],
    why: ["3+1+2 新高考下，选科决定三年后专业选择的范围，错不起", "凭感觉选科的学生，进高三才发现目标专业限科不符", "兴趣与成绩往往打架，需要一套把两者都算进去的推荐逻辑"],
    gain: ["粤华五大组合内的第一/第二/第三推荐", "选科及升学规划报告（可打印、可另存 PDF）", "弱势学科提升建议；英语低于 80 分提示日语或补英语路径"],
    theory: "基于学科四维测评（兴趣、能力倾向、观念、效能感）与霍兰德职业兴趣量表（RIASEC），结合月考成绩加权（权重 0–60% 机构可调），按广东 3+1+2 规则在物理/历史两大方向内生成组合推荐。",
  },
  {
    key: "xueli", combo: true, name: "学习力提升组合",
    kinds: ["e3", "multi5"],
    tags: ["学习方法", "潜能发现", "提分"],
    purpose: "E3 学业诊断定位方法与习惯短板，多元智能发现优势领域，配套提分策略",
    crowd: "初一至高三", minutes: 35, imgs: ["/assess/e3-cover.png", "/assess/e3.png"],
    why: ["补课不见效，多半是学习方法与动力出了问题，而不是题目刷得不够", "每个学生都有自己的优势智能，用错发力点事倍功半"],
    gain: ["学习力诊断报告（冰山模型 · 三阶九能版）", "学习方法、动力、习惯短板定位与提升建议", "多元智能五项分布，扬长教育的依据"],
    theory: "E3 学业诊断从方法、动力、习惯三个维度 9 项能力建模；多元智能理论（加德纳）从语言、逻辑、空间、运动、音乐、人际、自省、自然观察等维度刻画优势智能。",
  },
  {
    key: "jiating", combo: true, name: "亲子沟通组合",
    kinds: ["e3parent", "discparent"],
    tags: ["家校沟通", "亲子对照"],
    purpose: "家长与孩子分别作答，系统生成认知差异对照与沟通建议报告",
    crowd: "家长 + 学生", minutes: 20, imgs: ["/assess/parent-cover.png", "/assess/parent.png"],
    why: ["选科分歧、成绩波动背后，多半是家长与孩子的认知差异在起作用", "班主任约谈前，先看差异点在哪，沟通才有抓手"],
    gain: ["家长认知冲突报告（亲子对照与沟通建议）", "量化呈现家长与孩子在学习期待、沟通方式上的差异", "班主任/心理老师约谈参考"],
    theory: "家长卷（家庭支持 E3）与学生测评交叉比对，定位认知差距并生成沟通建议。",
  },
  {
    key: "subject4d", combo: false, name: "学科四维测评（九科）",
    kinds: ["subject4d"],
    tags: ["选科", "学法"],
    purpose: "逐科诊断兴趣、能力倾向、观念、效能感四维，是选科推荐的基石",
    crowd: "初一至高三", minutes: 30, imgs: ["/assess/subject-cover.png", "/assess/subject.png"],
    why: ["「我喜欢这门课」和「我学得会这门课」是两回事，四维分开量才看得清", "单科短板常被总成绩掩盖"],
    gain: ["九科四维画像与学科优势排序", "各科学习观念与效能感提示", "选科与学法指导的直接输入"],
    theory: "学科四维模型：兴趣（愿不愿学）、能力倾向（学不学得快）、观念（怎么看待这门学科）、效能感（信不信自己能学好）。",
  },
  {
    key: "holland", combo: false, name: "霍兰德职业兴趣测评",
    kinds: ["holland"],
    tags: ["职业兴趣", "专业方向"],
    purpose: "RIASEC 六型定位职业兴趣，匹配专业与职业方向",
    crowd: "初一至成人", minutes: 15, imgs: ["/assess/holland-cover.png", "/assess/holland.png"],
    why: ["没有方向感的努力最容易半途而废", "专业选择应先于院校选择"],
    gain: ["霍兰德三码与职业兴趣解析", "适配专业方向清单", "与学科四维组合生成选科推荐"],
    theory: "霍兰德职业兴趣理论（John Holland）：现实型 R、研究型 I、艺术型 A、社会型 S、企业型 E、常规型 C。",
  },
  {
    key: "e3", combo: false, name: "学习力诊断 E3",
    kinds: ["e3"],
    tags: ["学习方法", "提分"],
    purpose: "三阶九能冰山模型，定位学习方法、动力、习惯短板",
    crowd: "初一至高三", minutes: 20, imgs: ["/assess/e3-cover.png", "/assess/e3.png"],
    why: ["成绩 plateau 期，拼的不再是知识量而是学习系统", "同一个班同样的老师，差距在学习方法"],
    gain: ["冰山模型学习力报告（三阶九能版）", "短板定位与逐条提升建议", "科任老师分层辅导名单依据"],
    theory: "学习力三阶：基础阶（记忆、理解）、方法阶（归纳、迁移）、动力阶（目标、自律）；九能逐项评分。",
  },
  {
    key: "multi5", combo: false, name: "多元智能五项",
    kinds: ["multi5"],
    tags: ["潜能", "扬长"],
    purpose: "发现优势智能领域，为扬长教育与活动选择提供依据",
    crowd: "小学至高中", minutes: 15, imgs: ["/assess/multi5-cover.png", "/assess/multi5.png"],
    why: ["成绩单只量了一种智能，孩子的其它优势长期被忽视", "扬长比补短更能建立自信"],
    gain: ["五项智能分布雷达图", "优势领域与发展建议", "社团、竞赛、生涯活动选择参考"],
    theory: "多元智能理论（Howard Gardner）：语言、逻辑数学、空间、身体运动、人际等智能相对独立、各有优势。",
  },
  {
    key: "mental", combo: false, name: "心理健康筛查（四套量表）",
    kinds: ["mental"],
    tags: ["心理", "预警"],
    purpose: "情绪与行为风险筛查，异常自动进入预警中心分级推送",
    crowd: "全体学生", minutes: 10, imgs: ["/assess/mental-cover.png", "/assess/mental.png"],
    why: ["心理风险发现越早，干预成本越低", "学校需要合规的筛查工具与留痕机制"],
    gain: ["SDQ 五维筛查：情绪症状、品行、多动/注意缺陷、同伴交往、亲社会行为", "可按年龄选四套量表：学生版 A（SDQ）/ 学生版 B（PHQ-A+GAD-7）/ 通用版（PHQ-9+GAD-7）/ 深度评估（SCL-90）", "异常自动进预警中心，按班推送班主任；处置留痕，符合心理测评进校规范"],
    theory: "SDQ 长处与困难问卷（Goodman）从情绪症状、品行、多动/注意缺陷、同伴交往、亲社会行为五个维度筛查；配套 PHQ-A / GAD-7 / PHQ-9 / SCL-90 量表覆盖不同年龄段与深度需求。学年一次施测，仅用于风险识别。",
  },
  /* ------- v224 补全：原通用版全部测评 ------- */
  {
    key: "mbti", combo: false, name: "MBTI 性格快测",
    kinds: ["mbti"],
    tags: ["性格", "自我认知"],
    purpose: "28 道二选一迫选题，快速定位性格类型，帮学生理解自己的学习风格",
    crowd: "初一至成人", minutes: 10, imgs: ["/assess/mbti-cover.png", "/assess/mbti.png"],
    why: ["了解自己怎么想、怎么决策，是自主学习的第一步", "性格没有好坏，看见差异才能选对学习和沟通方式"],
    gain: ["MBTI 四字母类型与维度解析（E/I · S/N · T/F · J/P）", "学习风格与备考节奏建议", "与老师、家长沟通方式的参考"],
    theory: "MBTI（Myers-Briggs Type Indicator）基于荣格心理类型理论，从能量来源、信息获取、决策方式、生活态度四个维度划分 16 型人格。",
  },
  {
    key: "disc", combo: false, name: "DISC 行为风格（学生版）",
    kinds: ["disc"],
    tags: ["行为风格", "人际"],
    purpose: "24 组「最像我 / 最不像我」强迫选择，识别 D/I/S/C 行为特质",
    crowd: "初一至高三", minutes: 10, imgs: ["/assess/disc-cover.png", "/assess/disc.png"],
    why: ["同样的话对不同特质的孩子效果完全不同", "先懂孩子的行为风格，管理与激励才有的放矢"],
    gain: ["DISC 主导特质解析（支配 D / 影响 I / 稳健 S / 谨慎 C）", "师生沟通、家校配合的方式建议", "与家长版 DISC 自动做亲子冲突对照"],
    theory: "DISC 理论（William Marston）：人的行为风格可分支配 D、影响 I、稳健 S、谨慎 C 四类，强迫选择法（most/least）降低社会期许偏差。",
  },
  {
    key: "discparent", combo: false, name: "家长 DISC（家庭版）",
    kinds: ["discparent"],
    tags: ["家长", "亲子对照"],
    purpose: "家长测家庭环境下的行为风格，多位家长可各测一次，自动与孩子的校园 DISC 做冲突对照",
    crowd: "家长（多位可测）", minutes: 10, imgs: ["/assess/parent-cover.png", "/assess/parent.png"],
    why: ["亲子冲突很多时候是行为风格错位，而不是谁对谁错", "爸爸、妈妈、祖辈都可以各测一次，全家对照"],
    gain: ["家长本人 DISC 特质解析", "与孩子校园 DISC 的冲突对照分析", "家长认知冲突报告的输入之一"],
    theory: "与学生版 DISC 同题库、同计分（题干改写为家庭场景），保证亲子可比性。",
  },
  {
    key: "e3parent", combo: false, name: "家长卷 · 家庭支持",
    kinds: ["e3parent"],
    tags: ["家长", "家校沟通"],
    purpose: "家长对孩子的了解程度与家庭支持方式自评，生成认知差异提示",
    crowd: "家长", minutes: 8, imgs: ["/assess/parent-cover.png", "/assess/parent.png"],
    why: ["孩子眼中的自己，和家长眼中的孩子常常不是同一个人", "看见盲区，家校沟通才有共同语言"],
    gain: ["家长了解程度评级与观察差异（盲区）清单", "家庭支持方式建议", "家长认知冲突报告的输入之一"],
    theory: "家长卷与学生 E3 学业诊断交叉比对，量化家长认知与孩子自评的差异点。",
  },
  {
    key: "subject", combo: false, name: "学科能力测评",
    kinds: ["subject"],
    tags: ["学法", "过程诊断"],
    purpose: "9 科「听懂 / 记住 / 运用」学习环节自评，定位每科卡在哪一环",
    crowd: "初一至高三", minutes: 15, imgs: ["/assess/subject-cover.png", "/assess/subject.png"],
    why: ["「没考好」太笼统，听懂没、记住没、会用没，环节一拆原因就清楚", "建议每月一测，跟踪学习过程变化"],
    gain: ["每科三环节得分与薄弱环节定位", "进入综合学习力报告做问题分析", "科任老师过程性评价参考"],
    theory: "学习环节模型：课堂听懂（输入）→ 课后记住（保持）→ 考试运用（输出），逐环节自评定位断点。",
  },
  {
    key: "anchor", combo: false, name: "职业锚测评",
    kinds: ["anchor"],
    tags: ["职业价值观", "生涯"],
    purpose: "看看内心最看重什么——稳定、挑战、创造还是助人，锚定职业选择底层动力",
    crowd: "高中至成人", minutes: 12, imgs: ["/assess/anchor-cover.png", "/assess/anchor.png"],
    why: ["兴趣会变，价值观是职业选择里更稳定的锚", "选专业选职业，最终是在选自己想要的生活方式"],
    gain: ["职业锚类型画像（技术/管理/自主/安全/创业/服务/挑战/生活型）", "职业选择底层动力解析", "升学规划与专业选择的价值观校验"],
    theory: "职业锚理论（Edgar Schein）：职业价值观分技术职能型、管理型、自主独立型、安全稳定型、创业型、服务型、挑战型、生活型八类。",
  },
];

const TABS = [
  { key: "all", label: "全部" },
  { key: "combo", label: "组合测评" },
  { key: "single", label: "单项测评" },
] as const;

/* ---------------------------------- 双图切换（封面 / 报告内页） ---------------------------------- */

function ShotSwitch({ imgs, name }: { imgs: [string, string]; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img key={i} src={imgs[i]} alt={`${name}·${i === 0 ? "封面" : "报告页"}`} className="h-full w-full object-cover object-top" />
      {/* 页签标记 */}
      <span className="absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] text-white" style={{ background: "rgba(30,53,48,.72)" }}>
        {i === 0 ? "封面" : "报告页"}
      </span>
      {/* 切换箭头 */}
      <button
        onClick={(e) => { e.stopPropagation(); setI((v) => (v + 1) % 2); }}
        title="切换封面 / 报告页"
        className="absolute top-1/2 right-1 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-white opacity-80 transition-opacity hover:opacity-100"
        style={{ background: "rgba(30,53,48,.55)" }}
      >
        <ChevronRight size={12} />
      </button>
      {/* 圆点 */}
      <span className="absolute top-1 left-1 z-10 flex gap-1">
        {[0, 1].map((d) => (
          <i key={d} className="block h-1.5 w-1.5 rounded-full" style={{ background: d === i ? "#fff" : "rgba(255,255,255,.55)" }} />
        ))}
      </span>
    </div>
  );
}

/* ---------------------------------- 组件 ---------------------------------- */

export default function AssessCenter({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [detail, setDetail] = useState<CatalogItem | null>(null);
  const [picked, setPicked] = useState<string[]>([]); // catalog keys
  const [cls, setCls] = useState<string>("全部");
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [showTargets, setShowTargets] = useState(true);

  const utils = trpc.useUtils();
  const { data: targetsData, isLoading } = trpc.school.assessCenter.targets.useQuery();
  const { data: logsData } = trpc.school.assessCenter.logs.useQuery();
  const push = trpc.school.assessCenter.push.useMutation({
    onSuccess: (r) => {
      setDone(`已推送给 ${r.count} 名学生，所选测评已在学生端开放。`);
      setChecked(new Set());
      setNote("");
      void utils.school.assessCenter.targets.invalidate();
      void utils.school.assessCenter.logs.invalidate();
      setTimeout(() => setDone(null), 6000);
    },
    onError: (e) => setDone(`推送失败：${e.message}`),
  });

  /* v224：按超管配置的机构开放测评过滤目录（openKinds=null 表示全部开放） */
  const openKinds = targetsData?.openKinds ?? null;
  const items = useMemo(() => {
    const byTab = CATALOG.filter((c) => (tab === "all" ? true : tab === "combo" ? c.combo : !c.combo));
    if (!openKinds) return byTab;
    const set = new Set(openKinds);
    return byTab.filter((c) => c.kinds.every((k) => set.has(k)));
  }, [tab, openKinds]);
  /* 若已勾选的测评被超管关闭，同步从推送清单剔除 */
  const pickedValid = useMemo(() => {
    if (!openKinds) return picked;
    const set = new Set(openKinds);
    return picked.filter((k) => (CATALOG.find((c) => c.key === k)?.kinds ?? []).every((t) => set.has(t)));
  }, [picked, openKinds]);
  const pushKinds = useMemo(() => [...new Set(pickedValid.flatMap((k) => CATALOG.find((c) => c.key === k)?.kinds ?? []))], [pickedValid]);

  const targets = targetsData?.targets ?? [];
  const classes = useMemo(() => ["全部", ...[...new Set(targets.map((t) => t.className ?? "未分班"))].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }))], [targets]);
  const filtered = useMemo(() => targets.filter((t) => (cls === "全部" || (t.className ?? "未分班") === cls) && (!q || t.name.includes(q))), [targets, cls, q]);

  const togglePick = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  const toggleCheck = (id: number) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const pushLabel = (k: string) => KIND_LABEL[k] ?? k;

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      {/* 左：测评目录 */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <Pill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</Pill>
          ))}
          <span className="ml-auto text-[11.5px]" style={{ color: G.mute }}>勾选测评 → 右侧选择学生 → 一键推送，学生端立即可测</span>
        </div>

        {items.map((c) => {
          const pickedThis = pickedValid.includes(c.key);
          return (
            <Card key={c.key} style={{ padding: 0 }}>
              <div className="flex flex-col gap-3 p-4 sm:flex-row">
                {/* 效果图：封面 / 报告内页双图切换 */}
                <div className="relative shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: G.line, width: 176, height: 118 }}>
                  <ShotSwitch imgs={c.imgs} name={c.name} />
                  <button onClick={() => setDetail(c)} className="absolute inset-0 text-left" title="点击查看报告预览">
                    <span className="absolute right-1 bottom-1 rounded px-1.5 py-0.5 text-[10px] text-white" style={{ background: "rgba(30,53,48,.72)" }}>报告预览</span>
                  </button>
                </div>
                {/* 信息 */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-bold" style={{ color: G.ink }}>{c.name}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: c.combo ? G.brandSoft : "#F3F5F0", color: c.combo ? G.brand : G.mute }}>{c.combo ? "组合" : "单项"}</span>
                    {c.tags.map((t) => (
                      <span key={t} className="rounded-full border px-2 py-0.5 text-[10.5px]" style={{ borderColor: G.line, color: G.mute }}>{t}</span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: G.ink }}>测评用途：{c.purpose}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]" style={{ color: G.mute }}>
                    <span className="flex items-center gap-1"><UsersIcon size={12} />适用：{c.crowd}</span>
                    <span className="flex items-center gap-1"><Clock size={12} />约 {c.minutes} 分钟</span>
                    <span className="flex items-center gap-1"><FileText size={12} />{c.kinds.map(pushLabel).join(" + ")}</span>
                  </div>
                </div>
                {/* 操作 */}
                <div className="flex shrink-0 flex-col items-stretch gap-2 self-center sm:w-28">
                  <button onClick={() => setDetail(c)} className="rounded-lg border px-3 py-1.5 text-[12px] font-semibold" style={{ borderColor: G.line, color: G.ink }}>查看详情</button>
                  {canManage && (
                    <button
                      onClick={() => togglePick(c.key)}
                      className="flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white"
                      style={{ background: pickedThis ? G.warn : G.brand }}
                    >
                      {pickedThis ? <><Check size={13} />已加入</> : <><Plus size={13} />加入推送</>}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 右：推送栏 */}
      <aside className="w-full shrink-0 space-y-4 xl:w-80">
        <Card>
          <SecTitle title="推送清单" note={`${pushKinds.length} 项测评`} />
          {pushKinds.length === 0 ? (
            <p className="py-4 text-center text-[12px]" style={{ color: G.mute }}>
              <Layers size={26} className="mx-auto mb-2 opacity-40" />
              从左侧「加入推送」勾选测评
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {pushKinds.map((k) => (
                <span key={k} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px]" style={{ background: G.brandSoft, color: G.brand }}>
                  {pushLabel(k)}
                  <button onClick={() => setPicked((p) => p.filter((key) => !(CATALOG.find((c) => c.key === key)?.kinds ?? []).includes(k)))} title="移除"><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <button className="mb-2 flex w-full items-center justify-between" onClick={() => setShowTargets((v) => !v)}>
            <SecTitle title="选择学生" note={`已选 ${checked.size} 人`} />
            {showTargets ? <ChevronUp size={15} style={{ color: G.mute }} /> : <ChevronDown size={15} style={{ color: G.mute }} />}
          </button>
          {showTargets && (
            <>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {classes.map((c) => (
                  <Pill key={c} active={cls === c} onClick={() => setCls(c)}>{c}</Pill>
                ))}
              </div>
              <div className="mb-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: G.line }}>
                <Search size={13} style={{ color: G.mute }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索姓名" className="w-full bg-transparent text-[12.5px] outline-none" style={{ color: G.ink }} />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {isLoading && <p className="text-[12px]" style={{ color: G.mute }}>加载中…</p>}
                {filtered.map((t) => {
                  const on = checked.has(t.userId);
                  const allDone = pushKinds.length > 0 && pushKinds.every((k) => t.doneKinds.includes(k));
                  return (
                    <label key={t.userId} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]" style={{ background: on ? G.brandSoft : "transparent", color: G.ink }}>
                      <input type="checkbox" checked={on} onChange={() => toggleCheck(t.userId)} className="accent-[#0E7A5F]" />
                      <span className="min-w-0 flex-1 truncate">{t.name}<span className="ml-1.5 text-[11px]" style={{ color: G.mute }}>{t.className ?? "未分班"}</span></span>
                      {pushKinds.length > 0 && (
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: allDone ? "#E3F1EB" : "#FBF1EC", color: allDone ? G.brand : G.danger }}>
                          {allDone ? "已完成" : "待测"}
                        </span>
                      )}
                    </label>
                  );
                })}
                {!isLoading && !filtered.length && <p className="py-3 text-center text-[12px]" style={{ color: G.mute }}>没有匹配的学生</p>}
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setChecked(new Set(filtered.map((t) => t.userId)))} className="rounded-lg border px-2.5 py-1 text-[11.5px]" style={{ borderColor: G.line, color: G.ink }}>全选筛选结果</button>
                <button onClick={() => setChecked(new Set())} className="rounded-lg border px-2.5 py-1 text-[11.5px]" style={{ borderColor: G.line, color: G.mute }}>清空</button>
              </div>
            </>
          )}
        </Card>

        <Card>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可选，如：班会课后补测）" maxLength={200} className="mb-3 w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none" style={{ borderColor: G.line, color: G.ink }} />
          <button
            disabled={!canManage || pushKinds.length === 0 || checked.size === 0 || push.isPending}
            onClick={() => push.mutate({ userIds: [...checked], kinds: pushKinds, note })}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-white"
            style={{ background: G.brand, opacity: !canManage || pushKinds.length === 0 || checked.size === 0 || push.isPending ? 0.5 : 1 }}
          >
            <Send size={14} />
            {push.isPending ? "推送中…" : `推送测评（${pushKinds.length} 项 → ${checked.size} 人）`}
          </button>
          {done && <p className="mt-2 rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: G.brandSoft, color: G.brand }}>{done}</p>}
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: G.mute }}>推送后所选测评在该生客户端立即开放；已完成的测评不受影响。</p>
        </Card>

        {!!logsData?.logs.length && (
          <Card>
            <SecTitle title="推送记录" note="近 50 条" />
            <div className="space-y-2">
              {logsData.logs.slice(0, 8).map((l) => (
                <div key={l.id} className="rounded-lg border p-2.5 text-[11.5px]" style={{ borderColor: G.line }}>
                  <div className="flex items-center gap-1.5" style={{ color: G.ink }}>
                    <History size={11} style={{ color: G.mute }} />
                    <span className="font-semibold">{l.kinds.map(pushLabel).join("、")}</span>
                    <span className="ml-auto shrink-0" style={{ color: G.brand }}>{l.userCount} 人</span>
                  </div>
                  <div className="mt-1" style={{ color: G.mute }}>{new Date(l.createdAt).toLocaleString("zh-CN")}{l.note ? ` · ${l.note}` : ""}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </aside>

      {/* 详情弹窗 */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[17px] font-bold" style={{ color: G.ink }}>{detail.name}</h3>
                  <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: detail.combo ? G.brandSoft : "#F3F5F0", color: detail.combo ? G.brand : G.mute }}>{detail.combo ? "组合测评" : "单项测评"}</span>
                </div>
                <p className="mt-1 text-[12px]" style={{ color: G.mute }}>{detail.kinds.map(pushLabel).join(" + ")} · 约 {detail.minutes} 分钟 · 适用：{detail.crowd}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 hover:bg-black/5"><X size={17} style={{ color: G.mute }} /></button>
            </div>
            <div className="mb-5 overflow-hidden rounded-xl border" style={{ borderColor: G.line }}>
              <div className="relative" style={{ height: 340 }}>
                <ShotSwitch imgs={detail.imgs} name={detail.name} />
              </div>
              <p className="px-3 py-1.5 text-[11px]" style={{ color: G.mute, background: "#FAFBF8" }}>▲ 报告效果图 · 点图内箭头切换「封面 / 报告内页」（系统真实报告截取）</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4" style={{ borderColor: G.line }}>
                <h4 className="mb-2 text-[13.5px] font-bold" style={{ color: G.brand }}>为什么测</h4>
                <ul className="list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed" style={{ color: G.ink }}>
                  {detail.why.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: G.line }}>
                <h4 className="mb-2 text-[13.5px] font-bold" style={{ color: G.brand }}>你将获得</h4>
                <ul className="list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed" style={{ color: G.ink }}>
                  {detail.gain.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-4 rounded-xl border p-4" style={{ borderColor: G.line, background: "#FAFBF8" }}>
              <h4 className="mb-1.5 text-[13.5px] font-bold" style={{ color: G.brand }}>理论支撑</h4>
              <p className="text-[12.5px] leading-relaxed" style={{ color: G.ink }}>{detail.theory}</p>
            </div>
            {canManage && (
              <button
                onClick={() => { togglePick(detail.key); setDetail(null); }}
                className="mt-5 flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-[13px] font-semibold text-white"
                style={{ background: picked.includes(detail.key) ? G.warn : G.brand }}
              >
                {picked.includes(detail.key) ? "从推送清单移除" : "加入推送清单"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
