/**
 * 六份单项测评的 olive book 式样「新版」报告：MBTI / DISC / 霍兰德 / 多元智能五项 / 职业锚 / 心理健康（通用版）。
 * 版式与已定稿样张（report-mockups）一致；数据全部接真实测评结果与既有文案库，内容零编造。
 */
import { MBTI_REPORTS, DISC_REPORTS } from "@/data/reports";
import type { MbtiResult } from "@contracts/assessments";
import type { HollandResult } from "@contracts/holland";
import { HOLLAND_ORDER, HOLLAND_LABEL, HOLLAND_KEYWORDS } from "@contracts/holland";
import { HOLLAND_FIELD_MAP } from "@contracts/riasecMap";
import type { AnchorResult } from "@contracts/careerAnchor";
import { ANCHOR_ORDER, ANCHOR_LABEL, buildAnchorReport } from "@contracts/careerAnchor";
import type { Multi5Result } from "@contracts/multi5";
import { MULTI5_DIM_ORDER, MULTI5_DIM_LABEL, buildMulti5Report } from "@contracts/multi5";
import type { MentalV2Result } from "@contracts/mentalHealth";
import { OBook, OPage, OCover, OPartTag, OSecTitle, OCard, ODots, OTag, OTypeHero, OBigScore, OPairBars, OHBars, ORadar } from "./OliveBook";

const POLE_NAME: Record<string, string> = { E: "外向", I: "内向", S: "实感", N: "直觉", T: "思考", F: "情感", J: "判断", P: "感知" };

const TODAY = () => new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

export type OliveBaseProps = { name: string; grade?: string | null; date?: string };

/* ================= 1. MBTI ================= */
export function OliveMbti({ result, name, grade, date }: OliveBaseProps & { result: MbtiResult }) {
  const report = MBTI_REPORTS[result.type];
  if (!report) return null;
  const pairs = (["EI", "SN", "TF", "JP"] as const).map((pair) => {
    const [a, b] = pair.split("") as [string, string];
    const max = Math.max(result.dims[a as keyof typeof result.dims] + result.dims[b as keyof typeof result.dims], 1);
    return { a, aName: POLE_NAME[a], av: result.dims[a as keyof typeof result.dims], b, bName: POLE_NAME[b], bv: result.dims[b as keyof typeof result.dims], max };
  });
  return (
    <OBook>
      <OCover
        klabel="EVALUATION REPORT · MBTI 性格测评"
        title={<span>MBTI 性格<br />测评报告</span>}
        subtitle="四个维度 · 八个倾向 —— 认识自己的性格，找到更舒服的学习方式"
        info={[["姓　　名", name || "—"], ["年　　级", grade || "—"], ["测评类型", `${result.type} · ${report.name}`], ["报告日期", date ?? TODAY()]]}
      />
      <OPage no={2} foot="EVALUATION REPORT · MBTI">
        <OPartTag>PART 1</OPartTag>
        <h2>测评结果</h2>
        <div style={{ marginTop: 18 }}>
          <OTypeHero code={result.type} name={report.name} headline={report.headline} tags={report.tags} />
        </div>
        <OSecTitle n={1} title="四维倾向分布" sub="颜色更深的一侧为你当前的倾向" />
        <OCard>
          <OPairBars pairs={pairs} />
        </OCard>
        <OCard style={{ marginTop: 18 }}>
          <div className="ob-klabel" style={{ marginBottom: 8 }}>代表人物语录</div>
          <p className="ob-muted">
            「{report.figure.quote}」
            <br />—— {report.figure.name}（{report.figure.title}）
          </p>
        </OCard>
      </OPage>
      <OPage no={3} foot="EVALUATION REPORT · MBTI">
        <OSecTitle n={2} title="性格特质画像" sub="生活中的你" />
        <ODots items={report.traits} />
        <div className="ob-grid2" style={{ marginTop: 22 }}>
          <OCard white>
            <div className="ob-klabel" style={{ marginBottom: 10 }}>学习优势</div>
            <ODots items={report.studyStrengths} />
          </OCard>
          <OCard white>
            <div className="ob-klabel" style={{ marginBottom: 10 }}>可以注意</div>
            <ODots items={report.studyBlindspots} warn />
          </OCard>
        </div>
        <OSecTitle n={3} title="成长建议" sub={`给 ${result.type} 的小练习`} />
        <OCard>
          <ODots items={report.suggestions} />
        </OCard>
      </OPage>
    </OBook>
  );
}

