/**
 * v220 学校版专版（粤华打样）——管理端「校园管理」面板。
 * 五个子页：参测统计 / 选科意向（轮次+采纳率）/ 预警中心 / 未参测催办 / 一生一策成长档案。
 * 约定：聚合分布不点名，名单按职员权限下钻（伴学师仅名下学生）。
 */
import { useState } from "react";
import {
  ClipboardList,
  AlertTriangle,
  BellRing,
  FolderHeart,
  RefreshCw,
  Printer,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

type SubTab = "stats" | "intention" | "warning" | "remind" | "archive";

const SUB_TABS: { key: SubTab; label: string; icon: typeof ClipboardList }[] = [
  { key: "stats", label: "参测统计", icon: ClipboardList },
  { key: "intention", label: "选科意向", icon: CheckCircle2 },
  { key: "warning", label: "预警中心", icon: AlertTriangle },
  { key: "remind", label: "未参测催办", icon: BellRing },
  { key: "archive", label: "成长档案", icon: FolderHeart },
];

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

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-cream-deep">
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------------------------------- 参测统计 ---------------------------------- */

function StatsSection() {
  const { data, isLoading } = trpc.school.stats.assessment.useQuery();
  if (isLoading || !data) return <p className="text-[13px] text-olive-mute">加载中…</p>;
  return (
    <div className="space-y-4">
      <div className="paper-card p-4">
        <div className="text-[12px] text-olive-mute">校园学生总数</div>
        <div className="mono mt-1 text-[26px] font-bold text-olive">{data.total}</div>
      </div>
      <div className="paper-card p-4">
        <h3 className="text-[14px] font-bold text-olive">重点测评完成情况</h3>
        <div className="mt-3 space-y-3">
          {data.kinds.map((k) => (
            <div key={k.kind} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-[12.5px] text-olive">{k.label}</span>
              <div className="flex-1">
                <Bar done={k.done} total={data.total} />
              </div>
              <span className="mono w-24 shrink-0 text-right text-[12px] text-olive-mute">
                {k.done}/{data.total}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="paper-card overflow-hidden p-4">
        <h3 className="text-[14px] font-bold text-olive">班级分布（学科四维 / 霍兰德）</h3>
        <table className="mt-3 w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-olive-mute">
              <th className="py-1.5 pr-3 font-medium">班级</th>
              <th className="py-1.5 pr-3 text-right font-medium">人数</th>
              <th className="py-1.5 pr-3 text-right font-medium">四维完成</th>
              <th className="py-1.5 text-right font-medium">霍兰德完成</th>
            </tr>
          </thead>
          <tbody>
            {data.byClass.map((c) => (
              <tr key={c.className} className="border-t border-border/60">
                <td className="py-1.5 pr-3 text-olive">{c.className}</td>
                <td className="mono py-1.5 pr-3 text-right text-olive">{c.total}</td>
                <td className="mono py-1.5 pr-3 text-right text-olive">
                  {c.done4d}/{c.total}
                </td>
                <td className="mono py-1.5 text-right text-olive">
                  {c.doneHolland}/{c.total}
                </td>
              </tr>
            ))}
            {!data.byClass.length && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-olive-mute">
                  暂无校园学生
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------- 选科意向 ---------------------------------- */

function IntentionSection() {
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
  const openRound = rounds?.find((r) => r.status === "open");
  return (
    <div className="space-y-4">
      <div className="paper-card p-4">
        <h3 className="text-[14px] font-bold text-olive">意向轮次管理</h3>
        <p className="mt-1 text-[12px] text-olive-mute">同一时间只开放一轮；家长端只对开放轮可提交/修改意向。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(rounds ?? []).map((r) => (
            <div
              key={r.roundNo}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                r.status === "open" ? "border-lime bg-brand/5" : "border-border"
              }`}
            >
              <span className="text-[12.5px] font-bold text-olive">
                第{r.roundNo}轮（{r.count}人）
              </span>
              <span className={`text-[11px] ${r.status === "open" ? "text-brand" : "text-olive-mute"}`}>
                {r.status === "open" ? "开放中" : "已截止"}
              </span>
              <button
                onClick={() => roundsSet.mutate({ roundNo: r.roundNo, open: r.status !== "open" })}
                disabled={roundsSet.isPending}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] text-olive hover:bg-brand hover:text-cream disabled:opacity-40"
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
            className="rounded-xl border border-dashed border-border px-3 py-2 text-[12px] text-olive-mute hover:border-brand hover:text-brand disabled:opacity-40"
          >
            + 开新一轮
          </button>
        </div>
      </div>

      <div className="paper-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-[14px] font-bold text-olive">推荐采纳率统计</h3>
          <select
            value={roundSel}
            onChange={(e) => setRoundSel(Number(e.target.value))}
            className="rounded-lg border border-border bg-cream px-2 py-1 text-[12px] text-olive"
          >
            {(rounds ?? []).map((r) => (
              <option key={r.roundNo} value={r.roundNo}>
                第{r.roundNo}轮{r.status === "open" ? "（开放中）" : ""}
              </option>
            ))}
            {!rounds?.length && <option value={1}>第1轮</option>}
          </select>
        </div>
        {isLoading || !adoption ? (
          <p className="mt-3 text-[13px] text-olive-mute">加载中…</p>
        ) : adoption.total === 0 ? (
          <p className="mt-3 text-[13px] text-olive-mute">暂无校园学生数据。</p>
        ) : (
          <>
            <div className="mono mt-3 text-[13px] text-olive-mute">
              已确认 {adoption.decided}/{adoption.total} 人
              {openRound && roundSel === openRound.roundNo ? "" : "（本轮已截止）"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
              {(
                [
                  ["rec1", "第一推荐", adoption.buckets.rec1],
                  ["rec2", "第二推荐", adoption.buckets.rec2],
                  ["rec3", "第三推荐", adoption.buckets.rec3],
                  ["custom", "自定义", adoption.buckets.custom],
                  ["unset", "未确认", adoption.buckets.unset],
                ] as const
              ).map(([key, label, n]) => (
                <div key={key} className="rounded-xl border border-border p-3 text-center">
                  <div className="mono text-[20px] font-bold text-olive">{n}</div>
                  <div className="mt-0.5 text-[11.5px] text-olive-mute">{label}</div>
                  {adoption.pct && key !== "unset" && (
                    <div className="mono mt-0.5 text-[11px] text-brand">{adoption.pct[key as "rec1" | "rec2" | "rec3" | "custom"]}%</div>
                  )}
                </div>
              ))}
            </div>
            {adoption.pct && (
              <p className="mt-3 rounded-lg bg-brand/5 px-3 py-2 text-[12.5px] text-olive">
                系统推荐采纳率（前三推荐合计 / 已确认人数）：<b className="mono">{adoption.pct.hitRate}%</b>
              </p>
            )}
            {!!adoption.customList.length && (
              <div className="mt-4">
                <h4 className="text-[13px] font-bold text-olive">自定义选科及理由（{adoption.customList.length}人）</h4>
                <table className="mt-2 w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-olive-mute">
                      <th className="py-1.5 pr-3 font-medium">学生</th>
                      <th className="py-1.5 pr-3 font-medium">班级</th>
                      <th className="py-1.5 pr-3 font-medium">自选组合</th>
                      <th className="py-1.5 font-medium">理由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adoption.customList.map((c) => (
                      <tr key={c.userId} className="border-t border-border/60 align-top">
                        <td className="py-1.5 pr-3 text-olive">{c.name}</td>
                        <td className="py-1.5 pr-3 text-olive-mute">{c.className ?? "-"}</td>
                        <td className="py-1.5 pr-3 text-olive">{c.subjects.join("/")}</td>
                        <td className="py-1.5 text-olive">{c.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- 预警中心 ---------------------------------- */

function WarningSection() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<"open" | "acknowledged" | "resolved" | "">("");
  const { data, isLoading } = trpc.school.warnings.list.useQuery(status ? { status } : undefined);
  const reevaluate = trpc.school.warnings.reevaluate.useMutation({
    onSuccess: (r) => {
      utils.school.warnings.list.invalidate();
      alert(`扫描完成，新增预警 ${r.created} 条`);
    },
  });
  const handle = trpc.school.warnings.handle.useMutation({
    onSuccess: () => utils.school.warnings.list.invalidate(),
  });
  const events = data?.events ?? [];
  const counts = { open: 0, acknowledged: 0, resolved: 0 };
  for (const e of events) counts[e.status]++;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg border border-border bg-cream px-2 py-1.5 text-[12.5px] text-olive"
        >
          <option value="">全部状态</option>
          <option value="open">待处理</option>
          <option value="acknowledged">已确认</option>
          <option value="resolved">已办结</option>
        </select>
        <button
          onClick={() => reevaluate.mutate()}
          disabled={reevaluate.isPending}
          className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
        >
          <RefreshCw size={14} className={reevaluate.isPending ? "animate-spin" : ""} />
          {reevaluate.isPending ? "扫描中…" : "重新扫描预警"}
        </button>
        <span className="text-[12px] text-olive-mute">规则：心理红线（含 E3）/ 乐学&lt;3.0 / 成绩得分率降幅≥10个百分点</span>
      </div>
      {isLoading ? (
        <p className="text-[13px] text-olive-mute">加载中…</p>
      ) : !events.length ? (
        <div className="paper-card p-8 text-center text-[13px] text-olive-mute">
          <CircleDashed className="mx-auto mb-2 text-olive-mute" size={26} />
          当前没有预警记录。点击「重新扫描预警」按最新测评与成绩数据全量核查。
        </div>
      ) : (
        <div className="space-y-2.5">
          {events.map((e) => (
            <div key={e.id} className="paper-card flex flex-wrap items-start gap-3 p-3.5">
              <span
                className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  e.level === "高风险"
                    ? "bg-terra/15 text-terra"
                    : e.level === "预警"
                      ? "bg-[#C77F2A]/15 text-[#C77F2A]"
                      : "bg-butter-pale text-brand"
                }`}
              >
                {e.level}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-olive">
                  {e.name} <span className="font-normal text-olive-mute">（{e.className ?? "未分班"}）</span>
                  <span className="ml-2 font-normal text-olive-mute">{WARN_TYPE_LABEL[e.type] ?? e.type}</span>
                </div>
                <div className="mt-1 text-[12px] leading-relaxed text-olive-mute">
                  {e.detail ? JSON.stringify(e.detail) : ""}
                  {e.handleNote ? `｜处置：${e.handleNote}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-olive-mute">
                  {e.status === "open" ? "待处理" : e.status === "acknowledged" ? "已确认" : "已办结"}
                </span>
                {e.status === "open" && (
                  <>
                    <button
                      onClick={() => handle.mutate({ id: e.id, action: "acknowledge", note: "已知悉，跟进中" })}
                      disabled={handle.isPending}
                      className="rounded-lg border border-border px-2.5 py-1 text-[11.5px] text-olive hover:bg-brand hover:text-cream disabled:opacity-40"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => {
                        const note = window.prompt("办结说明（留痕）：", "已完成访谈/转介");
                        if (note !== null) handle.mutate({ id: e.id, action: "resolve", note });
                      }}
                      disabled={handle.isPending}
                      className="rounded-lg bg-brand px-2.5 py-1 text-[11.5px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
                    >
                      办结
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- 未参测催办 ---------------------------------- */

function RemindSection() {
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const { data, isLoading } = trpc.school.unassessed.list.useQuery();
  const remind = trpc.school.unassessed.remind.useMutation({
    onSuccess: (r) => {
      setText(r.text);
      utils.school.unassessed.my.invalidate();
      alert(`已为 ${r.reminded} 名缺测学生生成系统提醒`);
    },
  });
  const groups = data?.groups ?? [];
  const totalMissing = groups.reduce((s, g) => s + g.items.length, 0);
  return (
    <div className="space-y-4">
      <div className="paper-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-[14px] font-bold text-olive">缺测名单（学科四维 / 霍兰德）</h3>
          <button
            onClick={() => remind.mutate()}
            disabled={remind.isPending || !totalMissing}
            className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
          >
            <BellRing size={14} />
            {remind.isPending ? "催办中…" : "一键催办（生成系统提醒）"}
          </button>
        </div>
        <p className="mt-1 text-[12px] text-olive-mute">
          学校脱敏场景（不录手机号）下，系统提醒直接推给管理员/年级主任，可复制下方文本发各班班主任。
        </p>
        {isLoading ? (
          <p className="mt-3 text-[13px] text-olive-mute">加载中…</p>
        ) : !groups.length ? (
          <p className="mt-3 rounded-lg bg-brand/5 px-3 py-2.5 text-[13px] text-olive">全部学生均已完成必测项，太好了。</p>
        ) : (
          <div className="mt-3 space-y-3">
            {groups.map((g) => (
              <div key={g.className} className="rounded-xl border border-border p-3">
                <div className="text-[13px] font-bold text-olive">
                  {g.className} <span className="font-normal text-olive-mute">（{g.items.length}人缺测）</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {g.items.map((it) => (
                    <span key={it.userId} className="rounded-full bg-cream-deep px-2.5 py-1 text-[11.5px] text-olive">
                      {it.name}·缺{it.missing.join("、")}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {text && (
        <div className="paper-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-olive">可复制给班主任的催办文本</h3>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(text);
                alert("已复制");
              }}
              className="rounded-lg border border-border px-2.5 py-1 text-[11.5px] text-olive hover:bg-brand hover:text-cream"
            >
              复制
            </button>
          </div>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-cream-deep/60 p-3 text-[12.5px] leading-relaxed text-olive">{text}</pre>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- 一生一策成长档案 ---------------------------------- */

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
.check{font-family:monospace;font-size:12px;color:#0C7064}</style></head><body>
<h1>一生一策成长档案 · ${esc(s.name)}</h1>
<p>${esc(s.grade ?? "")} ${esc(s.className ?? "")} ${esc(s.school ?? "")} ｜ 生成时间：${esc(portfolio.generatedAt)}</p>
<p class="check">校验码：${esc(portfolio.checksum)}（导出内容经 SHA-256 摘要，可用于校验档案完整性）</p>
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
      <div className="paper-card flex flex-wrap items-center gap-3 p-4">
        <h3 className="text-[14px] font-bold text-olive">选择学生</h3>
        <select
          value={studentId ?? ""}
          onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : null)}
          className="min-w-52 rounded-lg border border-border bg-cream px-2 py-1.5 text-[12.5px] text-olive"
        >
          <option value="">请选择…</option>
          {(students?.students ?? []).map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.className ?? "未分班"} · {s.name}（{s.grade}）
            </option>
          ))}
        </select>
        {portfolio && (
          <button
            onClick={print}
            className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-cream hover:bg-lime"
          >
            <Printer size={14} />
            打印 / 导出 PDF
          </button>
        )}
      </div>
      {studentId != null && isLoading && <p className="text-[13px] text-olive-mute">加载中…</p>}
      {portfolio && (
        <div className="paper-card p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-[16px] font-bold text-olive">{portfolio.student.name}</h3>
            <span className="text-[12.5px] text-olive-mute">
              {portfolio.student.grade} {portfolio.student.className ?? ""} {portfolio.student.school ?? ""}
            </span>
            <span className="mono ml-auto rounded-lg bg-brand/5 px-2.5 py-1 text-[11.5px] text-brand">
              校验码 {portfolio.checksum}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {(
              [
                ["测评记录", portfolio.assessments.length],
                ["成绩记录", portfolio.academics.length],
                ["预警记录", portfolio.warnings.length],
                ["指导记录", portfolio.guidance.length],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-xl border border-border p-3 text-center">
                <div className="mono text-[20px] font-bold text-olive">{n}</div>
                <div className="mt-0.5 text-[11.5px] text-olive-mute">{label}</div>
              </div>
            ))}
          </div>
          <details className="mt-3 rounded-xl border border-border">
            <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-bold text-olive">测评明细（{portfolio.assessments.length}）</summary>
            <div className="space-y-1.5 px-3 pb-3">
              {portfolio.assessments.map((a, i) => (
                <div key={i} className="rounded-lg bg-cream-deep/50 px-2.5 py-1.5 text-[12px] text-olive">
                  <b>{KIND_LABEL[a.kind] ?? a.kind}</b>
                  <span className="text-olive-mute"> · {new Date(a.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
              ))}
            </div>
          </details>
          <details className="mt-2 rounded-xl border border-border">
            <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-bold text-olive">成绩曲线（{portfolio.academics.length}）</summary>
            <div className="space-y-1.5 px-3 pb-3">
              {portfolio.academics.map((a, i) => (
                <div key={i} className="rounded-lg bg-cream-deep/50 px-2.5 py-1.5 text-[12px] text-olive">
                  <b>{a.examName || "考试成绩"}</b>
                  <span className="text-olive-mute"> · {new Date(a.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
              ))}
            </div>
          </details>
          <details className="mt-2 rounded-xl border border-border">
            <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-bold text-olive">预警与处置（{portfolio.warnings.length}）</summary>
            <div className="space-y-1.5 px-3 pb-3">
              {portfolio.warnings.map((w, i) => (
                <div key={i} className="rounded-lg bg-cream-deep/50 px-2.5 py-1.5 text-[12px] text-olive">
                  <b>
                    {WARN_TYPE_LABEL[w.type] ?? w.type} · {w.level}
                  </b>
                  <span className="text-olive-mute">
                    {" "}
                    · {new Date(w.createdAt).toLocaleDateString("zh-CN")} · {w.status === "open" ? "待处理" : w.status === "acknowledged" ? "已确认" : "已办结"}
                    {w.handleNote ? ` · ${w.handleNote}` : ""}
                  </span>
                </div>
              ))}
              {!portfolio.warnings.length && <p className="text-[12px] text-olive-mute">无预警记录</p>}
            </div>
          </details>
          <details className="mt-2 rounded-xl border border-border">
            <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-bold text-olive">指导记录（{portfolio.guidance.length}）</summary>
            <div className="space-y-1.5 px-3 pb-3">
              {portfolio.guidance.map((g, i) => (
                <div key={i} className="rounded-lg bg-cream-deep/50 px-2.5 py-1.5 text-[12px] text-olive">
                  <b>{g.date}</b> · 七步法第{g.step}步{g.done ? "（已完成）" : ""}
                </div>
              ))}
              {!portfolio.guidance.length && <p className="text-[12px] text-olive-mute">暂无指导记录</p>}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- 主面板 ---------------------------------- */

export default function SchoolPanel() {
  const [sub, setSub] = useState<SubTab>("stats");
  const { data: ctx } = trpc.school.context.useQuery();
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-[18px] font-bold text-[#1E3530]">校园管理{ctx?.orgName ? ` · ${ctx.orgName}` : ""}</h2>
        <p className="mt-0.5 text-[12.5px] text-olive-mute">
          学校版专版功能（v220，粤华打样）：团体统计不点名，名单按权限下钻。
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
              sub === t.key ? "bg-[#0C7064] text-white shadow" : "text-[#1E3530] hover:bg-[#0C7064]/10"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>
      {sub === "stats" && <StatsSection />}
      {sub === "intention" && <IntentionSection />}
      {sub === "warning" && <WarningSection />}
      {sub === "remind" && <RemindSection />}
      {sub === "archive" && <ArchiveSection />}
    </div>
  );
}
