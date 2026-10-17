/**
 * 大报告 olive book 式样「新版」：学业诊断报告 / 升学指导报告 / 家长认知冲突报告。
 * 版式与已定稿的选科及升学规划报告（book 式样）一致；内容全部复用既有 buildXxxReport 文案与数据，原版报告零改动、并列入口。
 */
import { OBook, OPage, OCover, OPartTag, OSecTitle, OCard } from "./OliveBook";
import { BergSvg } from "../CombinedV39";
import { buildE3Report } from "@/data/reports/combined";
import type { CombinedSection } from "@/data/reports/types";
import { e3v37Level } from "@contracts/e3v37";
import type { E3V37Result } from "@contracts/e3v37";
import type { MbtiResult, DiscResult } from "@contracts/assessments";
import type { HollandResult } from "@contracts/holland";
import type { AnchorResult } from "@contracts/careerAnchor";
import { ANCHOR_LABEL } from "@contracts/careerAnchor";
import type { Multi5Result } from "@contracts/multi5";
import { MULTI5_DIM_ORDER, MULTI5_DIM_LABEL } from "@contracts/multi5";
import type { MentalResult, MentalV2Result } from "@contracts/mentalHealth";
import { isMentalV2 } from "@contracts/mentalHealth";
import type { AcademicsData } from "@contracts/academics";
import { E3V37_LEVEL_STYLE, e3v37LevelTextClass, E3V37_LEVEL_CAPTION } from "../e3v37Theme";
import { RichText } from "@/components/RichText";
import AbilityScoreTable from "../AbilityScoreTable";
import { MBTI_REPORTS, DISC_REPORTS } from "@/data/reports";
import type { RawAnswer } from "../answerBlocks";
import type { OliveBaseProps } from "./OliveSingles";
import GuidanceTab from "../GuidanceTab";
import type { ReportAssessmentData, ReportProfileInfo } from "../ReportView";
import type { GuidanceRecord } from "@/data/reports/guidance";
import type { E3V37ParentResult } from "@contracts/e3v37Parent";
import { ParentReportTab } from "../ReportView";

const r1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => (xs.length ? r1(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
const TODAY = () => new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
const COND_DISPLAY: Record<string, string> = { state: "身心状态", relation: "家庭关系", resource: "学习资源" };
const FOOT = "EVALUATION REPORT · 学业诊断";

/* ---------- 冰山记分卡小组件（样式同 CombinedV39 打印静态版） ---------- */
function KRow({ label, value, note, color }: { label: string; value: number; note?: string; color: string }) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span className="w-[76px] shrink-0 truncate text-[12.5px] text-olive-soft" title={label}>{label}</span>
      <span className="w-[40px] shrink-0 text-right text-[13px] font-extrabold" style={{ color }}>{value}</span>
      <div className="h-2 w-[38%] shrink-0 overflow-hidden rounded-full bg-[#EDF3EF]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, value * 20)}%`, background: color }} />
      </div>
      {note && <span className="shrink-0 text-[11px] text-olive-mute">{note}</span>}
    </div>
  );
}
function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="my-[7px] flex items-baseline justify-between rounded-lg bg-[#F0FAF5] px-3.5 py-1.5">
      <span className="text-[12.5px] font-bold text-olive-soft">{label}</span>
      <span className="text-[19px] font-extrabold text-[#0B8A63]">{value}<small className="text-[11px] font-semibold text-olive-mute">/ 5</small></span>
    </div>
  );
}
const levelColor = (s: number) => E3V37_LEVEL_STYLE[e3v37Level(s)].bar;

/** book 式样章节条款卡（level 带红黄绿左边条）。 */
function OItems({ items }: { items: NonNullable<CombinedSection["items"]> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            borderRadius: 10,
            border: "1px solid #E3EEE8",
            borderLeft: it.level ? `5px solid ${E3V37_LEVEL_STYLE[it.level].bar}` : "5px solid #0EA875",
            background: it.level ? E3V37_LEVEL_STYLE[it.level].bg : "#F7FBF8",
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: it.big ? 16.5 : 13.5, fontWeight: 700, color: "#0B3D2E", lineHeight: 1.7 }}>
            <RichText text={it.heading} />
            {it.level && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: E3V37_LEVEL_STYLE[it.level].text }}>
                {it.level}
              </span>
            )}
          </div>
          <p style={{ marginTop: 4, fontSize: 13, lineHeight: 1.95, color: "#4B5F57" }}>
            <RichText text={it.text} />
          </p>
        </div>
      ))}
    </div>
  );
}