/* ================= 2. DISC ================= */
export function OliveDisc({ primary, dims, name, grade, date }: OliveBaseProps & { primary: "D" | "I" | "S" | "C"; dims: Record<"D" | "I" | "S" | "C", number> }) {
  const report = DISC_REPORTS[primary];
  if (!report) return null;
  const order: ("D" | "I" | "S" | "C")[] = ["D", "I", "S", "C"];
  const MAX = 24;
  return (
    <OBook>
      <OCover
        klabel="EVALUATION REPORT · DISC 行为风格测评"
        title={<span>DISC 行为风格<br />测评报告</span>}
        subtitle="四种行为风格 —— 看见自己的行为模式，让沟通更顺畅"
        info={[["姓　　名", name || "—"], ["年　　级", grade || "—"], ["主导类型", `${primary} · ${report.name}`], ["报告日期", date ?? TODAY()]]}
      />
      <OPage no={2} foot="EVALUATION REPORT · DISC">
        <OPartTag>PART 1</OPartTag>
        <h2>测评结果</h2>
        <div style={{ marginTop: 18 }}>
          <OTypeHero code={primary} name={`${report.name}`} headline={report.headline} />
        </div>
        <OSecTitle n={1} title="四维行为倾向" sub={`满分 ${MAX} 分 · 得分越高该风格越明显`} />
        <OCard>
          <OHBars rows={order.map((k) => ({ label: `${k} ${DISC_REPORTS[k].name.slice(0, 2)}型`, value: dims[k], max: MAX, color: k === primary ? "#0EA875" : "#C9E0CE" }))} height={220} />
        </OCard>
        <OSecTitle n={2} title="四种风格解读" sub="没有好坏，只有不同" />
        <OCard white>
          {order.map((k) => (
            <div key={k} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "10px 0", borderBottom: "1px dashed #E3EEE8" }}>
              <span style={{ flex: "none", alignSelf: "flex-start" }}>
                <OTag hi={k === primary}>{k} {DISC_REPORTS[k].name}</OTag>
              </span>
              <span className="ob-muted" style={{ fontSize: 13 }}>{DISC_REPORTS[k].headline}</span>
              <b style={{ marginLeft: "auto", color: k === primary ? "#0B8A63" : "#8FA39B" }}>{dims[k]}</b>
            </div>
          ))}
        </OCard>
      </OPage>
    </OBook>
  );
}

/* ================= 3. 霍兰德 ================= */
export function OliveHolland({ result, name, grade, date }: OliveBaseProps & { result: HollandResult }) {
  const axes = HOLLAND_ORDER.map((k) => `${k} ${HOLLAND_LABEL[k].replace("型", "")}`);
  const vals = HOLLAND_ORDER.map((k) => result.dims[k]);
  return (
    <OBook>
      <OCover
        klabel="EVALUATION REPORT · 霍兰德职业兴趣测评"
        title={<span>霍兰德职业兴趣<br />测评报告</span>}
        subtitle="RIASEC 六种类型 —— 兴趣是学习的隐形发动机"
        info={[["姓　　名", name || "—"], ["年　　级", grade || "—"], ["兴趣代码", result.code], ["报告日期", date ?? TODAY()]]}
      />
      <OPage no={2} foot="EVALUATION REPORT · HOLLAND">
        <OPartTag>PART 1</OPartTag>
        <h2>测评结果</h2>
        <div style={{ marginTop: 18 }}>
          <OTypeHero code={result.code} name={result.top3.map((k) => HOLLAND_LABEL[k]).join(" · ")} headline={result.keywords} />
        </div>
        <OSecTitle n={1} title="职业兴趣雷达" sub="六维得分 · 满分 5 分" />
        <OCard style={{ display: "flex", justifyContent: "center" }}>
          <ORadar axes={axes} values={vals} max={5} />
        </OCard>
        <OSecTitle n={2} title="六种类型一览" sub="绿色底为你的前三类型" />
        <div className="ob-grid2">
          {HOLLAND_ORDER.map((k) => {
            const f = HOLLAND_FIELD_MAP[k];
            const hi = result.top3.includes(k);
            return (
              <OCard key={k} white style={hi ? { background: "#E4F7EC" } : undefined}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <b style={{ fontSize: 18, color: hi ? "#0B8A63" : "#8FA39B" }}>{k}</b>
                  <span style={{ fontWeight: 700, color: "#0B3D2E" }}>{HOLLAND_LABEL[k]}</span>
                  <b style={{ marginLeft: "auto", color: hi ? "#0B8A63" : "#8FA39B" }}>{result.dims[k]}</b>
                </div>
                <p className="ob-muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.8 }}>
                  {HOLLAND_KEYWORDS[k]} · 对应{f.trackName}方向（{f.fields.join("、")}）
                </p>
              </OCard>
            );
          })}
        </div>
      </OPage>
      <OPage no={3} foot="EVALUATION REPORT · HOLLAND">
        <OSecTitle n={3} title="结果解读" sub="兴趣代码不是定型，是地图" />
        <OCard>
          <p className="ob-muted">{result.summary}</p>
        </OCard>
        <OSecTitle n={4} title={`给 ${result.code} 型学生的学习建议`} sub="把兴趣接到学习上" />
        <ODots
          items={[
            ...result.top3.map((k) => {
              const f = HOLLAND_FIELD_MAP[k];
              return `${HOLLAND_LABEL[k]}（${k}）突出：对应${f.trackName}学科群（${f.fields.join("、")}），核心能力：${f.abilities.join("、")}。`;
            }),
            `选科参考：可优先关注${result.top3.map((k) => HOLLAND_FIELD_MAP[k].trackName).join("、")}门类，这些方向与你的兴趣结构匹配度更高。`,
          ]}
        />
      </OPage>
    </OBook>
  );
}

