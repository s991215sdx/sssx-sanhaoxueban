import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { INVITE_ASSESS_KINDS } from "@contracts/invite";

/**
 * v82「推送测评」面板（伴学师/管理员学员卡内联展开）：
 * 对扫码注册且渠道绑定了测评套餐的学员，未绑定的测评在客户端隐藏；
 * 在这里勾选后，该学员客户端立即可见可测（写入 student_profile.released_assessments）。
 * 渠道已绑定的测评显示为禁用勾选（由渠道套餐决定，无需重复推送）。
 */
export default function AssessmentReleasePanel({
  userId,
  released,
  boundKinds,
}: {
  userId: number;
  released: string[];
  boundKinds: string[];
}) {
  const utils = trpc.useUtils();
  const boundAll = boundKinds.includes("all");
  const boundSet = new Set(boundKinds);
  const [selected, setSelected] = useState<string[]>(released);
  const save = trpc.coach.setReleasedAssessments.useMutation({
    onSuccess: () => {
      utils.coach.myStudents.invalidate();
      utils.admin.students.invalidate();
    },
  });
  const toggle = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  return (
    <div className="mt-3 rounded-xl border border-border bg-cream/70 p-3" onClick={(e) => e.stopPropagation()}>
      <div className="text-[12px] font-bold text-olive">
        推送测评
        <span className="ml-2 font-normal text-olive-mute">勾选后，该学员客户端立即可见可测；未勾选的测评保持隐藏</span>
      </div>
      {boundAll ? (
        <p className="mt-2 text-[12px] leading-relaxed text-olive-mute">
          该学员注册渠道绑定了「全部测评」，客户端已可见全部测评，无需推送。
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INVITE_ASSESS_KINDS.map((k) => {
              const bound = boundSet.has(k.key);
              const on = bound || selected.includes(k.key);
              return (
                <button
                  key={k.key}
                  type="button"
                  disabled={bound}
                  onClick={() => toggle(k.key)}
                  title={bound ? "该测评已由注册渠道绑定，学员本来就可见" : undefined}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    bound
                      ? "cursor-not-allowed border-lime/60 bg-lime-pale/60 text-olive-mute"
                      : on
                        ? "border-lime/60 bg-lime-pale text-olive"
                        : "border-border bg-cream-card text-olive-mute hover:bg-lime-pale/50"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {k.label}
                  {bound ? "（渠道已绑定）" : ""}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => save.mutate({ userId, kinds: selected })}
              disabled={save.isPending}
              className="rounded-lg bg-olive px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
            >
              {save.isPending ? "保存中…" : "保存推送"}
            </button>
            {save.isSuccess && <span className="text-[11px] text-olive">已保存 ✓ 学员刷新客户端后生效</span>}
            {save.error && <span className="text-[11px] text-terra">{save.error.message}</span>}
          </div>
        </>
      )}
    </div>
  );
}