/** book 式样章节渲染：段落 + 条款 + 要点 + 收尾段。 */
function OSection({ section }: { section: CombinedSection }) {
  return (
    <div>
      {section.paragraphs?.map((p, i) => (
        <p key={i} style={{ marginTop: i === 0 ? 0 : 10, fontSize: 14, lineHeight: 2, color: "#4B5F57" }}>
          <RichText text={p} />
        </p>
      ))}
      {section.items && <OItems items={section.items} />}
      {section.bullets && (
        <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
          {section.bullets.map((b, i) => (
            <li key={i} style={{ position: "relative", paddingLeft: 18, fontSize: 13.5, lineHeight: 2, color: "#4B5F57", marginBottom: 4 }}>
              <span style={{ position: "absolute", left: 2, top: 11, width: 7, height: 7, borderRadius: "50%", background: "#0EA875" }} />
              <RichText text={b} />
            </li>
          ))}
        </ul>
      )}
      {section.closing?.map((c, i) => (
        <p key={i} style={{ marginTop: 12, fontSize: 13.5, lineHeight: 2, color: "#0B3D2E", fontWeight: 600 }}>
          <RichText text={c} />
        </p>
      ))}
    </div>
  );
}

/* ================= 学业诊断报告 ================= */
export type OliveE3Props = OliveBaseProps & {
  e3: E3V37Result;
  raw?: RawAnswer[];
  academics?: AcademicsData;
  mbti?: MbtiResult;
  disc?: DiscResult;
  holland?: HollandResult | null;
  anchor?: AnchorResult | null;
  multi5?: Multi5Result | null;
  mental?: MentalResult | MentalV2Result | null;
  ratings?: number[] | null;
};

