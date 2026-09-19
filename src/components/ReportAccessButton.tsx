import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * V54 · 报告推送开关（伴学师/管理员）：默认测评完家长不可见，点「推送报告」后家长可直接查看全部报告；
 * 已推送时可收回。伴学师只能操作自己名下的学员（后端校验）。
 */
export default function ReportAccessButton({
  userId,
  released,
  compact = false,
}: {
  userId: number;
  released: boolean;
  /** icon 模式（伴学学员卡）或文字模式（后台列表行） */
  compact?: boolean;
}) {
  const [confirmRecall, setConfirmRecall] = useState(false);
  const utils = trpc.useUtils();
  const setAccess = trpc.coach.setReportAccess.useMutation({
    onSuccess: () => {
      setConfirmRecall(false);
      utils.coach.myStudents.invalidate();
    },
  });
  const errMsg = setAccess.error?.message;

  if (!released) {
    return (
      <span onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          title="推送后家长可直接查看全部测评报告"
          disabled={setAccess.isPending}
          onClick={() => setAccess.mutate({ userId, released: true })}
          className={
            compact
              ? "rounded-lg p-1.5 text-olive-mute transition-colors hover:bg-lime-pale hover:text-olive disabled:opacity-50"
              : "rounded-lg bg-olive px-3 py-1.5 text-[12.5px] font-semibold text-cream hover:bg-lime disabled:opacity-50"
          }
        >
          {compact ? <Send size={15} /> : setAccess.isPending ? "推送中…" : "推送报告"}
        </button>
        {errMsg && <span className="ml-1.5 text-[11px] text-terra">{errMsg}</span>}
      </span>
    );
  }

  if (confirmRecall) {
    return (
      <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11.5px] text-olive-mute">收回后家长将看不到报告，确认？</span>
        <button
          type="button"
          disabled={setAccess.isPending}
          onClick={() => setAccess.mutate({ userId, released: false })}
          className="rounded-lg bg-terra px-2 py-1 text-[11.5px] font-semibold text-cream disabled:opacity-50"
        >
          {setAccess.isPending ? "…" : "确认收回"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmRecall(false)}
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
        title="报告已推送给家长，点击可收回"
        onClick={() => setConfirmRecall(true)}
        className={
          compact
            ? "rounded-lg bg-lime-pale p-1.5 text-[#4e7d20] transition-colors hover:bg-lime/30"
            : "inline-flex items-center gap-1 rounded-lg border border-lime/60 bg-lime-pale px-3 py-1.5 text-[12.5px] font-semibold text-[#4e7d20] hover:bg-lime/20"
        }
      >
        <CheckCircle2 size={compact ? 15 : 13} />
        {!compact && "已推送"}
      </button>
    </span>
  );
}
