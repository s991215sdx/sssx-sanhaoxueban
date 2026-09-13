import { useEffect, useState, type ReactNode } from "react";
import { ACADEMIC_SUBJECTS, SELF_LEVELS, subjectsForGrade, defaultFullScore, isMainSubject, type AcademicsData } from "@contracts/academics";
import { GraduationCap, Save } from "lucide-react";

export type AcademicsSubmit = {
  examName: string;
  subjects: {
    name: string;
    selfLevel: number | null;
    fullScore: number | null;
    lastScore: number | null;
    targetScore: number | null;
  }[];
};

type SubjectDraft = {
  selfLevel: number | null;
  fullScore: string;
  lastScore: string;
  targetScore: string;
};

const emptyDraft = (): SubjectDraft => ({ selfLevel: null, fullScore: "", lastScore: "", targetScore: "" });

function toNumber(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * 受控成绩编辑器核心：按年级定科目，逐科自评/满分/最近分/目标分。
 * 提交逻辑由父组件提供（onSubmit），便于在伴学师与注册向导中复用。
 */
export default function AcademicsEditorCore({
  grade,
  initial,
  submitting = false,
  submitLabel = "保存",
  onSubmit,
  footer,
  showIntro = true,
}: {
  grade: string | null | undefined;
  initial?: AcademicsData | null;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (data: AcademicsSubmit) => void;
  /** 提交成功后的提示（父组件控制显示） */
  footer?: ReactNode;
  showIntro?: boolean;
}) {
  const [examName, setExamName] = useState("");
  const [subjects, setSubjects] = useState<Record<string, SubjectDraft>>(
    () => Object.fromEntries(ACADEMIC_SUBJECTS.map((s) => [s, emptyDraft()])),
  );
  const [inited, setInited] = useState(false);
  const [touched, setTouched] = useState(false);

  // 以 initial 首次非空为准初始化一次（未编辑过时重置预填）
  useEffect(() => {
    if (inited || !initial) return;
    setExamName(initial.examName ?? "");
    setSubjects((prev) => {
      const next = { ...prev };
      for (const s of initial.subjects ?? []) {
        if (next[s.name]) {
          next[s.name] = {
            selfLevel: s.selfLevel,
            fullScore: s.fullScore != null ? String(s.fullScore) : "",
            lastScore: s.lastScore != null ? String(s.lastScore) : "",
            targetScore: s.targetScore != null ? String(s.targetScore) : "",
          };
        }
      }
      return next;
    });
    setInited(true);
  }, [initial, inited]);

  // 按档案年级决定科目清单：小学 = 语数英+道法+科学，初中/高中 = 全科
  const subjectList = subjectsForGrade(grade);

  const patch = (name: string, p: Partial<SubjectDraft>) =>
    setSubjects((prev) => ({ ...prev, [name]: { ...prev[name], ...p } }));

  /** 校验：填了满分时，最近分/目标分不能超过该科满分；分数不为负。 */
  const errors: Record<string, string> = {};
  for (const name of subjectList) {
    const d = subjects[name];
    const full = toNumber(d.fullScore);
    const last = toNumber(d.lastScore);
    const target = toNumber(d.targetScore);
    if (full != null && (full < 1 || full > 1500)) errors[name] = "满分需在 1-1500 之间";
    else if (last != null && last < 0) errors[name] = "分数不能为负";
    else if (target != null && target < 0) errors[name] = "分数不能为负";
    else if (full != null && last != null && last > full) errors[name] = `最近分不能超过满分 ${full}`;
    else if (full != null && target != null && target > full) errors[name] = `目标分不能超过满分 ${full}`;
  }
  const hasError = Object.keys(errors).length > 0;

  const onSave = () => {
    setTouched(true);
    if (hasError) return;
    onSubmit({
      examName: examName.trim(),
      subjects: subjectList.map((name) => {
        const d = subjects[name];
        return {
          name,
          selfLevel: d.selfLevel,
          fullScore: toNumber(d.fullScore),
          lastScore: toNumber(d.lastScore),
          targetScore: toNumber(d.targetScore),
        };
      }),
    });
  };

  return (
    <div className="paper-card p-5">
      <div className="flex items-center gap-2">
        <GraduationCap size={17} className="text-olive" />
        <h3 className="font-bold text-olive">学科自评与目标</h3>
      </div>
      {showIntro && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-olive-mute">
          填一填各科现状和目标，综合报告会据此算出每科要补的空间。满分留空按默认算（语数英：小学 100、初中 120、高中 150；其他科 100），各地不同可逐科改；不考或没学的科目整科留空即可，不影响其他科。
        </p>
      )}

      <label className="mt-4 block">
        <span className="text-[12.5px] text-olive-soft">最近大考名称</span>
        <input
          value={examName}
          onChange={(e) => setExamName(e.target.value)}
          placeholder="如：七年级上期中考试"
          className="mt-1 w-full rounded-xl border border-border bg-cream px-3 py-2 text-[13.5px] text-olive outline-none focus:border-lime"
        />
      </label>

      <div className="mt-4 space-y-2.5">
        {subjectList.map((name) => {
          const d = subjects[name];
          const full = toNumber(d.fullScore);
          const err = touched ? errors[name] : undefined;
          return (
            <div key={name} className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13.5px] font-semibold text-olive">{name}</span>
                {!isMainSubject(name) && (
                  <span className="text-[11px] text-olive-mute">不考或没学可不填</span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {SELF_LEVELS.map((lv) => (
                  <button
                    key={lv.value}
                    type="button"
                    title={lv.hint}
                    onClick={() => patch(name, { selfLevel: d.selfLevel === lv.value ? null : lv.value })}
                    className={`rounded-lg px-2 py-1 text-[11.5px] transition-colors ${
                      d.selfLevel === lv.value
                        ? "bg-olive text-cream"
                        : "border border-border text-olive-mute hover:border-lime/60 hover:text-olive"
                    }`}
                  >
                    {lv.label}
                  </button>
                ))}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="block truncate text-[11px] text-olive-mute">满分(可空)</span>
                  <input
                    type="number"
                    min={1}
                    max={1500}
                    value={d.fullScore}
                    onChange={(e) => patch(name, { fullScore: e.target.value })}
                    placeholder={`默认 ${defaultFullScore(name, grade)}`}
                    className="mt-1 w-full rounded-lg border border-border bg-cream px-2 py-1.5 text-[13px] text-olive outline-none focus:border-lime"
                  />
                </label>
                <label className="block">
                  <span className="block truncate text-[11px] text-olive-mute">最近大考分数</span>
                  <input
                    type="number"
                    min={0}
                    max={full ?? undefined}
                    value={d.lastScore}
                    onChange={(e) => patch(name, { lastScore: e.target.value })}
                    placeholder={`0-${full ?? defaultFullScore(name, grade)}`}
                    className="mt-1 w-full rounded-lg border border-border bg-cream px-2 py-1.5 text-[13px] text-olive outline-none focus:border-lime"
                  />
                </label>
                <label className="block">
                  <span className="block truncate text-[11px] text-olive-mute">目标分数</span>
                  <input
                    type="number"
                    min={0}
                    max={full ?? undefined}
                    value={d.targetScore}
                    onChange={(e) => patch(name, { targetScore: e.target.value })}
                    placeholder={`0-${full ?? defaultFullScore(name, grade)}`}
                    className="mt-1 w-full rounded-lg border border-border bg-cream px-2 py-1.5 text-[13px] text-olive outline-none focus:border-lime"
                  />
                </label>
              </div>
              {err && <p className="mt-1.5 text-[12px] text-terra">{err}</p>}
            </div>
          );
        })}
      </div>

      <button
        onClick={onSave}
        disabled={submitting}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-olive py-3 text-[14px] font-semibold text-cream hover:bg-lime-deep disabled:opacity-60"
      >
        <Save size={15} />
        {submitting ? "保存中…" : submitLabel}
      </button>
      {touched && hasError && (
        <p className="mt-2 text-center text-[13px] text-terra">有科目分数超过了该科满分，请检查后再保存。</p>
      )}
      {footer}
    </div>
  );
}