/* ================= 4. 多元智能五项 ================= */
export function OliveMulti5({ result, name, grade, date }: OliveBaseProps & { result: Multi5Result }) {
  const rep = buildMulti5Report(result);
  const bandColor = (v: number) => (v >= 60 ? "#3CC078" : v >= 40 ? "#F0A92E" : "#E4572E");
  const dimRows = [...rep.dims].sort((a, b) => b.score - a.score);
  return (
    <OBook>
      <OCover
        klabel="EVALUATION REPORT · 多元智能五项测评"
        title={<span>多元智能五项<br />测评报告</span>}
        subtitle="推理 · 细节 · 数字 · 词义 · 空间 —— 五项基础学能，看见认知的强项与短板"
        info={[["姓　　名", name || "—"], ["年　　级", grade || "—"], ["综合得分", `${result.overall} / 100`], ["报告日期", date ?? TODAY()]]}
      />
      <OPage no={2} foot="EVALUATION REPORT · MULTI5">
        <OPartTag>PART 1</OPartTag>
        <h2>测评结果</h2>
        <div style={{ marginTop: 18 }}>
          <OBigScore label="五项综合得分" value={<span>{result.overall}<small style={{ fontSize: 12, color: "#8FA39B" }}> / 100</small></span>} />
        </div>
        <OSecTitle n={1} title="五项能力分布" sub="百分制 · 答对率" />
        <OCard>
          <OHBars
            rows={MULTI5_DIM_ORDER.map((k) => ({ label: MULTI5_DIM_LABEL[k], value: result.dims[k], max: 100, color: bandColor(result.dims[k]) }))}
            height={230}
          />
          <p className="ob-muted" style={{ fontSize: 12, marginTop: 6 }}>绿 ≥60 优秀　黄 40–59 中等　红 &lt;40 需重点提升</p>
        </OCard>
        <OSecTitle n={2} title="答题正确数" sub="每项 8 题" />
        <table className="ob-table">
          <thead>
            <tr>{MULTI5_DIM_ORDER.map((k) => (<th key={k}>{MULTI5_DIM_LABEL[k]}</th>))}</tr>
          </thead>
          <tbody>
            <tr>{result.perDim.map((p) => (<td key={p.key}><b>{p.correct}</b> / {p.total}</td>))}</tr>
          </tbody>
        </table>
        <OSecTitle n={3} title="逐项解读与提升建议" />
        <OCard white>
          {dimRows.map((d) => (
            <div key={d.key} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px dashed #E3EEE8" }}>
              <span style={{ flex: "none", alignSelf: "flex-start" }}>
                <OTag hi={d.score >= 60}>{d.label} {d.score}</OTag>
              </span>
              <span className="ob-muted" style={{ fontSize: 13 }}>
                {d.feature}
                {d.evalPoints[0] ? ` ${d.evalPoints[0]}。` : ""}
                {d.growthAdvice[0] ? ` ${d.growthAdvice[0]}。` : ""}
              </span>
            </div>
          ))}
        </OCard>
      </OPage>
    </OBook>
  );
}

