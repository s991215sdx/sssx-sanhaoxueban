/**
 * 人才测评答题页（v253，登录态）。
 *
 * 只做三件事：把卷子取回来、把答案交上去、跳到报告。
 * 答题状态机在 components/talent/TalentQuiz 里，扫码那条路径也用它——两条入口不该有两套手感。
 */
import { useNavigate, useSearchParams } from "react-router";
import { AlertCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import TalentQuiz, { type PaperPart, type TalentAnswerPayload } from "@/components/talent/TalentQuiz";

export default function TalentQuizPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const position = sp.get("position") ?? "sales";
  const paper = trpc.talent.paper.useQuery({ position }, { retry: false });
  const submit = trpc.talent.submit.useMutation({
    onSuccess: (r) => {
      try {
        localStorage.removeItem(`talent-draft-${position}`);
      } catch {
        /* 清不掉不影响结果 */
      }
      navigate(`/talent/report/${r.id}`, { replace: true });
    },
  });

  if (paper.isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
        <p className="mono text-[12px] text-olive-mute">正在出卷…</p>
      </div>
    );
  }

  if (paper.error || !paper.data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="paper-card p-7 text-center">
          <AlertCircle className="mx-auto text-olive-mute" size={32} />
          <h1 className="mt-3 text-[17px] font-bold text-olive">卷子没取到</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-olive-mute">刷新一下再试；如果一直不行，把这段错误发给技术：{paper.error?.message ?? "无数据"}</p>
        </div>
      </div>
    );
  }

  const onDone = (answers: TalentAnswerPayload) =>
    submit.mutate({ position, answers: { ...answers } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <header className="mb-4">
        <div className="mono text-[11px] font-bold tracking-wider text-olive-mute">人才测评 · {paper.data.positionLabel}</div>
        <h1 className="mt-1 text-[21px] font-bold tracking-tight text-olive">按工作中真实的你作答</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-olive-soft">
          没有对错，也不是考试。越接近真实情况，报告里的建议越有用；答得「标准」，只会得到一份谁都能用的通用结论。
        </p>
      </header>

      {submit.error && (
        <div className="mb-3 rounded-xl border border-terra/40 bg-butter-pale/60 px-3.5 py-2.5 text-[12.5px] text-olive">
          交卷没成功：{submit.error.message}
        </div>
      )}

      <TalentQuiz
        parts={paper.data.parts as PaperPart[]}
        storageKey={`talent-draft-${position}`}
        submitting={submit.isPending}
        onSubmit={onDone}
        note="中途退出不会丢：答题进度存在这台设备上，回来接着答。"
      />
    </div>
  );
}
