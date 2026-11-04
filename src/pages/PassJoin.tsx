/**
 * 测评码扫码页（v239，公开路由 /p/<码>）
 *
 * 两种人扫同一张码，走两条路：
 *  - 孩子本人：换一个 2 小时的短会话，直接进测评中心开答——那份卷要读写档案、要出现在报告里，
 *    只有以本人身份答，后面的报告、练习、复测才对得上。
 *  - 家长：当场在这页填，交上来落到孩子名下，全程不给账号态。
 *    家长不该因为一支问卷就看到孩子的心理筛查和自评。
 *
 * 页面上只认人、不露数据：显示「X同学（初一）」，不显示姓名全称，也不显示任何既往结果。
 */
import { useState } from "react";
import { useParams } from "react-router";
import { AlertCircle, Check, Loader2, QrCode, UserCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import FamilyQuiz from "@/components/family/FamilyQuiz";
import E3ParentQuiz from "@/components/companion/E3ParentQuiz";
import DiscParentQuiz from "@/components/companion/DiscParentQuiz";
import { normalizePassCode } from "@contracts/passCode";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">{children}</div>
      <p className="mt-6 text-center mono text-[10.5px] tracking-wider text-olive-mute/70">好好学习 · 天天向上</p>
    </div>
  );
}

export default function PassJoin() {
  const { code = "" } = useParams();
  const normalized = normalizePassCode(code);
  const utils = trpc.useUtils();
  const info = trpc.assessment.passInfo.useQuery({ code: normalized }, { retry: false });
  const redeem = trpc.assessment.redeemPass.useMutation();
  const [finished, setFinished] = useState(false);
  /* 点「先不测了」也会走到收尾屏：没交上就不能说「收到了」，那是比不提示更糟的一句话 */
  const [cancelled, setCancelled] = useState(false);
  const [received, setReceived] = useState<number | null>(null);

  if (info.isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-4">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        <p className="mono text-sm text-olive-mute">正在打开测评…</p>
      </div>
    );
  }

  if (info.error || !info.data?.ok) {
    return (
      <Shell>
        <div className="paper-card p-8 text-center">
          <AlertCircle className="mx-auto text-olive-mute" size={34} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">这张码用不了</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">
            码大约 12 小时有效，过期、或者链接少了几位，都会打不开。让伴学师在电脑上重新点一次「去做测评」，再扫一次就好。
          </p>
        </div>
      </Shell>
    );
  }

  const { def, kind, childAlias, grade, received: already } = info.data;
  const isParent = def.who === "parent";

  /* ------- 家长填完 ------- */
  if (finished) {
    return (
      <Shell>
        <div className="paper-card p-7 text-center">
          <Check className={`mx-auto ${cancelled ? "text-olive-mute" : "text-[#2F7A41]"}`} size={36} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">
            {cancelled ? "这次先不填也没关系" : "这份收到了"}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
            {cancelled
              ? "刚才那份没有交上去，所以什么都没记录。这张码还有效，等有空再扫一次，从头填也可以。"
              : `答案已经交到 ${childAlias} 的档案里，伴学师和孩子都能在报告里看到。${
                  def.kind === "familyparent" || def.kind === "discparent"
                    ? "另一位家长可以扫同一张码再填一份——两个人分开填，才看得出你们各自怎么看。"
                    : ""
                }`}
          </p>
          {!cancelled && received != null && (
            <p className="mt-3 text-[12.5px] text-olive-mute">这张码上已经收到 {received} 份。</p>
          )}
        </div>
      </Shell>
    );
  }

  /* ------- 孩子本人：先认人，再换短会话 ------- */
  if (!isParent) {
    return (
      <Shell>
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-lime/50 bg-lime-pale/50 px-4 py-3">
          <UserCheck size={20} className="mt-0.5 shrink-0 text-olive" />
          <div className="min-w-0">
            <p className="text-[14.5px] font-bold text-olive">
              这份测评是 {childAlias}（{grade || "年级未填"}）的
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-olive-soft">
              不是你自己？关掉这个页面就好，不用点。
            </p>
          </div>
        </div>

        <div className="paper-card p-6">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-olive" />
            <h2 className="text-lg font-bold text-olive">{def.name}</h2>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">{def.brief}</p>
          <p className="mt-1 text-[12.5px] text-olive-mute">约 {def.minutes} 分钟 · 答完自动进你的报告</p>

          <button
            onClick={() =>
              redeem.mutate(
                { code: normalized },
                {
                  onSuccess: (r) => {
                    /* 换完会话要整页重开：登录态在 trpc/auth 里缓存着，软跳转会带着旧身份渲染 */
                    window.location.replace(`/assessments?start=${r.start}`);
                  },
                },
              )
            }
            disabled={redeem.isPending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15.5px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-60"
          >
            {redeem.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            {redeem.isPending ? "正在进入…" : `我是 ${childAlias}，开始作答`}
          </button>

          {redeem.isError && (
            <p className="mt-3 rounded-xl border border-terra/40 bg-terra/10 px-3 py-2 text-[13px] leading-relaxed text-terra">
              {redeem.error.message}
            </p>
          )}

          <p className="mt-3 text-[11.5px] leading-relaxed text-olive-mute">
            点下去会用 {childAlias} 的账号进入，2 小时后自动退出。如果这台手机上正登着别的账号，会被换成
            {childAlias} 的。
          </p>
        </div>
      </Shell>
    );
  }

  /* ------- 家长：就地作答 ------- */
  const onDone = (payload?: { received?: number }) => {
    setReceived(payload?.received ?? already + 1);
    setFinished(true);
    void utils.assessment.passInfo.invalidate();
  };

  return (
    <Shell>
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-lime/50 bg-lime-pale/50 px-4 py-3">
        <QrCode size={20} className="mt-0.5 shrink-0 text-olive" />
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold text-olive">
            正在填写 {childAlias}（{grade || "年级未填"}）的{def.name}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-olive-soft">
            {def.brief} · 约 {def.minutes} 分钟。不需要注册，答完直接进孩子的档案。
          </p>
        </div>
      </div>

      {kind === "familyparent" && (
        <FamilyQuiz
          kind="familyparent"
          guestCode={normalized}
          onDone={(who) => {
            setCancelled(!who);
            onDone();
          }}
        />
      )}
      {kind === "e3parent" && <E3ParentQuiz guestCode={normalized} onDone={() => onDone()} />}
      {kind === "discparent" && <DiscParentQuiz guestCode={normalized} onDone={() => onDone()} />}

      <p className="mt-5 text-center text-[11.5px] leading-relaxed text-olive-mute">
        这份问卷不会看到孩子的任何测评结果，也不会发给其他家长。
      </p>
    </Shell>
  );
}
