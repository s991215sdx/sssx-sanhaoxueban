/**
 * 家庭教育认知报告 · 完整版渲染（v250）
 *
 * 为什么是「拼字符串」而不是 JSX：这份报告是要打印/另存 PDF 的版面，13 页 A4、
 * 每一页都靠 mm 级定位。JSX 一层层组件化以后，改动一处间距就要跨三个文件找，
 * 反而更容易走形。这里按「一页一个函数」摆，版式与原版《完整版》样例逐页对齐，
 * 数据只从 FamilyFullReport 里取——渲染层不判断、不算分。
 *
 * 与产品页面的隔离：样式全部挂在 `.famrpt` 下（见 FAM_REPORT_CSS），
 * 不会污染测评中心与后台；打印时每页 page-break-after，一份恰好 13 张纸。
 */
import type { FamilyFullReport, Band, Disc4 } from "@contracts/familyFullReport";

const H = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

const LEVEL_CN: Record<string, string> = { L1: "第一级", L2: "第二级", L3: "第三级", L4: "第四级", L5: "第五级" };
const BAND_CLS: Record<Band, string> = { 断: "r", 勉强: "y", 通: "g", 稳: "g", 未测: "y" };
const BAND_WORD: Record<Band, string> = { 断: "断了", 勉强: "勉强", 通: "通了", 稳: "很稳", 未测: "未测" };

/** 台阶配色：病根深、跟着坏的浅。 */
function stairFill(band: Band, isRoot: boolean): string {
  if (band === "断") return isRoot ? "#C4453D" : "#D18B85";
  if (band === "勉强") return "#C98A16";
  if (band === "稳") return "#0B8A63";
  return "#0EA875";
}

function head(r: FamilyFullReport): string {
  const iso = r.meta.dateText.replace(/ 年 /g, "-").replace(/ 月 /g, "-").replace(/ 日/g, "");
  const ageBit = r.meta.ageText.match(/（(\d+) 岁）/)?.[1];
  const parts = [r.meta.studentName, ageBit ? `${ageBit} 岁` : "", r.meta.grade.replace(/（.*?）/, ""), iso].filter(Boolean);
  return `<div class="ph"><div class="l"><b>家庭教育认知报告</b></div><div class="r">${parts
    .map((p, i) => (i === 0 ? `<b>${H(p)}</b>` : H(p)))
    .join("　")}</div></div>`;
}

function foot(r: FamilyFullReport, page: number): string {
  const pn = String(page).padStart(2, "0");
  const tail = page === 13 ? `　·　报告编号 ${H(r.meta.reportNo)}` : "";
  return `<div class="pf"><span>家庭教育认知报告 · ${H(r.meta.studentName)}${tail}</span><span class="pn">${pn}</span></div>`;
}

/* ------------------------------------------------------------------ */
/* P01 封面                                                            */
/* ------------------------------------------------------------------ */

function cover(r: FamilyFullReport): string {
  return `<div class="page cover">
  <div class="inner">
    <div class="dots"><i></i><i></i><i></i></div>

    <div class="cv-head">
      <div class="cv-top">Evaluation Report · 家庭教育认知</div>
      <div class="cv-h1">家庭教育认知<br>测评报告</div>
      <div class="cv-bar"></div>
      <p class="cv-sub">不在孩子身上找问题，在关系里找卡点<br>
      五级台阶 · 亲子 DISC · 16 项盲区 · 六类资本 —— 先看清，再动手</p>
      <div class="cv-tag">完 整 版</div>
    </div>

    <div class="cv-art">
      <svg viewBox="0 -16 520 146" xmlns="http://www.w3.org/2000/svg">
        <g opacity="0.9">
          <rect x="0" y="86" width="86" height="40" rx="5" fill="#DCEFE5"/>
          <rect x="98" y="62" width="86" height="64" rx="5" fill="#BEE3D2"/>
          <rect x="196" y="42" width="86" height="84" rx="5" fill="#8FD1B5"/>
          <rect x="294" y="24" width="86" height="102" rx="5" fill="#4FB991"/>
          <rect x="392" y="6" width="86" height="120" rx="5" fill="#0EA875"/>
        </g>
        <rect x="92" y="56" width="98" height="6" rx="3" fill="#C4762A"/>
        <text x="0" y="76" fill="#8A9B92" font-size="12">第一级</text>
        <text x="98" y="52" fill="#B4621B" font-size="12" font-weight="700">第二级</text>
        <text x="196" y="32" fill="#8A9B92" font-size="12">第三级</text>
        <text x="294" y="14" fill="#8A9B92" font-size="12">第四级</text>
        <text x="392" y="-4" fill="#8A9B92" font-size="12">第五级</text>
      </svg>
      <p class="cv-art-note">五级台阶 · 你在第几级停了，上面几级就白修</p>
    </div>

    <div class="infocard">
      <div class="row"><span class="k">姓　　名</span><span class="v">${H(r.meta.studentName)}</span></div>
      <div class="row"><span class="k">年　　级</span><span class="v">${H(r.meta.ageText)}</span></div>
      <div class="row"><span class="k">报告类型</span><span class="v">完整版 · 10 节 + 附录</span></div>
      <div class="row"><span class="k">报告日期</span><span class="v">${H(r.meta.dateText)}</span></div>
      <div class="row"><span class="k">数据来源</span><span class="v long">家长卷 ${r.meta.counts.parentItems} 题 · 家长 DISC ${r.meta.counts.discGroups} 组 · 孩子关系 ${r.meta.counts.studentRel} 题 · 孩子 DISC ${r.meta.counts.discGroups} 组 · 心理量表 ${r.meta.counts.mentalItems} 题</span></div>
    </div>

    <div class="cv-foot">
      <div class="l">本报告依据家长与孩子的自评、量表筛查与性格测评综合生成，用于家庭教育方式的自我觉察，不构成医学诊断或心理治疗建议。涉及危机信号时，请优先联系学校心理老师或专业机构。</div>
      <div class="r">报告编号 <b>${H(r.meta.reportNo)}</b><br>咨询顾问　${H(r.meta.consultant)}</div>
    </div>
  </div>
</div>`;
}

/* ------------------------------------------------------------------ */
/* P02 目录                                                            */
/* ------------------------------------------------------------------ */

