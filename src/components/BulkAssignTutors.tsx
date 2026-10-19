import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import ReportExpirySelect from "./ReportExpirySelect";

/**
 * v217：批量分配伴学师——学员列表勾选多人后，统一分配给一位/多位伴学师。
 * 合并语义：只覆盖所选伴学师在这些学员身上的旧记录，学员已有的其他伴学师不受影响；
 * 每人可设「可看报告」开关与有效期（口径与单学员分配面板一致）。
 */
export default function BulkAssignTutors({
  studentIds,
  tutors,
  onDone,
  tutorLabel = "伴学师",
}: {
  studentIds: number[];
  tutors: { id: number; name: string }[];
  onDone: () => void;
  /** v220.2：角色称谓（学校版传「指导老师」，机构版默认「伴学师」） */
  tutorLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [access, setAccess] = useState<Record<number, { report: boolean; expiresAt: string | null }>>({});
  const utils = trpc.useUtils();
  const save = trpc.admin.batchSetStudentTutors.useMutation({
    onSuccess: () => {
      utils.admin.students.invalidate();
      setOpen(false);
      setSelected([]);
      setAccess({});
      onDone();
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const accessOf = (id: number) => access[id] ?? { report: true, expiresAt: null };

  return (
    <>
      <button
        type="button"
        disabled={studentIds.length === 0}
        title={`把勾选的学员统一分配给${tutorLabel}（不覆盖学员已有的其他${tutorLabel}）`}
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg border border-border bg-cream-card px-2.5 py-1.5 text-[12px] font-semibold text-olive transition-colors hover:border-lime disabled:cursor-not-allowed disabled:opacity-40"
      >
        <UserPlus size={13} />
        批量分配{tutorLabel}{studentIds.length > 0 ? `（已选 ${studentIds.length} 人）` : ""}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0B3D2E]/30 p-4" onClick={() => setOpen(false)}>
            <div
              className="max-h-[80vh] w-[420px] overflow-y-auto rounded-xl border border-border bg-cream-card p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-olive">
                  批量分配{tutorLabel}<span className="ml-1 text-[11.5px] font-normal text-olive-mute">（{studentIds.length} 位学员）</span>
                </span>
                <button onClick={() => setOpen(false)} className="rounded p-0.5 text-olive-mute hover:text-olive">
                  <X size={15} />
                </button>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-olive-mute">
                为勾选的学员添加以下{tutorLabel}；学员已有的其他{tutorLabel}保持不变。未勾选的学员不受影响。
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                {tutors.length === 0 && (
                  <span className="text-[12px] text-olive-mute">还没有{tutorLabel}，请先在「总览」里设置。</span>
                )}
                {tutors.map((t) => {
                  const on = selected.includes(t.id);
                  const acc = accessOf(t.id);
                  return (
                    <div key={t.id} className={`rounded-lg border px-2.5 py-1.5 ${on ? "border-transparent bg-brand/10" : "border-border bg-cream"}`}>
                      <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            setSelected((s) => (on ? s.filter((id) => id !== t.id) : [...s, t.id]));
                            if (!on && !access[t.id]) setAccess((a) => ({ ...a, [t.id]: { report: true, expiresAt: null } }));
                          }}
                          className="accent-[#52A965]"
                        />
                        <span className={on ? "font-semibold text-olive" : "text-olive-soft"}>{t.name}</span>
                      </label>
                      {on && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
                          <span className="text-[11px] text-olive-mute">报告：</span>
                          <button
                            type="button"
                            onClick={() => setAccess((a) => ({ ...a, [t.id]: { ...acc, report: !acc.report } }))}
                            className={`rounded-full px-2 py-px text-[11px] font-semibold ${
                              acc.report ? "bg-brand text-white" : "bg-cream-card text-olive-mute ring-1 ring-border"
                            }`}
                          >
                            {acc.report ? "可看报告" : "不可看"}
                          </button>
                          {acc.report && (
                            <ReportExpirySelect
                              compact
                              value={acc.expiresAt}
                              onChange={(iso) => setAccess((a) => ({ ...a, [t.id]: { ...acc, expiresAt: iso } }))}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() =>
                    save.mutate({
                      studentUserIds: studentIds,
                      tutors: selected.map((id) => ({
                        tutorUserId: id,
                        reportAccess: accessOf(id).report,
                        expiresAt: accessOf(id).expiresAt,
                      })),
                    })
                  }
                  disabled={save.isPending || selected.length === 0}
                  className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
                >
                  {save.isPending ? "保存中…" : `保存（${studentIds.length} 人）`}
                </button>
                <button onClick={() => setOpen(false)} className="text-[12px] text-olive-mute hover:text-olive">
                  取消
                </button>
                {save.error && <span className="text-[11px] text-terra">{save.error.message}</span>}
                {save.isSuccess && <span className="text-[11px] text-brand">已分配</span>}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
