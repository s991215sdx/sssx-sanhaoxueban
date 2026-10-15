import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileCheck, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import ReportExpirySelect from "./ReportExpirySelect";

/**
 * v169：「分配报告」——学员列表操作列按钮（仅管理员）。
 * 给伴学师开通某学员的测评报告查看权限（收钱后的解锁动作）。
 * 伴学师可以还没分配——保存时会自动建立分配关系并授予报告权限。
 */
export default function ReportGrantButton({
  studentUserId,
  studentName,
  tutors,
  assigned,
}: {
  studentUserId: number;
  studentName: string;
  /** 全部伴学师选项 */
  tutors: { id: number; name: string }[];
  /** 当前已分配（含权限状态，用于预选与提示） */
  assigned: { id: number; name: string; reportAccess?: boolean; reportAccessExpiresAt?: Date | string | null }[];
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [tutorId, setTutorId] = useState<number | "">("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const grant = trpc.admin.grantReportAccess.useMutation({
    onSuccess: () => {
      utils.admin.students.invalidate();
      utils.admin.tutors.invalidate();
      setOpen(false);
    },
  });

  const toggleOpen = () => {
    if (!open) {
      // 默认预选第一个「已分配但无报告权限」的伴学师，没有则选第一个已分配
      const first = assigned.find((t) => t.reportAccess === false) ?? assigned[0];
      setTutorId(first?.id ?? "");
      setExpiresAt(
        first?.reportAccessExpiresAt ? new Date(first.reportAccessExpiresAt as string | Date).toISOString() : null,
      );
    }
    setOpen((v) => !v);
  };

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const panelH = panelRef.current?.offsetHeight ?? 200;
    const gap = 6;
    let top = rect.bottom + gap;
    if (top + panelH > window.innerHeight - 8) top = Math.max(8, rect.top - panelH - gap);
    const left = Math.min(Math.max(8, rect.right - 260), window.innerWidth - 268);
    setPos({ top, left });
  }, [open]);

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

  const current = assigned.find((t) => t.id === tutorId);

  return (
    <span ref={anchorRef} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="分配报告（开通伴学师对本学员测评报告的查看权限）"
        onClick={toggleOpen}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-cream-card px-2.5 py-1.5 text-[12px] font-medium text-olive-soft hover:bg-butter-pale/70"
      >
        <FileCheck size={13} />
        分配报告
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }}
            className="fixed z-[90] w-[260px] rounded-xl border border-border bg-cream-card p-3 shadow-lg"
          >
            <span className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-olive">分配报告 · {studentName}</span>
              <button onClick={() => setOpen(false)} className="rounded p-0.5 text-olive-mute hover:text-olive">
                <X size={14} />
              </button>
            </span>
            <span className="mt-2.5 flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-olive-mute">伴学师（未分配的会自动建立分配）</span>
                <select
                  className="rounded-lg border border-border bg-cream px-2 py-1.5 text-[12.5px] text-olive"
                  value={tutorId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setTutorId(id);
                    const a = assigned.find((t) => t.id === id);
                    setExpiresAt(
                      a?.reportAccessExpiresAt ? new Date(a.reportAccessExpiresAt as string | Date).toISOString() : null,
                    );
                  }}
                >
                  <option value="">选择伴学师…</option>
                  {tutors.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {assigned.some((a) => a.id === t.id)
                        ? assigned.find((a) => a.id === t.id)?.reportAccess !== false
                          ? "（已可查看）"
                          : "（已分配·无报告权限）"
                        : "（未分配）"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-olive-mute">报告查看有效期</span>
                <ReportExpirySelect value={expiresAt} onChange={setExpiresAt} />
              </label>
            </span>
            <span className="mt-3 flex items-center gap-2">
              <button
                onClick={() => {
                  if (!tutorId) return;
                  grant.mutate({ studentUserId, tutorUserId: Number(tutorId), reportAccess: true, expiresAt });
                }}
                disabled={grant.isPending || !tutorId}
                className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
              >
                {grant.isPending ? "保存中…" : current?.reportAccess !== false && current ? "更新有效期" : "开通并保存"}
              </button>
              {current?.reportAccess !== false && current && (
                <button
                  onClick={() => grant.mutate({ studentUserId, tutorUserId: Number(tutorId), reportAccess: false })}
                  disabled={grant.isPending || !tutorId}
                  className="text-[12px] text-terra hover:underline"
                >
                  收回权限
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-[12px] text-olive-mute hover:text-olive">
                取消
              </button>
            </span>
            {grant.error && <span className="mt-1 block text-[11px] text-terra">{grant.error.message}</span>}
          </div>,
          document.body,
        )}
    </span>
  );
}
