import { useState } from "react";
import { KeyRound } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * V53 · 重置学员登录密码（伴学师/管理员）：两步确认，重置后默认 123456。
 * 伴学师只能重置自己名下的学员（后端校验）；管理员可重置任意学员。
 */
export default function ResetPasswordButton({
  userId,
  name,
  compact = false,
}: {
  userId: number;
  name?: string;
  /** icon 模式（学员卡右上角）或文字模式（后台列表行） */
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const reset = trpc.coach.resetStudentPassword.useMutation({
    onSuccess: () => {
      setConfirming(false);
      setDone(true);
      window.setTimeout(() => setDone(false), 5000);
    },
    onError: () => {
      setConfirming(false);
    },
  });
  const errMsg = reset.error?.message;

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-lime-pale px-2 py-1 text-[11.5px] font-semibold text-[#4e7d20]">
        <KeyRound size={12} />
        已重置为 123456
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11.5px] text-olive-mute">
          {compact ? "" : `重置${name ?? "该学员"}的密码为 123456？`}
          {compact ? "重置为 123456？" : ""}
        </span>
        <button
          type="button"
          disabled={reset.isPending}
          onClick={() => reset.mutate({ userId })}
          className="rounded-lg bg-olive px-2 py-1 text-[11.5px] font-semibold text-cream hover:bg-lime disabled:opacity-50"
        >
          {reset.isPending ? "重置中…" : "确认重置"}
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
        title="重置登录密码（重置后为默认密码 123456）"
        onClick={() => setConfirming(true)}
        className={
          compact
            ? "rounded-lg p-1.5 text-olive-mute transition-colors hover:bg-lime-pale hover:text-olive"
            : "rounded-lg border border-border bg-cream px-3 py-1.5 text-[12.5px] font-medium text-olive hover:border-lime"
        }
      >
        {compact ? <KeyRound size={15} /> : "重置密码"}
      </button>
      {errMsg && <span className="ml-1.5 text-[11px] text-terra">{errMsg}</span>}
    </span>
  );
}
