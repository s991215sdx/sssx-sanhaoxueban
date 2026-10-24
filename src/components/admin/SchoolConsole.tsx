/**
 * v220 学校版专版——校园管理控制台（粤华打样）。
 * 版式对齐学校版策划效果图：顶部墨绿品牌条 + 左侧分组导航 + 白卡片内容区。
 * 约定：粤华学校版不出现「伴学师」，统一称「指导老师」；聚合分布不点名，名单按职员权限下钻。
 */
import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router";
import {
  RefreshCw,
  Printer,
  BellRing,
  GraduationCap,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import StudentsTab from "./StudentsTab";
import TutorsTab from "./TutorsTab";
import SelectionStats from "./SelectionStats";
import AssessCenter from "./AssessCenter";
import InviteChannelsTab from "./InviteChannelsTab";
/* v232：Library 懒加载，避免被打进后台主 chunk */
const Library = lazy(() => import("@/pages/Library"));
import OrgFeaturesCard from "./OrgFeaturesCard";

/* ---------------------------------- 设计令牌（对齐效果图） ---------------------------------- */
export const G = {
  deep: "#0B5A4E", // 顶条墨绿
  brand: "#0E7A5F", // 主绿
  brandSoft: "#E3F1EB", // 浅绿底
  ink: "#1E3530", // 墨字
  mute: "#7A8A83", // 灰绿注释
  line: "#E4E9E4", // 分隔线
  track: "#EDF0EA", // 条形图轨道
  warn: "#C77F2A",
  danger: "#C0523C",
};

/* v232：菜单数据/类型已抽到 schoolNav.ts（Layout 首屏依赖此处，避免整个后台被打进入口 chunk） */
import { visibleSchoolGroups, type ItemKey, type SchoolItemKey } from "./schoolNav";
export { visibleSchoolGroups } from "./schoolNav";
export type { SchoolItemKey } from "./schoolNav";

const KIND_LABEL: Record<string, string> = {
  subject4d: "学科四维",
  holland: "霍兰德",
  e3: "学习力 E3",
  multi5: "多元智能",
  multi: "多元智能(旧)",
  mbti: "MBTI",
  disc: "DISC",
  anchor: "职业锚",
  mental: "心理筛查",
  mentalsdq: "心理 SDQ",
  mentalpa: "心理 PHQ-A",
  scl90: "心理 SCL-90",
  e3parent: "家长认知",
  discparent: "家长 DISC",
  subject: "学科能力(旧)",
};

const WARN_TYPE_LABEL: Record<string, string> = {
  mental_redline: "心理红线",
  academic_drop: "学业下滑",
  low_motivation: "动力不足",
};

/* ---------------------------------- 通用小件 ---------------------------------- */

export function SecTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="flex items-center gap-2 text-[14.5px] font-bold" style={{ color: G.ink }}>
        <i className="inline-block h-2 w-2 rounded-full" style={{ background: G.brand }} />
        {title}
      </h3>
      {note && <span className="text-[11.5px]" style={{ color: G.mute }}>{note}</span>}
    </div>
  );
}

function BigStat({ value, suffix, label }: { value: string | number; suffix?: string; label: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: G.line, background: "#fff" }}>
      <div className="text-[26px] font-bold leading-none" style={{ color: G.brand }}>
        {value}
        {suffix && <span className="ml-0.5 text-[14px] font-semibold">{suffix}</span>}
      </div>
      <div className="mt-1.5 text-[12px] leading-snug" style={{ color: G.mute }}>{label}</div>
    </div>
  );
}

export function RowBar({ label, n, total, color }: { label: string; n: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-right text-[12.5px]" style={{ color: G.ink }}>{label}</span>
      <div className="h-[14px] flex-1 overflow-hidden rounded" style={{ background: G.track }}>
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color ?? G.brand }} />
      </div>
      <span className="w-20 shrink-0 text-[12.5px] font-bold" style={{ color: G.ink }}>
        {n}
        <span className="ml-1 font-normal" style={{ color: G.mute }}>{pct}%</span>
      </span>
    </div>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: G.line, ...style }}>
      {children}
    </div>
  );
}

export function Pill({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors"
      style={
        active
          ? { borderColor: G.brand, background: G.brandSoft, color: G.brand }
          : { borderColor: G.line, background: "#fff", color: G.mute }
      }
    >
      {children}
    </button>
  );
}

/* ---------------------------------- 施测任务（未参测催办） ---------------------------------- */

