import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ClipboardCheck, History, MessageCircleQuestion, Save } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { LEARNING_TRACES, validateDailyCheckin, type LearningTraceKey } from "@contracts/orgService";
import type { CoachingDetail } from "./coachingTypes";

function localDate(): string {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
type Grade = "A" | "B" | "C";
type CheckinForm = {
  checkDate: string; supervisionId: string; completionRate: number; accuracyRate: number;
  actualCompletion: string; evidence: string; gapReason: string; errorCause: string; correction: string;
  followUp: string; followUpDate: string; tomorrowFirst: string; feynmanEnabled: boolean;
  feynmanConcept: string; feynmanOutput: string; feynmanGrade: Grade | ""; feynmanStuck: string;
  feynmanQuestion: string; retestDate: string; traces: LearningTraceKey[]; traceEvidence: string;
  traceFollowUp: string; changeReason: string;
};
function blankForm(checkDate = localDate()): CheckinForm {
  return { checkDate, supervisionId: "", completionRate: 100, accuracyRate: 100, actualCompletion: "", evidence: "",
    gapReason: "", errorCause: "", correction: "", followUp: "", followUpDate: checkDate, tomorrowFirst: "",
    feynmanEnabled: false, feynmanConcept: "", feynmanOutput: "", feynmanGrade: "", feynmanStuck: "",
    feynmanQuestion: "", retestDate: "", traces: [], traceEvidence: "", traceFollowUp: "", changeReason: "" };
}
const input = "mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const label = "block text-[11.5px] font-semibold text-olive";
const sectionTitle = "text-[13px] font-bold text-olive";

/** 日检验是督学的结构化验收，不替代周／月自由复盘，也不向家长公开内部记录。 */
export default function CoachingCheckins({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const [form, setForm] = useState<CheckinForm>(() => blankForm());
  const [attempted, setAttempted] = useState(false);
  useEffect(() => { setForm(blankForm()); setAttempted(false); }, [caseId]);
  const sameDay = useMemo(() => data.checkins.filter((item) => item.checkDate === form.checkDate), [data.checkins, form.checkDate]);
  const nextVersion = sameDay.reduce((max, item) => Math.max(max, item.version), 0) + 1;
  const validationError = validateDailyCheckin({ ...form, feynmanGrade: form.feynmanGrade || undefined, hasPreviousVersion: sameDay.length > 0 });
  const save = trpc.coaching.saveCheckin.useMutation({ onSuccess: async () => {
    setForm(blankForm(form.checkDate)); setAttempted(false);
    await utils.coaching.detail.invalidate({ caseId });
  } });
  const update = <K extends keyof CheckinForm,>(key: K, value: CheckinForm[K]) => {
    setForm((current) => ({ ...current, [key]: value })); save.reset();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault(); setAttempted(true);
    if (validationError) return;
    save.mutate({ ...form, caseId, supervisionId: Number(form.supervisionId) || null,
      feynmanGrade: form.feynmanGrade || undefined, followUpDate: form.followUpDate || null, retestDate: form.retestDate || null });
  };
  const toggleTrace = (key: LearningTraceKey) => update("traces", form.traces.includes(key) ? form.traces.filter((item) => item !== key) : [...form.traces, key]);

  return <section className="min-w-0 rounded-2xl border border-[#0C7064]/20 bg-white p-4 shadow-sm">
    <header className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1"><h2 className="flex items-center gap-1.5 text-[16px] font-bold text-olive"><ClipboardCheck size={18} className="text-[#0C7064]" />结构化日检验</h2><p className="mt-1 text-[11.5px] leading-relaxed text-olive-mute">从“来过”走向“学会”：量化完成与准确，记录错因、输出、痕迹和补位；同日修改只新增版本。</p></div>
      <span className="rounded-full bg-mint-pale px-3 py-1.5 text-[11px] font-semibold text-[#0C7064]">本次将保存为 V{nextVersion}</span>
    </header>

    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>检验日期<input aria-label="检验日期" type="date" value={form.checkDate} onChange={(e) => update("checkDate", e.target.value)} className={input} /></label>
        <label className={`${label} sm:col-span-1 lg:col-span-2`}>关联到店督学（可选）<select aria-label="关联到店督学" value={form.supervisionId} onChange={(e) => update("supervisionId", e.target.value)} className={input}><option value="">不关联到店记录</option>{data.supervisions.map((record) => <option key={record.id} value={record.id}>{new Date(record.visitAt).toLocaleString("zh-CN")} · {record.status === "completed" ? "已完成" : "草稿"}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>完成率（%）<input aria-label="完成率" type="number" min={0} max={100} step={1} value={form.completionRate} onChange={(e) => update("completionRate", Number(e.target.value))} className={input} /></label>
          <label className={label}>准确率（%）<input aria-label="准确率" type="number" min={0} max={100} step={1} value={form.accuracyRate} onChange={(e) => update("accuracyRate", Number(e.target.value))} className={input} /></label>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={label}>实际完成情况<textarea aria-label="实际完成情况" value={form.actualCompletion} onChange={(e) => update("actualCompletion", e.target.value)} rows={3} maxLength={10000} placeholder="对照今日计划，写明实际完成的任务、数量与质量" className={input} /></label>
        <label className={label}>可核验的学习证据<textarea aria-label="可核验的学习证据" value={form.evidence} onChange={(e) => update("evidence", e.target.value)} rows={3} maxLength={10000} placeholder="例：限时完成数学第 3 讲 12 题，答对 10 题；附草稿与订正记录" className={input} /></label>
      </div>

      {form.completionRate < 100 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <h3 className="text-[12.5px] font-bold text-amber-900">未完成补位（完成率不足 100% 时必填）</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className={label}>未完成原因<textarea aria-label="未完成原因" value={form.gapReason} onChange={(e) => update("gapReason", e.target.value)} rows={2} maxLength={6000} placeholder="区分知识卡点、时间分配、任务量或执行问题" className={input} /></label>
          <label className={label}>补位行动<textarea aria-label="补位行动" value={form.followUp} onChange={(e) => update("followUp", e.target.value)} rows={2} maxLength={6000} placeholder="谁在什么时间完成什么，如何再次验收" className={input} /></label>
          <label className={label}>补位日期<input aria-label="补位日期" type="date" min={form.checkDate} value={form.followUpDate} onChange={(e) => update("followUpDate", e.target.value)} className={input} /></label>
        </div>
      </div>}
      {form.accuracyRate < 100 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <h3 className="text-[12.5px] font-bold text-amber-900">错因与订正（准确率不足 100% 时必填）</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className={label}>错因<textarea aria-label="错因" value={form.errorCause} onChange={(e) => update("errorCause", e.target.value)} rows={2} maxLength={6000} placeholder="概念不清、审题偏差、计算失误或方法不熟，写具体知识点" className={input} /></label>
          <label className={label}>订正情况<textarea aria-label="订正情况" value={form.correction} onChange={(e) => update("correction", e.target.value)} rows={2} maxLength={6000} placeholder="已怎样订正，是否完成同类题复验，仍有什么卡点" className={input} /></label>
        </div>
      </div>}

      <fieldset className="rounded-xl border border-border bg-cream/45 p-3">
        <legend className="px-1 text-[12.5px] font-bold text-olive">五项学习痕迹</legend>
        <p className="text-[10.5px] text-olive-mute">按本次实际产出勾选，不为集齐而补勾；未集齐须安排补齐。</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{LEARNING_TRACES.map((trace) => <label key={trace.key} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-[11.5px] ${form.traces.includes(trace.key) ? "border-[#0C7064]/35 bg-mint-pale text-[#0C7064]" : "border-border bg-white text-olive"}`}><input type="checkbox" aria-label={trace.label} checked={form.traces.includes(trace.key)} onChange={() => toggleTrace(trace.key)} className="accent-[#0C7064]" />{trace.label}</label>)}</div>
        <div className={`mt-2 grid gap-2 ${form.traces.length < 5 ? "sm:grid-cols-2" : ""}`}>
          <label className={label}>痕迹说明（可选）<textarea aria-label="痕迹说明" value={form.traceEvidence} onChange={(e) => update("traceEvidence", e.target.value)} rows={2} maxLength={10000} placeholder="本次留下的页码、题目、作品或文字记录" className={input} /></label>
          {form.traces.length < 5 && <label className={label}>缺项补齐安排<textarea aria-label="缺项补齐安排" value={form.traceFollowUp} onChange={(e) => update("traceFollowUp", e.target.value)} rows={2} maxLength={6000} placeholder="哪些痕迹不适用、哪些需要补齐，由谁在何时完成" className={input} /></label>}
        </div>
      </fieldset>

      <section className="rounded-xl border border-[#0C7064]/15 bg-mint-pale/20 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-olive"><input type="checkbox" aria-label="本次包含费曼输出" checked={form.feynmanEnabled} onChange={(e) => update("feynmanEnabled", e.target.checked)} className="accent-[#0C7064]" /><MessageCircleQuestion size={16} className="text-[#0C7064]" />本次包含费曼输出</label>
        {form.feynmanEnabled && <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_260px]">
            <label className={label}>讲解知识点<input aria-label="费曼知识点" value={form.feynmanConcept} onChange={(e) => update("feynmanConcept", e.target.value)} maxLength={2000} placeholder="例：一元二次方程求根公式的适用条件" className={input} /></label>
            <label className={label}>输出评级<select aria-label="费曼评级" value={form.feynmanGrade} onChange={(e) => update("feynmanGrade", e.target.value as Grade | "")} className={input}><option value="">请选择 A／B／C</option><option value="A">A · 能独立讲清并回答追问</option><option value="B">B · 提示后能讲清</option><option value="C">C · 暂不能完整复述</option></select></label>
          </div>
          <label className={label}>学生自己的讲解输出<textarea aria-label="学生讲解输出" value={form.feynmanOutput} onChange={(e) => update("feynmanOutput", e.target.value)} rows={3} maxLength={10000} placeholder="记录学生怎样用自己的话讲给同伴或老师听，不用老师结论替代学生输出" className={input} /></label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className={label}>卡壳点（可选）<textarea aria-label="费曼卡壳点" value={form.feynmanStuck} onChange={(e) => update("feynmanStuck", e.target.value)} rows={2} maxLength={6000} className={input} /></label>
            <label className={label}>老师反问（可选）<textarea aria-label="老师反问" value={form.feynmanQuestion} onChange={(e) => update("feynmanQuestion", e.target.value)} rows={2} maxLength={6000} className={input} /></label>
            <label className={label}>再考日期（可选）<input aria-label="再考日期" type="date" value={form.retestDate} onChange={(e) => update("retestDate", e.target.value)} className={input} /></label>
          </div>
        </div>}
      </section>

      <div className={`grid gap-2 ${sameDay.length ? "sm:grid-cols-2" : ""}`}>
        <label className={label}>明日第一件事<textarea aria-label="明日第一件事" value={form.tomorrowFirst} onChange={(e) => update("tomorrowFirst", e.target.value)} rows={2} maxLength={6000} placeholder="写清明日开始后最先做的一个可验证动作" className={input} /></label>
        {sameDay.length > 0 && <label className={label}>修改原因（同日再次提交必填）<textarea aria-label="日检验修改原因" value={form.changeReason} onChange={(e) => update("changeReason", e.target.value)} rows={2} maxLength={500} placeholder="说明补充或更正依据；旧版本完整保留" className={input} /></label>}
      </div>
      {attempted && validationError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{validationError}</p>}
      {save.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{save.error.message}</p>}
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={save.isPending} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#0C7064] px-4 py-2.5 text-[12.5px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40"><Save size={15} />{save.isPending ? "正在保存…" : `保存日检验 V${nextVersion}`}</button>{save.isSuccess && <span role="status" className="inline-flex items-center gap-1 text-[11.5px] text-[#2F7A41]"><Check size={14} />V{save.data.version} 已保存，历史版本未改动。</span>}</div>
    </form>

    <div className="mt-5 border-t border-border pt-4"><h3 className={`${sectionTitle} flex items-center gap-1.5`}><History size={15} />日检验版本历史 <span className="font-normal text-olive-mute">共 {data.checkins.length} 版</span></h3>
      <div className="mt-3 space-y-2">{data.checkins.map((item) => <details key={item.id} className="rounded-xl border border-border bg-cream/40 p-3">
        <summary className="cursor-pointer text-[12px] font-semibold text-olive">{item.checkDate} · V{item.version}<span className="ml-2 font-normal text-olive-mute">完成 {item.completionRate}% · 准确 {item.accuracyRate}%{item.supervisionId ? ` · 关联督学 #${item.supervisionId}` : ""}</span></summary>
        <div className="mt-3 grid gap-2 text-[11.5px] leading-relaxed text-olive-soft sm:grid-cols-2">
          <CheckinText title="实际完成" text={item.actualCompletion} /><CheckinText title="学习证据" text={item.evidence} />
          {item.completionRate < 100 && <><CheckinText title="未完成原因" text={item.gapReason} /><CheckinText title="补位行动与期限" text={`${item.followUp}（${item.followUpDate}）`} /></>}
          {item.accuracyRate < 100 && <><CheckinText title="错因" text={item.errorCause} /><CheckinText title="订正情况" text={item.correction} /></>}
          <CheckinText title="五项痕迹" text={item.traces.map((key) => LEARNING_TRACES.find((trace) => trace.key === key)?.label ?? key).join("、")} />
          {item.traceEvidence && <CheckinText title="痕迹说明" text={item.traceEvidence} />}{item.traceFollowUp && <CheckinText title="痕迹补齐" text={item.traceFollowUp} />}
          {item.feynmanGrade && <><CheckinText title={`费曼输出 · ${item.feynmanGrade} 级`} text={`${item.feynmanConcept}\n${item.feynmanOutput}`} />{item.feynmanStuck && <CheckinText title="卡壳点" text={item.feynmanStuck} />}{item.feynmanQuestion && <CheckinText title="老师反问" text={item.feynmanQuestion} />}</>}
          <CheckinText title="明日第一件事" text={item.tomorrowFirst} />{item.changeReason && <CheckinText title="修改原因" text={item.changeReason} />}
        </div><p className="mt-2 text-[10px] text-olive-mute">记录于 {new Date(item.createdAt).toLocaleString("zh-CN")} · 记录人 #{item.createdBy}</p>
      </details>)}{!data.checkins.length && <p className="rounded-xl border border-dashed border-border py-5 text-center text-[12px] text-olive-mute">还没有结构化日检验，可从今天的实际任务开始。</p>}</div>
    </div>
  </section>;
}
function CheckinText({ title, text }: { title: string; text: string }) {
  return <div className="rounded-lg bg-white p-2.5"><b className="text-olive">{title}</b><p className="mt-1 whitespace-pre-wrap">{text}</p></div>;
}
