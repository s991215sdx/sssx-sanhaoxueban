import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  MBTI_QUESTIONS,
  DISC_QUESTIONS,
  E3V27_QUESTIONS,
  E3V27_MOTIVATION_OPTIONS,
  E3V27_OPEN_QUESTIONS,
  type E3V27Input,
  type E3V27Stage,
} from "@contracts/assessments";
import {
  E3V37_QUESTIONS,
  E3V37_MOTIVATION_OPTIONS,
  E3V37_LIFE_EVENTS,
  E3V37_OPEN_QUESTIONS,
  E3V37_RATING_COUNT,
  type E3V37Input,
  type E3V37Stage,
} from "@contracts/e3v37";
import { MULTI_RATINGS } from "@contracts/multi";
import { MULTI5_QUESTIONS, MULTI5_DIM_LABEL } from "@contracts/multi5";

const LIFE_EVENT_LEVEL = ["没发生", "轻度", "中度", "重度"] as const;

/** 各 Likert 量表 1-5 分选项文案（与作答端按钮一致）。 */
const FREQ5 = ["从不", "很少", "有时", "经常", "总是"] as const;
const FIT5 = ["完全不符合", "不太符合", "一般", "比较符合", "完全符合"] as const;

/** 二选一（mbti/disc）逐题明细：选中的选项高亮。 */
function ChoiceDetail({ kind, answers }: { kind: "mbti" | "disc"; answers: number[] }) {
  const questions = kind === "mbti" ? MBTI_QUESTIONS : DISC_QUESTIONS;
  return (
    <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
      {questions.map((q, i) => {
        const picked = answers[i];
        return (
          <div key={i} className="rounded-xl border border-cream-deep bg-cream/60 px-3 py-2.5">
            <div className="text-[12.5px] font-medium text-olive">
              <span className="mono mr-1.5 text-olive-mute">{i + 1}.</span>
              {q.text}
            </div>
            <div className="mt-1.5 space-y-1">
              {([q.a, q.b] as const).map((opt, j) => (
                <div
                  key={j}
                  className={`rounded px-2 py-1 text-[12.5px] leading-snug ${
                    picked === j
                      ? "border border-lime bg-lime-pale text-olive"
                      : "text-olive-mute opacity-70"
                  }`}
                >
                  {opt}
                  {picked === j && <span className="ml-1.5 text-[11px] font-semibold">✓ 孩子的选择</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Likert 评分题（e3/multi）逐题明细：显示原答案+选项文案；反向题保留原答案并标注换算分。 */
function RatingDetail({
  questions,
  ratings,
  labels,
}: {
  questions: { text: string; reverse: boolean }[];
  ratings: number[];
  labels: readonly string[];
}) {
  return (
    <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
      {questions.map((q, i) => {
        const v = ratings[i];
        const adj = q.reverse ? 6 - v : v;
        return (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-lg bg-cream/60 px-3 py-2 text-[12.5px]"
          >
            <span className="text-olive-soft">
              <span className="mono mr-1.5 text-olive-mute">{i + 1}.</span>
              {q.text}
              {q.reverse && (
                <span className="ml-1.5 rounded bg-butter/60 px-1 py-0.5 text-[10.5px] text-olive-mute">反向计分</span>
              )}
            </span>
            <span className={`shrink-0 font-semibold ${v != null && adj <= 2 ? "text-terra" : "text-olive"}`}>
              {v != null && v >= 1 && v <= 5 ? (
                <>
                  <span className="mono">{v}/5</span> · {labels[v - 1]}
                  {q.reverse && <span className="ml-1 text-[10.5px] text-olive-mute">（计 {adj} 分）</span>}
                </>
              ) : (
                <span className="mono">-</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** E3 V2.7 完整作答明细。 */
function E3Detail({ answers }: { answers: E3V27Input }) {
  const [showNone, setShowNone] = useState(false);
  const stage: E3V27Stage = answers.stage ?? "junior";
  const questions = E3V27_QUESTIONS[stage] ?? E3V27_QUESTIONS.junior;
  const ratingQuestions = questions.filter((q) => q.no <= 73);
  const eventQuestions = questions.filter((q) => q.no > 73);
  const happened = answers.lifeEvents
    .map((v, i) => ({ v, text: eventQuestions[i]?.text ?? "" }))
    .filter((e) => e.v > 0);
  const none = answers.lifeEvents
    .map((v, i) => ({ v, text: eventQuestions[i]?.text ?? "" }))
    .filter((e) => e.v === 0);
  const motivationOpt = E3V27_MOTIVATION_OPTIONS.find((o) => o.key === answers.motivation);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-[13px] font-semibold text-olive">评分题（73 题）</h4>
        <div className="mt-2">
          <RatingDetail questions={ratingQuestions} ratings={answers.ratings} labels={FREQ5} />
        </div>
      </div>

      {motivationOpt && (
        <div>
          <h4 className="text-[13px] font-semibold text-olive">学习状态单选</h4>
          <p className="mt-1.5 rounded-lg border border-lime bg-lime-pale px-3 py-2 text-[12.5px] text-olive">
            {motivationOpt.key} · {motivationOpt.label}：{motivationOpt.text}
          </p>
        </div>
      )}

      {answers.subjects?.length > 0 && (
        <div>
          <h4 className="text-[13px] font-semibold text-olive">学科快扫</h4>
          <div className="mt-1.5 space-y-1.5">
            {answers.subjects.map((sub, i) => (
              <div key={i} className="rounded-lg bg-cream/60 px-3 py-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-olive">{sub.name || "（未填科目名）"}</span>
                  {sub.mastery === 0 && sub.solving === 0 && sub.exam === 0 && sub.attitude === 0 && (
                    <span className="text-[11px] text-olive-mute">未开设</span>
                  )}
                </div>
                {!(sub.mastery === 0 && sub.solving === 0 && sub.exam === 0 && sub.attitude === 0) && (
                  <div className="mono mt-1 text-[11.5px] text-olive-soft">
                    掌握 {sub.mastery} · 解题 {sub.solving} · 发挥 {sub.exam} · 态度 {sub.attitude}
                    {sub.weakest && <span className="ml-2 text-olive-mute">薄弱：{sub.weakest}</span>}
                  </div>
                )}
              </div>
            ))}
            {(answers.lossReasons?.length > 0 || answers.scoreTrend) && (
              <p className="text-[12px] text-olive-mute">
                失分主因：{answers.lossReasons?.join("、") || "未选"}　成绩趋势：{answers.scoreTrend || "未选"}
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-[13px] font-semibold text-olive">生活事件（过去3个月）</h4>
        <div className="mt-1.5 space-y-1.5">
          {happened.length === 0 && <p className="text-[12.5px] text-olive-mute">都没有发生，状态平稳。</p>}
          {happened.map((e, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-cream/60 px-3 py-2 text-[12.5px]">
              <span className="text-olive-soft">{e.text}</span>
              <span className="chip shrink-0 !py-0 text-[11px]">{LIFE_EVENT_LEVEL[e.v] ?? e.v}</span>
            </div>
          ))}
          {none.length > 0 && happened.length > 0 && (
            <div>
              <button
                onClick={() => setShowNone((v) => !v)}
                className="text-[12px] text-olive-mute hover:text-olive"
              >
                {showNone ? "▾ 收起「没发生」" : `▸ 没发生的 ${none.length} 项`}
              </button>
              {showNone && (
                <div className="mt-1 space-y-1">
                  {none.map((e, i) => (
                    <div key={i} className="rounded-lg px-3 py-1.5 text-[12px] text-olive-mute">
                      {e.text} · 没发生
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {answers.openAnswers.some((a) => a?.trim()) && (
        <div>
          <h4 className="text-[13px] font-semibold text-olive">开放问答</h4>
          <div className="mt-1.5 space-y-2">
            {E3V27_OPEN_QUESTIONS.map((q, i) =>
              answers.openAnswers[i]?.trim() ? (
                <div key={i} className="rounded-lg bg-cream/60 px-3 py-2">
                  <div className="text-[12px] text-olive-mute">{q}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{answers.openAnswers[i]}</p>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 判定 V3.7 作答：70 道评分题（V2.7 为 73 题）。 */
function isE3V37Input(a: unknown): a is E3V37Input {
  return !!a && typeof a === "object" && Array.isArray((a as E3V37Input).ratings) && (a as E3V37Input).ratings.length === E3V37_RATING_COUNT;
}

/** E3 V3.7（三阶九能）完整作答明细。 */
function E3V37Detail({ answers }: { answers: E3V37Input }) {
  const [showNone, setShowNone] = useState(false);
  const stage: E3V37Stage = answers.stage ?? "junior";
  const questions = E3V37_QUESTIONS[stage] ?? E3V37_QUESTIONS.junior;
  const lifeEvents = E3V37_LIFE_EVENTS[stage] ?? E3V37_LIFE_EVENTS.junior;
  const happened = (answers.lifeEvents ?? [])
    .map((v, i) => ({ v, text: lifeEvents[i]?.text ?? "" }))
    .filter((e) => e.v > 0);
  const none = (answers.lifeEvents ?? [])
    .map((v, i) => ({ v, text: lifeEvents[i]?.text ?? "" }))
    .filter((e) => e.v === 0);
  const motivationOpt = E3V37_MOTIVATION_OPTIONS.find((o) => o.key === answers.motivation);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-[13px] font-semibold text-olive">评分题（70 题，68-70 为学能三项·单独报告不进总分）</h4>
        <div className="mt-2">
          <RatingDetail questions={questions} ratings={answers.ratings} labels={FREQ5} />
        </div>
      </div>

      {motivationOpt && (
        <div>
          <h4 className="text-[13px] font-semibold text-olive">学习状态单选</h4>
          <p className="mt-1.5 rounded-lg border border-lime bg-lime-pale px-3 py-2 text-[12.5px] text-olive">
            {motivationOpt.key} · {motivationOpt.label}：{motivationOpt.text}
          </p>
        </div>
      )}

      {answers.subjects?.length > 0 && (
        <div>
          <h4 className="text-[13px] font-semibold text-olive">学科快扫</h4>
          <div className="mt-1.5 space-y-1.5">
            {answers.subjects.map((sub, i) => (
              <div key={i} className="rounded-lg bg-cream/60 px-3 py-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-olive">{sub.name || "（未填科目名）"}</span>
                  {sub.liking === 0 && sub.mastery === 0 && sub.exam === 0 && (
                    <span className="text-[11px] text-olive-mute">未开设</span>
                  )}
                </div>
                {!(sub.liking === 0 && sub.mastery === 0 && sub.exam === 0) && (
                  <div className="mono mt-1 text-[11.5px] text-olive-soft">
                    喜欢 {sub.liking} · 掌握 {sub.mastery} · 发挥 {sub.exam}
                    {sub.rank && <span className="ml-2 text-olive-mute">排名：{sub.rank}</span>}
                    {sub.weakest && <span className="ml-2 text-olive-mute">薄弱：{sub.weakest}</span>}
                  </div>
                )}
              </div>
            ))}
            {(answers.lossReasons?.length > 0 || answers.scoreTrend) && (
              <p className="text-[12px] text-olive-mute">
                失分主因：{answers.lossReasons?.join("、") || "未选"}　成绩趋势：{answers.scoreTrend || "未选"}
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-[13px] font-semibold text-olive">生活事件（过去3个月）</h4>
        <div className="mt-1.5 space-y-1.5">
          {happened.length === 0 && <p className="text-[12.5px] text-olive-mute">都没有发生，状态平稳。</p>}
          {happened.map((e, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-cream/60 px-3 py-2 text-[12.5px]">
              <span className="text-olive-soft">{e.text}</span>
              <span className="chip shrink-0 !py-0 text-[11px]">{LIFE_EVENT_LEVEL[e.v] ?? e.v}</span>
            </div>
          ))}
          {none.length > 0 && happened.length > 0 && (
            <div>
              <button
                onClick={() => setShowNone((v) => !v)}
                className="text-[12px] text-olive-mute hover:text-olive"
              >
                {showNone ? "▾ 收起「没发生」" : `▸ 没发生的 ${none.length} 项`}
              </button>
              {showNone && (
                <div className="mt-1 space-y-1">
                  {none.map((e, i) => (
                    <div key={i} className="rounded-lg px-3 py-1.5 text-[12px] text-olive-mute">
                      {e.text} · 没发生
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {answers.openAnswers?.some((a) => a?.trim()) && (
        <div>
          <h4 className="text-[13px] font-semibold text-olive">开放问答</h4>
          <div className="mt-1.5 space-y-2">
            {E3V37_OPEN_QUESTIONS.map((q, i) =>
              answers.openAnswers[i]?.trim() ? (
                <div key={i} className="rounded-lg bg-cream/60 px-3 py-2">
                  <div className="text-[12px] text-olive-mute">{q}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{answers.openAnswers[i]}</p>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 客观题（multi5）逐题明细：显示所选选项与对错。 */
function Multi5Detail({ answers }: { answers: number[] }) {
  return (
    <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
      {MULTI5_QUESTIONS.map((q, i) => {
        const picked = answers[i];
        const ok = picked === q.answer;
        return (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-lg bg-cream/60 px-3 py-2 text-[12.5px]"
          >
            <span className="text-olive-soft">
              <span className="mono mr-1.5 text-olive-mute">{i + 1}.</span>
              {q.text}
              <span className="ml-1.5 rounded bg-cream-deep px-1 py-0.5 text-[10.5px] text-olive-mute">
                {MULTI5_DIM_LABEL[q.dim]}
              </span>
            </span>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                ok ? "bg-lime-pale text-olive" : "bg-terra/10 text-terra"
              }`}
            >
              {picked != null ? `选 ${"ABCD"[picked]}` : "未答"} · {ok ? "对" : "错"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 测评卡片底部的「答题明细」折叠区。
 *  默认取当前登录用户的答题记录；伴学师/管理员查看学员时可通过 answers 传入
 *  该学员的原始作答（传 null 表示无明细）。 */
export default function AnswerDetail({
  kind,
  answers: answersProp,
}: {
  kind: "mbti" | "disc" | "e3" | "multi" | "multi5";
  answers?: unknown;
}) {
  const [open, setOpen] = useState(false);
  const { data } = trpc.assessment.latest.useQuery(undefined, { enabled: answersProp === undefined });

  const answers = answersProp !== undefined ? answersProp : (data?.raw?.find((r) => r.kind === kind)?.answers ?? null);

  return (
    <div className="mt-3 border-t border-cream-deep pt-3">
      <button onClick={() => setOpen((v) => !v)} className="text-[12.5px] text-olive-mute hover:text-olive">
        {open ? "▾ 收起答题明细" : "▸ 查看答题明细"}
      </button>
      {open && (
        <div className="mt-3">
          {answers == null ? (
            <p className="text-[12.5px] text-olive-mute">这次是旧记录，未保存明细，重新测一次即可查看。</p>
          ) : kind === "mbti" || kind === "disc" ? (
            <ChoiceDetail kind={kind} answers={answers as number[]} />
          ) : kind === "e3" ? (
            isE3V37Input(answers) ? (
              <E3V37Detail answers={answers} />
            ) : (
              <E3Detail answers={answers as E3V27Input} />
            )
          ) : kind === "multi5" ? (
            <Multi5Detail answers={answers as number[]} />
          ) : (
            <RatingDetail questions={MULTI_RATINGS} ratings={answers as number[]} labels={FIT5} />
          )}
        </div>
      )}
    </div>
  );
}
