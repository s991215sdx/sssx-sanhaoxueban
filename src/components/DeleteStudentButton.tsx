import { useState } from "react";
import { Trash2 } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * v96 · 删除学员（伴学师/管理员）：两步确认。软删——学员立即从列表消失、无法登录，
 * 数据在回收站保留 2 个月，期间可恢复，到期自动物理清除。
 * 伴学师只能删自己名下的学员（后端校验）；管理员可删本机构任意学员。
 */
export default function DeleteStudentButton({
  userId,
  name,
  compact = false,
}: {
  userId: number;
  name?: string;
  /** icon 模式（学员卡右上角）或文字模式（后台列表行） */
  compact?: boolean;
}) {
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const del = trpc.coach.deleteStudent.useMutation({
    onSuccess: () => {
      setConfirming(false);
      setDone(true);
      window.setTimeout(() => setDone(false), 4000);
      void utils.coach.myStudents.invalidate();
      void utils.admin.students.invalidate();
    },
    onError: () => {
      setConfirming(false);
    },
  });
  const errMsg = del.error?.message;

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-[#FAF2E4] px-2 py-1 text-[11.5px] font-semibold text-[#A82524]">
        <Trash2 size={12} />
        已移入回收站
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11.5px] text-olive-mute">
          {compact ? "" : `删除${name ?? "该学员"}？`}移入回收站，保留 2 个月，期间可恢复——确认删除？
        </span>
        <button
          type="button"
          disabled={del.isPending}
          onClick={() => del.mutate({ userId })}
          className="rounded-lg bg-[#A82524] px-2 py-1 text-[11.5px] font-semibold text-white hover:bg-[#DD3534] disabled:opacity-50"
        >
          {del.isPending ? "删除中…" : "确认删除"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-border px-2 py-1 text-[11.5px] text-olive-mute hover:text-olive"
        >
          取消
        </button>
      </span>
    );
  }

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="删除学员（移入回收站，保留 2 个月，期间可在回收站恢复）"
        onClick={() => setConfirming(true)}
        className={
          compact
            ? "rounded-lg p-1.5 text-olive-mute transition-colors hover:bg-[#FAF2E4] hover:text-[#A82524]"
            : "rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium text-[#A82524] whitespace-nowrap transition-colors hover:border-[#DD3534]/50 hover:bg-[#FAF2E4]"
        }
      >
        {compact ? <Trash2 size={15} /> : "删除学员"}
      </button>
      {errMsg && <span className="ml-1.5 text-[11px] text-terra">{errMsg}</span>}
    </span>
  );
}
