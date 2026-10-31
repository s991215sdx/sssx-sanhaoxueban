/**
 * 家庭教育测评 · 学生端引导页（v238）
 *
 * 一份测评两头做：孩子答 14 题（他自己的那份），爸妈扫同一张码各答 29 题。
 * 这一页只负责把两件事串起来——先把「我的」做完，再让爸妈扫码；做完两侧才出对照。
 *
 * 不做成「必须按顺序」的强制流程：家长今天没空、明天再填都很常见，
 * 所以码一直挂在页面上，随时可以回来接着推进。
 */
import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ChevronRight, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import FamilyQuiz from "./FamilyQuiz";
import FamilyCodeCard from "./FamilyCodeCard";

const BAND_TEXT: Record<string, string> = { 断: "走不通", 勉强: "勉强", 通: "通", 稳: "稳" };

export default function FamilySuite({ onExit }: { onExit: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.family.useQuery(undefined, { retry: false });
  const [doing, setDoing] = useState(false);

  if (doing) {
    return (
      <FamilyQuiz
        kind="familystudent"
        onDone={() => {
          setDoing(false);
          void utils.assessment.family.invalidate();
        }}
      />
    );
  }

  if (isLoading) {
    return <div className="paper-card h-52 animate-pulse bg-cream-deep/50" />;
  }

  const student = data?.student ?? null;
  const hasParent = !!data?.has.parent;
  const broken = (student?.ladder ?? []).filter((l) => l.band === "断");
  const shaky = (student?.ladder ?? []).filter((l) => l.band === "勉强");

  return (
    <div className="space-y-4">
      <button onClick={onExit} className="flex items-center gap-1 text-[13px] text-olive-mute hover:text-olive">
        <ArrowLeft size={15} />
        返回测评中心
      </button>

      <div className="paper-card p-5">
        <h2 className="text-[19px] font-bold text-olive">家庭教育测评</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
          同一件事，你说「走不通」、爸妈说「还行」，家里就会反复吵同一架。这份测评把两边分开问，
          再放在一起看——不是为了评谁对谁错，是为了找出哪几件事你们理解得不一样。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-olive-mute">
          <span className="rounded-full bg-cream px-2.5 py-1">你答 14 题 · 约 3 分钟</span>
          <span className="rounded-full bg-cream px-2.5 py-1">爸妈各答 29 题 · 约 6 分钟</span>
          <span className="rounded-full bg-cream px-2.5 py-1">两边都做完才出对照</span>
        </div>
      </div>

      {/* 第一块：我的那份 */}
      <div className="paper-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15.5px] font-bold text-olive">1 · 我的那份</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">
              五级台阶（你和爸妈之间哪一级走不通）、你怎么看爸妈、安全感、最容易吵的那件事。
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${student ? "bg-lime-pale text-olive" : "border border-dashed border-border text-olive-mute"}`}>
            {student ? "已完成" : "未开始"}
          </span>
        </div>

        {student && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {student.ladder.map((l) => (
              <span
                key={l.level}
                className={`rounded-lg px-2 py-1 text-[11.5px] font-medium ${
                  l.band === "断"
                    ? "bg-terra/10 text-terra"
                    : l.band === "勉强"
                      ? "bg-butter-pale text-[#8A5A16]"
                      : "bg-cream text-olive-mute"
                }`}
              >
                L{l.level.slice(1)} {BAND_TEXT[l.band] ?? l.band}
              </span>
            ))}
          </div>
        )}

        {student && (broken.length > 0 || shaky.length > 0) && (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-olive-soft">
            {broken.length > 0
              ? `${broken.map((b) => b.level).join("、")} 这几级现在走不通——报告里会讲怎么接回来。`
              : `${shaky.map((b) => b.level).join("、")} 这一级是勉强的，还不算断。`}
          </p>
        )}

        <button
          onClick={() => setDoing(true)}
          className="mt-3.5 w-full rounded-xl bg-brand py-3 text-[14px] font-semibold text-cream hover:bg-lime"
        >
          {student ? "重新答一遍（覆盖上次）" : "开始答题"}
        </button>
      </div>

      {/* 第二块：爸妈那份（扫码） */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <Users size={15} className="text-olive" />
          <h3 className="text-[15.5px] font-bold text-olive">2 · 爸妈的那份</h3>
          {hasParent && <span className="rounded-full bg-lime-pale px-2 py-0.5 text-[11.5px] font-semibold text-olive">已收到</span>}
        </div>
        <FamilyCodeCard />
      </div>

      {/* 第三块：报告 */}
      <div className="paper-card flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-bold text-olive">家庭教育报告</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-olive-mute">
            {student && hasParent
              ? "两边都答完了，可以看五级台阶、六项盲区和九十天行动。"
              : "报告要两边都答完才出对照；现在也可以先看你这一侧的结果。"}
          </p>
        </div>
        <Link
          to="/report-detail?tab=family"
          className="flex shrink-0 items-center gap-0.5 rounded-xl border border-lime/60 bg-lime-pale px-3.5 py-2 text-[13px] font-semibold text-olive no-underline hover:bg-butter/25"
        >
          去看
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
