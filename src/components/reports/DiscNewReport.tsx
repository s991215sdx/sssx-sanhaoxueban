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
  discNewAxisDots,
  type DiscNewResult,
  type DiscNewFactor,
} from "@contracts/discNew";

/**
 * v247 DISC（学生版新 / 家长版新）报告视图：复刻版 12 页 A4 报告的屏幕呈现。
 * 内容与复刻版一致（封面/四轴图/因子倾向度/96词库/三个我/阻碍与支持/相处方式/测评介绍/封底），
 * 打印走页面「所见即所得」管线，各节之间自动分页。
 */

const F_COLOR: Record<DiscNewFactor, string> = { D: "#e74c3c", I: "#f39c12", S: "#27ae60", C: "#2980b9" };
const DOT_COLOR = { real: "#e67e22", scene: "#8e44ad", pressure: "#2c3e50" } as const;

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
  const who = label ? `${label}（家长）` : name;
  const realT = discNewTopTypes(result.net);
  const sceneT = discNewTopTypes(result.sceneScores);
  const presT = discNewTopTypes(result.pressureScores);
  const prof = DISC_NEW_TYPE_PROFILES[result.primary];
  const domFactor = realT.order[0];

  const typeChip = (t: ReturnType<typeof discNewTopTypes>, color: string, text: string) => (
    <div className="flex-1 rounded-xl border border-border bg-cream px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11.5px] text-olive-mute">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        {text}
      </div>
      <div className="mt-1 text-[14.5px] font-bold" style={{ color: F_COLOR[t.top[0]] }}>
        {t.top.join(" ")}{t.typeName ? `（${t.typeName}）` : ""}
      </div>
    </div>
  );

  const paraOrder = DISC_NEW_FACTORS.slice().sort((a, b) => Math.abs(result.pct[b]) - Math.abs(result.pct[a]));
  const hlSet = Object.fromEntries(DISC_NEW_FACTORS.map((f) => [f, discNewHlWords(f, result.pct[f])])) as Record<string, string[]>;

  const pressureCards = DISC_NEW_PRESSURE_CARDS.filter((c) => c.cond(result.pct));

  const sceneChange =
    sceneT.typeKey === realT.typeKey
      ? `与真实的我基本一致，在${scene.subject}环境中仍能按照自己的行为偏好行事。`
      : (DISC_NEW_CHANGE_TEXT.scene[domFactor] ?? "").replace("{场景}", scene.subject);
  const presChange =
    presT.typeKey === realT.typeKey ? DISC_NEW_CHANGE_TEXT.same : (DISC_NEW_CHANGE_TEXT.pressure[presT.order[0]] ?? DISC_NEW_CHANGE_TEXT.same);

  const arts = DISC_NEW_ARTICLES[result.primary]
    ? DISC_NEW_FACTORS.map((ck) => DISC_NEW_ARTICLES[result.primary]![ck]).filter((a): a is NonNullable<typeof a> => !!a)
    : [];
  const artPages: (typeof arts)[] = arts.length ? [arts.slice(0, 2), arts.slice(2)] : [];

  const Sec = ({ title, children, page }: { title: string; children: React.ReactNode; page: string }) => (
    <section className="paper-card p-5 print:break-after-page">
      <div className="border-b border-[#1E3530]/10 pb-2">
        <div className="text-[11px] tracking-wide text-olive-mute">{scene.reportTitle}</div>
        <h3 className="mt-0.5 text-[16px] font-bold text-olive">{title}</h3>
      </div>
      {children}
      <div className="mono mt-4 text-right text-[10.5px] text-olive-mute">{page}</div>
    </section>
  );

  return (
    <div className="space-y-4">
      {/* P1 封面 */}
      <section className="paper-card flex min-h-[420px] flex-col items-center justify-center p-8 text-center print:break-after-page">
        <p className="max-w-md text-[12.5px] leading-relaxed text-olive-mute">
          “每个人都是天才，但如果你用爬树的能力评断一条鱼，他将终其一生觉得自己是个笨蛋。” ——爱因斯坦
        </p>
        <h2 className="mt-8 text-[26px] font-bold leading-snug text-olive">{scene.reportTitle}</h2>
        <div className="mt-8 text-[14px] leading-relaxed text-olive-soft">
          <b className="text-[16px] text-olive">{who}</b>
          <br />
          {result.scene === "family" ? "成人" : "学生"}
          <br />
          评估日期：{date ?? new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
          <br />
          施测机构：三好学伴
        </div>
        <div className="mono mt-10 text-[10.5px] tracking-wider text-olive-mute">DISC REPORT · 三好学伴测评系统</div>
      </section>

      {/* P2 基本情况解读 */}
      <Sec title="1 基本情况解读" page="第 01 页">
        <div className="mt-4 space-y-3">
          {DISC_NEW_AXES.map((ax) => (
            <div key={ax.f} className="flex items-center gap-3">
              <span className="w-6 text-[13px] font-bold" style={{ color: F_COLOR[ax.f] }}>{ax.f}</span>
              <div className="flex-1">
                <div className="relative h-3 rounded-full bg-cream-deep">
                  <span className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `calc(${discNewAxisDots(result.net[ax.f])}% - 7px)`, background: DOT_COLOR.real }} />
                  <span className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `calc(${discNewAxisDots(result.sceneScores[ax.f])}% - 7px)`, background: DOT_COLOR.scene }} />
                  <span className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `calc(${discNewAxisDots(result.pressureScores[ax.f])}% - 7px)`, background: DOT_COLOR.pressure }} />
                </div>
                <div className="mt-0.5 flex justify-between text-[11px] text-olive-mute"><span>{ax.left}</span><span>{ax.right}</span></div>
              </div>
            </div>
          ))}
          <div className="flex gap-3 pt-1 text-[11px] text-olive-soft">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: DOT_COLOR.real }} />真实的我</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: DOT_COLOR.scene }} />{scene.subject}中的我</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: DOT_COLOR.pressure }} />压力下的我</span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {typeChip(realT, DOT_COLOR.real, "真实的我")}
          {typeChip(sceneT, DOT_COLOR.scene, `${scene.subject}中的我`)}
          {typeChip(presT, DOT_COLOR.pressure, "压力下的我")}
        </div>
        <p className="mt-4 text-[13.5px] text-olive-soft">{who}可能有以下行为特征：</p>
      </Sec>

      {/* P3 因子倾向度 */}
      <Sec title="DISC四种类型因子倾向度" page="第 02 页">
        <p className="mt-3 text-[13px] leading-relaxed text-olive-soft">
          DISC四种类型因子，每个人可能都有，只是所占比例、倾向程度不同；{DISC_NEW_FACTORS.map((f) => `${who} ${f}倾向度为${result.pct[f]}%`).join("，")}，它们不同程度地影响着{who}的行为特征：
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DISC_NEW_FACTORS.map((f) => (
            <div key={f} className="rounded-xl px-3 py-2.5 text-white" style={{ background: F_COLOR[f] }}>
              <div className="text-[11px] opacity-90">{f} {DISC_NEW_AXES.find((a) => a.f === f)!.right}</div>
              <div className="text-[20px] font-bold">{result.pct[f]}%</div>
              <div className="mt-1 h-1.5 rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, Math.abs(result.pct[f]))}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2.5">
          {paraOrder.map((f) => (
            <p key={f} className="text-[13px] leading-relaxed text-olive-soft" style={{ textIndent: "2em" }}>
              {DISC_NEW_FACTOR_TEXT[`${f}_${result.pct[f] >= 0 ? "high" : "low"}`]}
            </p>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-cream-deep/60 px-3.5 py-3 text-[13px] leading-relaxed text-olive-soft">
          <b className="text-olive">{who}可能避免的消极因素：</b>{prof.avoid}<br />
          <b className="text-olive">{who}可能想要的激励因素：</b>{prof.want}<br />
          <b className="text-olive">{who}可能倾向的沟通方式：</b>{prof.style}
        </div>
      </Sec>

      {/* P4 词库表 */}
      <Sec title="DISC程度特征词" page="第 03 页">
        <p className="mt-3 text-[13px] leading-relaxed text-olive-soft" style={{ textIndent: "2em" }}>
          请仔细阅读以下四列中用不同颜色所着重标志的特征词，这些特征词是{who}四个因子聚集程度的一系列描述，这一系列特征词描述大致涵盖了{who}最可能的行为表征。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DISC_NEW_FACTORS.map((f) => (
            <div key={f} className="overflow-hidden rounded-xl border border-border">
              <div className="py-1.5 text-center text-[12.5px] font-bold text-white" style={{ background: F_COLOR[f] }}>{f}</div>
              {[...DISC_NEW_WORD_BANK[f].pos, ...DISC_NEW_WORD_BANK[f].neg].map((w) => {
                const hl = hlSet[f].includes(w);
                return (
                  <div key={w} className="border-t border-border/60 px-2 py-1 text-center text-[12px]" style={hl ? { color: F_COLOR[f], background: `${F_COLOR[f]}18`, fontWeight: 600 } : { color: "#8a8f78" }}>
                    {w}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Sec>

      {/* P5 三个我（上） */}
      <Sec title='2 "三个我"解读' page="第 04 页">
        <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-olive-soft">
          <p><b className="text-olive">{who}具有的个性优势：</b>{prof.strength}</p>
          <p><b className="text-olive">{who}可能出现的支持性因素：</b>{prof.support}</p>
          <p><b className="text-olive">{who}可能日常行为：</b></p>
        </div>
        <div className="mt-2 grid grid-cols-[86px_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-border bg-cream px-3.5 py-3 text-[12.5px]">
          <span className="text-olive-mute">沟通方式</span><span className="text-olive-soft">{prof.comm.way}</span>
          <span className="text-olive-mute">眼神交流</span><span className="text-olive-soft">{prof.comm.eye}</span>
          <span className="text-olive-mute">身体语言</span><span className="text-olive-soft">{prof.comm.body}</span>
          <span className="text-olive-mute">处理冲突</span><span className="text-olive-soft">{prof.comm.conflict}</span>
        </div>
        {pressureCards.map((c) => (
          <div key={c.name} className="mt-3 rounded-xl border border-terra/40 bg-terra/5 px-3.5 py-3">
            <div className="text-[13px] font-bold text-terra">需要关注{who}的要点 · {c.name}</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive-soft">{c.state}</p>
            {c.checks.length > 0 && (
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[12.5px] text-olive-soft">
                {c.checks.map((k) => <li key={k}>{k}</li>)}
              </ol>
            )}
            {c.tip && <p className="mt-1.5 text-[12px] text-olive-mute">提示:{c.tip}</p>}
          </div>
        ))}
      </Sec>

      {/* P6 三个我（下）对比 */}
      <Sec title='"三个我"对比' page="第 05 页">
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-border bg-cream px-3.5 py-3">
            <div className="text-[13.5px] font-bold text-olive">真实的我 · {realT.top.join(" ")}{realT.typeName ? `（${realT.typeName}）` : ""}</div>
          </div>
          <div className="rounded-xl border border-border bg-cream px-3.5 py-3">
            <div className="text-[13px] font-bold text-olive">与“真实的我”对比，“{scene.subject}中的我” {who}的变化：</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{sceneChange}</p>
          </div>
          <div className="rounded-xl border border-border bg-cream px-3.5 py-3">
            <div className="text-[13.5px] font-bold text-olive">压力下的我 · {presT.top.join(" ")}{presT.typeName ? `（${presT.typeName}）` : ""}</div>
          </div>
          <div className="rounded-xl border border-border bg-cream px-3.5 py-3">
            <div className="text-[13px] font-bold text-olive">与“真实的我”对比，“压力下的我” {who}的变化：</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{presChange}</p>
          </div>
        </div>
      </Sec>

      {/* P7 阻碍与支持 */}
      <Sec title={`3 ${who}的阻碍与所需的支持`} page="第 06 页">
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-terra/40 bg-terra/5 px-3.5 py-3">
            <h4 className="text-[13px] font-bold text-terra">1、以下行为可能会阻碍{who}的发展：</h4>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-olive-soft">
              {prof.blockers.map((x) => <li key={x}>{x}</li>)}
            </ol>
          </div>
          <div className="rounded-xl border border-lime/50 bg-lime-pale/50 px-3.5 py-3">
            <h4 className="text-[13px] font-bold text-olive">2、{who}可能需要他人给予以下支持：</h4>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-olive-soft">
              {prof.helpers.map((x) => <li key={x}>{x}</li>)}
            </ol>
          </div>
        </div>
      </Sec>

      {/* P8-9 相处方式 */}
      {artPages.length > 0 ? (
        artPages.map((pageArts, i) => (
          <Sec key={i} title={`4 ${who}与${scene.objectName}的相处方式`} page={`第 ${String(7 + i).padStart(2, "0")} 页`}>
            <div className="mt-3 space-y-4">
              {pageArts.map((a) => (
                <article key={a.title} className="rounded-xl border border-border bg-cream px-3.5 py-3">
                  <h4 className="text-[13.5px] font-bold text-olive">{a.title}</h4>
                  <h5 className="mt-2 text-[12px] font-bold text-olive-mute">案例：</h5>
                  <p className="mt-1 rounded-lg bg-cream-deep/60 px-3 py-2 text-[12.5px] leading-relaxed text-olive-soft">{a.case}</p>
                  <h5 className="mt-2 text-[12px] font-bold text-olive-mute">原因分析：</h5>
                  <ol className="mt-1 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-olive-soft">
                    {a.reasons.map((x) => <li key={x}>{x}</li>)}
                  </ol>
                  <h5 className="mt-2 text-[12px] font-bold text-olive-mute">相处方式建议：</h5>
                  <ol className="mt-1 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-olive-soft">
                    {a.tips.map((x) => <li key={x}>{x}</li>)}
                  </ol>
                </article>
              ))}
            </div>
          </Sec>
        ))
      ) : (
        <Sec title={`4 ${who}与${scene.objectName}的相处方式`} page="第 07 页">
          <p className="mt-3 text-[12.5px] leading-relaxed text-olive-mute">
            【{result.primary}型{result.scene === "family" ? "父母" : "学生"}相处方式案例：原版四篇案例文案暂未收录完整，首期复刻仅收录 S
            型全篇。商用版需补齐 4 主型 × 4 对象型共 16 篇。】
          </p>
        </Sec>
      )}

      {/* P10 测评介绍 */}
      <Sec title="5 测评介绍" page={`第 ${String(7 + Math.max(artPages.length, 1)).padStart(2, "0")} 页`}>
        <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft" style={{ textIndent: "2em" }}>{DISC_NEW_INTRO.theory}</p>
        {DISC_NEW_INTRO.factors.map((x) => (
          <div key={x.k} className="mt-2.5 rounded-xl border border-border bg-cream px-3.5 py-2.5">
            <b className="text-[13px] text-olive">{x.name}</b>
            <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{x.text}</p>
          </div>
        ))}
        <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft" style={{ textIndent: "2em" }}>{DISC_NEW_INTRO.closing}</p>
      </Sec>

      {/* P11 研发团队 */}
      <Sec title="研发团队" page={`第 ${String(8 + Math.max(artPages.length, 1)).padStart(2, "0")} 页`}>
        <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft" style={{ textIndent: "2em" }}>
          三好学伴测评研发团队：由教育测量、发展与教育心理学、数据科学方向成员组成，专注于 K12 学生学业发展与家庭教养场景的测评工具研发。
        </p>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-olive-soft" style={{ textIndent: "2em" }}>
          本报告基于 DISC 行为风格理论生成，测评结果描述的是行为倾向而非能力水平，亦不构成心理学诊断。人的行为可以调整和改变；当前类型只代表当前状态，会随着场景、年龄和阅历的增加而改变。
        </p>
        <p className="mt-3 rounded-xl bg-cream-deep/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-olive-mute">
          {DISC_NEW_INTRO.trust}
        </p>
      </Sec>
    </div>
  );
}
