import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { coachingScenarioLabel } from "@contracts/orgService";
import { trpc } from "@/providers/trpc";
import { COACHING_SECTIONS, type CoachingSection } from "./coachingNavigation";
import type { CoachingCases } from "./coachingTypes";

export const V4_CARD = "rounded-2xl border border-[#E7E2D0] bg-white p-4 shadow-[0_1px_2px_rgba(69,80,58,.06)]";
export const V4_BUTTON = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[#E7E2D0] bg-white px-3.5 py-2 text-[12px] font-semibold text-olive outline-none transition-colors hover:bg-cream focus-visible:ring-2 focus-visible:ring-[#0C7064]/35 disabled:cursor-not-allowed disabled:opacity-40";
export const V4_PRIMARY = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] bg-[#0C7064] px-3.5 py-2 text-[12px] font-semibold text-white outline-none transition-colors hover:bg-[#095C53] focus-visible:ring-2 focus-visible:ring-[#0C7064]/35 disabled:cursor-not-allowed disabled:opacity-40";

export function CoachingPanel({ title, subtitle, action, children, className = "" }: {
  title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`${V4_CARD} ${className}`}>
    <header className="flex flex-wrap items-center gap-2">
      <h3 className="text-[14px] font-bold text-olive">{title}</h3>
      {subtitle && <div className="text-[10.5px] leading-relaxed text-olive-mute">{subtitle}</div>}
      {action && <div className="ml-auto">{action}</div>}
    </header>
    <div className="mt-3">{children}</div>
  </section>;
}

export function CoachingPageHeading({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <header className={`${V4_CARD} flex flex-wrap items-center gap-3`}>
    <div className="min-w-0 flex-1"><h2 className="text-[16px] font-bold text-olive">{title}</h2><p className="mt-0.5 text-[11px] leading-relaxed text-olive-mute">{description}</p></div>
    {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
  </header>;
}

export function CoachingNavigation({ tab, onChange }: { tab: CoachingSection; onChange: (section: CoachingSection) => void }) {
  return <nav aria-label="陪跑中心导航" className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-[#F6F3E8] p-1">
    {COACHING_SECTIONS.map((item) => <button type="button" key={item.key} aria-current={tab === item.key ? "page" : undefined} onClick={() => onChange(item.key)}
      className={`min-h-10 min-w-[72px] flex-1 cursor-pointer whitespace-nowrap rounded-[10px] border border-transparent px-3 py-2 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#0C7064]/35 ${tab === item.key ? "bg-[#E5EFE8] text-[#0C7064]" : "text-olive-soft hover:border-[#E7E2D0] hover:bg-white"}`}>{item.label}</button>)}
  </nav>;
}

export function CoachingStudentHeader({ row, cases, caseId, onCaseChange, tab, onTabChange }: {
  row: CoachingCases[number]; cases: CoachingCases; caseId: number; onCaseChange: (id: number) => void;
  tab: CoachingSection; onTabChange: (section: CoachingSection) => void;
}) {
  const { data: staff = [] } = trpc.coaching.staff.useQuery();
  const nameOf = (id: number) => staff.find((person) => person.id === id)?.name ?? `员工 #${id}`;
  const months = Math.max(1, Math.floor((Date.now() - Date.parse(`${row.coachingCase.serviceStart}T00:00:00`)) / (30.44 * 86400000)) + 1);
  return <header className={V4_CARD}>
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E5EFE8] text-[16px] font-bold text-[#0C7064]">{row.studentName?.slice(0, 1) || <UserRound size={20} />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-[17px] font-bold text-olive">{row.studentName}</h2><span className="text-[12px] text-olive-mute">{row.grade || "年级待补全"}</span>
          {row.serviceScenarios.map((key) => <span key={key} className="rounded-full bg-[#EEF1FA] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#5265A7]">{coachingScenarioLabel(key)}</span>)}
          <span className="rounded-full bg-[#E5EFE8] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0C7064]">第 {months} 个月 · {months <= 3 ? "一对一＋督学" : "月度评估服务形式"}</span>
        </div>
        <p className="mt-1 text-[11.5px] text-olive-mute">服务周期 {row.coachingCase.serviceStart} ～ {row.coachingCase.serviceEnd} ｜ 主教：{nameOf(row.coachingCase.coachId)} ｜ 督学：{nameOf(row.coachingCase.supervisorId)}</p>
      </div>
      <label className="w-full text-[10.5px] font-semibold text-olive-soft sm:w-[250px]">当前学员 · 所有页面联动
        <select aria-label="选择陪跑学员" value={caseId} onChange={(event) => onCaseChange(Number(event.target.value))} className="mt-1 min-h-10 w-full rounded-[10px] border border-[#E7E2D0] bg-white px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064] focus-visible:ring-2 focus-visible:ring-[#0C7064]/25">
          {cases.map((item) => <option key={item.coachingCase.id} value={item.coachingCase.id}>{item.studentName} · {item.grade || "年级待补全"}</option>)}
        </select>
      </label>
    </div>
    <CoachingNavigation tab={tab} onChange={onTabChange} />
  </header>;
}

export function CoachingRootNavigation({ cases, caseId, onCaseChange, tab, onTabChange }: {
  cases: CoachingCases; caseId: number; onCaseChange: (id: number) => void; tab: CoachingSection; onTabChange: (section: CoachingSection) => void;
}) {
  return <header className={V4_CARD}>
    <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><h2 className="text-[15px] font-bold text-olive">三好学伴 · 陪跑中心</h2><p className="mt-0.5 text-[10.5px] text-olive-mute">同一学员贯穿画像、规划、执行、成长与家校</p></div>
      <label className="w-full text-[10.5px] font-semibold text-olive-soft sm:w-[280px]">当前学员 · 所有页面联动
        <select aria-label="选择陪跑学员" value={caseId} disabled={!cases.length} onChange={(event) => onCaseChange(Number(event.target.value))} className="mt-1 min-h-10 w-full rounded-[10px] border border-[#E7E2D0] bg-white px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064] disabled:opacity-50">
          {!cases.length && <option value={0}>暂无陪跑主档</option>}{cases.map((item) => <option key={item.coachingCase.id} value={item.coachingCase.id}>{item.studentName} · {item.grade || "年级待补全"}</option>)}
        </select>
      </label>
    </div>
    <CoachingNavigation tab={tab} onChange={onTabChange} />
  </header>;
}
