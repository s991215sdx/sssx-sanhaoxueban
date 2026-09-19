import { useState } from "react";
import { FileLock2, Send, CheckCircle2 } from "lucide-react";
import { trpc } from "@/providers/trpc";

/** 报告未开放时的提示面板，家长/学员可一键请伴学师推送 */
export function ReportLockedPanel({ what = "这份报告" }: { what?: string }) {
  const request = trpc.profile.requestReportPush.useMutation();
  const [sent, setSent] = useState(false);

  if (sent || request.isSuccess) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[#c7a23a99] bg-[#f9f1da] p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[#8a6d1a]" />
        <p className="mt-3 font-medium text-[#6b5410]">已请伴学师推送</p>
        <p className="mt-1 text-sm text-[#8a6d1a]">
          伴学师会尽快整理并推送{what}，推送完成后即可查看；也可以直接联系伴学师。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[#d9cfba] bg-white p-8 text-center">
      <FileLock2 className="mx-auto h-10 w-10 text-[#8a6d1a]" />
      <p className="mt-3 font-medium text-[#333333]">{what}暂未开放查看</p>
      <p className="mt-1 text-sm leading-relaxed text-[#666666]">
        报告由伴学师测评解读并整理后推送。点击下方按钮请伴学师推送，完成后会通知你查看。
      </p>
      <button
        onClick={() =>
          request.mutate(undefined, {
            onSuccess: () => setSent(true),
            onError: (e) => alert(`发送失败：${e.message}`),
          })
        }
        disabled={request.isPending}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#3C2E25] px-5 py-2.5 text-sm text-white hover:bg-[#2c211a] disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {request.isPending ? "发送中…" : "请伴学师推送报告"}
      </button>
    </div>
  );
}
