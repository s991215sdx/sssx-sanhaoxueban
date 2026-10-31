/**
 * 家长扫码填写页（v238，公开路由 /f/<家庭码>）
 *
 * 爸爸、妈妈扫的是同一张码：能看到「正在填谁家的问卷」，但看不到孩子的任何测评结果。
 * 填完直接落到孩子账号里，家长不需要注册、不需要登录。
 *
 * 一个孩子可能被两三位家人各填一份，页面上会显示「爸爸已填 / 妈妈还没填」，
 * 后到的人一眼知道自己这一份是补哪一块。
 */
import { useState } from "react";
import { useParams } from "react-router";
import { AlertCircle, Check, HeartHandshake } from "lucide-react";
import { trpc } from "@/providers/trpc";
import FamilyQuiz, { type ParentRespondent } from "@/components/family/FamilyQuiz";
import { normalizeFamilyCode } from "@contracts/familyCode";

export default function FamilyJoin() {
  const { code = "" } = useParams();
  const normalized = normalizeFamilyCode(code);
  const utils = trpc.useUtils();
  const info = trpc.assessment.familyCodeInfo.useQuery({ code: normalized }, { retry: false });
  const [finished, setFinished] = useState(false);
  /* 刚提交的是哪位：refetch 回来之前先本地标上，不然家长交完就看到自己那格「还没填」 */
  const [sentBy, setSentBy] = useState<ParentRespondent | null>(null);

  if (info.isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-4">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        <p className="mono text-sm text-olive-mute">正在打开家庭问卷…</p>
      </div>
    );
  }

  if (info.error || !info.data?.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
        <div className="paper-card w-full max-w-sm p-8 text-center">
          <AlertCircle className="mx-auto text-olive-mute" size={34} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">这张码用不了</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">
            可能已经换过新码，或者链接少了几位。让孩子打开「家庭教育测评」重新给你看一眼二维码就行。
          </p>
        </div>
      </div>
    );
  }

  const { childAlias, grade, filled } = info.data;
  /* 「其他家人」可能有爷爷、姑姑，称谓以自己填的为准；没填过就只列爸爸、妈妈两格 */
  const otherLabels = filled.filter((p) => p.respondent === "other").map((p) => p.label || "其他家人");
  const rows = [
    { key: "dad", label: "爸爸", done: filled.some((p) => p.respondent === "dad") || sentBy === "dad" },
    { key: "mom", label: "妈妈", done: filled.some((p) => p.respondent === "mom") || sentBy === "mom" },
    ...(otherLabels.length > 0 || sentBy === "other"
      ? [{ key: "other", label: otherLabels[0] ?? "其他家人", done: true }]
      : []),
  ];

  if (finished) {
    /* 点「先不测了」也会走到这一屏：没交上就不能说「收到了」，否则家长以为填完了、其实一条没落库 */
    const submitted = sentBy != null;
    return (
      <div className="flex min-h-screen flex-col items-center bg-cream px-4 py-10">
        <div className="w-full max-w-md">
          <div className="paper-card p-7 text-center">
            <Check className={`mx-auto ${submitted ? "text-[#2F7A41]" : "text-olive-mute"}`} size={36} />
            <h1 className="mt-3 text-[19px] font-bold text-olive">
              {submitted ? "这一份收到了" : "这次先不填也没关系"}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
              {submitted
                ? `答案已经交到 ${childAlias} 的账号里。另一位家长可以扫同一张码接着填——两个人分开填，报告里才能看出你俩本身哪里说得不一样。`
                : `刚才那份没有交上去，所以什么都没记录。这张码一直有效，等你有空再扫一次，从头填也可以。`}
            </p>
            {submitted && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {rows.map((p) => (
                  <span
                    key={p.key}
                    className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${
                      p.done ? "bg-lime-pale text-olive" : "border border-dashed border-border text-olive-mute"
                    }`}
                  >
                    {p.label}
                    {p.done ? " 已填" : " 还没填"}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="mt-6 text-center mono text-[10.5px] tracking-wider text-olive-mute/70">好好学习 · 天天向上</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        {/* 认人：只给「X同学 + 年级」，够家长确认是不是自家孩子，不多露一分 */}
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-lime/50 bg-lime-pale/50 px-4 py-3">
          <HeartHandshake size={20} className="mt-0.5 shrink-0 text-olive" />
          <div className="min-w-0">
            <p className="text-[14.5px] font-bold text-olive">
              正在填写 {childAlias}（{grade}）的家庭问卷
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-olive-soft">
              不是你家孩子？关掉这个页面就好，不用填。
            </p>
          </div>
        </div>

        <FamilyQuiz
          kind="familyparent"
          guestCode={normalized}
          onDone={(who) => {
            setSentBy(who ?? null);
            setFinished(true);
            void utils.assessment.familyCodeInfo.invalidate();
          }}
        />

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-olive-mute">
          这份问卷不需要注册，也不会把结果发给其他家长。
        </p>
      </div>
    </div>
  );
}