function TasksSection({ canManage }: { canManage: boolean }) {
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const { data, isLoading } = trpc.school.unassessed.list.useQuery();
  const remind = trpc.school.unassessed.remind.useMutation({
    onSuccess: (r) => {
      setText(r.text);
      utils.school.unassessed.my.invalidate();
    },
  });
  const groups = data?.groups ?? [];
  const totalMissing = groups.reduce((s, g) => s + g.items.length, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat value={totalMissing} label="未完成必测项的学生" />
        <BigStat value={groups.length} label="涉及班级" />
        <BigStat value="2" label="必测项：学科四维 + 霍兰德" />
        <BigStat value="—" label="数据实时更新" />
      </div>
      <Card>
        <SecTitle
          title="待催测名单"
          note={canManage ? "点击「一键催办」生成系统提醒，文本可复制给班主任" : "按班级分组，可转发班主任跟进"}
        />
        {canManage && (
          <button
            onClick={() => remind.mutate()}
            disabled={remind.isPending || !totalMissing}
            className="mb-3 flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white"
            style={{ background: G.brand, opacity: remind.isPending || !totalMissing ? 0.5 : 1 }}
          >
            <BellRing size={14} />
            {remind.isPending ? "催办中…" : "一键催办（生成系统提醒）"}
          </button>
        )}
        {isLoading ? (
          <p className="text-[13px]" style={{ color: G.mute }}>加载中…</p>
        ) : !groups.length ? (
          <p className="rounded-lg px-3 py-2.5 text-[13px]" style={{ background: G.brandSoft, color: G.brand }}>
            全部学生均已完成必测项。
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.className} className="rounded-xl border p-3" style={{ borderColor: G.line }}>
                <div className="text-[13px] font-bold" style={{ color: G.ink }}>
                  {g.className}
                  <span className="ml-2 font-normal" style={{ color: G.mute }}>{g.items.length} 人缺测</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.items.map((it) => (
                    <span key={it.userId} className="rounded-full px-2.5 py-1 text-[11.5px]" style={{ background: "#F3F5F0", color: G.ink }}>
                      {it.name} · 缺{it.missing.join("、")}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {text && (
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold" style={{ color: G.ink }}>可复制给班主任的催办文本</h3>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(text);
              }}
              className="rounded-lg border px-2.5 py-1 text-[11.5px]"
              style={{ borderColor: G.line, color: G.ink }}
            >
              复制
            </button>
          </div>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg p-3 text-[12.5px] leading-relaxed" style={{ background: "#F6F7F3", color: G.ink }}>{text}</pre>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------- 进度看板（参测统计） ---------------------------------- */

function ProgressSection() {
  const { data, isLoading } = trpc.school.stats.assessment.useQuery();
  if (isLoading || !data) return <p className="text-[13px]" style={{ color: G.mute }}>加载中…</p>;
  const missing = data.kinds.length ? Math.max(0, data.total - Math.min(...data.kinds.filter((k) => k.kind === "subject4d" || k.kind === "holland").map((k) => k.done))) : 0;
  void missing;
  const required = data.kinds.filter((k) => k.kind === "subject4d" || k.kind === "holland");
  const bothDone = required.length ? Math.min(...required.map((k) => k.done)) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat value={data.total} suffix="人" label="校园学生总数" />
        <BigStat value={bothDone} suffix="人" label="已完成全部必测项" />
        <BigStat value={data.total ? Math.round((bothDone / data.total) * 100) : 0} suffix="%" label="必测完成率" />
        <BigStat value={data.byClass.length} suffix="个班" label="覆盖班级" />
      </div>
      <Card>
        <SecTitle title="重点测评完成情况" note="条形 = 完成人数 / 校园生总数" />
        <div className="space-y-2.5">
          {data.kinds.map((k) => (
            <RowBar key={k.kind} label={k.label} n={k.done} total={data.total} />
          ))}
        </div>
      </Card>
      <Card>
        <SecTitle title="班级完成率排行" note="按必测完成人数排序" />
        <div className="space-y-2.5">
          {[...data.byClass]
            .sort((a, b) => b.done4d / b.total - a.done4d / a.total)
            .map((c) => (
              <RowBar key={c.className} label={c.className} n={c.done4d} total={c.total} color={c.done4d / c.total >= 0.9 ? G.brand : c.done4d / c.total >= 0.6 ? "#5FA983" : G.warn} />
            ))}
          {!data.byClass.length && <p className="text-[12.5px]" style={{ color: G.mute }}>暂无校园学生</p>}
        </div>
        <p className="mt-3 text-[11.5px]" style={{ color: G.mute }}>黄色 = 完成率偏低，建议重点跟进（名单见「施测任务」）。</p>
      </Card>
      <Card>
        <SecTitle title="班级明细" note="学科四维 / 霍兰德完成数" />
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left" style={{ color: G.mute }}>
              <th className="py-2 pr-3 font-medium">班级</th>
              <th className="py-2 pr-3 text-right font-medium">人数</th>
              <th className="py-2 pr-3 text-right font-medium">四维完成</th>
              <th className="py-2 text-right font-medium">霍兰德完成</th>
            </tr>
          </thead>
          <tbody>
            {data.byClass.map((c) => (
              <tr key={c.className} className="border-t" style={{ borderColor: G.line }}>
                <td className="py-2 pr-3" style={{ color: G.ink }}>{c.className}</td>
                <td className="py-2 pr-3 text-right" style={{ color: G.ink }}>{c.total}</td>
                <td className="py-2 pr-3 text-right" style={{ color: G.ink }}>{c.done4d}/{c.total}</td>
                <td className="py-2 text-right" style={{ color: G.ink }}>{c.doneHolland}/{c.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------------------------- 选科意向分析（采纳率） ---------------------------------- */

function IntentionSection({ canManage }: { canManage: boolean }) {
  const utils = trpc.useUtils();
  const [roundSel, setRoundSel] = useState<number>(1);
  const { data: rounds } = trpc.school.intentions.rounds.useQuery();
  const { data: adoption, isLoading } = trpc.school.intentions.adoption.useQuery({ roundNo: roundSel });
  const roundsSet = trpc.school.intentions.roundsSet.useMutation({
    onSuccess: () => {
      utils.school.intentions.rounds.invalidate();
      utils.school.intentions.adoption.invalidate();
    },
  });
  const decided = adoption?.decided ?? 0;
  const hitRate = adoption?.pct?.hitRate ?? null;
  /* v221：成绩权重随机构设置动态显示（默认校园 35） */
  const { data: xw } = trpc.school.xuankeWeight.get.useQuery();
  const scorePct = xw?.scoreWeight ?? 35;
  const potPct = 100 - scorePct;
  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <SecTitle title="意向轮次管理" note="同一时间只开放一轮；学生/家长只对开放轮可提交" />
          <div className="flex flex-wrap gap-2">
            {(rounds ?? []).map((r) => (
              <div
                key={r.roundNo}
                className="flex items-center gap-2 rounded-xl border px-3 py-2"
                style={{ borderColor: r.status === "open" ? G.brand : G.line, background: r.status === "open" ? G.brandSoft : "#fff" }}
              >
                <span className="text-[12.5px] font-bold" style={{ color: G.ink }}>第{r.roundNo}轮（{r.count}人）</span>
                <span className="text-[11px]" style={{ color: r.status === "open" ? G.brand : G.mute }}>{r.status === "open" ? "开放中" : "已截止"}</span>
                <button
                  onClick={() => roundsSet.mutate({ roundNo: r.roundNo, open: r.status !== "open" })}
                  disabled={roundsSet.isPending}
                  className="rounded-full border px-2 py-0.5 text-[11px]"
                  style={{ borderColor: G.line, color: G.ink }}
                >
                  {r.status === "open" ? "截止" : "开放"}
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const next = ((rounds ?? []).length || 0) + 1;
                roundsSet.mutate({ roundNo: next, open: true, label: `第${next}轮意向` });
              }}
              disabled={roundsSet.isPending}
              className="rounded-xl border border-dashed px-3 py-2 text-[12px]"
              style={{ borderColor: G.line, color: G.mute }}
            >
              + 开新一轮
            </button>
          </div>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {(rounds ?? []).map((r) => (
          <Pill key={r.roundNo} active={roundSel === r.roundNo} onClick={() => setRoundSel(r.roundNo)}>
            第{r.roundNo}轮{r.status === "open" ? "·开放中" : ""}
          </Pill>
        ))}
        {!rounds?.length && <Pill active>第1轮</Pill>}
      </div>
      {isLoading || !adoption ? (
        <p className="text-[13px]" style={{ color: G.mute }}>加载中…</p>
      ) : adoption.total === 0 ? (
        <Card><p className="text-[13px]" style={{ color: G.mute }}>暂无校园学生数据。</p></Card>
      ) : (
        <>
          {/* 自动生成结论横幅 */}
          <div className="rounded-xl p-4 text-white" style={{ background: G.deep }}>
            <div className="text-[11px] opacity-80">总结论（自动生成，可复制进校务汇报）</div>
            <div className="mt-1 text-[15.5px] font-bold leading-relaxed">
              {decided === 0
                ? `本轮已确认 0 / ${adoption.total} 人——可结合「施测任务」催办后再看采纳率。`
                : `本轮 ${decided} 人完成意向确认：系统推荐采纳率 ${hitRate}%，其中第一推荐采纳 ${adoption.pct?.rec1 ?? 0}%；自定义选科 ${adoption.buckets.custom} 人（理由回收率 ${adoption.buckets.custom ? 100 : 0}%）。`}
            </div>
            <div className="mt-1 text-[11px] opacity-75">
              口径：最终确认以学校开放轮为准；推荐为学科潜力 {potPct}% + 月考成绩 {scorePct}% 加权 TOP3。
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <SecTitle title="采纳率分布" note={`已确认 ${decided}/${adoption.total} 人`} />
              <div className="space-y-2.5">
                <RowBar label="第一推荐采纳" n={adoption.buckets.rec1} total={decided || 1} />
                <RowBar label="第二推荐采纳" n={adoption.buckets.rec2} total={decided || 1} />
                <RowBar label="第三推荐采纳" n={adoption.buckets.rec3} total={decided || 1} />
                <RowBar label="自定义选科" n={adoption.buckets.custom} total={decided || 1} color="#D9A13B" />
                <RowBar label="未确认" n={adoption.buckets.unset} total={adoption.total} color="#B9C4BC" />
              </div>
              {adoption.pct && (
                <p className="mt-3 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: G.brandSoft, color: G.brand }}>
                  系统推荐采纳率（前三推荐合计 / 已确认人数）：<b>{adoption.pct.hitRate}%</b>
                </p>
              )}
            </Card>
            <Card>
              <SecTitle title="自定义选科 · 班级分布" note={`${adoption.customList.length} 人`} />
              {(() => {
                const byClass = new Map<string, number>();
                for (const c of adoption.customList) {
                  const cn = c.className || "未分班";
                  byClass.set(cn, (byClass.get(cn) ?? 0) + 1);
                }
                const max = Math.max(1, ...byClass.values());
                const rows = [...byClass.entries()].sort((a, b) => b[1] - a[1]);
                if (!rows.length) return <p className="text-[12.5px]" style={{ color: G.mute }}>本轮暂无自定义选科。</p>;
                return (
                  <div className="space-y-2.5">
                    {rows.map(([cn, n]) => (
                      <RowBar key={cn} label={cn} n={n} total={max} color={n / max > 0.5 ? G.warn : "#5FA983"} />
                    ))}
                  </div>
                );
              })()}
            </Card>
          </div>
          {!!adoption.customList.length && (
            <Card>
              <SecTitle title="自定义选科理由汇总" note="家长填写，≥5 字；按班级推送班主任/年级主任" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-150 text-[12.5px]">
                  <thead>
                    <tr className="text-left" style={{ background: G.brandSoft, color: G.brand }}>
                      <th className="rounded-l-lg px-3 py-2 font-bold">学生</th>
                      <th className="px-3 py-2 font-bold">班级</th>
                      <th className="px-3 py-2 font-bold">自选组合</th>
                      <th className="px-3 py-2 font-bold">理由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adoption.customList.map((c) => (
                      <tr key={c.userId} className="border-t align-top" style={{ borderColor: G.line }}>
                        <td className="px-3 py-2" style={{ color: G.ink }}>{c.name}</td>
                        <td className="px-3 py-2" style={{ color: G.mute }}>{c.className ?? "-"}</td>
                        <td className="px-3 py-2 font-bold" style={{ color: G.brand }}>{c.subjects.join("/")}</td>
                        <td className="px-3 py-2" style={{ color: G.ink }}>{c.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------- 预警中心 ---------------------------------- */

function WarningsSection() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<"" | "open" | "acknowledged" | "resolved">("");
  const { data, isLoading } = trpc.school.warnings.list.useQuery(status ? { status } : undefined);
  const reevaluate = trpc.school.warnings.reevaluate.useMutation({
    onSuccess: () => utils.school.warnings.list.invalidate(),
  });
  const handle = trpc.school.warnings.handle.useMutation({
    onSuccess: () => utils.school.warnings.list.invalidate(),
  });
  const events = data?.events ?? [];
  const open = events.filter((e) => e.status === "open").length;
  const high = events.filter((e) => e.level === "高风险").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat value={open} label="待处理预警" />
        <BigStat value={high} label="高风险（自伤红线）" />
        <BigStat value={events.length} label="当前列表条数" />
        <BigStat value="3 类" label="心理红线 / 学业下滑 / 动力不足" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pill active={status === ""} onClick={() => setStatus("")}>全部</Pill>
        <Pill active={status === "open"} onClick={() => setStatus("open")}>待处理</Pill>
        <Pill active={status === "acknowledged"} onClick={() => setStatus("acknowledged")}>已确认</Pill>
        <Pill active={status === "resolved"} onClick={() => setStatus("resolved")}>已办结</Pill>
        <button
          onClick={() => reevaluate.mutate()}
          disabled={reevaluate.isPending}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white"
          style={{ background: G.brand, opacity: reevaluate.isPending ? 0.5 : 1 }}
        >
          <RefreshCw size={14} className={reevaluate.isPending ? "animate-spin" : ""} />
          {reevaluate.isPending ? "扫描中…" : "重新扫描预警"}
        </button>
      </div>
      {isLoading ? (
        <p className="text-[13px]" style={{ color: G.mute }}>加载中…</p>
      ) : !events.length ? (
        <Card>
          <p className="py-6 text-center text-[13px]" style={{ color: G.mute }}>
            当前没有预警记录。点击「重新扫描预警」按最新测评与成绩数据全量核查。
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {events.map((e) => (
            <Card key={e.id} style={{ padding: "14px 16px" }}>
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className="mt-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={
                    e.level === "高风险"
                      ? { background: "#F7E3DE", color: G.danger }
                      : e.level === "预警"
                        ? { background: "#F8ECD8", color: G.warn }
                        : { background: G.brandSoft, color: G.brand }
                  }
                >
                  {e.level}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold" style={{ color: G.ink }}>
                    {e.name}
                    <span className="font-normal" style={{ color: G.mute }}>（{e.className ?? "未分班"}）</span>
                    <span className="ml-2 font-normal" style={{ color: G.mute }}>{WARN_TYPE_LABEL[e.type] ?? e.type}</span>
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed" style={{ color: G.mute }}>
                    {e.detail ? JSON.stringify(e.detail) : ""}
                    {e.handleNote ? `｜处置：${e.handleNote}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px]" style={{ color: G.mute }}>
                    {e.status === "open" ? "待处理" : e.status === "acknowledged" ? "已确认" : "已办结"}
                  </span>
                  {e.status === "open" && (
                    <>
                      <button
                        onClick={() => handle.mutate({ id: e.id, action: "acknowledge", note: "已知悉，跟进中" })}
                        disabled={handle.isPending}
                        className="rounded-lg border px-2.5 py-1 text-[11.5px]"
                        style={{ borderColor: G.line, color: G.ink }}
                      >
                        确认
                      </button>
                      <button
                        onClick={() => {
                          const note = window.prompt("办结说明（留痕）：", "已完成访谈/转介");
                          if (note !== null) handle.mutate({ id: e.id, action: "resolve", note });
                        }}
                        disabled={handle.isPending}
                        className="rounded-lg px-2.5 py-1 text-[11.5px] font-semibold text-white"
                        style={{ background: G.brand }}
                      >
                        办结
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- 成长档案 ---------------------------------- */

function ArchiveSection() {
  const [studentId, setStudentId] = useState<number | null>(null);
  const { data: students } = trpc.school.archive.students.useQuery();
  const { data: portfolio, isLoading } = trpc.school.archive.portfolio.useQuery(
    { studentId: studentId ?? 0 },
    { enabled: studentId != null },
  );
  const print = () => {
    if (!portfolio) return;
    const esc = (x: unknown) =>
      String(x ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const s = portfolio.student;
    const rows = [
      ...portfolio.assessments.map(
        (a) =>
          `<tr><td>测评</td><td>${esc(KIND_LABEL[a.kind] ?? a.kind)}</td><td>${esc(new Date(a.createdAt).toLocaleDateString("zh-CN"))}</td><td>${esc(JSON.stringify(a.result).slice(0, 200))}</td></tr>`,
      ),
      ...portfolio.academics.map(
        (a) =>
          `<tr><td>成绩</td><td>${esc(a.examName)}</td><td>${esc(new Date(a.createdAt).toLocaleDateString("zh-CN"))}</td><td>${esc(JSON.stringify(a.subjects))}</td></tr>`,
      ),
      ...portfolio.warnings.map(
        (w) =>
          `<tr><td>预警</td><td>${esc(WARN_TYPE_LABEL[w.type] ?? w.type)}·${esc(w.level)}</td><td>${esc(new Date(w.createdAt).toLocaleDateString("zh-CN"))}</td><td>${esc(w.status)} ${esc(w.handleNote ?? "")}</td></tr>`,
      ),
      ...portfolio.guidance.map(
        (g) =>
          `<tr><td>指导</td><td>七步法第${g.step}步${g.done ? "（完成）" : ""}</td><td>${esc(g.date)}</td><td>${esc(JSON.stringify(g.answers))}</td></tr>`,
      ),
    ].join("");
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(s.name)}·一生一策成长档案</title>
<style>body{font-family:system-ui,"Microsoft YaHei",sans-serif;max-width:820px;margin:24px auto;padding:0 16px;color:#1E3530}
h1{font-size:20px}h2{font-size:15px;margin-top:20px}table{width:100%;border-collapse:collapse;font-size:12px}
td,th{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f5f2e8}
.check{font-family:monospace;font-size:12px;color:#0E7A5F}</style></head><body>
<h1>一生一策成长档案 · ${esc(s.name)}</h1>
<p>${esc(s.grade ?? "")} ${esc(s.className ?? "")} ${esc(s.school ?? "")} ｜ 生成时间：${esc(portfolio.generatedAt)}</p>
<p class="check">校验码：${esc(portfolio.checksum)}（SHA-256 摘要，可校验档案完整性）</p>
<h2>档案明细（测评 / 成绩 / 预警 / 指导记录）</h2>
<table><thead><tr><th>类型</th><th>项目</th><th>日期</th><th>内容</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <GraduationCap size={18} style={{ color: G.brand }} />
          <select
            value={studentId ?? ""}
            onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : null)}
            className="min-w-60 rounded-lg border bg-white px-2.5 py-2 text-[12.5px]"
            style={{ borderColor: G.line, color: G.ink }}
          >
            <option value="">选择学生…</option>
            {(students?.students ?? []).map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.className ?? "未分班"} · {s.name}（{s.grade}）
              </option>
            ))}
          </select>
          {portfolio && (
            <button
              onClick={print}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white"
              style={{ background: G.brand }}
            >
              <Printer size={14} />
              打印 / 导出 PDF
            </button>
          )}
        </div>
      </Card>
      {studentId != null && isLoading && <p className="text-[13px]" style={{ color: G.mute }}>加载中…</p>}
      {portfolio && (
        <Card>
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-[16px] font-bold" style={{ color: G.ink }}>{portfolio.student.name}</h3>
            <span className="text-[12.5px]" style={{ color: G.mute }}>
              {portfolio.student.grade} {portfolio.student.className ?? ""} {portfolio.student.school ?? ""}
            </span>
            <span className="mono ml-auto rounded-lg px-2.5 py-1 text-[11.5px] font-bold" style={{ background: G.brandSoft, color: G.brand }}>
              校验码 {portfolio.checksum}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["测评记录", portfolio.assessments.length],
                ["成绩记录", portfolio.academics.length],
                ["预警记录", portfolio.warnings.length],
                ["指导记录", portfolio.guidance.length],
              ] as const
            ).map(([label, n]) => (
              <BigStat key={label} value={n} label={label} />
            ))}
          </div>
          <details className="mt-4 rounded-xl border" style={{ borderColor: G.line }}>
            <summary className="cursor-pointer px-3 py-2.5 text-[12.5px] font-bold" style={{ color: G.ink }}>
              测评明细（{portfolio.assessments.length}）
            </summary>
            <div className="space-y-1.5 px-3 pb-3">
              {portfolio.assessments.map((a, i) => (
                <div key={i} className="rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: "#F6F7F3", color: G.ink }}>
                  <b>{KIND_LABEL[a.kind] ?? a.kind}</b>
                  <span style={{ color: G.mute }}> · {new Date(a.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
              ))}
            </div>
          </details>
          <details className="mt-2 rounded-xl border" style={{ borderColor: G.line }}>
            <summary className="cursor-pointer px-3 py-2.5 text-[12.5px] font-bold" style={{ color: G.ink }}>
              成绩曲线（{portfolio.academics.length}）
            </summary>
            <div className="space-y-1.5 px-3 pb-3">
              {portfolio.academics.map((a, i) => (
                <div key={i} className="rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: "#F6F7F3", color: G.ink }}>
                  <b>{a.examName || "考试成绩"}</b>
                  <span style={{ color: G.mute }}> · {new Date(a.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
              ))}
            </div>
          </details>
          <details className="mt-2 rounded-xl border" style={{ borderColor: G.line }}>
            <summary className="cursor-pointer px-3 py-2.5 text-[12.5px] font-bold" style={{ color: G.ink }}>
              预警与处置（{portfolio.warnings.length}）
            </summary>
            <div className="space-y-1.5 px-3 pb-3">
              {portfolio.warnings.map((w, i) => (
                <div key={i} className="rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: "#F6F7F3", color: G.ink }}>
                  <b>{WARN_TYPE_LABEL[w.type] ?? w.type} · {w.level}</b>
                  <span style={{ color: G.mute }}>
                    {" "}· {new Date(w.createdAt).toLocaleDateString("zh-CN")} · {w.status === "open" ? "待处理" : w.status === "acknowledged" ? "已确认" : "已办结"}
                    {w.handleNote ? ` · ${w.handleNote}` : ""}
                  </span>
                </div>
              ))}
              {!portfolio.warnings.length && <p className="text-[12px]" style={{ color: G.mute }}>无预警记录</p>}
            </div>
          </details>
          <details className="mt-2 rounded-xl border" style={{ borderColor: G.line }}>
            <summary className="cursor-pointer px-3 py-2.5 text-[12.5px] font-bold" style={{ color: G.ink }}>
              指导记录（{portfolio.guidance.length}）
            </summary>
            <div className="space-y-1.5 px-3 pb-3">
              {portfolio.guidance.map((g, i) => (
                <div key={i} className="rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: "#F6F7F3", color: G.ink }}>
                  <b>{g.date}</b> · 七步法第{g.step}步{g.done ? "（已完成）" : ""}
                </div>
              ))}
              {!portfolio.guidance.length && <p className="text-[12px]" style={{ color: G.mute }}>暂无指导记录</p>}
            </div>
          </details>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------- 组织架构（用户与角色） ---------------------------------- */

function UsersSection() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const { data: usersData, isLoading } = trpc.admin.users.useQuery({ orgId: null, search: search.trim() || undefined });
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => {
      utils.admin.users.invalidate();
      utils.admin.overview.invalidate();
    },
  });
  const ROLE_LABEL: Record<string, string> = { admin: "管理员", tutor: "指导老师", jiaowu: "教务", user: "学生/家长" };
  return (
    <Card>
      <SecTitle title="用户与角色" note="可搜索姓名/手机号；把用户设为指导老师或教务" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索姓名 / 手机号…"
        className="mb-3 w-full max-w-xs rounded-lg border bg-white px-3 py-2 text-[12.5px]"
        style={{ borderColor: G.line, color: G.ink }}
      />
      {isLoading ? (
        <p className="text-[13px]" style={{ color: G.mute }}>加载中…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-130 text-[12.5px]">
            <thead>
              <tr className="text-left" style={{ background: G.brandSoft, color: G.brand }}>
                <th className="rounded-l-lg px-3 py-2 font-bold">姓名</th>
                <th className="px-3 py-2 font-bold">手机号</th>
                <th className="px-3 py-2 font-bold">角色</th>
                <th className="rounded-r-lg px-3 py-2 font-bold">操作</th>
              </tr>
            </thead>
            <tbody>
              {(usersData ?? []).slice(0, 50).map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: G.line }}>
                  <td className="px-3 py-2" style={{ color: G.ink }}>{u.name}</td>
                  <td className="px-3 py-2" style={{ color: G.mute }}>{u.phone ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#F3F5F0", color: G.ink }}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {u.role === "user" && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setRole.mutate({ userId: u.id, role: "tutor" })}
                          disabled={setRole.isPending}
                          className="rounded-lg border px-2 py-0.5 text-[11px]"
                          style={{ borderColor: G.line, color: G.brand }}
                        >
                          设为指导老师
                        </button>
                        <button
                          onClick={() => setRole.mutate({ userId: u.id, role: "jiaowu" })}
                          disabled={setRole.isPending}
                          className="rounded-lg border px-2 py-0.5 text-[11px]"
                          style={{ borderColor: G.line, color: G.ink }}
                        >
                          设为教务
                        </button>
                      </div>
                    )}
                    {(u.role === "tutor" || u.role === "jiaowu") && (
                      <button
                        onClick={() => setRole.mutate({ userId: u.id, role: "user" })}
                        disabled={setRole.isPending}
                        className="rounded-lg border px-2 py-0.5 text-[11px]"
                        style={{ borderColor: G.line, color: G.mute }}
                      >
                        取消角色
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------- 页面标题 ---------------------------------- */

const TITLES: Record<ItemKey, { crumb: string; title: string; sub?: string }> = {
  assess: { crumb: "测评管理 / 测评中心", title: "测评中心", sub: "测评组合与单项测评目录——看报告效果图与功能介绍，勾选后批量推送给学生" },
  tasks: { crumb: "测评管理 / 施测任务", title: "施测任务 · 未参测催办", sub: "谁做完了、谁还没动——一键催办，文本直达班主任" },
  progress: { crumb: "测评管理 / 进度看板", title: "进度看板 · 参测完成统计", sub: "全校必测完成率与班级排行，黄色班级建议重点跟进" },
  intention: { crumb: "数据统计 / 选科意向分析", title: "选科意向分析 · 推荐采纳率", sub: "系统推荐与实际确认的对比——前三推荐采纳、自定义理由回收，自动产出「推荐有效率」" },
  selection: { crumb: "数据统计 / 选科统计分析", title: "选科统计分析", sub: "年级/班级选科结构、第一推荐聚合、三轮意向对比——把个体推荐聚合成管理依据" },
  archive: { crumb: "数据统计 / 成长档案", title: "一生一策成长档案", sub: "测评 + 成绩 + 预警 + 指导记录自动归档，可导出校验" },
  students: { crumb: "学生管理 / 学员管理", title: "学员管理", sub: "搜索学员、分配指导老师、报告查看权限" },
  teachers: { crumb: "学生管理 / 指导老师", title: "指导老师", sub: "名下学员、二维码默认报告权限管理" },
  warnings: { crumb: "学校管理 / 预警中心", title: "预警中心", sub: "心理红线 / 学业下滑 / 动力不足——处置留痕，可审计" },
  invites: { crumb: "学校管理 / 注册邀请", title: "注册邀请", sub: "生成注册二维码，配置开放的测评与报告" },
  users: { crumb: "学校管理 / 组织架构", title: "组织架构 · 用户与角色", sub: "管理员、指导老师、教务的角色管理" },
  features: { crumb: "学校管理 / 版本与功能", title: "版本与功能", sub: "当前开通的系统版本与功能权限（只读，由平台超管统一管理）" },
  library: { crumb: "教学资源 / 资料库", title: "资料库", sub: "专业库、职业库、院校分数库与 12 学科门类图，供咨询与报告生成时查询调用" },
};

/* ---------------------------------- 主控制台 ---------------------------------- */

export default function SchoolConsole({ selfName, jiaowu = false }: { selfName: string; jiaowu?: boolean }) {
  /* v220.3：导航状态放进 URL（?item=xxx），外层侧边栏（Layout）可直接链接到各区块 */
  const [params, setParams] = useSearchParams();
  const { data: ctx } = trpc.school.context.useQuery();
  const canManage = !jiaowu;
  const allKeys = visibleSchoolGroups(jiaowu).flatMap((g) => g.items.map((it) => it.key));
  const raw = params.get("item") as SchoolItemKey | null;
  const item: SchoolItemKey = raw && allKeys.includes(raw) ? raw : "progress";
  const setItem = (k: SchoolItemKey) => setParams({ item: k });
  const visibleGroups = visibleSchoolGroups(jiaowu);
  /* v229：资料库功能被平台超管关闭时，菜单隐藏该入口（服务端接口同步 403） */
  const svcGroups =
    ctx?.services?.library === false
      ? visibleGroups.map((g) => ({ ...g, items: g.items.filter((it) => it.key !== "library") })).filter((g) => g.items.length)
      : visibleGroups;
  const t = TITLES[item];
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#F2F5F1" }}>
      {/* 顶部品牌条 */}
      <header className="flex items-center gap-3 px-5 py-3 text-white" style={{ background: G.deep }}>
        <span className="text-[16.5px] font-bold tracking-wide">三好学伴 · 学校版</span>
        <span className="rounded-full border px-2.5 py-0.5 text-[11px]" style={{ borderColor: "rgba(255,255,255,.45)" }}>
          {ctx?.orgName ?? "校园系统"}
        </span>
        <span className="ml-auto text-[12px] opacity-90">{jiaowu ? "教务" : "校长"} · {selfName}</span>
      </header>
      <div className="flex flex-1">
        {/* v220.3：内层栏仅移动端保留（桌面端菜单已并入外层侧边栏 Layout） */}
        <aside className="w-52 shrink-0 border-r bg-white py-4 md:hidden" style={{ borderColor: G.line }}>
          {svcGroups.map((g) => (
            <div key={g.label} className="mb-4">
              <div className="px-4 pb-1.5 text-[10.5px] font-bold tracking-wider" style={{ color: G.mute }}>{g.label}</div>
              {g.items.map((it) => {
                const active = item === it.key;
                return (
                  <button
                    key={it.key}
                    onClick={() => setItem(it.key)}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors"
                    style={{
                      color: active ? G.brand : G.ink,
                      background: active ? G.brandSoft : "transparent",
                      borderLeft: active ? `3px solid ${G.brand}` : "3px solid transparent",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <it.icon size={15} />
                    {it.label}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>
        {/* 内容区 */}
        <main className="min-w-0 flex-1 p-6">
          <div className="text-[11.5px]" style={{ color: G.mute }}>{t.crumb}</div>
          <h1 className="mt-1 text-[20px] font-bold" style={{ color: G.ink }}>{t.title}</h1>
          {t.sub && <p className="mt-1 mb-4 text-[12.5px]" style={{ color: G.mute }}>{t.sub}</p>}
          <div className="mt-4">
            {item === "assess" && <AssessCenter canManage={canManage} />}
            {item === "tasks" && <TasksSection canManage={canManage} />}
            {item === "progress" && <ProgressSection />}
            {item === "intention" && <IntentionSection canManage={canManage} />}
            {item === "selection" && <SelectionStats canManage={canManage} />}
            {item === "archive" && <ArchiveSection />}
            {item === "warnings" && <WarningsSection />}
            {item === "students" && <StudentsTab jiaowu={jiaowu} orgScope={{ orgId: null }} tutorLabel="指导老师" />}
            {item === "teachers" && <TutorsTab orgScope={{ orgId: null }} tutorLabel="指导老师" />}
            {item === "invites" && <InviteChannelsTab />}
            {item === "users" && <UsersSection />}
            {item === "features" && <OrgFeaturesCard />}
            {item === "library" && (
              <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A8A83]">资料库加载中…</div>}>
                <Library />
              </Suspense>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