export function OliveE3({ e3, raw, academics, mbti, disc, holland, anchor, multi5, mental, ratings, name, grade, date }: OliveE3Props) {
  const report = buildE3Report(e3);

  /* ---------- 冰山记分卡数据（与 CombinedV39 同口径） ---------- */
  const ability = (label: string) => e3.abilities.find((a) => a.label === label);
  const core = (key: string) => e3.systems.core.find((c) => c.key === key);
  const kpMean = (abilityLabel: string, kps: string[]): number | null => {
    const a = ability(abilityLabel);
    const fs = (a?.focuses ?? []).filter((f) => kps.includes(f.kp));
    return fs.length ? mean(fs.map((f) => f.score)) : null;
  };
  const metaParts = [ability("计划")?.score ?? null, kpMean("复盘", ["自我监控"]), kpMean("复盘", ["反思归因", "策略调节"])].filter((x): x is number => x != null);
  const metaScore = metaParts.length ? mean(metaParts) : (core("善学")?.score ?? 0);
  const aptitudeMean = mean(e3.aptitude.map((a) => a.score));
  const aiScore = ability("智学")?.score ?? 0;

  const SUBJ_SHORT: Record<string, string> = { "首选科目（物理/历史，圈一个）": "首选科目", "再选科目（填两科）": "再选科目" };
  const e3raw = raw?.find((r) => r.kind === "e3")?.answers as { subjects?: { name: string; liking: number; mastery: number; exam: number }[] } | null | undefined;
  const scanRows = ((e3raw?.subjects ?? []) as { name: string; liking: number; mastery: number; exam: number }[])
    .map((s) => {
      const vals = [s.liking, s.mastery, s.exam].filter((v) => v > 0);
      return { name: SUBJ_SHORT[s.name] ?? s.name, score: vals.length ? mean(vals) : 0, n: vals.length };
    })
    .filter((s) => s.n > 0);
  const acadRows = (academics?.subjects ?? []).filter((x) => x.selfLevel != null).map((x) => ({ name: x.name, score: x.selfLevel as number, n: 1 }));
  const scoreRows = scanRows.length > 0 ? scanRows : acadRows;
  const scoreMean = mean(scoreRows.map((s) => s.score));

  const condCells = e3.systems.condition.cells;
  const condMean = mean(condCells.map((c) => c.score));

  const mbtiName = mbti ? MBTI_REPORTS[mbti.type]?.name : undefined;
  const discName = disc ? DISC_REPORTS[disc.primary]?.name : undefined;

  const cardCls = "rounded-xl border border-[#E3EEE8] bg-white px-4 py-3 shadow-sm";
  const headCls = "text-[14.5px] font-extrabold text-olive";
  const Head = ({ title, note }: { title: string; note?: string }) => (
    <h4 className={headCls}>
      {title}
      {note && <span className="ml-2 text-[11px] font-semibold text-olive-mute">{note}</span>}
    </h4>
  );

  /* 页码：1 封面 + 2 体检概览 + 3 冰山 + 章节页 + 附录页 */
  const secOffset = 3;
  const appendixNo = secOffset + report.sections.length;

  return (
    <OBook>
      <OCover
        klabel="EVALUATION REPORT · 学业诊断（三阶九能 V3.7）"
        title={<span>学业诊断报告</span>}
        subtitle="乐学（心）· 会学（术）· 善学（脑）—— 三阶九能，看见看不见的学习力"
        info={[["姓　　名", name || "—"], ["年　　级", grade || "—"], ["学段版本", e3.stageLabel], ["报告日期", date ?? TODAY()]]}
      />

      {/* P2 · 三阶九能体检概览 */}
      <OPage no={2} foot={FOOT}>
        <OPartTag>PART 1</OPartTag>
        <h2>三阶九能体检 · {e3.stageLabel}</h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {e3.systems.core.map((c) => (
            <div key={c.key} className="rounded-xl bg-[#F0FAF5] px-2.5 py-2.5 text-center">
              <div className="text-[11.5px] text-olive-mute">{c.key}</div>
              <div className={`mt-0.5 text-[17px] font-bold ${e3v37LevelTextClass(c.level)}`}>{c.score}/5</div>
              <div className={`mt-0.5 text-[11px] ${e3v37LevelTextClass(c.level)}`}>{c.level}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-olive-mute">{E3V37_LEVEL_CAPTION}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip !text-[11px]">学习状态「{e3.motivationLabel}」{e3.motivationScore}/5</span>
          <span className="chip !text-[11px]">外驱依赖 {e3.extDrive}/5 · 内驱 {e3.intDrive}/5</span>
          <span className="chip !text-[11px]">生活事件 {e3.lifeEventScore}/24（{e3.lifeEventLevel}）</span>
          {e3.mainBlock && (
            <span className="chip !border-[#A82524]/50 !bg-[#FAF2E4] !text-[11px] !text-[#A82524]">主卡点：{e3.mainBlock.label} {e3.mainBlock.score}/5</span>
          )}
        </div>
        {e3.redFlags.length > 0 && (
          <div className="mt-4 rounded-xl border border-terra/40 bg-terra/10 p-3">
            <div className="text-[12.5px] font-bold text-terra">红线提示：先照顾好状态，再谈成绩</div>
            {e3.redFlags.map((f, i) => (
              <p key={i} className="mt-1 text-[12.5px] leading-relaxed text-terra">{f}</p>
            ))}
          </div>
        )}
        <OSecTitle n="·" title="章节导航" sub={`本报告共 ${report.sections.length} 章`} />
        <div className="flex flex-wrap gap-1.5">
          {report.sections.map((s, i) => (
            <a key={i} href={`#osec-${i}`} className="rounded-lg border border-border bg-cream px-2.5 py-1 text-[12px] text-olive transition-colors hover:border-lime hover:bg-butter-pale">
              {String(i + 1).padStart(2, "0")} {s.title.replace(/\*\*/g, "")}
            </a>
          ))}
        </div>
      </OPage>

      {/* P3 · 冰山模型 */}
      <OPage no={3} foot={FOOT}>
        <OPartTag>PART 2</OPartTag>
        <h2>学习能力冰山模型 · 三阶九能</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">
          水面之上是看得见的学习成绩；水面之下是乐学（心）、会学（术）、善学（脑）三大系统，共九能，全部计入总分。冰山越往下越隐蔽：能力最好训练、行为靠习惯、动力最难撬动。
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-5">
          <div className="w-[300px] max-w-full shrink-0 overflow-hidden rounded-2xl border border-[#E3EEE8] bg-gradient-to-b from-[#F0FAF5] to-[#E4F2E9]">
            <BergSvg stretch={1} />
          </div>
          <div className="min-w-[260px] flex-1 space-y-3">
            <div className={cardCls}>
              <Head title="学习成绩" note="看得见的结果 · 各科三项均分" />
              <TotalRow label="学科综合均分" value={scoreMean} />
              {scoreRows.length === 0 ? (
                <p className="py-1 text-[12px] text-olive-mute">学科测评数据未填写</p>
              ) : (
                scoreRows.slice(0, 8).map((s) => <KRow key={s.name} label={s.name} value={s.score} color={levelColor(s.score)} />)
              )}
            </div>
            <div className={cardCls}>
              <Head title="能力系统" note="学习效率高不高（脑）" />
              <TotalRow label="善学 · 系统总分" value={core("善学")?.score ?? 0} />
              <KRow label="元认知" value={metaScore} note="计划 · 监控 · 复盘" color={levelColor(metaScore)} />
              <KRow label="学能" value={aptitudeMean} note="学习效率" color={levelColor(aptitudeMean)} />
              <KRow label="AI 智学" value={aiScore} note="运用 AI 自学" color={levelColor(aiScore)} />
              {multi5 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-dashed border-[#E3EEE8] pt-2">
                  <span className="w-full text-[11px] font-bold text-[#0B8A63]">多元智能五项（百分制 · 参考，不计入总分）</span>
                  {MULTI5_DIM_ORDER.map((k) => (
                    <span key={k} className="flex items-center gap-1.5">
                      <span className="text-[11px] text-olive-soft">{MULTI5_DIM_LABEL[k]}</span>
                      <span className="h-[7px] w-14 overflow-hidden rounded-full bg-[#EDF3EF]">
                        <span className="block h-full rounded-full bg-[#7FB89A]" style={{ width: `${multi5.dims[k]}%` }} />
                      </span>
                      <span className="w-6 text-[12px] font-extrabold text-[#0B8A63]">{multi5.dims[k]}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={cardCls}>
              <Head title="行为系统" note="会不会学（术）" />
              <TotalRow label="会学 · 系统总分" value={core("会学")?.score ?? 0} />
              <KRow label="听懂" value={ability("学懂")?.score ?? 0} color={levelColor(ability("学懂")?.score ?? 0)} />
              <KRow label="记住" value={ability("记住")?.score ?? 0} color={levelColor(ability("记住")?.score ?? 0)} />
              <KRow label="会用" value={ability("会用")?.score ?? 0} color={levelColor(ability("会用")?.score ?? 0)} />
            </div>
            <div className={cardCls}>
              <Head title="动力系统" note="愿不愿学（心）" />
              <TotalRow label="乐学 · 系统总分" value={core("乐学")?.score ?? 0} />
              <KRow label="学习动力" value={ability("动力")?.score ?? 0} color={levelColor(ability("动力")?.score ?? 0)} />
              <KRow label="学习信心" value={ability("信心")?.score ?? 0} color={levelColor(ability("信心")?.score ?? 0)} />
              <KRow label="学习韧劲" value={ability("韧劲")?.score ?? 0} color={levelColor(ability("韧劲")?.score ?? 0)} />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={cardCls}>
            <Head title="自我认知 · 心理状态" />
            {mental && isMentalV2(mental) ? (
              <>
                <KRow label="PHQ-9" value={mental.phq9} note={`/27 · ${mental.phq9Level}`} color={mental.phq9Level !== "良好" ? "#E4572E" : "#2F7A41"} />
                <KRow label="GAD-7" value={mental.gad7} note={`/21 · ${mental.gad7Level}`} color={mental.gad7Level !== "良好" ? "#E4572E" : "#2F7A41"} />
              </>
            ) : (
              <p className="py-1 text-[12px] text-olive-mute">心理状态测评未做（选做）</p>
            )}
          </div>
          <div className={cardCls}>
            <Head title="支持系统" note="身心 · 家庭 · 资源" />
            <TotalRow label="支持系统 · 均分" value={condMean} />
            {condCells.map((c) => (
              <KRow key={c.key} label={COND_DISPLAY[c.key] ?? c.label} value={c.score} color={levelColor(c.score)} />
            ))}
          </div>
          <div className={cardCls}>
            <Head title="深层特质" note="性格 · 兴趣 · 锚" />
            {disc && (
              <div className="flex items-baseline gap-2 py-1">
                <span className="w-[52px] shrink-0 text-[11.5px] font-bold text-olive-soft">DISC</span>
                <span className="text-[15px] font-extrabold tracking-wide text-[#0B8A63]">{disc.primary}</span>
                <span className="text-[11px] text-olive-mute">{discName ?? ""}</span>
              </div>
            )}
            {mbti && (
              <div className="flex items-baseline gap-2 py-1">
                <span className="w-[52px] shrink-0 text-[11.5px] font-bold text-olive-soft">MBTI</span>
                <span className="text-[15px] font-extrabold tracking-wide text-[#0B8A63]">{mbti.type}</span>
                <span className="text-[11px] text-olive-mute">{mbtiName ?? ""}</span>
              </div>
            )}
            {holland && (
              <div className="flex items-baseline gap-2 py-1">
                <span className="w-[52px] shrink-0 text-[11.5px] font-bold text-olive-soft">职业兴趣</span>
                <span className="text-[15px] font-extrabold tracking-wide text-[#0B8A63]">{holland.code}</span>
                <span className="text-[11px] text-olive-mute">{holland.keywords}</span>
              </div>
            )}
            {anchor && anchor.top2.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-2 py-1">
                <span className="w-[52px] shrink-0 text-[11.5px] font-bold text-olive-soft">职业锚</span>
                <span className="text-[15px] font-extrabold tracking-wide text-[#0B8A63]">{anchor.top2.join("·")}</span>
                <span className="text-[11px] text-olive-mute">{anchor.top2.map((k) => ANCHOR_LABEL[k]).join(" · ")}</span>
              </div>
            )}
            {!disc && !mbti && !holland && !anchor && <p className="py-1 text-[12px] text-olive-mute">性格/兴趣测评未完成</p>}
          </div>
        </div>
        <p className="mt-4 border-t border-[#E3EEE8] pt-2.5 text-[12px] leading-[1.8] text-olive-mute">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "#E4572E" }} />红 &lt; 3.0 卡点（优先干预）　
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "#F0A92E" }} />黄 3.0–3.7 待提升　
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "#3CC078" }} />绿 ≥ 3.8 正常　|　
          评分为 1–5 分制；三阶九能计入总分；支持系统与多元智能五项单独解读。
        </p>
      </OPage>

      {/* 章节页 */}
      {report.sections.map((s, i) => (
        <OPage key={i} no={secOffset + 1 + i} foot={FOOT}>
          <div id={`osec-${i}`} className="scroll-mt-20">
            <OSecTitle n={i + 1} title={<RichText text={s.title} />} />
            <OSection section={s} />
          </div>
        </OPage>
      ))}

      {/* 附录 · 得分表 */}
      <OPage no={appendixNo + 1} foot={FOOT}>
        <OSecTitle n="附" title="三阶九能观察点得分表" sub="逐题得分 · 点击能力行展开" />
        <OCard white>
          <AbilityScoreTable e3={e3} ratings={ratings} />
        </OCard>
        <p className="mt-3 text-[12px] leading-[1.9] text-olive-mute">
          红黄绿口径：红 &lt;3.0 为卡点 · 黄 3.0-3.7 为待提升 · 绿 ≥3.8 为正常；反向题已按「6－圈选数」换算，分数越低越需要关注。
        </p>
      </OPage>
    </OBook>
  );
}

/* ================= 升学指导报告（流式 book：封面 + 原版完整内容 + A4 打印适配） ================= */

export type OliveGuidanceProps = {
  data?: ReportAssessmentData;
  profile?: ReportProfileInfo;
  academics?: AcademicsData | null;
  records?: GuidanceRecord[] | null;
  onAssess?: (start: string) => void;
};

export function OliveGuidance({ profile, ...props }: OliveGuidanceProps) {
  return (
    <OBook>
      <OCover
        klabel="EVALUATION REPORT · 升学指导"
        title={<span>升学指导报告</span>}
        subtitle="选科规划 · 专业职业方向 · 升学路径 —— 基于六项测评与学业数据交叉分析"
        info={[["姓　　名", profile?.name || "—"], ["年　　级", profile?.grade || "—"], ["报告日期", TODAY()]]}
      />
      <div className="ob-flow">
        <GuidanceTab profile={profile} {...props} />
      </div>
    </OBook>
  );
}

/* ================= 家长认知冲突报告（流式 book） ================= */
export type OliveParentProps = OliveBaseProps & {
  student: DiscResult | null;
  parents: { label: string; result: DiscResult }[];
  e3parent: E3V37ParentResult | null;
  raw?: RawAnswer[];
};

export function OliveParent({ student, parents, e3parent, raw, name, grade, date }: OliveParentProps) {
  return (
    <OBook>
      <OCover
        klabel="EVALUATION REPORT · 家长认知冲突"
        title={<span>家长认知冲突报告</span>}
        subtitle="家庭支持对照 · 亲子冲突点清单 · 改进方案 —— 孩子自评 × 家长观察"
        info={[["学生姓名", name || "—"], ["年　　级", grade || "—"], ["报告日期", date ?? TODAY()]]}
      />
      <div className="ob-flow">
        <ParentReportTab student={student} parents={parents} e3parent={e3parent} raw={raw} />
      </div>
    </OBook>
  );
}
