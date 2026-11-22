import { useMemo } from "react";
import { Flag } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { isE3V37Result } from "@contracts/e3v37";
import type { CoachingDetail } from "./coachingTypes";

const LEVEL_TO_RAG: Record<string, "red" | "yellow" | "green"> = { 卡点: "red", 待提升: "yellow", 正常: "green" };
const DIM_STYLE = {
  red: { bg: "#F9E4E1", fg: "#A82524", label: "问题明显" },
  yellow: { bg: "#FAF0CC", fg: "#8A6500", label: "有待关注" },
  green: { bg: "#E9F3E6", fg: "#2F7A41", label: "健康" },
} as const;

/** 冰山模型面板：冰山上=成绩面（家长感知）；冰山下=E3 测评按 境(环境)/心(动力)/脑(能力)/行(执行) 四维。 */
export function IcebergPanel({ studentUserId }: { studentUserId: number }) {
  const { data: studentDetail } = trpc.coach.studentDetail.useQuery({ userId: studentUserId });
  const dims = useMemo(() => {
    const e3 = isE3V37Result(studentDetail?.assessments.e3) ? studentDetail.assessments.e3 : null;
    if (!e3) return null;
    const dimOf = (system: string): "心" | "脑" | "行" | null =>
      system === "乐学" ? "心" : system === "会学" ? "脑" : system === "善学" ? "行" : null;
    const groups: Record<"境" | "心" | "脑" | "行", { label: string; score: number; rag: "red" | "yellow" | "green" }[]> = { 境: [], 心: [], 脑: [], 行: [] };
    for (const cell of e3.systems.condition.cells) groups.境.push({ label: cell.label, score: cell.score, rag: LEVEL_TO_RAG[cell.level] ?? "green" });
    for (const ability of e3.abilities) {
      const dim = dimOf(ability.system);
      if (dim) groups[dim].push({ label: ability.label, score: ability.score, rag: LEVEL_TO_RAG[ability.level] ?? "green" });
    }
    const order: ("red" | "yellow" | "green")[] = ["red", "yellow", "green"];
    return (Object.keys(groups) as ("境" | "心" | "脑" | "行")[]).map((key) => {
      const rows = groups[key];
      const worst = rows.length ? order.find((rag) => rows.some((row) => row.rag === rag)) ?? "green" : "green";
      const avg = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : null;
      const weak = rows.filter((row) => row.rag !== "green").map((row) => `${row.label}${row.score.toFixed(1)}`);
      return { key, worst, avg, weak, count: rows.length };
    });
  }, [studentDetail]);
  if (!dims) return null;
  return <div className="space-y-1.5" aria-label="学习冰山模型">
    <div className="rounded-lg bg-[#EEF1FA] p-2">
      <div className="flex justify-between text-[10.5px]"><b style={{ color: "#5265A7" }}>冰山上 · 成绩面</b><span className="text-olive-mute">补课只解决这一层</span></div>
    </div>
    <div className="rounded-lg bg-cream/60 p-2">
      <div className="flex justify-between text-[10.5px]"><b>冰山下 · 学习状态（E3 测评）</b><span className="text-olive-mute">需专业测评识别</span></div>
      <div className="mt-1.5 grid grid-cols-4 gap-1 text-center">
        {dims.map((dim) => { const style = DIM_STYLE[dim.worst]; return <div key={dim.key} className="rounded p-1.5" style={{ background: style.bg }}>
          <b className="block text-[12px]" style={{ color: style.fg }}>{dim.key}</b>
          <span className="block truncate text-[9px]" style={{ color: style.fg }}>{dim.count ? (dim.weak.length ? dim.weak.join("、") : `${dim.avg?.toFixed(1)} · ${style.label}`) : "待测评"}</span>
        </div>; })}
      </div>
    </div>
  </div>;
}

const STAGES = [
  { key: "自省", desc: "为自己而学", course: "规划课", courseKeys: ["planning"], done: (n: number) => n >= 1 },
  { key: "自觉", desc: "觉察与反思", course: "心法课", courseKeys: ["mindset"], done: (n: number) => n >= 4 },
  { key: "自律", desc: "他律→习惯", course: "督学课", courseKeys: ["supervision"], done: (n: number) => n >= 4 },
  { key: "自主", desc: "掌握方法", course: "技法课", courseKeys: ["method"], done: (n: number) => n >= 1 },
  { key: "自立", desc: "尊重与空间", course: "亲子美言课", courseKeys: ["parent"], done: (n: number) => n >= 1 },
] as const;
const TARGET_NOTE: Record<string, string> = { 规划课: "启动 1 次", 心法课: "标准 4–8 周", 督学课: "常态", 技法课: "心法稳定后上线", 亲子美言课: "1 个月周期" };

/** 成长路径：自省→自觉→自律→自主→自立→自由；每阶段对应一门课，状态由执行记录自动推导。 */
export function GrowthPathBar({ data }: { data: CoachingDetail }) {
  const counts = useMemo(() => {
    const doneSessions = data.sessions.filter((session) => session.status === "completed" || session.status === "done");
    const map: Record<string, number> = { planning: 0, mindset: 0, method: 0, parent: 0, supervision: 0 };
    for (const session of doneSessions) for (const unit of session.units) if (map[unit.courseKey] != null) map[unit.courseKey] += 1;
    map.supervision = data.supervisions.length;
    return map;
  }, [data]);
  let currentFound = false;
  return <section className="rounded-2xl border border-border bg-white p-4 shadow-sm" aria-label="成长路径">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-olive"><Flag size={15} className="text-[#0C7064]" />成长路径</h3>
      <span className="text-[10.5px] text-olive-mute">培养目标：独立思考 · 承担责任 · 解决问题的「自由人」</span>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px] sm:grid-cols-6">
      {STAGES.map((stage) => {
        const n = stage.courseKeys.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
        const done = stage.done(n);
        const active = !done && n > 0;
        const isCurrent = !done && !currentFound && (active || !STAGES.some((s, i) => { const idx = STAGES.indexOf(stage); return i < idx && !s.done(s.courseKeys.reduce((sum, key) => sum + (counts[key] ?? 0), 0)); }));
        if (isCurrent) currentFound = true;
        const style = done ? { background: "#E9F3E6", border: "1px solid #52A965" } : isCurrent ? { background: "var(--mintpale, #E5EFE8)", border: "2px solid #0C7064" } : { background: "#F6F3E8" };
        return <div key={stage.key} className="rounded-xl p-2.5" style={style}>
          <b className={`block text-[13px] ${done ? "" : isCurrent ? "text-[#0C7064]" : "text-olive-soft"}`} style={done ? { color: "#2F7A41" } : {}}>{done ? "✓ " : isCurrent ? "▶ " : ""}{stage.key}</b>
          <span className="text-olive-mute">{stage.desc}</span>
          <div className="mt-1 text-[9.5px] text-olive-soft">{stage.course} · {done ? "已完成" : n > 0 ? `${n} 次` : TARGET_NOTE[stage.course]}</div>
        </div>;
      })}
      <div className="rounded-xl border-2 border-dashed border-border p-2.5">
        <b className="block text-[13px] text-olive-mute">自由</b>
        <span className="text-olive-mute">陪跑终点</span>
        <div className="mt-1 text-[9.5px] text-olive-mute">长期目标</div>
      </div>
    </div>
    <p className="mt-2 text-[10.5px] text-olive-mute">服务节奏：心法不通、技法无用 —— 先关系后学习；状态到位再上线技法课，以月为单位动态调整。</p>
  </section>;
}
