/**
 * DISC 画像：把职场 DISC 的四项净分翻译成「这人是什么风格、怎么跟他共事」。
 *
 * 用法分两层：风格层（类型名 / 优点代价 / 压力反应 / 相处建议）与岗位层
 * （这套风格落在这个岗位的日常工作里顺不顺）。岗位层单独成块，
 * 因为同一个人在市场推广是「顺」，在财务教务可能是「逆」。
 */

export type DiscKey = "D" | "I" | "S" | "C";

export const DISC_DIM: Record<DiscKey, { label: string; en: string; gist: string }> = {
  D: { label: "支配", en: "Dominance", gist: "定方向、抢结果" },
  I: { label: "影响", en: "Influence", gist: "拉关系、造气氛" },
  S: { label: "稳健", en: "Steadiness", gist: "稳住节奏、守住人" },
  C: { label: "严谨", en: "Conscientiousness", gist: "抠标准、控风险" },
};

export const PRESSURE: Record<DiscKey, string> = {
  D: "压力越大越强硬，「快点」容易说成「你怎么还没好」，对慢的人和绕弯的话失去耐心。",
  I: "压力大时话变多、承诺变满，用热闹盖住问题，细节和收尾最先掉。",
  S: "压力大时不说、憋着，表面「都行」，拖到不能再拖才表态，变化来得突然会明显抵抗。",
  C: "压力大时更挑剔，容易陷进细节出不来，用「还没准备好」推迟表态。",
};

export const TRAITS: Record<DiscKey, string[]> = {
  D: ["开会先问「什么时候能出结果」", "遇到挡路的流程，倾向绕过去而不是等审批", "对含糊的承诺没耐心，要数字、要节点"],
  I: ["进新环境很快能叫出别人的名字", "讲方案先讲人和故事，再补数据", "答应得快，兑现要看有没有人跟"],
  S: ["冲突起来先降温，不急着分对错", "按既定流程走，临时改计划会不舒服", "很少主动争功，活干完了就退到后面"],
  C: ["对数字和措辞敏感，会揪住前后不一致的地方", "习惯先看规则、先例，再决定怎么做", "信息不全时不愿表态，宁可再等等"],
};

type BlendKey = "DI" | "DC" | "DS" | "ID" | "IS" | "IC" | "SI" | "SC" | "SD" | "CD" | "CS" | "CI";

