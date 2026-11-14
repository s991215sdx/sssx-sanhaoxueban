/**
 * 候选人扫码答题页（v253，公开路由 /t/<邀请码>）。
 *
 * 三条规矩：
 *  1) 进来先说清「谁请你答、答哪个岗、要多久」——候选人没有账号，不能自己挑岗位；
 *  2) 答完不给他看分数。自评分数当场摆在候选人面前，他下一份就会按岗位调答案，
 *     这个工具也就废了。报告只回发起人那边；
 *  3) 全程不要注册、不要登录，填个姓名就能开始。多一道手续，回收率掉一半。
 */
import { useState } from "react";
import { useParams } from "react-router";
import { AlertCircle, ArrowRight, Check, Clock } from "lucide-react";
import { trpc } from "@/providers/trpc";
import TalentQuiz, { type PaperPart, type TalentAnswerPayload } from "@/components/talent/TalentQuiz";

export default function TalentJoin() {
  const { code = "" } = useParams();
  const info = trpc.talent.inviteInfo.useQuery({ code }, { retry: false });
  const [name, setName] = useState("");
  const [started, setStarted] = useState(false);
  const [sent, setSent] = useState(false);

  const paper = trpc.talent.paper.useQuery(
    { position: info.data?.position ?? "sales" },
    { enabled: started && !!info.data, retry: false },
  );
  const submit = trpc.talent.submit.useMutation({ onSuccess: () => setSent(true) });

  if (info.isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-4">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
        <p className="mono text-[13px] text-olive-mute">正在打开测评…</p>
      </div>
    );
  }

  if (info.error || !info.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4">
        <div className="paper-card w-full max-w-sm p-8 text-center">
          <AlertCircle className="mx-auto text-olive-mute" size={34} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">这张链接用不了</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-olive-mute">
            可能已经过期（一张码认 7 天），或者链接少了几位。请让联系你的 HR 重新发一张。
          </p>
        </div>
      </div>
    );
  }

  const { positionLabel, inviterName, orgName, minutes } = info.data;

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4">
        <div className="paper-card w-full max-w-md p-8 text-center">
          <Check className="mx-auto text-brand" size={36} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">已经交上去了</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-olive-soft">
            {name || "你"}的这份「{positionLabel}」评估已经交给 {inviterName}，接下来会有人和你联系。
            这一页可以关掉了。
          </p>
          <p className="mt-4 text-[11.5px] leading-relaxed text-olive-mute">
            说明：这份评估用于了解你的工作方式与岗位匹配情况，不作为录用或淘汰的唯一依据；
            结果由用人方与你当面沟通。
          </p>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
        <div className="w-full max-w-md">
          <div className="paper-card p-6">
            <div className="mono text-[11px] font-bold tracking-wider text-olive-mute">岗位评估 · {positionLabel}</div>
            <h1 className="mt-2 text-[20px] font-bold leading-snug text-olive">
              {inviterName} 请你做一份
              <br />
              岗位适配评估
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-olive-soft">
              {orgName ? `${orgName} · ` : ""}共 5 段、约 {minutes} 分钟。没有对错，按你平时真实的做法选就行——
              答得「标准」，只会得到一份谁都能用的通用结论。
            </p>
            <div className="mono mt-3 flex items-center gap-1.5 text-[11.5px] text-olive-mute">
              <Clock size={12} /> 建议一次做完，中途退出进度会留在这台手机上
            </div>

            <label className="mt-5 block text-[12px] font-medium text-olive-soft">你的姓名（方便 HR 对上是哪一位）</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              placeholder="例如：王小雨"
              className="mt-1.5 w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-[14px] text-olive outline-none transition-colors focus:border-brand"
            />
            <button
              type="button"
              disabled={name.trim().length < 1}
              onClick={() => setStarted(true)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep disabled:opacity-40"
            >
              开始 <ArrowRight size={15} />
            </button>
            <p className="mt-3 text-[10.5px] leading-relaxed text-olive-mute">
              不需要注册。填的姓名只用于让 HR 认出这份答卷是谁的。
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (paper.isLoading || !paper.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-4">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
        <p className="mono text-[13px] text-olive-mute">正在出卷…</p>
      </div>
    );
  }

  const onDone = (answers: TalentAnswerPayload) =>
    submit.mutate({ code, name: name.trim(), position: paper.data.position, answers: { ...answers } });

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="mono text-[11px] font-bold tracking-wider text-olive-mute">
            {positionLabel} · 岗位适配评估
          </div>
          <div className="mono text-[11px] text-olive-mute">{inviterName} 邀请</div>
        </div>
        {submit.error && (
          <div className="mb-3 rounded-xl border border-terra/40 bg-butter-pale/60 px-3.5 py-2.5 text-[12.5px] text-olive">
            交卷没成功：{submit.error.message}
          </div>
        )}
        <TalentQuiz
          parts={paper.data.parts as PaperPart[]}
          storageKey={`talent-invite-${code}`}
          submitting={submit.isPending}
          submitLabel="交卷"
          onSubmit={onDone}
          note="答完直接交，不用注册。"
        />
      </div>
    </div>
  );
}
