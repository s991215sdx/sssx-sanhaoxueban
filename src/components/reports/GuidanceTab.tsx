import { Compass, GraduationCap, MapPin, Sparkles, Target } from "lucide-react";
import { buildGuidanceReport } from "@/data/reports/guidance";
import type { ReportAssessmentData, ReportProfileInfo } from "@/components/reports/ReportView";

/**
 * V72：升学指导综合报告——霍兰德职业兴趣 × 职业锚 × MBTI × DISC × 多元智能五项，
 * 输出选科建议、专业方向、行业方向与行动建议（用于选科指导 / 升学指导）。
 * 与学习力综合报告并列的「第二份综合报告」。
 */
export default function GuidanceTab({
  data,
  profile,
  onAssess,
}: {
  data?: ReportAssessmentData;
  profile?: ReportProfileInfo;
  onAssess?: (start: string) => void;
}) {
  const g = buildGuidanceReport({
    grade: profile?.grade,
    mbti: data?.mbti,
    disc: data?.disc,
    multi5: data?.multi5 ?? undefined,
    anchor: data?.anchor ?? undefined,
    holland: data?.holland ?? undefined,
  });

  if (!g) {
    return (
      <div className="paper-card mx-auto max-w-xl p-8 text-center">
        <Compass className="mx-auto h-10 w-10 text-olive-mute" />
        <p className="mt-3 font-semibold text-olive">还没有可用于升学指导的测评数据</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-olive-mute">
          完成下面的任意测评后，这里会自动生成你的升学指导报告（霍兰德职业兴趣、职业锚、MBTI、DISC、多元智能五项，做得越全报告越准）。
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {(["holland", "anchor", "mbti", "disc", "multi5"] as const).map((k) => (
            <button
              key={k}
              onClick={() => onAssess?.(k)}
              className="rounded-full border border-lime/50 bg-lime-pale/60 px-3 py-1.5 text-[12.5px] font-semibold text-olive hover:border-lime"
            >
              去测{{ holland: "霍兰德职业兴趣", anchor: "职业锚", mbti: "MBTI", disc: "DISC", multi5: "多元智能五项" }[k]} →
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头卡 */}
      <div className="paper-card accent-l border-lime p-5">
        <div className="flex items-center gap-2">
          <Compass size={17} className="text-olive" />
          <h3 className="font-bold text-olive">升学指导综合报告</h3>
        </div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
          回答三个问题：<b>选什么科 · 学什么专业 · 进什么行业</b>。基于 {g.basedOn.join("、")} 交叉分析
          {g.missing.length > 0 ? <>；补上 {g.missing.join("、")} 后报告会更准。</> : "。"}
        </p>
        {g.headline && (
          <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl bg-olive px-3.5 py-2 text-[13.5px] font-bold text-cream">
            <Sparkles size={14} className="text-lime" />
            {g.headline}
          </div>
        )}
      </div>

      {/* 选科建议 */}
      {g.subjectAdvice.length > 0 && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-olive" />
            <h3 className="font-bold text-olive">选科建议</h3>
          </div>
          <ul className="mt-3 space-y-2.5">
            {g.subjectAdvice.map((s, i) => (
              <li key={i} className="rounded-xl bg-cream px-3.5 py-2.5 text-[13.5px] leading-relaxed text-olive-soft">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 推荐专业方向 */}
      <div className="paper-card p-5">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-olive" />
          <h3 className="font-bold text-olive">推荐专业方向</h3>
          <span className="text-[11.5px] text-olive-mute">按兴趣×性格×能力交叉匹配，非限定</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {g.majors.map((m) => (
            <span key={m.name} className="chip !text-[12px]" title={m.why}>
              {m.name}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-olive-mute">匹配依据：{g.majors.slice(0, 3).map((m) => m.why).join("；")}。</p>
      </div>

      {/* 推荐行业方向 */}
      <div className="paper-card p-5">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-olive" />
          <h3 className="font-bold text-olive">未来行业方向参考</h3>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {g.industries.map((m) => (
            <span key={m.name} className="chip !border-terra/40 !bg-terra/5 !text-[12px] !text-terra" title={m.why}>
              {m.name}
            </span>
          ))}
        </div>
      </div>

      {/* 性格与行为如何影响升学路径 */}
      {(g.mbtiBlock || g.discBlock) && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-olive" />
            <h3 className="font-bold text-olive">你的升学打法</h3>
          </div>
          {g.mbtiBlock && (
            <div className="mt-3 rounded-xl bg-cream px-3.5 py-3">
              <p className="text-[13.5px] font-semibold text-olive">
                {g.mbtiBlock.type} 型「{g.mbtiBlock.name}」的领域倾向
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-olive-soft">{g.mbtiBlock.fieldSlant}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive-mute">
                学法提示：{g.mbtiBlock.studyStyle.join("；")}。
              </p>
            </div>
          )}
          {g.discBlock && (
            <div className="mt-3 rounded-xl bg-cream px-3.5 py-3">
              <p className="text-[13.5px] font-semibold text-olive">
                {g.discBlock.primary} 型「{g.discBlock.name}」的升学打法
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-olive-soft">{g.discBlock.roleStyle}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive-mute">{g.discBlock.scene}</p>
            </div>
          )}
        </div>
      )}

      {/* 兴趣与驱动力 */}
      {(g.hollandBlock || g.anchorBlock) && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-olive" />
            <h3 className="font-bold text-olive">兴趣与职业驱动力</h3>
          </div>
          {g.hollandBlock && (
            <div className="mt-3">
              <p className="text-[13.5px] font-semibold text-olive">
                霍兰德兴趣代码 {g.hollandBlock.code}（前三位）
              </p>
              <div className="mt-2 space-y-2">
                {g.hollandBlock.top3.map((t, i) => (
                  <div key={t.key} className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-2.5">
                    <p className="text-[13px] font-semibold text-olive">
                      {i + 1}. {t.key} · {t.label} <span className="font-normal text-olive-mute">{t.score.toFixed(1)} 分</span>
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">
                      匹配职业：{t.careers.join("、")}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-olive-mute">
                      相关专业：{t.majors.join("、")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {g.anchorBlock && (
            <div className="mt-3">
              <p className="text-[13.5px] font-semibold text-olive">职业锚 Top2（你最不愿放弃的驱动力）</p>
              <div className="mt-2 space-y-2">
                {g.anchorBlock.map((a, i) => (
                  <div key={a.label} className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-2.5">
                    <p className="text-[13px] font-semibold text-olive">
                      {i + 1}. {a.label} <span className="font-normal text-olive-mute">{a.score.toFixed(1)} 分</span>
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{a.workStyle}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-olive-mute">
                      相关职业领域：{a.careerFields.join("、")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 能力底子 */}
      {g.multi5Block && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-olive" />
            <h3 className="font-bold text-olive">能力底子（多元智能五项 Top3）</h3>
          </div>
          <div className="mt-3 space-y-2">
            {g.multi5Block.map((d, i) => (
              <div key={d.label} className="rounded-xl bg-cream px-3.5 py-2.5">
                <p className="text-[13px] font-semibold text-olive">
                  {i + 1}. {d.label} <span className="font-normal text-olive-mute">{d.score} 分</span>
                </p>
                <p className="mt-0.5 text-[12.5px] text-olive-soft">{d.feature}</p>
                {d.career.length > 0 && <p className="mt-0.5 text-[12.5px] text-olive-mute">方向参考：{d.career.join("；")}。</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 行动建议 */}
      <div className="paper-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-olive" />
          <h3 className="font-bold text-olive">下一步行动建议</h3>
        </div>
        <ul className="mt-3 space-y-2">
          {g.actionTips.map((t, i) => (
            <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-olive-soft">
              <span className="mt-0.5 font-bold text-lime-deep">{i + 1}.</span>
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-relaxed text-olive-mute">
          说明：本报告基于测评数据的倾向性分析，用于开阔选科与升学思路，不构成唯一决策依据；重大选择请结合学业成绩、家庭情况与学校老师意见综合判断。
        </p>
      </div>
    </div>
  );
}
