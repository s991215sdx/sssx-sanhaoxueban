import {
  DISC_NEW_FACTORS,
  DISC_NEW_AXES,
  DISC_NEW_WORD_BANK,
  DISC_NEW_FACTOR_TEXT,
  DISC_NEW_TYPE_PROFILES,
  DISC_NEW_PRESSURE_CARDS,
  DISC_NEW_CHANGE_TEXT,
  DISC_NEW_ARTICLES,
  DISC_NEW_INTRO,
  DISC_NEW_SCENES,
  discNewTopTypes,
  discNewHlWords,
  type DiscNewResult,
  type DiscNewFactor,
} from "@contracts/discNew";
import {
  DISC_NEW_CHART_BG,
  DISC_NEW_ICON_I,
  DISC_NEW_ICON_S,
  DISC_NEW_ICON_C,
  DISC_NEW_DOT_D,
  DISC_NEW_DOT_I,
} from "@contracts/discNewChartAssets";

/**
 * v247 DISC（学生版新 / 家长版新）报告视图。
 * 与复刻原型（DISC复刻/public/js/app.js + css/style.css）逐段、逐样式一致：
 * A4 整页卡片（210mm×297mm）+ 原版配色/字号/间距/页码/封面/封底，
 * 不再套用三好学伴 olive/paper-card 设计体系。
 * CSS 全部以 .disc-new-report 作用域隔离，不影响站内其他报告。
 */

const F_COLOR: Record<DiscNewFactor, string> = { D: "#e74c3c", I: "#f39c12", S: "#27ae60", C: "#2980b9" };

