import { useMemo } from "react";
import { CalendarDays, ClipboardCheck, Target, TrendingUp } from "lucide-react";
import GrowSnapshot from "./GrowSnapshot";
import { GrowthPathBar } from "./CoachingV2Panels";
import { parseGrowForm } from "./growPlan";
import type { CoachingDetail } from "./coachingTypes";

const SESSION_STATUS: Record<string, string> = { planned: "已排期", done: "已完成", cancelled: "已取消" };

function weekRange(offset = 0): { start: Date; end: Date } {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 周一为一周起点
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + offset * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59);
  return { start, end };
}
const fmtDay = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** 学员陪跑空间 · 总览：GROW 四象限 + 本周安排 + 衡量达成，一屏回答「这孩子现在什么情况」。 */
export default function CoachingOverview({ data, onEdit }: { data: CoachingDetail; onEdit: () => void }) {
  const growForm = parseGrowForm(data.coachingCase.growForm);
  const { weekSessions, weekTasks, nextContact } = useMemo(() => {
    const { start, end } = weekRange();
    const sessions = data.sessions
      .filter((session) => { const t = new Date(session.startAt); return t >= start && t <= end; })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    const tasks = data.tasks
      .filter((task) => task.status !== "verified" && task.dueDate >= start.toISOString().slice(0, 10) && task.dueDate <= end.toISOString().slice(0, 10))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const nextContact = data.planning.growProfiles[0]?.nextContactAt ? new Date(data.planning.growProfiles[0].nextContactAt).toLocaleString("zh-CN") : "";
    return { weekSessions: sessions, weekTasks: tasks, nextContact };
  }, [data]);

  const weeklyItems = growForm?.weekly.filter((w) => w.item.trim()) ?? [];
  const exams = growForm?.exams.filter((e) => e.name.trim()) ?? [];
  const { start, end } = weekRange();
  const verified = data.tasks.filter((task) => task.status === "verified").length;

  return <div className="space-y-4">
    <GrowSnapshot data={data} onEdit={onEdit} />
    <GrowthPathBar data={data} />
    <div className="grid items-start gap-4 2xl:grid-cols-2">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm" aria-label="本周安排">
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-olive"><CalendarDays size={16} className="text-[#0C7064]" />本周安排<span className="ml-1 text-[11px] font-normal text-olive-mute">{fmtDay(start)} – {fmtDay(end)}</span></h3>
        <div className="mt-3 space-y-2">
          {weekSessions.map((session) => { const t = new Date(session.startAt); return <div key={session.id} className="flex items-center gap-3 rounded-xl bg-cream/50 px-3 py-2.5">
            <span className="flex h-9 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-mint-pale text-[#0C7064]"><b className="text-[13px] leading-none">{fmtDay(t)}</b><span className="mt-0.5 text-[9px]">{WEEKDAYS[t.getDay()]}</span></span>
            <span className="min-w-0 flex-1"><b className="block truncate text-[12.5px] text-olive">{session.format || "到店服务"}</b><span className="text-[10.5px] text-olive-mute">{t.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span></span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${session.status === "done" ? "bg-mint-pale text-[#0C7064]" : session.status === "cancelled" ? "bg-gray-100 text-gray-500" : "bg-butter-pale text-[#9A7622]"}`}>{SESSION_STATUS[session.status] ?? session.status}</span>
          </div>; })}
          {!weekSessions.length && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11.5px] text-olive-mute">本周还没有排到店或课堂，去「执行」页签安排。</p>}
        </div>
        {weekTasks.length > 0 && <div className="mt-3 border-t border-border pt-3">
          <h4 className="text-[11.5px] font-semibold text-olive-soft">本周到期行动</h4>
          <div className="mt-1.5 space-y-1.5">{weekTasks.map((task) => <div key={task.id} className="flex items-center gap-2 text-[11.5px]"><span className="min-w-0 flex-1 truncate text-olive-soft">· {task.title}</span><span className="shrink-0 text-[10px] text-amber-800">截止 {task.dueDate.slice(5)}</span></div>)}</div>
        </div>}
        {nextContact && <p className="mt-3 rounded-lg bg-mint-pale/35 px-3 py-2 text-[11px] text-olive-soft">下次跟进：<b className="text-[#0C7064]">{nextContact}</b></p>}
      </section>

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm" aria-label="衡量达成">
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-olive"><TrendingUp size={16} className="text-[#0C7064]" />衡量达成<span className="ml-1 text-[11px] font-normal text-olive-mute">目标 vs 执行</span></h3>
        <div className="mt-3 flex items-end justify-between gap-3"><span className="text-[11.5px] text-olive-mute">行动任务验收</span><b className="text-[20px] text-[#0C7064]">{data.tasks.length ? `${Math.round(verified / data.tasks.length * 100)}%` : "—"}</b></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-deep/45"><div className="h-full rounded-full bg-[#0C9B82] transition-[width]" style={{ width: `${data.tasks.length ? Math.round(verified / data.tasks.length * 100) : 0}%` }} /></div>
        <div className="mt-4 space-y-1.5">
          <h4 className="flex items-center gap-1 text-[11.5px] font-semibold text-olive-soft"><ClipboardCheck size={13} />每周修正项</h4>
          {weeklyItems.length ? weeklyItems.slice(0, 6).map((w, index) => <div key={index} className="flex items-baseline gap-2 rounded-lg bg-cream/50 px-3 py-2"><span className="min-w-0 flex-1 text-[11.5px] text-olive-soft">· {w.item}</span>{w.metric && <span className="shrink-0 text-[11px] font-semibold text-[#0C7064]">{w.metric}</span>}</div>) : <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[11px] text-olive-mute">尚未设定每周修正项，去「规划」补充衡量标准。</p>}
        </div>
        {exams.length > 0 && <div className="mt-4 space-y-1.5">
          <h4 className="flex items-center gap-1 text-[11.5px] font-semibold text-olive-soft"><Target size={13} />大考成绩</h4>
          {exams.slice(0, 5).map((e, index) => <div key={index} className="flex items-baseline gap-2 rounded-lg bg-cream/50 px-3 py-2 text-[11.5px]"><span className="min-w-0 flex-1 text-olive-soft">{e.name}{e.date ? <span className="ml-1 text-[10px] text-olive-mute">{e.date}</span> : null}</span><b className="shrink-0 text-olive">{e.scores || "待记录"}</b></div>)}
        </div>}
      </section>
    </div>
  </div>;
}