function toc(r: FamilyFullReport): string {
  const n = r.deviation.total;
  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>CONTENTS　目录</div>
  <h2>这本报告怎么读：<span class="em">先看现有资源，再看关系卡点</span></h2>
  <p class="lead">十节不是并列的十个话题，是一条线：<b>现有资源 → 关系卡点 → 性格与阶段 → 孩子的困难 → 成因 → 沟通方式 → 行动安排</b>。<br>
  如果只有十分钟，读第 01 节和第 09 节；想知道结论从哪来，直接翻附录。</p>

  <div class="toc">
    <div class="row"><span class="no">PART 00</span><span class="tt">现有资源<em>四个方面 · 四项值得肯定的表现，均可在附录核对</em></span><span class="pg">03</span></div>
    <div class="row"><span class="no">PART 01</span><span class="tt">关系走到第几级<em>五级台阶 · 五级的判定口径与双方作答</em></span><span class="pg">04</span></div>
    <div class="row"><span class="no">PART 02</span><span class="tt">两种性格的对照<em>DISC 双人四维分 · 16 格定位 · 同一晚各自在想什么</em></span><span class="pg">05</span></div>
    <div class="row"><span class="no">PART 03</span><span class="tt">这个阶段他要什么<em>${H(r.stage.name)} · 你欠的三笔账 · 从专制走到权威</em></span><span class="pg">06</span></div>
    <div class="row"><span class="no">PART 04</span><span class="tt">你们各自的安全感<em>两个维度 · 四象限位置 · 你们都在回避的那一头</em></span><span class="pg">07</span></div>
    <div class="row"><span class="no">PART 05</span><span class="tt">孩子世界的卡点，和孩子一起战胜困难<em>${n} 项偏离题目 · 执行 / 状态 / 关系 / 意义四组 · 每组对应的支持</em></span><span class="pg">08</span></div>
    <div class="row"><span class="no">PART 06</span><span class="tt">他为什么不说<em>三个原因：他心里没劲 · 你急他慢 · 你以为的和真实的</em></span><span class="pg">09</span></div>
    <div class="row"><span class="no">PART 07</span><span class="tt">同样一句话，两种结果<em>YES 三步：接住感受 → 说出你的感受 → 一起给方案</em></span><span class="pg">10</span></div>
    <div class="row"><span class="no">PART 08</span><span class="tt">他最常说的六句话<em>六个场景 × 三句可以直接照着说的话</em></span><span class="pg">11</span></div>
    <div class="row"><span class="no">PART 09</span><span class="tt">九十天，只练一件事<em>分四步 · 12 周打卡 · 三个月后重测什么</em></span><span class="pg">12</span></div>
    <div class="row"><span class="no">附　录</span><span class="tt">这些结论是从哪几道题来的<em>学生卷 19 题 · 家长卷 6 题 · 量表与 DISC 原始分</em></span><span class="pg">13</span></div>
  </div>

  <div class="card tint" style="margin-top:3.2mm">
    <h4>读之前，先接受一件事</h4>
    <p>这份报告里没有一句话是在评价孩子。所有「断了」「勉强」说的都是<b>你们之间的那条通道</b>，不是他这个人。
    所以看到红的地方，不用急着辩解，也不用急着自责——先看清楚它在哪一级，比什么都重要。</p>
  </div>

  <div class="src"><b>依据</b><span>家长卷 ${r.meta.counts.parentItems} 题（家庭支持 9 + 条件观察 7 + 认知对照 16 + 关系现状 18 + 投入 5）+ 家长 DISC ${r.meta.counts.discGroups} 组 + 孩子关系 ${r.meta.counts.studentRel} 题 + 孩子 DISC ${r.meta.counts.discGroups} 组 + 心理量表 ${r.meta.counts.mentalItems} 题。<b>本报告全部结论可追溯到具体题目</b>，附录列出关键题。</span></div>

  ${foot(r, 2)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* P03 PART00 现有资源                                                 */
/* ------------------------------------------------------------------ */

function part00(r: FamilyFullReport): string {
  const p = r.disc.parent;
  const c = r.disc.child;
  const l1 = r.ladder.rows[0];
  const l2 = r.ladder.rows[1];
  const pTop = p ? (["D", "I", "S", "C"] as Disc4[]).sort((a, b) => p.pct[b] - p.pct[a])[0] : "D";
  const pTopWord: Record<string, string> = {
    D: "任务导向与决策速度：遇到问题习惯于立即介入、尽快拿出办法",
    I: "关系与表达：习惯先把气氛带起来、把人拉进来一起做",
    S: "稳定与陪伴：不轻易改变节奏，愿意长期守在一件事上",
    C: "标准与准确：先看清楚、想明白，再动手",
  };
  const cTop = c ? (["D", "I", "S", "C"] as Disc4[]).sort((a, b) => c.pct[b] - c.pct[a])[0] : "S";
  const investBest = r.invest;

  const a1Body = p
    ? `家长 DISC 四维中 ${pTop} 为 ${p.pct[pTop]}，是四项里最高的一项。${pTop} 代表${pTopWord[pTop]}。孩子成绩出现波动，第一时间查原因、想办法的通常是你。`
    : "家长 DISC 还没答，这一页先用孩子那一份的结论。等家长那份补上，这一格会换成你自己的四维分。";
  const a3Body = `第${LEVEL_CN[l1.level].replace("第", "").replace("级", "")}级判定为「${l1.verdict}」：孩子选「${l1.childOpt}」${
    l1.verdict === "勉强" ? "，不是最低档的「很不符合」" : ""
  }；你选「${l1.parentOpt}」。两边方向一致，说明遇到困难时他还留着找家里的可能${
    l1.verdict === "断" ? "——只是这一次没接上" : "，只是频率降了"
  }。`;
  const a4Body = c
    ? `孩子 DISC 四维中 ${cTop} 为 ${c.pct[cTop]}，是四项${cTop === "S" ? "最高" : "里较高"}的一项。${
        cTop === "S"
          ? "S 代表关系取向：倾向维持和谐、回避正面冲突。问卷中没有一处对抗性作答——沉默是他的应对方式，不等于没有情绪。"
          : "他不是没有情绪，是把情绪放在你看不见的地方。"
      }`
    : "孩子 DISC 还没答，这一项先留白。";

  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 00　现有资源</div>
  <h2>四个方面，<span class="emg">值得肯定的地方</span></h2>
  <p class="lead">本报告后续章节将集中分析需要调整的部分。在此之前，先列出四项值得肯定的表现——<b>每一条都能在附录中找到对应题目与选项，可逐条核对。</b>这四项是后续九十天可以依托的基础。</p>

  <div class="assets">
    <div class="asset">
      <div class="ah"><span class="an">01</span><span class="at">责任承担｜遇到问题不回避</span></div>
      <div class="ab">${H(a1Body)}</div>
      <div class="ev2">家长 DISC：${H(discLine(p))}<br>孩子 DISC：${H(discLine(c))}（附录）</div>
      <div class="au"><b>建议：</b>保留行动的力度，把落点从「代为制定方案」移到「共同查找原因」。同样是介入，后一种更容易被接受。</div>
    </div>

    <div class="asset">
      <div class="ah"><span class="an">02</span><span class="at">日常在场｜关注持续且具体</span></div>
      <div class="ab">投入这几题你答了 ${investBest.count} 题，其中「${H(investBest.q)}」得分最高。指向同一结论：你对学习过程保持持续关注，而不只在结果出来时才介入。${
        r.alt
          ? `${H(r.alt.label)}答了 ${r.alt.invest.count} 题，最高的是「${H(r.alt.invest.q)}」（${r.alt.invest.score} 分）——${
              r.alt.invest.q === investBest.q ? "两个人关注的是同一件事" : "两个人的关注点不在同一处，正好互补"
            }。`
          : ""
      }</div>
      <div class="ev2">家长卷投入 5 题作答 ${investBest.count} 题；「${H(investBest.q)}」得 ${investBest.score} 分</div>
      <div class="au"><b>建议：</b>把「观察」改为「询问」，同样的关注度更容易被孩子接住。</div>
    </div>

    <div class="asset">
      <div class="ah"><span class="an">03</span><span class="at">沟通通道｜尚未关闭</span></div>
      <div class="ab">${H(a3Body)}</div>
      <div class="ev2">L1「${H(l1.name)}」——孩子：${H(l1.childOpt)}，家长：${H(l1.parentOpt)} → ${H(l1.verdict)}<br>对照 L2「${H(l2.name)}」：孩子选${H(l2.childOpt)} → ${H(l2.verdict)}</div>
      <div class="au"><b>建议：</b>修复从第一级开始。这是五级中唯一能通过日常互动自行恢复的一级。</div>
    </div>

    <div class="asset">
      <div class="ah"><span class="an">04</span><span class="at">冲突处理｜回避而非对抗</span></div>
      <div class="ab">${H(a4Body)}</div>
      <div class="ev2">孩子 DISC：${H(discLine(c))}<br>L3「${H(r.ladder.rows[2].name)}」孩子选${H(r.ladder.rows[2].childOpt)}，全卷无对抗性作答</div>
      <div class="au"><b>建议：</b>减少语言追问，改用共同活动、书面表达等非面对面方式。</div>
    </div>
  </div>

  <div class="maprow">
    <div class="mt">与后续章节的对应</div>
    <div class="mrow">
      <span><b>01 责任承担</b> → PART 07　把执行力转为提问</span>
      <span><b>02 日常在场</b> → PART 03　时间投入已足，不必再加</span>
      <span><b>03 沟通通道</b> → PART 01　修复自第一级开始</span>
      <span><b>04 冲突处理</b> → PART 08　提供非语言出口</span>
    </div>
  </div>

  <div class="concl">
    <div class="ct">四项合并的判断</div>
    <p>家庭并不缺少投入，缺的是把投入转化为对话的路径。<b>问题不在管得不够，而在管得过满、说得过少。</b><br>
    因此后续调整的方向不是加大力度，而是更换方式。</p>
  </div>

  <div class="bridge">
    <div class="bl">阅读提示</div>
    <p>下一页将指出${r.ladder.firstBroken ? `${LEVEL_CN[r.ladder.firstBroken]}已经中断` : "哪一级最吃紧"}。这与上述四项并不矛盾——<b>基础尚存、通道未闭，这一级就仍可修复。</b></p>
  </div>

  <div class="src"><b>依据</b><span>家长 DISC 四维分 · 家长卷投入项 5 题 · 五级台阶 L1/L2 双方作答 · 孩子 DISC 四维分。<b>四条均可在附录逐条核对</b>，不含推测。</span></div>

  ${foot(r, 3)}
</div>`;
}

function discLine(side: { pct: Record<Disc4, number> } | null): string {
  if (!side) return "未答";
  return `D ${side.pct.D} / I ${side.pct.I} / S ${side.pct.S} / C ${side.pct.C}`;
}

/* ------------------------------------------------------------------ */
/* P04 PART01 五级台阶                                                 */
/* ------------------------------------------------------------------ */

function part01(r: FamilyFullReport): string {
  const rows = r.ladder.rows;
  const root = r.ladder.firstBroken ?? r.ladder.shaky[0] ?? null;
  const pos = [8, 110, 212, 314, 416];
  const labels = [
    ["有事第一个找你", "不是先找朋友"],
    ["什么都愿意说", "不是问才说"],
    ["吵完还能说话", "不是冷战三天"],
    ["规矩能商量", "不是你说了算"],
    ["他的事他定", "不用你催着查"],
  ];

  const stairs = rows
    .map((row, i) => {
      const fill = stairFill(row.verdict, row.level === root);
      const y = 242 - i * 50;
      const badge =
        row.level === root && r.ladder.firstBroken
          ? `\n    <rect x="${pos[i]}" y="${y - 21}" width="72" height="14" rx="3" fill="#C4453D"/>
    <text x="${pos[i] + 36}" y="${y - 10.5}" text-anchor="middle" fill="#fff" font-size="8.4" font-weight="700">卡在这一级</text>`
          : "";
      const halo =
        row.level === root && r.ladder.firstBroken
          ? `\n    <rect x="${pos[i] + 2}" y="${y + 2}" width="102" height="50" rx="6" fill="none" stroke="#C4453D" stroke-opacity="0.22" stroke-width="9"/>`
          : "";
      return `${halo}
    <g filter="url(#sh)"><rect x="${pos[i]}" y="${y}" width="102" height="50" rx="6" fill="${fill}"/></g>
    <text x="${pos[i] + 51}" y="${y + 18}" text-anchor="middle" fill="#fff" font-size="10.6" font-weight="700">${LEVEL_CN[row.level]}</text>
    <text x="${pos[i] + 51}" y="${y + 33}" text-anchor="middle" fill="#fff" font-size="8.8" font-weight="600">${H(labels[i][0])}</text>
    <text x="${pos[i] + 51}" y="${y + 44}" text-anchor="middle" fill="#fff" font-size="7" opacity="0.85">${H(labels[i][1])}</text>${badge}`;
    })
    .join("\n");

  const tableRows = rows
    .map(
      (row) => `<tr>
      <td><b>${LEVEL_CN[row.level]}</b><span class="tn">${H(row.name)}</span></td>
      <td>${H(row.parentQ)}<span class="opt">你选：<b>${H(row.parentOpt)}</b></span></td>
      <td>${H(row.childQ)}<span class="opt">他选：<b>${H(row.childOpt)}</b></span></td>
      <td style="text-align:center"><span class="lg ${BAND_CLS[row.verdict]}">${BAND_WORD[row.verdict]}</span></td>
    </tr>`,
    )
    .join("\n    ");

  const headline = r.ladder.firstBroken
    ? `五个台阶，<span class="em">你们停在了${LEVEL_CN[r.ladder.firstBroken].replace("第", "第").replace("级", "级")}</span>`.replace("第", "第")
    : `五个台阶，<span class="em">${r.ladder.shaky.length ? `勉强的在${r.ladder.shaky.map((s) => LEVEL_CN[s]).join("、")}` : "五级都还通着"}</span>`;

  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 01　关系走到第几级</div>
  <h2>${headline.replace("你们停在了第", "你们停在了第")}</h2>
  <p class="lead">这五级不是打分，是<b>找卡点</b>：你在第几级停了，上面几级就白修。<br>
  怎么判断？不看感觉，看他的行为——每一级都对应一个<b>能数出来的动作</b>。</p>

  <svg class="stairfig" viewBox="0 0 600 292" xmlns="http://www.w3.org/2000/svg" style="margin-top:1.5mm">
    <defs>
      <filter id="sh" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#14322A" flood-opacity="0.16"/>
      </filter>
    </defs>
${stairs}

    <text x="580" y="52" text-anchor="end" fill="#A9C4B6" font-size="9">↑ 越往上</text>
    <text x="580" y="64" text-anchor="end" fill="#A9C4B6" font-size="9">越要放手</text>
    <text x="580" y="272" text-anchor="end" fill="#A9C4B6" font-size="9">地基</text>
  </svg>

  <div class="legendline">
    <span><i style="background:var(--accent)"></i>通了</span>
    <span><i style="background:var(--yellow)"></i>勉强</span>
    <span><i style="background:var(--red)"></i>断了</span>
    <span style="margin-left:auto">颜色深的是病根，浅的是跟着坏的</span>
  </div>

  <h3>每一级的判定依据：双方作答与对应选项</h3>
  <table class="ev">
    <tr>
      <th style="width:16%">这一级</th>
      <th style="width:36%">你答的题 · 你选的是</th>
      <th style="width:35%">他答的题 · 他选的是</th>
      <th style="width:13%;text-align:center">判定</th>
    </tr>
    ${tableRows}
  </table>
  <p class="xs" style="margin-top:1.2mm">判定规则：两边都对上才判「通」；一边勉强、一边低，判「勉强」；两边都低，判「断了」——<b>这不是你一个人的判断，是你们俩答案的对照。</b></p>

  <div class="verdict">
    <p><b>结论：${H(r.ladder.verdictText)}</b><br>
    你现在看到的三个问题（情绪差、手机停不下来、想学却做不动），也是同一件事：<span class="hl">他心里没劲，又不跟你说。</span></p>
  </div>

  <div class="src"><b>依据</b><span>家长关系 8 题 + 孩子关系 6 题（完整版另有认知对照 16 题，见附录）。每级 3–4 题加权，判定方向稳定；两级都用双方回答交叉验证。</span></div>

  ${foot(r, 4)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* P05 PART02 DISC                                                     */
/* ------------------------------------------------------------------ */

const TYPE_CN: Record<Disc4, string> = { D: "支配", I: "影响", S: "稳健", C: "谨慎" };
const TYPE_NAME: Record<Disc4, string> = { D: "支配型", I: "影响型", S: "稳健型", C: "谨慎型" };
const TYPE_TRAIT: Record<Disc4, string> = {
  D: "快、定、要结果",
  I: "热、说、要回应",
  S: "慢、忍、不表态",
  C: "细、准、要标准",
};
const TYPE_MISREAD: Record<Disc4, string> = {
  D: "你的「推动」，在他那儿是「压」",
  I: "你的「关心」，在他那儿是「吵」",
  S: "你的「忍」，在他那儿是不管了",
  C: "你的「较真」，在他那儿是「挑错」",
};
const GRID: Record<string, [string, string]> = {
  "D-D": ["都争说了算", "各划一块地盘"],
  "D-I": ["你打断他", "让他说完再反应"],
  "D-S": ["你催他退", "提前说，给缓冲"],
  "D-C": ["你只要结果", "先给理由再给期限"],
  "I-D": ["你话太多", "说重点"],
  "I-I": ["都热闹没人收尾", "定一个人收尾"],
  "I-S": ["你热他躲", "降低强度"],
  "I-C": ["你随意他较真", "先说清标准"],
  "S-D": ["你忍他逼", "说出底线"],
  "S-I": ["你被带着走", "先定节奏"],
  "S-S": ["谁都不说", "轮流开口"],
  "S-C": ["你回避他追问", "正面回答一次"],
  "C-D": ["你讲理他要快", "结论先行"],
  "C-I": ["你挑错他炸", "先说好的"],
  "C-S": ["标准太高他够不着", "降到能开始"],
  "C-C": ["互相较真", "约定「够了」的标准"],
};

function typeCard(side: FamilyFullReport["disc"]["parent"], who: string, tone: "a" | "b"): string {
  if (!side) {
    return `<div class="typecard"><div class="tch"><span class="tcn">${who}</span><span class="tct${tone === "b" ? " b" : ""}">未答</span></div>
      <p class="xs" style="margin-top:2mm">这一份还没收到，四维分留白。</p></div>`;
  }
  const rows = (["D", "I", "S", "C"] as Disc4[])
    .map((k) => {
      const on = k === side.primary;
      const cls = on ? (tone === "b" ? "on domb" : "on dom") : "on";
      const vcls = on ? (tone === "b" ? "tv hb" : "tv h") : "tv";
      return `<div class="trow"><span class="tnm">${k} ${TYPE_CN[k]}</span><span class="tb"><i class="${cls}" style="width:${side.pct[k]}%"></i></span><span class="${vcls}">${side.pct[k]}</span></div>`;
    })
    .join("\n      ");
  return `<div class="typecard">
      <div class="tch"><span class="tcn">${who}</span><span class="tct${tone === "b" ? " b" : ""}">${side.primary} ${TYPE_NAME[side.primary]}</span></div>
      ${rows}
      <p class="xs" style="margin-top:1mm">${H(TYPE_TRAIT[side.primary])} —— ${H(TYPE_MISREAD[side.primary])}</p>
    </div>`;
}

function part02(r: FamilyFullReport): string {
  const p = r.disc.parent;
  const c = r.disc.child;
  const cell = r.disc.cell;
  const order: Disc4[] = ["D", "I", "S", "C"];
  const diffs = r.disc.diffs;
  const bigDiffs = diffs
    ? order
        .filter((k) => Math.abs(diffs[k]) >= 25)
        .sort((a, b) => Math.abs(diffs[b]) - Math.abs(diffs[a]))
    : [];

  const gridRows = order
    .map((row) => {
      const cells = order
        .map((col) => {
          const [a, b] = GRID[`${row}-${col}`] ?? ["", ""];
          const hit = cell && cell.row === row && cell.col === col;
          return `<td${hit ? ' class="hit"' : ""}>${H(a)}<br>${H(b)}</td>`;
        })
        .join("");
      return `<tr>
      <th class="rh">家长 ${row}<span class="rs">${H(TYPE_TRAIT[row])}</span></th>
      ${cells}
    </tr>`;
    })
    .join("\n    ");

  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 02　两种性格的对照</div>
  <h2>${p && c ? `你是 ${p.primary}，他是 ${c.primary}：<span class="em">${p.primary === "D" && c.primary === "S" ? "一个在催，一个在退" : `${H(TYPE_TRAIT[p.primary])}遇上${H(TYPE_TRAIT[c.primary])}`}</span>` : "两种性格的对照"}</h2>
  <p class="lead">DISC 不是给自己贴标签，是看两个人的<b>默认节奏差多少</b>——你快他慢，你直他绕，你要结果他要缓冲。<br>
  ${H(r.disc.sub)}</p>

  <div class="grid2" style="margin-top:3mm">
    ${typeCard(p, "你 · 家长 DISC", "a")}
    ${typeCard(c, "他 · 孩子 DISC", "b")}
  </div>

  <p class="sm" style="margin-top:2mm">两人一比：<b>${bigDiffs.map((k) => `${k} 差 ${Math.abs(diffs![k])}`).join("、") || "四维接近"}</b>${bigDiffs.length >= 2 ? "，两维正好反向" : ""}——<span class="hl">同一件事，他要缓冲，你要结果</span>。</p>

  <h3>十六种组合：你们在中间那一格</h3>
  <table class="dm">
    <tr>
      <th style="width:17%"></th>
      <th>孩子：急 D</th><th>孩子：热 I</th><th>孩子：慢 S</th><th>孩子：细 C</th>
    </tr>
    ${gridRows}
  </table>
  <p class="xs" style="margin-top:-.5mm">橙色是你们家：<b>家长 ${cell?.row ?? "-"} × 孩子 ${cell?.col ?? "-"}</b>——${H(r.disc.cellNote)}</p>

  <h3>同一个晚上，你们各自在想什么</h3>
  <table>
    <tr><th style="width:17%">时刻</th><th style="width:41%">你的内心</th><th>他的内心</th></tr>
    <tr><td>催第一遍</td><td>「说了就该动，这有什么难的」</td><td>「知道了，别催了」（其实还没打算动）</td></tr>
    <tr><td>催第三遍</td><td>「他就是不把我当回事」</td><td>「反正做什么都要被说，那就随便吧」</td></tr>
    <tr><td>你发火</td><td>「我这么辛苦是为了谁」</td><td>「果然，我又让他失望了」</td></tr>
    <tr><td>第二天早上</td><td>「昨天的事就过去了」</td><td>「他还在生气吗」（其实没过去）</td></tr>
  </table>

  <div class="card warn" style="margin-top:2.4mm">
    <p><b>${H(r.disc.danger.split("。")[0])}。</b>${H(r.disc.danger.split("。").slice(1).join("。").replace(/^，/, ""))}</p>
  </div>

  <div class="src"><b>依据</b><span>亲子 DISC 各 <b>${r.meta.counts.discGroups} 组题</b>，四维分 你 ${H(discLine(p))}，他 ${H(discLine(c))}；16 格取双方<b>主导型</b>（家长 ${cell?.row ?? "-"} × 孩子 ${cell?.col ?? "-"}）。差值 ≥25 记为「反向」。</span></div>

  ${foot(r, 5)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* P06 PART03 阶段                                                     */
/* ------------------------------------------------------------------ */

function part03(r: FamilyFullReport): string {
  const s = r.stage;
  const demand = s.demand;
  const warm = s.warmth;
  const propose = Math.min(100, warm + 13);
  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 03　这个阶段他要什么</div>
  <h2>${s.age ?? ""} 岁，他在干一件大事：<span class="em">搞清楚「我是谁」</span></h2>
  <p class="lead">这一站的任务不是提分，是<b>把自我立起来</b>。他需要确认三件事：${s.duties.map((d) => H(d)).join("、")}。<br>
  这三件任何一件没被满足，都不会以「我需要自主」的形式说出来，而是变成<b>不听话、懒、玩手机</b>——你看到的是行为，他要的是自主。</p>

  <h3>你欠了三笔账</h3>
  <div class="grid3">
    <div class="card warn">
      <h4>时间账</h4>
      <p class="sm">他要「自己安排」，你给了他一张<b>精确到小时的时间表</b>。<br>
      <span class="xs">代价：他失去练习安排的机会，到更高年级更被动。</span></p>
    </div>
    <div class="card warn">
      <h4>语言账</h4>
      <p class="sm">他要「表达自己」，你给了他<b>评价和纠正</b>。<br>
      <span class="xs">代价：他学会只说安全的，真话留给朋友。</span></p>
    </div>
    <div class="card warn">
      <h4>情绪账</h4>
      <p class="sm">他要「被接纳」，你给了他<b>有条件的肯定</b>（考好了才夸）。<br>
      <span class="xs">代价：他把「我这个人」和「我的成绩」绑在一起。</span></p>
    </div>
  </div>

  <h3>你的管教方式：${H(s.styleLine)}</h3>
  <div class="grid2">
    <div class="card">
      <h4>要求 <span style="color:var(--warn);font-size:12pt">${demand}</span></h4>
      <p class="sm">你定的规矩多、执行得也严。这是你的强项——没有你，很多事根本推不动。</p>
    </div>
    <div class="card">
      <h4>回应 <span style="color:var(--red);font-size:12pt">${warm}</span></h4>
      <p class="sm">听他说话、问他怎么想的时候少。所以他学会了：说了也没用。</p>
    </div>
  </div>
  <p class="sm" style="margin-top:1.5mm">这类家长最常说的那句话是「<b>不用问为什么，照做就行</b>」。<br>
  他听到的是：<b>我的想法不重要。</b>久了就变成表面听话、心里很远。</p>

  <h3>要改的不是规矩，是「让他参与一次」</h3>
  <div class="grid3">
    <div class="card tint">
      <h4><span style="display:inline-flex;align-items:center;justify-content:center;width:4.6mm;height:4.6mm;border-radius:50%;background:var(--accent);color:#fff;font-size:7.6pt;margin-right:1.4mm">1</span>只加回应，不减要求</h4>
      <p class="sm">要求还是 ${demand}，不用降。先把回应从 ${warm} 提到 ${propose}：<b>他说话时，你只做一件事——听完。</b><br>
      <span class="xs">两周内不评价、不纠正、不转学习。</span></p>
    </div>
    <div class="card tint">
      <h4><span style="display:inline-flex;align-items:center;justify-content:center;width:4.6mm;height:4.6mm;border-radius:50%;background:var(--accent);color:#fff;font-size:7.6pt;margin-right:1.4mm">2</span>挑两条规矩改成协商</h4>
      <p class="sm">选最容易的两条（手机时长、周末安排）。<b>时间他定，底线你定。</b><br>
      <span class="xs">定完写下来，一个月内不改口。</span></p>
    </div>
    <div class="card tint">
      <h4><span style="display:inline-flex;align-items:center;justify-content:center;width:4.6mm;height:4.6mm;border-radius:50%;background:var(--accent);color:#fff;font-size:7.6pt;margin-right:1.4mm">3</span>让他承担一次后果</h4>
      <p class="sm">协商的事他没做到，<b>不要救，也不要翻旧账</b>，只问「下次怎么调」。<br>
      <span class="xs">自主感只能从承担后果里长出来。</span></p>
    </div>
  </div>

  <div class="quote" style="border-left:3px solid var(--accent);padding:2.4mm 3.4mm;background:#F7FAF8;font-size:9.6pt;margin-top:2.4mm">
    「你可以自己决定，但决定之后告诉我。做不到我们一起改，不骂你。」——这一句同时给了自主、边界和安全感，正好是他这一站要的三样东西。
  </div>

  <h3>这个阶段，家长最容易犯的三个错</h3>
  <table>
    <tr><th style="width:30%">做法</th><th style="width:26%">你以为在做什么</th><th>实际发生了什么</th></tr>
    <tr><td>查手机、翻书包、进房间不敲门</td><td>了解情况、防止走偏</td><td>他把「被看见」等同于「被审查」，开始藏东西</td></tr>
    <tr><td>用成绩定义人：「你就是不努力」</td><td>激励他</td><td>他把「事没做好」内化成「我不行」</td></tr>
    <tr><td>替他安排所有时间</td><td>帮他省时间</td><td>他失去练习「自己安排」的机会，越到高年级越被动</td></tr>
  </table>

  <div class="src"><b>依据</b><span>档案年级「${H(r.meta.grade.replace(/（.*?）/, ""))}」+ 年龄 ${s.age ?? "-"} → 判定为<b>${H(s.name)}</b>；要求 ${demand} / 回应 ${warm} ← 家长卷 P38–P45 八道管教题（四点量表折百分）；三笔账由阶段规则与本报告前两节结论生成，<b>不含新测评题</b>。</span></div>

  ${foot(r, 6)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* P07 PART04 安全感                                                   */
/* ------------------------------------------------------------------ */

function part04(r: FamilyFullReport): string {
  const sec = r.security;
  const p = sec.parent ?? { avoid: 50, anxiety: 50 };
  const c = sec.child ?? { avoid: 50, anxiety: 50 };
  /* 坐标：横轴「越怕被追问」52→500，纵轴「越需要确认」218→14 */
  const px = 52 + (p.avoid / 100) * 448;
  const py = 218 - (p.anxiety / 100) * 204;
  const cx = 52 + (c.avoid / 100) * 448;
  const cy = 218 - (c.anxiety / 100) * 204;
  /* 第二位家长（多为妈妈）：有她的安全感两题就多画一个点，没有就不画——
     空白比「未测」两个字更不打扰人。 */
  const altSec = r.alt?.security ?? null;
  const ax = altSec ? 52 + (altSec.avoid / 100) * 448 : 0;
  const ay = altSec ? 218 - (altSec.anxiety / 100) * 204 : 0;
  const altLabel = r.alt?.label ?? "";
  const sameZone = sec.zone !== "未测" && sec.gap.includes("同一区域");
  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 04　你们各自的安全感</div>
  <h2>你们都不缺爱，<span class="em">缺的是把它说出来</span></h2>
  <p class="lead">这一页测的不是性格，是<b>遇到不安时你们各自的第一反应</b>。两个维度：你多需要确认、你多怕被追问。两个都低是安全型；任何一个偏高，相处就开始变形。</p>

  <div style="margin-top:1.4mm">
    <svg viewBox="0 0 520 238" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7" refY="3.2" orient="auto">
          <path d="M0,0 L7,3.2 L0,6.4 z" fill="#A9C4B6"/>
        </marker>
      </defs>
      <rect x="52" y="14" width="224" height="102" fill="#FDF6E6"/>
      <rect x="276" y="14" width="224" height="102" fill="#FCEFEB"/>
      <rect x="52" y="116" width="224" height="102" fill="#EFF7F2"/>
      <rect x="276" y="116" width="224" height="102" fill="#F9FCFA"/>
      <line x1="52" y1="116" x2="276" y2="116" stroke="#DCE9E2"/>
      <line x1="276" y1="14" x2="276" y2="218" stroke="#DCE9E2"/>
      <rect x="52" y="14" width="448" height="204" fill="none" stroke="#D3E3DA"/>

      <line x1="52" y1="232" x2="510" y2="232" stroke="#A9C4B6" stroke-width="1.2" marker-end="url(#ar2)"/>
      <line x1="38" y1="218" x2="38" y2="10" stroke="#A9C4B6" stroke-width="1.2" marker-end="url(#ar2)"/>
      <text x="44" y="9" font-size="8" fill="#7C8E85">↑ 越需要确认</text>
      <text x="506" y="228" text-anchor="end" font-size="8" fill="#7C8E85">越怕被追问 →</text>

      <text x="66" y="34" font-size="9.4" font-weight="800" fill="#A0701F">焦虑型</text>
      <text x="66" y="47" font-size="7.2" fill="#A0701F">怕你走，所以要抓牢</text>
      <text x="486" y="34" text-anchor="end" font-size="9.4" font-weight="800" fill="#A8524A">混乱型</text>
      <text x="486" y="47" text-anchor="end" font-size="7.2" fill="#A8524A">又想靠近，又怕受伤</text>
      <text x="66" y="204" font-size="9.4" font-weight="800" fill="#1F6B4F">安全型</text>
      <text x="66" y="217" font-size="7.2" fill="#2E7A5E">能亲密，也能独处</text>
      <text x="486" y="204" text-anchor="end" font-size="9.4" font-weight="800" fill="#3F5B4E">回避型</text>
      <text x="486" y="217" text-anchor="end" font-size="7.2" fill="#5F7269">不期待，就不失望</text>

      <line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="#B9CFC4" stroke-dasharray="3 3"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="8" fill="#0B8A63" opacity=".14"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.6" fill="#0B8A63"/>
      <text x="${px.toFixed(1)}" y="${(py - 12).toFixed(1)}" text-anchor="middle" font-size="8.6" font-weight="700" fill="#0B8A63">你</text>
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="#D9694E" opacity=".16"/>
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.6" fill="#D9694E"/>
      <text x="${cx.toFixed(1)}" y="${(cy - 12).toFixed(1)}" text-anchor="middle" font-size="8.6" font-weight="700" fill="#B04A33">他</text>
      <text x="${px.toFixed(1)}" y="${(py + 16).toFixed(1)}" text-anchor="middle" font-size="6.8" fill="#7C8E85">回避 ${p.avoid} · 焦虑 ${p.anxiety}</text>
      <text x="${cx.toFixed(1)}" y="${(cy + 16).toFixed(1)}" text-anchor="middle" font-size="6.8" fill="#7C8E85">回避 ${c.avoid} · 焦虑 ${c.anxiety}</text>
      ${
        altSec
          ? `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="8" fill="#C9A227" opacity=".18"/>
      <circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="4.2" fill="#B8860B"/>
      <text x="${(ax + 9).toFixed(1)}" y="${(ay + 3).toFixed(1)}" font-size="8.6" font-weight="700" fill="#8A6508">${H(altLabel.slice(0, 1))}</text>
      <text x="${(ax + 9).toFixed(1)}" y="${(ay + 15).toFixed(1)}" font-size="6.6" fill="#8A6508">回避 ${altSec.avoid} · 焦虑 ${altSec.anxiety}</text>`
          : ""
      }
    </svg>
    <p class="xs" style="text-align:center;margin-top:1.4mm">${
      sameZone ? "你和他都落在同一片区域——同样的回避，不同的理由" : "你和他落在不同区域——你们的不安，来源不是同一个"
    }${altSec ? "" : ""}</p>
  </div>

  <div class="grid3" style="margin-top:2.2mm">
    <div class="card" style="padding:2.6mm 3mm">
      <h4 style="font-size:8.8pt">你的位置</h4>
      <p class="sm" style="color:var(--mute);font-size:7pt;margin-bottom:.8mm">回避 ${p.avoid} · 焦虑 ${p.anxiety}</p>
      <p class="sm">你不缺感情，是不习惯把感情说出来。遇到事更愿意去解决，而不是去谈。<b>这和你的 ${r.disc.parent?.primary ?? "主维"} ${r.disc.parent?.pct[r.disc.parent.primary] ?? ""} 是同一件事的两面</b>——把事情做完，比把感受说清容易。</p>
    </div>
    <div class="card" style="padding:2.6mm 3mm">
      <h4 style="font-size:8.8pt">他的位置</h4>
      <p class="sm" style="color:var(--mute);font-size:7pt;margin-bottom:.8mm">回避 ${c.avoid} · 焦虑 ${c.anxiety}</p>
      <p class="sm">他不是不在乎，是太早学会了「说了也没用」。${r.disc.child ? `${r.disc.child.primary} ${r.disc.child.pct[r.disc.child.primary]} 的孩子不说，不是没想法，` : ""}<b>是怕说了被否定</b>。他关门的动作，是保护，不是拒绝。</p>
    </div>
    <div class="card tint" style="padding:2.6mm 3mm">
      <h4 style="font-size:8.8pt">你们之间</h4>
      <p class="sm" style="color:var(--mute);font-size:7pt;margin-bottom:.8mm">${H(sec.gap || "都在回避")}${
        altSec ? `；${H(altLabel)}偏${H(r.alt!.zone)}` : ""
      }</p>
      <p class="sm"><b>两个都在回避的人凑在一起，家里就没有人负责说话。</b>所以你们不吵架、也不亲近——不是关系差，是都在等对方先开口。</p>
    </div>
  </div>

  <div class="verdict" style="margin-top:2.4mm;border-left-color:var(--accent);background:var(--cream)">
    <p>你们不在「缺爱」那一头，在「不说」那一头。<b>要补的不是感情，是开口的那一下。</b>感情你们都有，只是都用了不发声的方式给——你给他安排，他给你沉默。</p>
  </div>

  <h3>为什么你们俩都偏回避</h3>
  <p class="sm">你们两个用的是同一种策略，只是动作不同：<b>你靠「把事情做完」回避，他靠「不说话」回避。</b>底下的逻辑一模一样——不把期待说出口，就不会失望；不开口，就不会被否定。这套逻辑不是谁教的，是各自在家里学会的。你早就习惯了「说了也没人帮，那就自己做」；他还小，试过几次，发现说了会被纠正、被追问，于是学会了不说。<b>两个人都没错，但两个人都没得到想要的回应。</b></p>

  <div class="card warn" style="margin-top:2.2mm">
    <h4>一个 30 秒的练习</h4>
    <p class="sm">这周找一次他关门的时刻，站在门外说一句：<b>「我不进来，我就是想说一句——刚才那事，我不该那个语气。」</b>说完就走，不要求他回应。<br>
    这句话练的是「说了不一定要有结果」。对回避型的人来说，最难的不是开口，是开口之后能忍住不追问。</p>
  </div>

  <div class="src"><b>依据</b><span>家长卷 P53 / P54 两题、孩子卷 S09 / S10 两题，5 点量表折算为两个 0—100 的维度分；象限划分为二维交叉。<b>分类只描述习惯，不构成心理诊断，也不代表不可改变。</b></span></div>

  ${foot(r, 7)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* P08 PART05 偏离题                                                   */
/* ------------------------------------------------------------------ */

function part05(r: FamilyFullReport): string {
  const d = r.deviation;
  const body = d.hasData
    ? d.groups
        .map(
          (g) => `<tr class="grp"><td colspan="4">${H(g.name)} · ${g.items.length} 题</td></tr>
${g.items
  .map(
    (it) =>
      `<tr><td>${it.no}</td><td>${H(it.text)}</td><td><span class="lg ${it.score <= 2 ? "r" : "y"}">${H(it.choice)} ${it.score}</span></td><td>${H(it.why)}</td></tr>`,
  )
  .join("\n")}`,
        )
        .join("\n\n    ")
    : `<tr><td colspan="4" style="padding:6mm;text-align:center;color:#8A9B92">孩子还没做学习力诊断（E3 70 题），这一页的原始作答暂时空着。补做以后，这里会列出全部偏离正常值的题。</td></tr>`;

  const mentalRows = `<tr class="grp"><td colspan="4">两个量表 · 各 1 项</td></tr>
    <tr><td>焦虑</td><td>GAD-7，7 题，过去两周</td><td><span class="lg y">${H(r.plan.moodBand.includes("焦虑") ? "" : "")}${H(anxietyWord(r))}</span></td><td>紧张、坐不住、容易烦</td></tr>
    <tr><td>情绪</td><td>PHQ-9，9 题，过去两周</td><td><span class="lg y">${H(r.plan.moodBand)}</span></td><td>兴趣下降、疲惫；自伤条目见附录</td></tr>`;

  const quote = d.hasData && d.groups[1]?.items[0] ? d.groups[1].items[0] : d.groups[0]?.items[0];

  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 05　困难与支持</div>
  <h2>孩子世界的卡点，<span class="emg">和孩子一起战胜困难</span></h2>
  <p class="lead">这一页不加解释，只把他的原始作答摆出来。<b>下表是全部偏离正常值的题目</b>——2 分及以下、明显偏弱的 3 分项，以及负面表述拿到 4 分的题。</p>

  <table class="apx tight" style="margin-top:2.4mm">
    <tr><th style="width:8%">题号 / 项</th><th style="width:41%">他答的这道题</th><th style="width:16%">他的选择</th><th>这说明什么</th></tr>

    ${body}

    ${mentalRows}
  </table>

  <div class="verdict" style="margin-top:3mm">
    <p><b>${H(d.summary)}</b>手机和顶嘴只是外面看得见的那两层。</p>
  </div>

  <div class="bridge">
    <div class="bl">可以这样开口</div>
    <p>「我看了你填的那份问卷，有几条是我以前没想到的。${quote ? `比如你写『${H(quote.text)}』——我原来只当你是贪玩。` : ""}」</p>
  </div>

  <div class="supports">
    <div class="sp"><b>学习执行</b>拆到 15 分钟能做完的一步；问「你打算几点开始」</div>
    <div class="sp"><b>情绪与状态</b>先保睡眠，再谈学习；情绪上来先接住</div>
    <div class="sp"><b>家庭关系</b>每周留一段不谈学习的时间，20 分钟</div>
    <div class="sp"><b>目标与意义</b>说出一个具体长处；去掉表扬的条件</div>
  </div>

  <div class="firststep">
    <div class="fl">如果这周只做一件事</div>
    <p>把上面这张表打印出来，你自己先答一遍，再对照他答的。<b>对不上的那几行，就是这周要谈的。</b></p>
  </div>

  <div class="src"><b>依据</b><span>学生卷 ${d.hasData ? d.groups.flatMap((g) => g.items.map((i) => i.no)).join(" / ") : "（未作答）"} 题原始得分（1–5 分，5＝最符合）；焦虑 7 题、情绪 9 题量表分级。逐条可对照附录。</span></div>

  ${foot(r, 8)}
</div>`;
}

function anxietyWord(r: FamilyFullReport): string {
  const m = r.appendix.mental.match(/焦虑 (\S+?)（/);
  return m ? m[1] : "未测";
}

/* ------------------------------------------------------------------ */
/* P09 PART06 三原因                                                   */
/* ------------------------------------------------------------------ */

function part06(r: FamilyFullReport): string {
  const m = r.motive;
  /* 盲区表：第二位家长在时多一列，同题并排——两个人都「低估」，才是真的看不见。 */
  const altBlind = r.alt?.blind ?? [];
  const hasAltCol = !!r.alt && altBlind.length > 0;
  const blindRows = r.blind
    .map((b) => {
      const altGuess = altBlind.find((x) => x.key === b.key)?.parentGuess ?? "—";
      return hasAltCol
        ? `<tr><td><b>${H(b.label)}</b></td><td>${H(b.parentGuess)}</td><td>${H(altGuess)}</td><td>${H(b.childReal)}</td></tr>`
        : `<tr><td><b>${H(b.label)}</b></td><td>${H(b.parentGuess)}</td><td>${H(b.childReal)}</td></tr>`;
    })
    .join("\n    ");
  const pType = r.disc.parent?.primary ?? "D";
  const cType = r.disc.child?.primary ?? "S";
  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 06　他为什么不说</div>
  <h2>三个原因叠在一起，<span class="em">变成了你现在看到的样子</span></h2>
  <p class="lead">三个原因每个都很简单，但三个一起，就很难动。<b>看懂它们的顺序，才知道先动哪一个。</b></p>

  <h3>一 · 他不是不想学，是「推一下动一下」</h3>
  <p class="sm" style="margin-bottom:1.5mm">一个人愿意做一件事，通常因为四样里至少占两点。他占了 <b>${m.hit} 点</b>。</p>
  <table>
    <tr><th style="width:18%">四项动力</th><th style="width:30%">他的现状</th><th>说人话</th></tr>
    ${m.rows.map((row) => `<tr><td><b>${H(row.label)}</b></td><td>${H(row.now)}</td><td>${H(row.plain)}</td></tr>`).join("\n    ")}
  </table>
  <p class="xs" style="margin-top:1.2mm">${H(m.verdict)}</p>

  <h3>二 · 你急他慢，一个在催，一个在退</h3>
  <div class="grid2">
    <div class="card">
      <h4>你：${H(TYPE_TRAIT[pType])}</h4>
      <p class="sm">看到问题就想马上解决，最受不了「拖着不办」。<br>
      <b style="color:var(--red)">你的盲点：</b>${H(TYPE_MISREAD[pType])}。</p>
    </div>
    <div class="card">
      <h4>他：${H(TYPE_TRAIT[cType])}</h4>
      <p class="sm">不正面拒绝，先说「知道了」，然后不动。<br>
      <b style="color:var(--red)">他的盲点：</b>他的「沉默」，在你那儿是「同意」。</p>
    </div>
  </div>
  <p class="sm" style="margin-top:1.5mm"><b>你越推，他越退；他越退，你越推。</b>这个圈一旦转起来，两个人都觉得委屈——你觉得他不领情，他觉得你不懂他。</p>

  <h3>三 · 你以为的，和他真实的</h3>
  <table>
    ${
      hasAltCol
        ? `<tr><th style="width:14%">这一项</th><th style="width:27%">${H(r.meta.respondentLabel)}以为</th><th style="width:27%">${H(r.alt!.label)}以为</th><th>他真实</th></tr>`
        : `<tr><th style="width:16%">这一项</th><th style="width:40%">你以为</th><th>他真实</th></tr>`
    }
    ${blindRows || `<tr><td colspan="${hasAltCol ? 4 : 3}" style="color:#8A9B92">孩子的 E3 与家长的条件观察还没齐，这三点暂时空着。</td></tr>`}
  </table>
  <p class="xs" style="margin-top:1.2mm">三条里${r.blind.filter((b) => b.low).length}条是<b>低估</b>——不是你不了解他，是你的注意力一直在「他学得怎么样」，很少放在「他过得怎么样」。${
    hasAltCol
      ? `两位家长都低估的是：${(() => {
          const both = r.blind.filter((b) => b.low && (altBlind.find((x) => x.key === b.key)?.low ?? false));
          return both.length ? both.map((b) => b.label).join("、") : "没有——至少有一位看到了";
        })()}。`
      : ""
  }</p>

  <h3>三个原因连起来，是一个转不停的圈</h3>
  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:1.6mm;margin:1mm 0 2mm">
    <span style="font-size:8.6pt;padding:1.2mm 2.4mm;border-radius:1mm;background:#F0F7F3;color:#2B5E4C;font-weight:600">他越不说</span>
    <span style="color:#B9CFC4;font-size:8.6pt">→</span>
    <span style="font-size:8.6pt;padding:1.2mm 2.4mm;border-radius:1mm;background:#F0F7F3;color:#2B5E4C;font-weight:600">你只能靠猜</span>
    <span style="color:#B9CFC4;font-size:8.6pt">→</span>
    <span style="font-size:8.6pt;padding:1.2mm 2.4mm;border-radius:1mm;background:#F0F7F3;color:#2B5E4C;font-weight:600">猜错了就去管</span>
    <span style="color:#B9CFC4;font-size:8.6pt">→</span>
    <span style="font-size:8.6pt;padding:1.2mm 2.4mm;border-radius:1mm;background:#FBF0EE;color:#A83A33;font-weight:600">一管就吵</span>
    <span style="color:#B9CFC4;font-size:8.6pt">→</span>
    <span style="font-size:8.6pt;padding:1.2mm 2.4mm;border-radius:1mm;background:#FBF0EE;color:#A83A33;font-weight:600">他更不说</span>
  </div>
  <p class="sm">链条上任何一环打断，后面的都会松。<b>最容易打断的是最左边那一环</b>——因为它只需要你花时间，不需要他配合。</p>

  <div class="verdict">
    <p><b>所以顺序是：</b>先让他愿意说（第二级），再谈怎么学。<b>顺序反了，方法越好，反弹越大。</b></p>
  </div>

  <div class="src"><b>依据</b><span>动力四问 ← 学生卷第 3、8、13、24、36、60 题；情绪 ← 心理量表（<b>${H(anxietyWord(r))}</b>，自伤条目 ${H(r.appendix.mental.match(/自伤条目 (\d)/)?.[1] ?? "0")}）；手机 ← 第 40 题「放下就不知道干什么」、第 65 题「一玩就停不下来」；三条盲区 ← 家长卷条件观察 7 题与学生卷同维度对照。</span></div>

  ${foot(r, 9)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* P10 PART07 YES 三步                                                 */
/* ------------------------------------------------------------------ */

function part07(r: FamilyFullReport): string {
  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 07　同样一句话，两种结果</div>
  <div style="display:flex;align-items:center;gap:2.4mm;margin:1mm 0 2.2mm">
    <span style="width:1.6mm;align-self:stretch;border-radius:1mm;background:linear-gradient(180deg,#0EA875,#4FC79B)"></span>
    <span style="font-size:11.6pt;font-weight:800;color:var(--accent2)">怎么升级亲密关系，从练习好好说话开始</span>
  </div>
  <h2>同一个分数，<span class="em">两种说法，两种结果</span></h2>
  <p class="lead">孩子月考回来，把卷子往桌上一放：「数学才 62。」</p>

  <div class="grid2" style="margin-top:2.4mm">
    <div class="card" style="border-left:3px solid var(--red);background:var(--redbg);border-color:#EECFCA">
      <h4 style="color:var(--red)">常见说法</h4>
      <p class="sm" style="margin:.8mm 0 2mm">「62？上次不是 78 吗？天天抱着手机就这结果。手机给我，这周别想碰。」</p>
      <p class="sm"><b>他的反应：</b>「算了，说什么都没用。」拿着卷子回房间，门关上。<br>
      <b>结论：</b>你是「敌人那边的」。</p>
    </div>
    <div class="card" style="border-left:3px solid var(--accent);background:var(--gbg);border-color:#CFE2D8">
      <h4 style="color:var(--accent2)">换一种说法</h4>
      <p class="sm" style="margin:.8mm 0 2mm">「62 啊……你自己是不是也挺难受的？这两天看你话都少了，我心里也不是滋味。一次考试说明不了什么，我们一起看看分丢在哪儿，行吗？」</p>
      <p class="sm"><b>他的反应：</b>「……选择题错了四个，都是会做的。」<br>
      <b>结论：</b>你是「我们这边的」。</p>
    </div>
  </div>
  <p class="xs" style="margin-top:-.5mm">两句话都在说 62 分，差别只在前一句先接了什么：前一句接的是手机，后一句接的是他的难受。</p>

  <h3>后一句拆开看，就是三步</h3>
  <table class="ev">
    <tr>
      <th style="width:8%;text-align:center">步</th>
      <th style="width:24%">做什么</th>
      <th style="width:34%">那句话里对应的部分</th>
      <th>家长最常漏掉的一步</th>
    </tr>
    <tr>
      <td style="text-align:center"><span style="display:inline-flex;align-items:center;justify-content:center;width:6mm;height:6mm;border-radius:50%;background:var(--accent);color:#fff;font-weight:800;font-size:9pt">Y</span></td>
      <td><b>说出他的感受</b><br><span class="xs">不是问「怎么考这么点」</span></td>
      <td>「你自己是不是也挺难受的？」</td>
      <td>直接跳到事实：「哪道题错了？拿出来我看」——他要的不是当场复盘</td>
    </tr>
    <tr>
      <td style="text-align:center"><span style="display:inline-flex;align-items:center;justify-content:center;width:6mm;height:6mm;border-radius:50%;background:#3FAE87;color:#fff;font-weight:800;font-size:9pt">E</span></td>
      <td><b>说出你的感受</b><br><span class="xs">平等地说「我」，不是「你」</span></td>
      <td>「我心里也不是滋味」</td>
      <td>变成指责：「你就是不努力」——说了感受，但姿态是审判</td>
    </tr>
    <tr>
      <td style="text-align:center"><span style="display:inline-flex;align-items:center;justify-content:center;width:6mm;height:6mm;border-radius:50%;background:#6BB99B;color:#fff;font-weight:800;font-size:9pt">S</span></td>
      <td><b>一起给方案</b><br><span class="xs">给邀请，不给命令</span></td>
      <td>「我们一起看看分丢在哪儿，行吗？」</td>
      <td>加条件：「下次必须考到 85」——方案变成了军令状</td>
    </tr>
  </table>

  <h3>三种失败的说法，你是哪一种</h3>
  <div class="grid3">
    <div class="card warn">
      <h4>只有 E · 火型</h4>
      <p class="sm">只宣泄自己的感受：「我天天为你操心，你就这样回报我？」<br>
      <b>结果：</b>他记住的是你发火，不是问题本身。</p>
    </div>
    <div class="card warn">
      <h4>只有 S · 哑型</h4>
      <p class="sm">不给感受，直接给方案：「行了别说了，我给你买新的。」<br>
      <b>结果：</b>事解决了，他觉得你不懂他。</p>
    </div>
    <div class="card warn">
      <h4>先 S 后讲道理 · 审判型</h4>
      <p class="sm">先给结论再讲道理：「早跟你说过要小心，现在知道了吧。」<br>
      <b>结果：</b>他记住了教训，也记住了别跟你说话。</p>
    </div>
  </div>

  <div class="quote" style="border-left:3px solid var(--accent);padding:2.4mm 3.4mm;background:#F7FAF8;font-size:9.6pt;margin-top:2.4mm">
    判断标准只有一个：<b>在你孩子眼里，你是「我们这边的」，还是「敌人那边的」？</b><br>
    这个判断不看你说得对不对，只看你有没有先接住他的感受。
  </div>

  <div class="src"><b>说明</b><span>本页是同一句话的两种说法对比，用来解释上一页「他为什么不说」，<b>不来自新题目</b>；三步结构对应下一节的六个场景。</span></div>

  ${foot(r, 10)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* P11 PART08 六句话                                                   */
/* ------------------------------------------------------------------ */

function part08(r: FamilyFullReport): string {
  const scenes = r.scenes;
  const hot = scenes.find((s) => s.hot) ?? scenes[0];
  const rows = scenes
    .map(
      (s) => `<tr${s.hot ? ' style="background:#FDF8EC"' : ""}>
      <td><b>${H(s.name)}</b><span class="tn">${H(s.say)}</span></td>
      <td>${H(s.hold)}</td>
      <td>${H(s.mine)}</td>
      <td>${H(s.plan)}</td>
    </tr>`,
    )
    .join("\n    ");
  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 08　他最常说的六句话</div>
  <h2>他说这六句，<span class="em">你都可以这样接</span></h2>
  <p class="lead">不用背，<b>先挑一句最像你家的，这周只练这一句</b>。顺序永远是：先接住他的感受 → 再讲你的感受 → 最后给方案。</p>

  <table class="ev" style="margin-top:2mm">
    <tr>
      <th style="width:19%">场景 · 他会说</th>
      <th style="width:27%">① 接住他的感受</th>
      <th style="width:27%">② 说出你的感受</th>
      <th>③ 一起给方案</th>
    </tr>
    ${rows}
  </table>

  <h3>先从哪一句开始练</h3>
  <div class="card tint">
    <p class="sm"><b>别六句一起练。</b>你家最常发生的是${H(hot.name)}，就从这一句开始：<br>
    <span style="font-size:10.6pt;font-weight:800;color:var(--accent2)">「${H(hot.hold)}」</span><br>
    两周只练这一句，等他愿意接话了再练第二句——<b>顺序是「先让他说」，不是「先让他改」</b>。<br>
    <span class="xs">也不用一次说全三步：只说对第一步，就已经比现在好一半，因为他第一次感觉到「${H(r.meta.respondentLabel)}在听我」。</span></p>
  </div>

  <h3>练不成，通常是这三种</h3>
  <div class="grid3">
    <div class="card warn">
      <h4>接住说得像审问</h4>
      <p class="sm">「是不是<b>又</b>玩手机了？」<br>加个「又」，整句就废了。</p>
    </div>
    <div class="card warn">
      <h4>说感受说成指责</h4>
      <p class="sm">「我看到你就烦。」<br>说的是「我」，但姿态是审判。</p>
    </div>
    <div class="card warn">
      <h4>方案只有一个选项</h4>
      <p class="sm">「九点前必须写完。」<br>那不是选项，是通知。</p>
    </div>
  </div>

  <h3>如果他还是不说，换三个办法</h3>
  <table>
    <tr><th style="width:26%">别这样</th><th style="width:34%">换成</th><th>为什么</th></tr>
    <tr><td>当面追问「你到底怎么了」</td><td>换个场景：开车时、散步时、一起洗碗时</td><td>不用对视的时候，男孩尤其容易开口</td></tr>
    <tr><td>「你最近很不正常」</td><td>「我最近有点担心你，也说不上为什么」</td><td>说「我」不发「你」的判词，他才不用防</td></tr>
    <tr><td>一直等他自己说</td><td>借别人的事起头：「我同事家孩子也这样，你觉得呢」</td><td>谈别人比谈自己安全，他会顺着说「我也差不多」</td></tr>
  </table>

  <div class="src"><b>依据</b><span>六个场景 ← 家长卷 P55 冲突场景题（作业 / 手机 / 作息 / 成绩 / 交友 / 隐私），排第一的是你选的那一件；三句话术按 <b>${H(r.disc.parent?.primary ?? "D")} 家长 × ${H(r.disc.child?.primary ?? "S")} 孩子</b>这一格生成。</span></div>

  ${foot(r, 11)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* P12 PART09 九十天                                                   */
/* ------------------------------------------------------------------ */

function part09(r: FamilyFullReport): string {
  const cells = Array.from({ length: 12 }, (_, i) => {
    const w = i + 1;
    const txt = w <= 2 ? "练接住" : w <= 4 ? "加感受" : w <= 8 ? "一起定" : "连起来";
    const bg = w <= 2 ? ["#CFE2D8", "#EAF6EF", "#0B7A5C", "#7A8C82"] : w <= 4 ? ["#BFD8CB", "#DCEFE5", "#0B7A5C", "#7A8C82"] : w <= 8 ? ["#B2CFBF", "#D3E6DA", "#0B7A5C", "#7A8C82"] : ["#A9C9B8", "#C6DED1", "#1F5B48", "#5F7A6E"];
    return `<div style="border:1px solid ${bg[0]};background:${bg[1]};border-radius:1.2mm;padding:.9mm 1mm;text-align:center"><span style="display:block;font-size:9.4pt;font-weight:800;color:${bg[2]};line-height:1.2">${w}</span><span style="display:block;font-size:6.8pt;color:${bg[3]}">${txt}</span></div>`;
  }).join("\n    ");

  const brokenList = r.ladder.rows.filter((x) => x.verdict === "断").map((x) => x.level);
  const ladderNow = brokenList.length
    ? `${brokenList[0]} 断${brokenList.length > 1 ? ` · ${brokenList.slice(1).join(" / ")} 跟着断` : ""}`
    : r.ladder.shaky.length
      ? `${r.ladder.shaky.join(" / ")} 勉强`
      : "五级都通";

  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>PART 09　九十天，只练一件事</div>
  <h2>九十天不解决大考，<span class="em">只练「好好说话」</span></h2>
  <p class="lead">分四步，不跳步。<b>上一段没做到，不要进下一段</b>——跳过去的部分，会在下一段以更麻烦的形式回来。</p>

  <table style="margin-top:2mm">
    <tr>
      <th style="width:14%">阶段</th>
      <th style="width:52%">只练哪一步 · 怎么练</th>
      <th>怎么算练成</th>
    </tr>
    <tr><td><b>第 1–2 周</b></td><td><b>只练「接住」</b>：他说话，你第一句固定用「是不是……」，不加评价、不加建议、不转学习</td><td>有一次他接着说下去了</td></tr>
    <tr><td><b>第 3–4 周</b></td><td><b>加「我的感受」</b>：接完感受加一句「我看到……我心里……」；<b>出现「你总是」就算失败，重来</b></td><td>他没顶嘴，也没走开</td></tr>
    <tr><td><b>第 5–8 周</b></td><td><b>加「一起定」</b>：给两个都行的选项，定完写下来，一个月不改口</td><td>规矩连续执行 5 天没吵</td></tr>
    <tr><td><b>第 9–12 周</b></td><td><b>三步连起来</b>：吵起来时也走一遍，先说「是不是」，火能立刻降下来</td><td>一次冲突当天收场</td></tr>
  </table>

  <h3>十二周，做完一格涂一格</h3>
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:1.4mm;margin:1.4mm 0 1mm">
    ${cells}
  </div>

  <h3>三个月后重测，只看这四个数</h3>
  <table>
    <tr><th style="width:26%">看什么</th><th style="width:26%">现在</th><th>三个月后什么算改善</th></tr>
    <tr><td>他主动说的次数</td><td>${H(r.plan.childInitiate)}</td><td>每周 2 次以上（含「没用的事」）</td></tr>
    <tr><td>冲突收场时间</td><td>${H(r.plan.conflictClose)}</td><td>当天，或第二天有人先开口</td></tr>
    <tr><td>情绪量表</td><td>${H(r.plan.moodBand)}</td><td>下降一个区间；若没降反升，<b>联系学校心理老师</b></td></tr>
    <tr><td>五级台阶</td><td>${H(ladderNow)}</td><td><b>${H(brokenList[0] ?? r.ladder.shaky[0] ?? "L2")} 转黄即可</b>，不要求全绿</td></tr>
  </table>
  <p class="xs" style="margin-top:1.2mm">重测不用做全套：只重测<b>第二级和第三级的六道题，加一份情绪量表</b>，二十分钟够了。</p>

  <div class="card warn" style="margin-top:2.4mm">
    <h4>做不完、又吵翻了怎么办</h4>
    <p><b>不要从头再来。</b>九十天里断掉一两周是正常的，接着往下走。「我做了三周，第四周没做到」和「我又失败了」是两种说法——前者继续，后者放弃。<br>
    <span class="xs">若连续一个月完全推不动，或情绪分数往上升，不要加码，先找学校心理老师聊一次。</span></p>
  </div>

  <div class="quote" style="border-left:3px solid var(--accent);padding:2.4mm 3.4mm;background:#F7FAF8;font-size:9.6pt;margin-top:2.4mm">
    这九十天只做一件事：<b>让他觉得「${H(r.meta.respondentLabel)}是站在我这边的」</b>——做到了，手机、成绩、作息都会变得可谈。
  </div>

  <div class="src"><b>依据</b><span>前六节的判定结果——<b>${r.ladder.firstBroken ? `${LEVEL_CN[r.ladder.firstBroken]}卡点` : "卡点"}</b> + <b>${H(r.disc.parent?.primary ?? "D")} 家长 × ${H(r.disc.child?.primary ?? "S")} 孩子</b> + <b>冲突前两名</b>；本页不新增题目，动作由卡点直接对应。</span></div>

  ${foot(r, 12)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* P13 附录                                                            */
/* ------------------------------------------------------------------ */

const AREA_ORDER = ["乐学", "会学", "善学", "智学", "条件"];

function appendix(r: FamilyFullReport): string {
  const rows = r.appendix.studentRows;
  /* 按域分组，每组首行 rowspan，和原版一致 */
  const grouped = AREA_ORDER.map((area) => ({ area, rows: rows.filter((x) => x.area === area) })).filter((g) => g.rows.length);
  const studentTable = rows.length
    ? grouped
        .map((g) =>
          g.rows
            .map(
              (row, i) =>
                `<tr>${i === 0 ? `<td rowspan="${g.rows.length}"><b>${H(g.area)}</b></td>` : ""}<td>${row.no}</td><td>${H(shorten(row.text, 14))}</td><td><b>${row.score}</b></td><td>${H(row.note)}</td></tr>`,
            )
            .join("\n    "),
        )
        .join("\n\n    ")
    : `<tr><td colspan="5" style="padding:5mm;text-align:center;color:#8A9B92">孩子还没做 E3 学习力诊断，附录暂空。</td></tr>`;

  const hasAltCol = !!r.alt && r.appendix.parentRows.some((x) => x.altChoice != null);
  const parentTable = r.appendix.parentRows
    .map(
      (row) =>
        `<tr><td>${H(row.text)}</td><td><b>${H(row.choice)}</b></td>${
          hasAltCol ? `<td><b>${H(row.altChoice ?? "—")}</b></td>` : ""
        }<td>${row.bad ? `<b style="color:var(--red)">${H(row.gap)}</b>` : H(row.gap || "—")}</td></tr>`,
    )
    .join("\n        ");

  const p = r.disc.parent;
  const c = r.disc.child;

  return `<div class="page">
  ${head(r)}

  <div class="ch"><i></i>APPENDIX　附录</div>
  <h2>这些结论，<span class="em">是从哪几道题来的</span></h2>
  <p class="lead">这一页给咨询师和老师看，家长可以跳过。全部为 1–5 分，5＝最符合；<b>带 ● 的是对结论影响最大的题</b>。</p>

  <h3>学生卷（节选 ${rows.length || 19} 题）</h3>
  <table class="apx">
    <tr><th style="width:9%">域</th><th style="width:7%">题号</th><th style="width:40%">题目（节选）</th><th style="width:8%">得分</th><th>支撑报告里的哪一句</th></tr>
    ${studentTable}
  </table>

  <h3>家长卷（6 题）· 量表 · DISC</h3>
  <div class="grid2" style="align-items:start">
    <div>
      <table class="apx">
        ${
          hasAltCol
            ? `<tr><th style="width:44%">题目</th><th style="width:12%">${H(r.meta.respondentLabel)}</th><th style="width:12%">${H(r.alt!.label)}</th><th>与孩子自评差</th></tr>`
            : `<tr><th style="width:52%">题目</th><th style="width:14%">你选的</th><th>与他自评的差</th></tr>`
        }
        ${parentTable}
      </table>
    </div>
    <div>
      <table class="apx">
        <tr><th style="width:44%">量表 / 测评</th><th style="width:26%">结果</th><th>说明</th></tr>
        <tr><td>焦虑量表（7 题）</td><td><b>${H(anxietyWord(r))}</b></td><td>紧张、坐不住、易烦</td></tr>
        <tr><td>情绪量表（9 题）</td><td><b>${H(r.plan.moodBand)}</b></td><td>兴趣下降、疲惫；自伤 ${H(r.appendix.mental.match(/自伤条目 (\d)/)?.[1] ?? "0")}</td></tr>
        <tr><td>家长 DISC</td><td><b>${H(p ? discLine(p) : "未答")}</b></td><td>${p ? `${p.primary} 主导` : "—"}</td></tr>
        <tr><td>学生 DISC</td><td><b>${H(c ? discLine(c) : "未答")}</b></td><td>${c ? `${c.primary} 主导` : "—"}</td></tr>
        <tr><td>完成情况</td><td>${H(r.appendix.validity)}</td><td>无极端作答，均有效</td></tr>
      </table>
    </div>
  </div>

  <div class="card tint" style="margin-top:2.4mm">
    <p><b>怎么用这一页：</b>家长说「你们不了解我孩子」时，翻到这里，指其中一条问：<span class="hl">「这道题他选的是『很不符合』，你觉得是几分？」</span>——用具体题目对话，比争论结论有效得多。</p>
  </div>

  <p class="xs" style="margin-top:2mm">免责声明：本报告基于学生与家长的自我报告生成，反映的是「他们如何描述自己」，不等同于临床评估。分级只用于给建议排序，不构成心理诊断。若出现持续两周以上的情绪低落、自伤念头、拒绝上学等情况，请优先联系学校心理辅导老师或专业医疗机构。</p>

  ${foot(r, 13)}
</div>`;
}

function shorten(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/* ------------------------------------------------------------------ */
/* 汇总导出                                                            */
/* ------------------------------------------------------------------ */

export function renderFamilyReportPages(r: FamilyFullReport): string {
  return [cover(r), toc(r), part00(r), part01(r), part02(r), part03(r), part04(r), part05(r), part06(r), part07(r), part08(r), part09(r), appendix(r)].join("\n");
}

export const FAM_REPORT_CSS = `.famrpt{
    --ink:#0B3D2E; --body:#33463F; --soft:#5A6B62; --mute:#8A9B92;
    --line:#E3EEE8; --accent:#0EA875; --accent2:#0B8A63; --cream:#F0FAF5;
    --warn:#C4762A; --red:#C4453D; --yellow:#C98A16;
    --redbg:#FDF4F2; --ybg:#FDF8EC; --gbg:#F1F7F3;
  }
.famrpt, .famrpt *{box-sizing:border-box;margin:0;padding:0}
.famrpt{background:#EDEFEC;font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
    color:var(--body);line-height:1.72;-webkit-font-smoothing:antialiased}
.famrpt .page{width:210mm;height:297mm;background:#fff;margin:0 auto 8mm;padding:15mm 16mm 11mm;
    position:relative;box-shadow:0 3px 14px rgba(12,70,62,.10);overflow:hidden;
    display:flex;flex-direction:column}
.famrpt .page > *{flex-shrink:0}
.famrpt /* ---------- 封面 ---------- */
  .cover{padding:0}
.famrpt .cover .inner{flex:1;display:flex;flex-direction:column;padding:20mm 18mm 14mm;position:relative}
.famrpt .dots{display:flex;gap:2mm}
.famrpt .dots i{width:2.2mm;height:2.2mm;border-radius:50%;background:var(--accent);display:block}
.famrpt .cv-top{font-size:8.4pt;letter-spacing:.28em;color:var(--mute);margin-top:16mm;text-transform:uppercase}
.famrpt .cv-h1{font-size:30pt;font-weight:800;line-height:1.28;color:var(--ink);letter-spacing:.02em;margin-top:5mm}
.famrpt .cv-bar{width:16mm;height:1.2mm;background:var(--accent);border-radius:1mm;margin:6mm 0}
.famrpt .cv-sub{font-size:10.4pt;line-height:2.05;color:var(--soft)}
.famrpt .cv-tag{display:inline-block;font-size:8pt;font-weight:700;color:#fff;background:var(--accent2);
    border-radius:1mm;padding:.6mm 2.4mm;letter-spacing:.1em;margin-top:6mm;align-self:flex-start}
.famrpt .cv-head{display:flex;flex-direction:column;padding-top:4mm}
.famrpt .cv-art{flex:1;display:flex;flex-direction:column;justify-content:center;padding:6mm 0 2mm}
.famrpt .cv-art svg{width:100%;height:auto;display:block}
.famrpt .cv-art-note{font-size:8.6pt;color:var(--mute);letter-spacing:.02em;margin-top:3mm}
.famrpt .infocard{margin-top:0;background:var(--cream);border:1px solid #D8EDE4;border-radius:3mm;
    padding:6mm 7mm}
.famrpt .infocard .row{display:grid;grid-template-columns:22mm 1fr;gap:4mm;font-size:9.6pt;line-height:2.1}
.famrpt .infocard .k{color:var(--mute);font-size:9pt}
.famrpt .infocard .v{color:var(--ink);font-weight:700}
.famrpt .infocard .v.long{font-weight:600;font-size:9pt;line-height:1.85}
.famrpt .cv-foot{display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;
    margin-top:6mm;padding-top:3.5mm;border-top:1px solid var(--line)}
.famrpt .cv-foot .l{font-size:7.6pt;color:var(--mute);line-height:1.75;max-width:112mm}
.famrpt .cv-foot .r{text-align:right;font-size:8pt;color:var(--soft);line-height:1.9;white-space:nowrap}
.famrpt .cv-foot .r b{color:var(--ink)}
.famrpt /* ---------- 正文页头 ---------- */
  .ph{display:flex;justify-content:space-between;align-items:flex-end;
    border-bottom:1px solid var(--line);padding-bottom:2.5mm;margin-bottom:6mm}
.famrpt .ph .l{font-size:8pt;color:var(--mute);letter-spacing:.04em}
.famrpt .ph .l b{color:var(--accent2);font-size:8.6pt;letter-spacing:.02em}
.famrpt .ph .r{font-size:8pt;color:var(--soft)}
.famrpt .ph .r b{color:var(--ink)}
.famrpt .tagmini{display:inline-block;font-size:6.8pt;font-weight:700;color:#fff;background:var(--yellow);
    border-radius:1mm;padding:.3mm 1.6mm;letter-spacing:.1em;margin-left:2mm;vertical-align:1px}
.famrpt /* ---------- 章节头 ---------- */
  .ch{display:flex;align-items:center;gap:2.6mm;font-size:8pt;font-weight:700;
    letter-spacing:.22em;color:var(--accent2);margin-bottom:2mm}
.famrpt .ch i{width:6.5mm;height:.55mm;background:var(--accent);display:block}
.famrpt h2{font-size:16.5pt;line-height:1.42;color:var(--ink);font-weight:800;letter-spacing:.01em}
.famrpt h2 .em{color:var(--warn)}
.famrpt h2 .emg{color:var(--accent2)}
.famrpt .lead{font-size:9.6pt;color:var(--soft);line-height:1.78;margin-top:2.2mm}
.famrpt h3{font-size:10.2pt;color:var(--accent2);font-weight:700;margin:4.2mm 0 1.8mm;
    padding-left:2.6mm;border-left:2.4px solid var(--accent);line-height:1.4}
.famrpt p{font-size:9.4pt;line-height:1.75}
.famrpt .sm{font-size:8.7pt;line-height:1.72}
.famrpt .xs{font-size:7.6pt;line-height:1.6;color:var(--mute)}
.famrpt table{width:100%;border-collapse:collapse;font-size:8.4pt}
.famrpt th{background:#F4F9F6;color:var(--ink);font-weight:700;text-align:left;
    padding:1.7mm 2mm;border:1px solid var(--line);font-size:7.9pt}
.famrpt td{padding:1.5mm 2mm;border:1px solid #EAF1ED;vertical-align:top;line-height:1.5}
.famrpt .card{border:1px solid var(--line);border-radius:2.2mm;padding:2.8mm 3.2mm;background:#fff}
.famrpt .card.warn{border-color:#EEDCB8;background:var(--ybg)}
.famrpt .card.tint{border-color:#CFE2D8;background:var(--gbg)}
.famrpt .card h4{font-size:9.2pt;color:var(--ink);margin-bottom:1mm}
.famrpt .card p{font-size:8.7pt}
.famrpt .grid2{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.famrpt .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:2.6mm}
.famrpt .hl{background:linear-gradient(transparent 62%,#D9F2E5 62%);font-weight:700;color:var(--ink)}
.famrpt /* 依据条 */
  .src{display:flex;gap:2mm;align-items:flex-start;font-size:7.1pt;line-height:1.55;
    color:var(--soft);background:#F7FBF9;border-left:2px solid #CFE2D8;
    padding:1.5mm 2.2mm;border-radius:0 1mm 1mm 0;margin:2mm 0 1.2mm}
.famrpt .src b{flex:0 0 auto;color:var(--accent2);font-size:7pt;letter-spacing:.08em}
.famrpt /* 台阶 */
  .stairfig{width:100%;height:auto;display:block}
.famrpt .legendline{display:flex;gap:5mm;align-items:center;font-size:7.5pt;color:var(--mute);margin-top:1.5mm}
.famrpt .legendline span{display:flex;align-items:center;gap:1.2mm}
.famrpt .legendline i{width:2.6mm;height:2.6mm;border-radius:50%;display:inline-block}
.famrpt /* 判定表 */
  .ev td{font-size:7.8pt;line-height:1.45;padding:1.45mm 1.9mm}
.famrpt .ev th{font-size:7.5pt;padding:1.3mm 1.9mm}
.famrpt .ev .tn{display:block;font-size:6.9pt;color:var(--mute);font-weight:400;margin-top:.3mm}
.famrpt .ev .opt{display:block;font-size:7.2pt;color:var(--soft);margin-top:.4mm}
.famrpt .ev .opt b{color:var(--ink)}
.famrpt .lg{display:inline-block;font-size:7.1pt;font-weight:700;padding:.4mm 1.6mm;border-radius:.8mm}
.famrpt .lg.y{background:var(--ybg);color:#A9700E;border:1px solid #EEDCB8}
.famrpt .lg.r{background:var(--redbg);color:var(--red);border:1px solid #EECFCA}
.famrpt /* 结论条 */
  .verdict{border-left:3px solid var(--red);background:var(--redbg);border-radius:0 2mm 2mm 0;
    padding:2.4mm 3.2mm;margin-top:2.6mm}
.famrpt .verdict p{font-size:8.9pt;line-height:1.7}
.famrpt /* DISC 卡 */
  .typecard{border:1px solid var(--line);border-radius:2mm;padding:2mm 2.8mm 2.1mm;background:#fff;overflow:hidden}
.famrpt .typecard .tch{display:flex;justify-content:space-between;align-items:baseline;
    margin-bottom:1.5mm;padding-bottom:1.1mm;border-bottom:1px dashed var(--line)}
.famrpt .typecard .tcn{font-size:7.6pt;color:var(--mute);letter-spacing:.04em}
.famrpt .typecard .tct{font-size:10.4pt;font-weight:800;color:var(--accent2)}
.famrpt .typecard .tct.b{color:var(--warn)}
.famrpt .trow{display:grid;grid-template-columns:13mm minmax(0,1fr) 10mm;gap:1.6mm;align-items:center;margin:.6mm 0}
.famrpt .trow .tnm{font-size:7.9pt;color:#5A6B62}
.famrpt .trow .tb{position:relative;height:2.7mm;background:#EDF3EF;border-radius:.5mm;overflow:hidden;min-width:0}
.famrpt .trow .tb i{position:absolute;left:0;top:0;bottom:0;border-radius:.5mm;display:block;background:#B9CFC4}
.famrpt .trow .tb i.on.dom{background:linear-gradient(90deg,#4FC79B,#0EA875)}
.famrpt .trow .tb i.on.domb{background:linear-gradient(90deg,#E0A164,#C4762A)}
.famrpt .trow .tv{text-align:right;font-size:7.6pt;font-weight:700;color:var(--mute)}
.famrpt .trow .tv.h{color:var(--accent2)}
.famrpt .trow .tv.hb{color:var(--warn)}
.famrpt /* 16 格 */
  .dm{width:100%;border-collapse:separate;border-spacing:1mm;font-size:7.3pt}
.famrpt .dm th{background:none;border:none;color:var(--mute);font-weight:700;font-size:7.2pt;
    text-align:center;padding:0 0 .7mm;line-height:1.25}
.famrpt .dm td{background:#F8FAF9;border:1px solid #E9F0EC;border-radius:1.2mm;padding:1.3mm 1.1mm;
    line-height:1.38;color:#66786F;text-align:center;font-size:7.3pt}
.famrpt .dm th.rh{text-align:left;color:var(--accent2);font-size:7.6pt;padding:0 0 0 .5mm;vertical-align:middle}
.famrpt .dm th.rh .rs{display:block;font-size:6.5pt;color:var(--mute);font-weight:500;margin-top:.3mm}
.famrpt .dm td.hit{background:#FFF6EC;border-color:#E0BE94;font-weight:700;color:#A85614}
.famrpt /* 冲突条 */
  .cf{margin-bottom:2.6mm}
.famrpt .cf .cfh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1mm}
.famrpt .cf .cfn{font-size:9pt;font-weight:700;color:var(--ink)}
.famrpt .cf .cfn .rk{display:inline-block;width:4.4mm;height:4.4mm;border-radius:50%;background:var(--red);
    color:#fff;font-size:6.8pt;text-align:center;line-height:4.4mm;margin-right:1.4mm;vertical-align:1px}
.famrpt .cf .cff{font-size:7.7pt;font-weight:700;color:var(--red)}
.famrpt .cf .cff.mid{color:var(--yellow)}
.famrpt .cf .cfl{height:2.4mm;margin:1mm 0 1.4mm;background:#F1F5F2;border-radius:.6mm;overflow:hidden}
.famrpt .cf .cfl i{display:block;height:100%;border-radius:.6mm;background:linear-gradient(90deg,#D98A84,#C4453D)}
.famrpt .cf .cfl i.mid{background:linear-gradient(90deg,#E8C48A,#C98A16)}
.famrpt .cf .cfd{font-size:7.9pt;color:var(--soft);line-height:1.55}
.famrpt /* YES 三步 */
  .yes{border:1px solid var(--line);border-radius:2mm;overflow:hidden;margin-top:1.5mm}
.famrpt .yes .row{display:grid;grid-template-columns:11mm 1fr;align-items:stretch;
    border-bottom:1px solid #EDF3F0}
.famrpt .yes .row:last-child{border-bottom:none}
.famrpt .yes .yn{display:flex;align-items:center;justify-content:center;font-size:11pt;font-weight:800;
    color:#fff;background:var(--accent)}
.famrpt .yes .row:nth-child(2) .yn{background:#3FAE87}
.famrpt .yes .row:nth-child(3) .yn{background:#6BB99B}
.famrpt .yes .yt{padding:2mm 3mm;font-size:8.6pt;line-height:1.6}
.famrpt .yes .yt b{color:var(--ink)}
.famrpt .tasks{display:grid;grid-template-columns:repeat(3,1fr);gap:2.4mm;margin-top:1.5mm}
.famrpt .task{border:1px solid var(--line);border-radius:1.8mm;padding:2.2mm 2.5mm;background:#fff}
.famrpt .task .tw{font-size:6.9pt;color:var(--mute);letter-spacing:.08em}
.famrpt .task .tnm{font-size:8.7pt;font-weight:700;color:var(--ink);margin:.5mm 0 1mm}
.famrpt .task .td{font-size:7.7pt;color:var(--soft);line-height:1.55}
.famrpt .upsell{border:1px dashed #CFE2D8;border-radius:2mm;padding:2.6mm 3.2mm;background:#FAFDFB;margin-top:auto}
.famrpt .upsell h4{font-size:8.8pt;color:var(--ink);margin-bottom:1.2mm}
.famrpt .upsell .items{display:grid;grid-template-columns:1fr 1fr;gap:.8mm 4mm}
.famrpt .upsell .it{font-size:7.9pt;color:var(--soft)}
.famrpt .upsell .it b{color:var(--accent2)}
.famrpt .pf{margin-top:auto;display:flex;justify-content:space-between;align-items:center;
    font-size:7.4pt;color:var(--mute);border-top:1px solid var(--line);padding-top:1.8mm}
.famrpt .pf .pn{font-weight:700;color:var(--soft)}
.famrpt /* 目录 */
  .toc{margin-top:4mm}
.famrpt .toc .row{display:flex;align-items:baseline;gap:3mm;padding:2.05mm 0;border-bottom:1px dotted #DCEAE3}
.famrpt .toc .row:last-child{border-bottom:none}
.famrpt .toc .no{flex:0 0 16mm;font-size:8.4pt;font-weight:800;color:var(--accent2);letter-spacing:.06em}
.famrpt .toc .tt{flex:1;font-size:10.4pt;font-weight:700;color:var(--ink)}
.famrpt .toc .tt em{display:block;font-style:normal;font-size:8.4pt;font-weight:400;color:var(--soft);margin-top:.6mm}
.famrpt .toc .pg{flex:0 0 auto;font-size:9pt;font-weight:700;color:var(--mute)}
.famrpt /* ---------- PART00 资产页 ---------- */
  .assets{display:grid;grid-template-columns:1fr 1fr;gap:3.6mm;margin-top:3.4mm}
.famrpt .asset{border:1px solid #D5EADF;border-radius:2.4mm;padding:3.4mm 3.6mm;background:#FCFEFD;
    display:flex;flex-direction:column;min-height:54mm}
.famrpt .asset .ah{display:flex;align-items:baseline;gap:2.2mm;margin-bottom:1.4mm}
.famrpt .asset .an{font-size:15pt;font-weight:800;color:#BFE3D3;line-height:1;letter-spacing:-.02em}
.famrpt .asset .at{font-size:9.8pt;font-weight:800;color:var(--ink);line-height:1.4}
.famrpt .asset .ab{font-size:8.6pt;line-height:1.66;color:var(--body)}
.famrpt .asset .ab b{color:var(--accent2)}
.famrpt .asset .ev2{font-size:7.4pt;line-height:1.55;color:var(--mute);border-top:1px dashed #E2EFE9;
    padding-top:1.4mm;margin-top:1.6mm}
.famrpt .asset .au{font-size:8.3pt;line-height:1.6;color:var(--warn);background:#FDF9F1;
    border-radius:1.2mm;padding:1.6mm 2.2mm;margin-top:auto}
.famrpt .maprow{margin-top:3.2mm;border:1px dashed #CFE9DF;border-radius:2mm;padding:2.6mm 3.2mm;background:#FBFDFC}
.famrpt .maprow .mt{font-size:7.4pt;font-weight:700;letter-spacing:.16em;color:var(--accent2);margin-bottom:1.3mm}
.famrpt .maprow .mrow{display:grid;grid-template-columns:1fr 1fr;column-gap:6mm;row-gap:1mm;
    font-size:8pt;line-height:1.6;color:var(--soft)}
.famrpt .maprow b{color:var(--ink)}
.famrpt .concl{margin-top:3.2mm;background:var(--cream);border:1px solid #D8EDE4;border-radius:2.2mm;padding:3.6mm 4mm}
.famrpt .concl .ct{font-size:7.8pt;font-weight:700;letter-spacing:.16em;color:var(--accent2);margin-bottom:1.2mm}
.famrpt .concl p{font-size:9.6pt;line-height:1.82;color:var(--ink)}
.famrpt .bridge{margin-top:3mm;display:grid;grid-template-columns:24mm minmax(0,1fr);gap:4mm;align-items:center;
    border-left:2.6px solid var(--yellow);background:#FDFBF6;border-radius:0 2mm 2mm 0;padding:2.8mm 3.4mm}
.famrpt .bridge .bl{font-size:7.4pt;font-weight:700;letter-spacing:0;color:#A9700E;line-height:1.6;white-space:nowrap}
.famrpt .bridge p{font-size:9pt;line-height:1.75;color:var(--ink)}
.famrpt /* 卡点层 */
  .layers{margin-top:3.6mm}
.famrpt .layer{display:grid;grid-template-columns:29mm minmax(0,1fr) 58mm;gap:3.8mm;
    border:1px solid var(--line);border-radius:2mm;padding:3.7mm 3.8mm;margin-bottom:3.4mm;background:#fff}
.famrpt .layer .lv{padding-top:.2mm}
.famrpt .layer .ln{display:inline-block;font-size:7pt;font-weight:700;letter-spacing:.08em;color:#fff;
    border-radius:.8mm;padding:.35mm 1.6mm}
.famrpt .layer .lt{display:block;font-size:9.2pt;font-weight:800;color:var(--ink);margin-top:1.4mm;line-height:1.36}
.famrpt .layer .lb p{font-size:8.5pt;line-height:1.7;color:var(--body)}
.famrpt .layer .lb p b{color:var(--ink)}
.famrpt .layer .ev3{font-size:7.6pt;line-height:1.6;color:var(--mute);margin-top:1.2mm;
    border-top:1px dashed #E2EFE9;padding-top:.9mm}
.famrpt .layer .ls{font-size:8.2pt;line-height:1.65;color:#8A5A1C;background:#FDF9F1;
    border-radius:1.2mm;padding:2mm 2.4mm;align-self:start}
.famrpt .layer .ls b{color:var(--warn)}
.famrpt .apx.tight td{font-size:7.6pt;padding:1.05mm 1.8mm;line-height:1.45}
.famrpt .apx.tight th{font-size:7.2pt;padding:.9mm 1.8mm}
.famrpt .supports{display:grid;grid-template-columns:repeat(4,1fr);gap:2.4mm;margin-top:3mm}
.famrpt .sp{border:1px solid #D8EDE4;background:#F7FCFA;border-radius:1.6mm;padding:2.4mm 2.5mm;
    font-size:7.5pt;line-height:1.55;color:var(--soft)}
.famrpt .sp b{display:block;color:var(--accent2);font-size:8.2pt;margin-bottom:.7mm;letter-spacing:.02em}
.famrpt .apx tr.grp td{background:#F1F8F4;color:var(--accent2);font-weight:700;font-size:7.5pt;
    padding:1mm 1.8mm;letter-spacing:.04em;border-color:#E4F0E9}
.famrpt .firststep{margin-top:3mm;display:grid;grid-template-columns:36mm minmax(0,1fr);gap:4mm;align-items:center;
    border:1px solid #CFE9DF;border-radius:2mm;padding:3mm 3.8mm;background:#F5FCF9}
.famrpt .firststep .fl{font-size:7.6pt;font-weight:700;letter-spacing:.08em;color:var(--accent2);line-height:1.5}
.famrpt .firststep p{font-size:9pt;line-height:1.7;color:var(--ink)}
.famrpt /* 附录明细表 */
  .apx td{font-size:7.7pt;line-height:1.42;padding:1.2mm 1.8mm}
.famrpt .apx th{font-size:7.4pt;padding:1.2mm 1.8mm}

/* 打印：每页一张 A4，边距为零，页面内的 mm 才是真 mm */
@media print{
  .famrpt .page{margin:0;box-shadow:none;page-break-after:always}
  .famrpt .page:last-child{page-break-after:auto}
}
`;