export const BLENDS: Record<BlendKey, { name: string; oneLine: string; cost: string; tip: string }> = {
  DI: {
    name: "推动型",
    oneLine: "先定方向再拉人，开场快、气势足，擅长把一件没影的事推起来。",
    cost: "冲得太快，后面的人跟不上；承诺给出去时没算过交付能力。",
    tip: "配一个能收口的人，别让他同时开三个头。",
  },
  DC: {
    name: "攻坚型",
    oneLine: "要结果也要质量，定下目标就盯到底，标准高、不太接受「差不多」。",
    cost: "对人也是这个标准，团队会觉得被挑；慢下来的环节他最不耐烦。",
    tip: "把「够好了」的标准提前说死，否则他会一直加码。",
  },
  DS: {
    name: "稳推型",
    oneLine: "目标清楚，但推进靠的是一步步压实，不靠喊；答应的事基本会到。",
    cost: "启动偏慢，遇到必须马上转向的场面会犹豫。",
    tip: "给他明确的节点和权限，别中途频繁改方向。",
  },
  ID: {
    name: "感染型",
    oneLine: "靠把人说动来推事，场面冷了会主动去热，适合从零建立关系。",
    cost: "开场强、收尾弱；细节和跟进要靠别人补。",
    tip: "把口头承诺当场落成文字和时间点。",
  },
  IS: {
    name: "亲和型",
    oneLine: "关系优先，团队里的黏合剂，愿意为别人的情绪多花时间。",
    cost: "该说不的时候说不出口，冲突被压下去而不是解决。",
    tip: "替他把难听的话说了，别让他当坏人。",
  },
  IC: {
    name: "说服型",
    oneLine: "既讲得动人又讲得清楚，适合把复杂方案讲给不懂的人听。",
    cost: "表达上的优势会掩盖执行上的漏洞，容易被自己的叙述说服。",
    tip: "让他讲完之后，追一句「第一步谁做、什么时候交」。",
  },
  SI: {
    name: "陪伴型",
    oneLine: "耐心、愿意听，把人的状态放在事情前面，服务场景里的天然底子。",
    cost: "节奏偏慢，遇到需要强硬推进的场面会退。",
    tip: "给他稳定的服务对象和清晰的节奏，别频繁换场景。",
  },
  SC: {
    name: "稳准型",
    oneLine: "稳且细，流程交到他手上不会漏，适合长期守一件事。",
    cost: "对变化敏感，临时插队的事会明显影响状态。",
    tip: "变更提前通知，给他时间重排计划。",
  },
  SD: {
    name: "承压型",
    oneLine: "扛事不吭声，压力自己消化，关键时刻靠得住。",
    cost: "不说不等于没问题，容易在没预警的时候突然撑不住。",
    tip: "主动问、定期问，别等他来找你。",
  },
  CD: {
    name: "精工型",
    oneLine: "先算清再做，慢但少错，适合不能出错的活。",
    cost: "决策链长，窗口期短的机会抓不住。",
    tip: "给他留足准备时间，急事要明确说「先给个六十分版本」。",
  },
  CS: {
    name: "守序型",
    oneLine: "按规矩来，稳定可预期，制度和流程的天然维护者。",
    cost: "规则之外的例外处理会僵，容易被说「不灵活」。",
    tip: "给他写清楚例外怎么批，别让他自己扛判断。",
  },
  CI: {
    name: "析理型",
    oneLine: "用数据和逻辑说话，也愿意把道理讲明白，适合做方案与教研。",
    cost: "对情绪和场景的敏感度偏低，容易把话说得对但不好听。",
    tip: "提醒他先照顾感受再讲结论。",
  },
};

/** 各岗位「吃」哪两个字母：风格的主导/第二字母落在这两个里，干这个岗就顺。 */
export const JOB_EAT: Record<string, { eat: DiscKey[]; scene: string }> = {
  mkt: { eat: ["D", "C"], scene: "定渠道、试素材、看数据、把预算压到跑得动的那一条上" },
  sales: { eat: ["D", "I"], scene: "主动接触陌生客户、临门一脚的促单、被拒绝之后再来一次" },
  admin: { eat: ["S", "C"], scene: "招人、谈薪、处理员工关系、把流程守住" },
  fin: { eat: ["C", "S"], scene: "对账、核销、排课、在「先退了再说」面前守住规矩" },
  service: { eat: ["S", "I"], scene: "跟课、答疑、安抚家长、长期陪着一个学生" },
  pot: { eat: ["D", "S"], scene: "定方向、分活、扛结果，还要让团队愿意跟着走" },
};

export const JOB_NAME: Record<string, string> = {
  mkt: "市场推广",
  sales: "咨询销售",
  admin: "人事行政",
  fin: "财务教务",
  service: "教学服务",
  pot: "管理潜质",
};

const ORDER: DiscKey[] = ["D", "I", "S", "C"];

export type DiscProfile = {
  dims: { key: DiscKey; label: string; en: string; gist: string; score: number; delta: number }[];
  primary: DiscKey;
  secondary: DiscKey;
  blend: string;
  styleName: string;
  balanced: boolean;
  shape: "balanced" | "tie" | "single" | "normal";
  oneLine: string;
  traits: string[];
  cost: string;
  pressure: string;
  withHim: string[];
  job: { key: string; label: string; verdict: "顺" | "偏顺" | "逆"; headline: string; text: string };
  headline: string;
};

