import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, X } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * V56：学员-伴学师多对多分配（仅管理员）。
 * 按钮显示当前分配人数，点开面板勾选多位伴学师，保存即全量替换。
 * v167：面板改为 portal 固定定位——原先 absolute 定位在表格行内，
 * 会被表格容器的 overflow 裁剪/盖住，且末行向下弹出会被截断。
 * 现在按按钮位置计算坐标，下方空间不够时自动向上翻。
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const save = trpc.admin.setStudentTutors.useMutation({
    onSuccess: () => {
      utils.admin.students.invalidate();
      utils.admin.tutors.invalidate();
      setOpen(false);
    },
  });

  // 打开时按当前分配初始化勾选（避免渲染期 effect 反复重置用户选择）
  const toggleOpen = () => {
    if (!open) setSelected(assigned.map((t) => t.id));
    setOpen((v) => !v);
  };

  /* 面板打开后：按按钮位置定坐标，下方放不下（或被视口底边裁）就向上翻 */
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const panelH = panelRef.current?.offsetHeight ?? 220;
    const gap = 6;
    let top = rect.bottom + gap;
    if (top + panelH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - panelH - gap);
    }
    const left = Math.min(Math.max(8, rect.right - 240), window.innerWidth - 248);
    setPos({ top, left });
  }, [open, tutors.length]);

  /* 点面板外 / Esc / 滚动 → 关闭（固定定位不跟随滚动，留着会飘） */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", () => setOpen(false), { capture: true });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={anchorRef} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="分配伴学师（可多选）"
        onClick={toggleOpen}
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
          assigned.length > 0
            ? "border-transparent bg-brand font-semibold text-white shadow-sm"
            : "border-border bg-cream text-olive-soft hover:border-lime"
        }`}
      >
        <UserPlus size={13} />
        {assigned.length > 0 ? `伴学师 ${assigned.length}` : "分配伴学师"}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }}
            className="fixed z-[90] w-60 rounded-xl border border-border bg-cream-card p-3 shadow-lg"
          >
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
                      on ? "border-transparent bg-brand font-semibold text-white shadow-sm" : "border-border bg-cream text-olive-soft"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setSelected((s) => (on ? s.filter((id) => id !== t.id) : [...s, t.id]))}
                      className="accent-[#52A965]"
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
                className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
              >
                {save.isPending ? "保存中…" : "保存"}
              </button>
              <button onClick={() => setOpen(false)} className="text-[12px] text-olive-mute hover:text-olive">
                取消
              </button>
              {save.error && <span className="text-[11px] text-terra">{save.error.message}</span>}
            </span>
          </div>,
          document.body,
        )}
    </span>
  );
}