/* ================= 5. 职业锚 ================= */
export function OliveAnchor({ result, name, grade, date }: OliveBaseProps & { result: AnchorResult }) {
  const rep = buildAnchorReport(result);
  const [t1, t2] = rep.top2;
  return (
    <OBook>
      <OCover
        klabel="EVALUATION REPORT · 职业锚测评"
        title={<span>职业锚<br />测评报告</span>}
        subtitle="八种职业锚 —— 内心深处最不愿放弃的东西，决定什么样的努力能让你长久有干劲"
        info={[["姓　　名", name || "—"], ["年　　级", grade || "—"], ["职业锚 Top2", rep.top2.map((t) => t.label).join(" · ")], ["报告日期", date ?? TODAY()]]}
      />
      <OPage no={2} foot="EVALUATION REPORT · ANCHOR">
        <OPartTag>PART 1</OPartTag>
        <h2>测评结果</h2>
        <div style={{ marginTop: 18 }}>
          <OTypeHero code={`${t1.code}·${t2.code}`} name={`${t1.label} · ${t2.label}`} headline={result.summary} />
        </div>
        <OSecTitle n={1} title="八种职业锚得分" sub="满分 5 分 · 红 <3.0 卡点 · 黄 3.0–3.7 · 绿 ≥3.8" />
        <OCard>
          <OHBars rows={ANCHOR_ORDER.map((k) => ({ label: ANCHOR_LABEL[k], value: result.dims[k], max: 5 }))} height={320} />
        </OCard>
      </OPage>
      <OPage no={3} foot="EVALUATION REPORT · ANCHOR">
        <OSecTitle n={2} title="Top2 深度解读" />
        <div className="ob-grid2">
          {rep.top2.map((t, i) => (
            <OCard key={t.key}>
              <div className="ob-klabel" style={{ marginBottom: 8 }}>{i === 0 ? "第一锚" : "第二锚"} · {t.label} {t.score}</div>
              <p className="ob-muted">{t.feature}</p>
            </OCard>
          ))}
        </div>
        <OSecTitle n={3} title="给未来的你" sub="升学与选专业的参考" />
        <ODots
          items={[
            ...t1.studyImpact.slice(0, 2),
            ...t2.studyImpact.slice(0, 2),
            `适合关注的职业领域：${[...new Set([...t1.careerFields, ...t2.careerFields])].join("、")}。`,
            "职业锚会随经历微调，建议每学年复测一次，观察自己的变化。",
          ]}
        />
      </OPage>
    </OBook>
  );
}

/* ================= 6. 心理健康（通用版 PHQ-9 + GAD-7） ================= */
const MENTAL_COLOR: Record<string, string> = { 良好: "#3CC078", 关注: "#F0A92E", 预警: "#E4572E", 高风险: "#E4572E" };

export function OliveMentalV2({ result, name, grade, date }: OliveBaseProps & { result: MentalV2Result }) {
  const color = MENTAL_COLOR[result.level] ?? "#F0A92E";
  return (
    <OBook>
      <OCover
        klabel="EVALUATION REPORT · 心理健康测评"
        title={<span>心理健康<br />测评报告</span>}
        subtitle="情绪状态 · 压力感受 —— 照顾好心情，才有力气学习"
        info={[["姓　　名", name || "—"], ["年　　级", grade || "—"], ["测评工具", "PHQ-9 · GAD-7"], ["报告日期", date ?? TODAY()]]}
        note="本报告为状态参考，不构成医学诊断。如连续两周以上情绪低落或焦虑，请及时告知家长、老师或寻求专业帮助。"
      />
      <OPage no={2} foot="EVALUATION REPORT · MENTAL">
        <OPartTag>PART 1</OPartTag>
        <h2>测评结果</h2>
        <div className="ob-grid2" style={{ marginTop: 18 }}>
          <OCard style={{ textAlign: "center", padding: "34px 20px" }}>
            <div className="ob-klabel">抑郁情绪筛查 PHQ-9</div>
            <div style={{ fontSize: 52, fontWeight: 800, color, margin: "14px 0 4px" }}>
              {result.phq9}
              <small style={{ fontSize: 16, color: "#8FA39B" }}> / 27</small>
            </div>
            <OTag hi>{result.phq9Level}</OTag>
          </OCard>
          <OCard style={{ textAlign: "center", padding: "34px 20px" }}>
            <div className="ob-klabel">焦虑情绪筛查 GAD-7</div>
            <div style={{ fontSize: 52, fontWeight: 800, color, margin: "14px 0 4px" }}>
              {result.gad7}
              <small style={{ fontSize: 16, color: "#8FA39B" }}> / 21</small>
            </div>
            <OTag hi>{result.gad7Level}</OTag>
          </OCard>
        </div>
        <OBigScore label="综合状态评定" value={result.level} color={color} />
        <OCard>
          <div className="ob-klabel" style={{ marginBottom: 8 }}>解读</div>
          <p className="ob-muted">{result.summary}</p>
        </OCard>
        <OSecTitle n={1} title="继续保持的好习惯" />
        <ODots items={result.positives.length > 0 ? result.positives : ["规律作息：尽量固定睡觉和起床时间，睡好了情绪才稳。", "每周 3 次、每次 30 分钟以上的运动，是天然的「情绪调节器」。", "保持至少一位可以倾诉的信任对象（朋友、家人、老师），有话别憋着。"]} />
      </OPage>
    </OBook>
  );
}