/* 原版 style.css 报告段（作用域化），并补 Tailwind preflight 会重置的列表/标题默认样式 */
const REPORT_CSS = `
.disc-new-report { --dn-line:#e8e8e8; background:#525659; padding:18px 0 40px; font-family:-apple-system,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif; color:#333; }
.disc-new-report .page { width:210mm; min-height:297mm; background:#fff; margin:0 auto 18px; padding:18mm 16mm; position:relative; box-shadow:0 2px 12px rgba(0,0,0,.35); overflow:hidden; page-break-after:always; break-after:page; box-sizing:border-box; }
.disc-new-report .page-head { font-size:15px; font-weight:800; color:#2d3748; border-bottom:2px solid #2d3748; padding-bottom:6px; margin-bottom:14px; }
.disc-new-report .page-num { position:absolute; bottom:10mm; left:0; right:0; text-align:center; font-size:11px; color:#999; }
.disc-new-report .p-cover { display:flex; flex-direction:column; justify-content:center; background:linear-gradient(160deg,#f7f9fc 0%,#e8edf5 100%); }
.disc-new-report .p-cover .quote { font-size:13px; color:#6b7a90; line-height:2; border-left:3px solid #9db3cf; padding-left:12px; margin-bottom:34px; }
.disc-new-report .p-cover h1 { font-size:34px; line-height:1.5; color:#243b55; letter-spacing:2px; margin-bottom:40px; font-weight:800; }
.disc-new-report .cover-info { font-size:14px; color:#445; line-height:2.4; }
.disc-new-report .cover-info b { color:#243b55; }
.disc-new-report .cover-brand { margin-top:50px; font-size:12px; color:#8fa1b8; }
.disc-new-report .original-section-title { display:flex; align-items:stretch; margin:4px 0 24px; background:#e8f5f0; border-radius:4px; overflow:hidden; color:#242424; }
.disc-new-report .original-section-title > span { display:flex; align-items:center; background:#45b58a; color:#fff; font-size:29px; font-weight:500; padding:7px 21px; }
.disc-new-report .original-section-title > strong { padding:10px 18px; font-size:25px; line-height:1.35; font-weight:800; }
.disc-new-report .original-state-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; margin:12px 0 20px; }
.disc-new-report .original-state-chart { display:block; width:100%; height:auto; }
.disc-new-report .lead-note { font-size:14px; color:#556; margin-top:12px; }
.disc-new-report .pct-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:8px 0 14px; }
.disc-new-report .pct-card { border-radius:10px; padding:10px 12px; color:#fff; }
.disc-new-report .pct-card .pct-f { font-size:15px; font-weight:800; }
.disc-new-report .pct-card .pct-v { font-size:22px; font-weight:800; float:right; }
.disc-new-report .pct-card .pct-bar { height:6px; background:rgba(255,255,255,.35); border-radius:3px; margin-top:8px; overflow:hidden; }
.disc-new-report .pct-card .pct-bar > i { display:block; height:100%; background:#fff; border-radius:3px; }
.disc-new-report .factor-para { font-size:13px; line-height:2; color:#445; text-align:justify; margin-bottom:10px; text-indent:2em; }
.disc-new-report .trait-trio { margin-top:12px; border-top:1px solid var(--dn-line); padding-top:10px; font-size:13px; line-height:2.1; }
.disc-new-report .trait-trio b { color:#2d3748; }
.disc-new-report .bank-table { display:grid; grid-template-columns:repeat(4,1fr); gap:0; border:1px solid var(--dn-line); border-radius:8px; overflow:hidden; }
.disc-new-report .bank-col-head { text-align:center; font-weight:800; font-size:15px; color:#fff; padding:6px 0; }
.disc-new-report .bank-cell { text-align:center; font-size:12px; padding:5.5px 2px; border-top:1px solid #f0f0f0; color:#666; }
.disc-new-report .bank-cell.hl { font-weight:800; }
.disc-new-report .mi-block { margin-bottom:14px; font-size:13px; line-height:2; }
.disc-new-report .mi-block b { color:#2d3748; }
.disc-new-report .behavior-grid { display:grid; grid-template-columns:78px 1fr; gap:4px 10px; font-size:13px; line-height:1.9; margin:8px 0 14px; }
.disc-new-report .behavior-grid .bg-label { font-weight:700; color:#667; }
.disc-new-report .warn-card { background:#fdf6ec; border:1px solid #f5d9a8; border-radius:10px; padding:12px 14px; margin-bottom:10px; }
.disc-new-report .warn-card .wc-name { font-weight:800; color:#c07b16; margin-bottom:6px; }
.disc-new-report .warn-card .wc-state { font-size:13px; line-height:1.9; color:#665; }
.disc-new-report .warn-card ol { margin:6px 0 0 18px; font-size:12.5px; color:#665; line-height:1.9; }
.disc-new-report .warn-tip { font-size:12px; color:#a07a2c; margin-top:6px; }
.disc-new-report .compare-box { background:#f6f8fb; border-radius:10px; padding:12px 14px; margin-bottom:12px; }
.disc-new-report .compare-box .cb-title { font-weight:800; font-size:14px; margin-bottom:6px; color:#344; }
.disc-new-report .compare-box p { font-size:13px; line-height:2; color:#556; text-indent:2em; }
.disc-new-report .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.disc-new-report .tc-box { border-radius:10px; padding:12px 14px; }
.disc-new-report .tc-box h3 { font-size:14px; margin-bottom:8px; font-weight:700; }
.disc-new-report .tc-box ol { margin-left:16px; font-size:12.5px; line-height:2; }
.disc-new-report .tc-red { background:#fdf3f2; } .disc-new-report .tc-red h3 { color:#c0392b; }
.disc-new-report .tc-green { background:#f2fbf5; } .disc-new-report .tc-green h3 { color:#1e8449; }
.disc-new-report .article { margin-bottom:16px; }
.disc-new-report .article h3 { font-size:15px; color:#243b55; margin-bottom:8px; font-weight:700; }
.disc-new-report .article h4 { font-size:13px; color:#445; margin:8px 0 4px; font-weight:700; }
.disc-new-report .article p, .disc-new-report .article li { font-size:12.5px; line-height:1.95; color:#556; text-align:justify; }
.disc-new-report .article ol { margin-left:16px; }
.disc-new-report .article .case-quote { background:#f6f8fb; border-radius:8px; padding:10px 12px; }
.disc-new-report .intro-para { font-size:12.5px; line-height:2; color:#556; text-align:justify; text-indent:2em; margin-bottom:10px; }
.disc-new-report .intro-factor { margin-bottom:10px; }
.disc-new-report .intro-factor b { font-size:13px; color:#243b55; }
.disc-new-report .intro-factor p { font-size:12.5px; line-height:1.95; color:#556; text-align:justify; }
.disc-new-report .p-back { display:flex; flex-direction:column; justify-content:flex-end; }
.disc-new-report .back-info { font-size:12px; color:#99a; line-height:2.2; }
.disc-new-report .copy-note { position:absolute; bottom:10mm; left:16mm; right:16mm; font-size:10px; color:#bbc; border-top:1px solid var(--dn-line); padding-top:6px; }
/* Tailwind preflight 会清除 ol 默认样式，这里还原原版的十进制列表 */
.disc-new-report ol { list-style:decimal; padding-left:0; }
.disc-new-report .page ol li { display:list-item; }
@media (max-width:560px) { .disc-new-report .page { width:100%; min-height:auto; padding:20px 16px; } }
@media print {
  @page { size:A4; margin:0; }
  .disc-new-report { background:#fff; padding:0; }
  .disc-new-report .page { margin:0; box-shadow:none; width:auto; min-height:auto; height:297mm; }
}
`;

