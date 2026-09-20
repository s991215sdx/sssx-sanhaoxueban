import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * V56：学员-伴学师多对多分配（仅管理员）。
 * 按钮显示当前分配人数，点开面板勾选多位伴学师，保存即全量替换。
 */
export default function TutorAssignButton({
  studentUserId,
  tutors,
  assigned,
}: {
  studentUserId: number;
  /** 全部伴学师选项 */
  tutors: { id: number; name: string }[];
  /** 当前已分配的伴学师 */
  assigned: { id: number; name: string }[];
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const save = trpc.admin.setStudentTutors.useMutation({
    onSuccess: () => {
      utils.admin.students.invalidate();
      utils.admin.tutors.invalidate();
      setOpen(false);
    },
  });

  useEffect(() => {
    if (open) setSelected(assigned.map((t) => t.id));
  }, [open, assigned]);

  return (
    <span className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="分配伴学师（可多选）"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
          assigned.length > 0
            ? "border-lime/60 bg-lime-pale text-olive"
            : "border-border bg-cream text-olive-soft hover:border-lime"
        }`}
      >
        <UserPlus size={13} />
        {assigned.length > 0 ? `伴学师 ${assigned.length}` : "分配伴学师"}
      </button>

      {open && (
        <span className="absolute right-0 z-30 mt-1 block w-60 rounded-xl border border-border bg-cream-card p-3 shadow-lg">
          <span className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-olive">分配给哪些伴学师？</span>
            <button onClick={() => setOpen(false)} className="rounded p-0.5 text-olive-mute hover:text-olive">
              <X size={14} />
            </button>
          </span>
          <span className="mt-2 flex flex-col gap-1">
            {tutors.length === 0 && (
              <span className="text-[12px] text-olive-mute">还没有伴学师，请先在「总览」里设置。</span>
            )}
            {tutors.map((t) => {
              const on = selected.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] ${
                    on ? "border-lime/60 bg-lime-pale text-olive" : "border-border bg-cream text-olive-soft"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setSelected((s) => (on ? s.filter((id) => id !== t.id) : [...s, t.id]))}
                    className="accent-[#7cb83c]"
                  />
                  {t.name}
                </label>
              );
            })}
          </span>
          <span className="mt-2.5 flex items-center gap-2">
            <button
              onClick={() => save.mutate({ studentUserId, tutorIds: selected })}
              disabled={save.isPending}
              className="rounded-lg bg-olive px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
            >
              {save.isPending ? "保存中…" : "保存"}
            </button>
            <button onClick={() => setOpen(false)} className="text-[12px] text-olive-mute hover:text-olive">
              取消
            </button>
            {save.error && <span className="text-[11px] text-terra">{save.error.message}</span>}
          </span>
        </span>
      )}
    </span>
  );
}
