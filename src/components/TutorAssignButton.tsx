import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import ReportExpirySelect from "./ReportExpirySelect";

/**
 * V56：学员-伴学师多对多分配（仅管理员）。
 * v167：面板改 portal 固定定位——原先 absolute 定位在表格行内，会被表格容器 overflow 裁剪盖住。
 * v169：每位伴学师增加「报告权限」开关与有效期（B 端付费控制）——
 *   是 = 可看本学员的测评报告/解析；否 = 只能看到做了哪些测评。默认有效期永久。
 */
export default function TutorAssignButton({
  studentUserId,
  tutors,
  assigned,
}: {
  studentUserId: number;
  /** 全部伴学师选项 */
  tutors: { id: number; name: string }[];
  /** 当前已分配的伴学师（含报告权限与有效期） */
  assigned: { id: number; name: string; reportAccess?: boolean; reportAccessExpiresAt?: Date | string | null }[];
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  /* v169：报告权限设置 tutorId → { report, expiresAt } */
  const [access, setAccess] = useState<Record<number, { report: boolean; expiresAt: string | null }>>({});
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

  // 打开时按当前分配初始化勾选与权限（避免渲染期 effect 反复重置用户选择）
  const toggleOpen = () => {
    if (!open) {
      setSelected(assigned.map((t) => t.id));
      const init: Record<number, { report: boolean; expiresAt: string | null }> = {};
      for (const t of assigned) {
        init[t.id] = {
          report: t.reportAccess !== false,
          expiresAt: t.reportAccessExpiresAt ? new Date(t.reportAccessExpiresAt as string | Date).toISOString() : null,
        };
      }
      setAccess(init);
    }
    setOpen((v) => !v);
  };

  /* 面板打开后：按按钮位置定坐标，下方放不下（或被视口底边裁）就向上翻 */
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const panelH = panelRef.current?.offsetHeight ?? 300;
    const gap = 6;
    let top = rect.bottom + gap;
    if (top + panelH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - panelH - gap);
    }
    const left = Math.min(Math.max(8, rect.right - 280), window.innerWidth - 288);
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

  const accessOf = (id: number) => access[id] ?? { report: true, expiresAt: null };

  return (
    <span ref={anchorRef} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="分配伴学师（可多选，可设置报告权限）"
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
            className="fixed z-[90] w-[280px] rounded-xl border border-border bg-cream-card p-3 shadow-lg"
          >
            <span className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-olive">分配给哪些伴学师？</span>
              <button onClick={() => setOpen(false)} className="rounded p-0.5 text-olive-mute hover:text-olive">
                <X size={14} />
              </button>
            </span>
            <span className="mt-2 flex flex-col gap-1.5">
              {tutors.length === 0 && (
                <span className="text-[12px] text-olive-mute">还没有伴学师，请先在「总览」里设置。</span>
              )}
              {tutors.map((t) => {
                const on = selected.includes(t.id);
                const acc = accessOf(t.id);
                return (
                  <span
                    key={t.id}
                    className={`rounded-lg border px-2.5 py-1.5 ${
                      on ? "border-transparent bg-brand/10" : "border-border bg-cream"
                    }`}
                  >
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
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
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
                      </span>
                    )}
                  </span>
                );
              })}
            </span>
            <span className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() =>
                  save.mutate({
                    studentUserId,
                    tutors: selected.map((id) => ({
                      tutorUserId: id,
                      reportAccess: accessOf(id).report,
                      expiresAt: accessOf(id).expiresAt,
                    })),
                  })
                }
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