function OriginalStateChart({
  title,
  scores,
  type,
}: {
  title: string;
  scores: Record<DiscNewFactor, number>;
  type: ReturnType<typeof discNewTopTypes>;
}) {
  const xs: Record<DiscNewFactor, number> = { D: 100, I: 200, S: 300, C: 400 };
  const ys = DISC_NEW_FACTORS.map((f) => 460 - Math.max(-24, Math.min(24, scores[f])) * 11.1);
  const points = DISC_NEW_FACTORS.map((f, i) => `${xs[f]},${ys[i]}`).join(" ");
  const typeLabel = `${type.top.join(" ")}${type.typeName ? `（${type.typeName}）` : ""}`;
  return (
    <svg className="original-state-chart" viewBox="0 0 500 832" role="img" aria-label={`${title}：${typeLabel}`}>
      <image href={DISC_NEW_CHART_BG} x="0" y="0" width="500" height="832" />
      <text x="250" y="45" textAnchor="middle" fill="#fff" fontSize="29" fontWeight="500">{title}</text>
      <polyline points={points} fill="none" stroke="#666" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      {DISC_NEW_FACTORS.map((f, i) => {
        const isAnimal = f === "S" || f === "C" || (f === "I" && scores.I > 0);
        const src = f === "D" ? DISC_NEW_DOT_D : f === "I" ? (scores.I > 0 ? DISC_NEW_ICON_I : DISC_NEW_DOT_I) : f === "S" ? DISC_NEW_ICON_S : DISC_NEW_ICON_C;
        const size = isAnimal ? 64 : 34;
        return <image key={f} href={src} x={xs[f] - size / 2} y={ys[i] - size / 2} width={size} height={size} />;
      })}
      <text x="250" y="812" textAnchor="middle" fill="#333" fontSize="25">{typeLabel}</text>
    </svg>
  );
}

