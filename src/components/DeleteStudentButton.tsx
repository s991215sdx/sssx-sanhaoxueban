import { useState } from "react";
import { Trash2 } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * v96 · 删除学员（伴学师/管理员）：两步确认。软删——学员立即从列表消失、无法登录，
 * 数据在回收站保留 2 个月，期间可恢复，到期自动物理清除。
 * 伴学师只能删自己名下的学员（后端校验）；管理员可删本机构任意学员。
 * v201：语义改为「移出机构」——若该账号（同手机号）还在其他机构，本次只移出本机构，
 * 其他机构账号不受影响；无机构账号/非学员角色后端直接拒绝。
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
  const [done, setDone] = useState<string | null>(null);
  const del = trpc.coach.deleteStudent.useMutation({
    onSuccess: (res) => {
      setConfirming(false);
      setDone(
        res.removedOrgOnly
          ? `已移出本机构（该账号还在：${res.siblingOrgs.join("、")}，不受影响）`
          : "已移出本机构（移入回收站，2 个月内可恢复）",
      );
      window.setTimeout(() => setDone(null), 5000);
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
        {done}
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11.5px] text-olive-mute">
          {compact ? "" : `移出${name ?? "该学员"}？`}移出本机构，本机构内立即无法登录，数据保留 2 个月可恢复；若账号还在其他机构则不受影响——确认移出？
        </span>
        <button
          type="button"
          disabled={del.isPending}
          onClick={() => del.mutate({ userId })}
          className="rounded-lg bg-[#A82524] px-2 py-1 text-[11.5px] font-semibold text-white hover:bg-[#DD3534] disabled:opacity-50"
        >
          {del.isPending ? "移出中…" : "确认移出"}
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
        title="移出本机构（数据进回收站保留 2 个月可恢复；多机构账号只移出本机构）"
        onClick={() => setConfirming(true)}
        className={
          compact
            ? "rounded-lg p-1.5 text-olive-mute transition-colors hover:bg-[#FAF2E4] hover:text-[#A82524]"
            : "rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium text-[#A82524] whitespace-nowrap transition-colors hover:border-[#DD3534]/50 hover:bg-[#FAF2E4]"
        }
      >
        {compact ? <Trash2 size={15} /> : "移出机构"}
      </button>
      {errMsg && <span className="ml-1.5 text-[11px] text-terra">{errMsg}</span>}
    </span>
  );
}