export function buildDiscProfile(disc: { D: number; I: number; S: number; C: number }, job: string): DiscProfile {
  const dims = ORDER.map((k) => ({
    key: k,
    label: DISC_DIM[k].label,
    en: DISC_DIM[k].en,
    gist: DISC_DIM[k].gist,
    score: disc[k],
    delta: disc[k] - 50,
  }));
  const ranked = [...ORDER].sort((a, b) => disc[b] - disc[a]);
  const primary = ranked[0];
  const secondary = ranked[1];
  const balanced = disc[ranked[0]] - disc[ranked[3]] <= 12;
  const tie = !balanced && disc[primary] === disc[secondary];
  const single = !balanced && !tie && disc[secondary] < 50;
  const shape: DiscProfile["shape"] = balanced ? "balanced" : tie ? "tie" : single ? "single" : "normal";
  const blend = `${primary}${secondary}`;
  const b = BLENDS[(blend as BlendKey)] ?? BLENDS.DI;
  const styleName = balanced ? "均衡型" : b.name;
  const eat = JOB_EAT[job];
  const verdict: "顺" | "偏顺" | "逆" = eat.eat.includes(primary) ? "顺" : eat.eat.includes(secondary) ? "偏顺" : "逆";
  const eatName = eat.eat.map((k) => DISC_DIM[k].label).join(" + ");
  const pName = DISC_DIM[primary].label;
  const sName = DISC_DIM[secondary].label;
  const headline = balanced
    ? `四项风格差别不大（极差 ${disc[ranked[0]] - disc[ranked[3]]} 分），没有单一主导——他会看场合切换，适应性强，但别人不容易预判他的反应。`
    : tie
      ? `${pName}与${sName}并列 ${disc[primary]} 分，没有单一主导——两套打法在他身上同时成立，通常会先${pName === "支配" ? "定方向" : "把人理顺"}、再${sName === "严谨" ? "抠标准" : "往前推"}。`
      : single
        ? `只有「${pName}」这一项（${disc[primary]} 分）明显高于均值，其余三项都在均值以下：风格很集中，辨识度高，换场景时切换的余地也小。底色是「${b.name}」：${b.oneLine}`
        : `${pName} ${disc[primary]} 分是主导，${sName} ${disc[secondary]} 分是第二风格，合起来是「${b.name}」：${b.oneLine}`;
  const text =
    verdict === "顺"
      ? tie
        ? `${eat.scene}，${pName}（${primary}）和${sName}（${secondary}）都用得上——他会自然而然地那么做，不需要刻意。`
        : `${eat.scene}，正好落在${pName}（${primary}）的舒适区——他会自然而然地那么做，不需要刻意。`
      : verdict === "偏顺"
        ? `${eat.scene}更吃${eatName}，他的第一风格是${pName}，靠${sName}补得上，但会比天生这个风格的人多花一点力气。`
        : `${eat.scene}要的是${eatName}，他的力气更多在${pName}和${sName}上。不是干不了，是每天要额外拧一下；如果这个岗占比很高，得靠流程和搭档兜住。`;
  return {
    dims,
    primary,
    secondary,
    blend,
    styleName,
    balanced,
    shape,
    oneLine: balanced ? "没有单一主导风格，随场合切换。" : b.oneLine,
    traits: TRAITS[primary].slice(0, 3),
    cost: balanced ? "风格不鲜明的好处是适应性强，代价是别人不太知道该怎么配合你。" : b.cost,
    pressure: PRESSURE[primary],
    withHim: [
      balanced ? "他看场合切换风格，重要的事直接问「这次你打算怎么推」" : b.tip,
      `沟通时先给${primary === "D" || primary === "C" ? "结论" : "人和场景"}，再补${primary === "D" || primary === "C" ? "过程" : "数据"}——这是他自己处理信息的方式。`,
      PRESSURE[primary].startsWith("压力大时不说")
        ? "他嘴上说「都行」不等于没意见，要单独问一次。"
        : `他${primary === "D" ? "抢决策权" : primary === "I" ? "答应得快" : primary === "S" ? "回避冲突" : "反复改"}的时候，提前把边界和标准说清楚。`,
    ],
    job: {
      key: job,
      label: JOB_NAME[job],
      verdict,
      headline: verdict === "顺" ? "顺风：这套风格正好是这个岗每天在用的" : verdict === "偏顺" ? "偏顺风：第一风格不对口，第二风格补得上" : "逆风：这个岗要的，恰好不是他最顺手的",
      text,
    },
    headline,
  };
}