export default function DiscNewReport({
  result,
  name,
  label,
  date,
}: {
  result: DiscNewResult;
  /** 受测者显示名（学生=姓名；家长=label）。 */
  name: string;
  /** 家长版填写人标签（爸爸/妈妈…），学生版不传。 */
  label?: string;
  /** 测评日期（原始记录作答时间）。 */
  date?: string;
}) {
  const scene = DISC_NEW_SCENES[result.scene];
  const who = label || name;
  const realT = discNewTopTypes(result.net);
  const sceneT = discNewTopTypes(result.sceneScores);
  const presT = discNewTopTypes(result.pressureScores);
  const prof = DISC_NEW_TYPE_PROFILES[realT.order[0]];
  const domFactor = realT.order[0];
  const dateStr =
    date ?? new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const reportNo = `DISC-${Array.from(`${who}${dateStr}`)
    .reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
    .toString(36)
    .toUpperCase()}`;

  /* P3 解读段落：按因子倾向度绝对值排序 */
  const paraOrder = DISC_NEW_FACTORS.slice().sort((a, b) => Math.abs(result.pct[b]) - Math.abs(result.pct[a]));

  /* P4 96 词库高亮 */
  const hlSet = Object.fromEntries(DISC_NEW_FACTORS.map((f) => [f, discNewHlWords(f, result.pct[f])])) as Record<string, string[]>;

  /* P5 压力卡片 */
  const pressureCards = DISC_NEW_PRESSURE_CARDS.filter((c) => c.cond(result.pct));

  /* P6 对比 */
  const sceneChange =
    sceneT.typeKey === realT.typeKey
      ? `与真实的我基本一致，在${scene.subject}环境中仍能按照自己的行为偏好行事。`
      : (DISC_NEW_CHANGE_TEXT.scene[domFactor] ?? "").replace("{场景}", scene.subject);
  const presChange =
    presT.typeKey === realT.typeKey
      ? DISC_NEW_CHANGE_TEXT.same
      : (DISC_NEW_CHANGE_TEXT.pressure[presT.order[0]] ?? DISC_NEW_CHANGE_TEXT.same);

  /* P8-9 相处方式（原版分页规则：前 2 篇 / 后 2 篇，不足则重复前 2 篇） */
  const arts = DISC_NEW_ARTICLES[realT.order[0]]
    ? DISC_NEW_FACTORS.map((ck) => DISC_NEW_ARTICLES[realT.order[0]]![ck]).filter((a): a is NonNullable<typeof a> => !!a)
    : [];
  const artPages = arts.length ? [arts.slice(0, 2), arts.slice(2).length ? arts.slice(2) : arts.slice(0, 2)] : [];

  const Head = ({ title }: { title: string }) => (
    <>
      <div className="page-head">{scene.reportTitle}</div>
      <div className="page-head" style={{ border: "none", fontSize: 17 }}>{title}</div>
    </>
  );
  const PageNum = ({ n }: { n: number }) => <div className="page-num">第 {String(n).padStart(2, "0")} 页</div>;

  return (
    <div className="disc-new-report">
      <style>{REPORT_CSS}</style>

      {/* P1 封面 */}
      <div className="page p-cover">
        <div className="quote">每个人都是天才，但如果你用爬树的能力评断一条鱼，他将终其一生觉得自己是个笨蛋。 ——爱因斯坦</div>
        <h1>DISC{scene.subject}个性<br />和行为模式<br />报告</h1>
        <div className="cover-info">
          <b>{who}</b>
          <br />
          {result.scene === "family" ? "成人" : "学生"}
          <br />
          评估日期：{dateStr}
          <br />
          施测机构：三好学伴
        </div>
        <div className="cover-brand">DISC REPORT · 三好学伴测评系统</div>
      </div>

      {/* P2 基本情况解读：原版三栏纵向四轴图 */}
      <div className="page">
        <div className="original-section-title"><span>1</span><strong>基本情况解读</strong></div>
        <div className="original-state-grid">
          <OriginalStateChart title="真实的我" scores={result.net} type={realT} />
          <OriginalStateChart title={`${scene.subject}中的我`} scores={result.sceneScores} type={sceneT} />
          <OriginalStateChart title="压力下的我" scores={result.pressureScores} type={presT} />
        </div>
        <p className="lead-note">{who}可能有以下行为特征：</p>
        <PageNum n={1} />
      </div>

      {/* P3 因子倾向度 */}
      <div className="page">
        <Head title="DISC四种类型因子倾向度" />
        <p className="factor-para" style={{ textIndent: 0 }}>
          DISC四种类型因子，每个人可能都有，只是所占比例、倾向程度不同；
          {DISC_NEW_FACTORS.map((f) => `${who} ${f}倾向度为${result.pct[f]}%`).join("，")}，它们不同程度地影响着{who}的行为特征：
        </p>
        <div className="pct-grid">
          {DISC_NEW_FACTORS.map((f) => (
            <div className="pct-card" key={f} style={{ background: F_COLOR[f] }}>
              <span className="pct-f">{f} {DISC_NEW_AXES.find((a) => a.f === f)!.right}</span>
              <span className="pct-v">{result.pct[f]}%</span>
              <div className="pct-bar"><i style={{ width: `${Math.min(100, Math.abs(result.pct[f]))}%` }} /></div>
            </div>
          ))}
        </div>
        {paraOrder.map((f) => (
          <p className="factor-para" key={f}>{DISC_NEW_FACTOR_TEXT[`${f}_${result.pct[f] >= 0 ? "high" : "low"}`]}</p>
        ))}
        <div className="trait-trio">
          <b>{who}可能避免的消极因素：</b>{prof.avoid}<br />
          <b>{who}可能想要的激励因素：</b>{prof.want}<br />
          <b>{who}可能倾向的沟通方式：</b>{prof.style}
        </div>
        <PageNum n={2} />
      </div>

      {/* P4 DISC程度特征词（96 词库高亮表） */}
      <div className="page">
        <Head title="DISC程度特征词" />
        <p className="factor-para" style={{ textIndent: 0 }}>
          请仔细阅读以下四列中用不同颜色所着重标志的特征词，这些特征词是{who}四个因子聚集程度的一系列描述，这一系列特征词描述大致涵盖了{who}最可能的行为表征。
        </p>
        <div className="bank-table">
          {DISC_NEW_FACTORS.map((f) => (
            <div key={f}>
              <div className="bank-col-head" style={{ background: F_COLOR[f] }}>{f}</div>
              {DISC_NEW_WORD_BANK[f].pos.concat(DISC_NEW_WORD_BANK[f].neg).map((w) => (
                <div
                  key={w}
                  className={`bank-cell${hlSet[f].includes(w) ? " hl" : ""}`}
                  style={hlSet[f].includes(w) ? { color: F_COLOR[f], background: `${F_COLOR[f]}18` } : undefined}
                >
                  {w}
                </div>
              ))}
            </div>
          ))}
        </div>
        <PageNum n={3} />
      </div>

      {/* P5 "三个我"（上） */}
      <div className="page">
        <Head title={'2 "三个我"解读'} />
        <div className="mi-block"><b>{who}具有的个性优势：</b>{prof.strength}</div>
        <div className="mi-block"><b>{who}可能出现的支持性因素：</b>{prof.support}</div>
        <div className="mi-block"><b>{who}可能日常行为：</b></div>
        <div className="behavior-grid">
          <div className="bg-label">沟通方式</div><div>{prof.comm.way}</div>
          <div className="bg-label">眼神交流</div><div>{prof.comm.eye}</div>
          <div className="bg-label">身体语言</div><div>{prof.comm.body}</div>
          <div className="bg-label">处理冲突</div><div>{prof.comm.conflict}</div>
        </div>
        {pressureCards.map((c) => (
          <div className="warn-card" key={c.name}>
            <div className="wc-name">需要关注{who}的要点 · {c.name}</div>
            <div className="wc-state">{c.state}</div>
            {c.checks.length > 0 && <ol>{c.checks.map((k) => <li key={k}>{k}</li>)}</ol>}
            {c.tip ? <div className="warn-tip">提示：{c.tip}</div> : null}
          </div>
        ))}
        <PageNum n={4} />
      </div>

      {/* P6 "三个我"（下） */}
      <div className="page">
        <Head title={'"三个我"对比'} />
        <div className="compare-box">
          <div className="cb-title">真实的我 · {realT.top.join(" ")}{realT.typeName ? `（${realT.typeName}）` : ""}</div>
        </div>
        <div className="compare-box">
          <div className="cb-title">与"真实的我"对比，"{scene.subject}中的我" {who}的变化：</div>
          <p>{sceneChange}</p>
        </div>
        <div className="compare-box">
          <div className="cb-title">压力下的我 · {presT.top.join(" ")}{presT.typeName ? `（${presT.typeName}）` : ""}</div>
        </div>
        <div className="compare-box">
          <div className="cb-title">与"真实的我"对比，"压力下的我" {who}的变化：</div>
          <p>{presChange}</p>
        </div>
        <PageNum n={5} />
      </div>

      {/* P7 阻碍与支持 */}
      <div className="page">
        <Head title={`3 ${who}的阻碍与所需的支持`} />
        <div className="two-col">
          <div className="tc-box tc-red">
            <h3>1、以下行为可能会阻碍{who}的发展：</h3>
            <ol>{prof.blockers.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
          <div className="tc-box tc-green">
            <h3>2、{who}可能需要他人给予以下支持：</h3>
            <ol>{prof.helpers.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
        </div>
        <PageNum n={6} />
      </div>

      {/* P8-9 相处方式 */}
      {artPages.length > 0 ? (
        artPages.map((pageArts, i) => (
          <div className="page" key={i}>
            <Head title={`4 ${who}与${scene.objectName}的相处方式`} />
            {pageArts.map((a) => (
              <div className="article" key={a.title}>
                <h3>{a.title}</h3>
                <h4>案例：</h4>
                <p className="case-quote">{a.case}</p>
                <h4>原因分析：</h4>
                <ol>{a.reasons.map((x) => <li key={x}>{x}</li>)}</ol>
                <h4>相处方式建议：</h4>
                <ol>{a.tips.map((x) => <li key={x}>{x}</li>)}</ol>
              </div>
            ))}
            <PageNum n={7 + i} />
          </div>
        ))
      ) : (
        <div className="page">
          <Head title={`4 ${who}与${scene.objectName}的相处方式`} />
          <div className="article">
            <p style={{ color: "#999" }}>
              【{realT.order[0]}型{scene.objectName === "孩子" ? "父母" : "学生"}相处方式案例：原版四篇案例文案暂未收录完整，首期复刻仅收录 S 型全篇。商用版需补齐 4 主型 × 4 对象型共 16 篇。】
            </p>
          </div>
          <PageNum n={7} />
        </div>
      )}

      {/* 测评介绍 */}
      <div className="page">
        <Head title="5 测评介绍" />
        <p className="intro-para">{DISC_NEW_INTRO.theory}</p>
        {DISC_NEW_INTRO.factors.map((x) => (
          <div className="intro-factor" key={x.name}>
            <b>{x.name}</b>
            <p>{x.text}</p>
          </div>
        ))}
        <p className="intro-para">{DISC_NEW_INTRO.closing}</p>
        <PageNum n={7 + Math.max(artPages.length, 1)} />
      </div>

      {/* 研发团队 */}
      <div className="page">
        <Head title="研发团队" />
        <p className="intro-para">三好学伴测评研发团队：由教育测量、发展与教育心理学、数据科学方向成员组成，专注于 K12 学生学业发展与家庭教养场景的测评工具研发。</p>
        <p className="intro-para">本报告基于 DISC 行为风格理论生成，测评结果描述的是行为倾向而非能力水平，亦不构成心理学诊断。人的行为可以调整和改变；当前类型只代表当前状态，会随着场景、年龄和阅历的增加而改变。</p>
        <PageNum n={8 + Math.max(artPages.length, 1)} />
      </div>

      {/* 封底 */}
      <div className="page p-back">
        <div className="page-head" style={{ border: "none" }}>{scene.reportTitle}</div>
        <div className="back-info">
          受测者：{who}<br />
          评估日期：{dateStr}<br />
          施测机构：三好学伴<br />
          报告编号：{reportNo}
        </div>
        <div className="copy-note">本报告由三好学伴测评系统自动生成，仅供个人发展与家庭教育参考。</div>
      </div>
    </div>
  );
}
