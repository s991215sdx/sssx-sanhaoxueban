/* 全量表计分一致性审查：极值作答 → 期望极值结果 */
import { scoreMbti, scoreDisc, scoreDiscV2, MBTI_QUESTIONS, DISC_QUESTIONS, DISC_V2_GROUPS, DISC_PARENT_V2_GROUPS, DISC_V2_GROUP_COUNT } from "../contracts/assessments";
import { scoreE3V37, E3V37_RATING_COUNT } from "../contracts/e3v37";
import { scoreMulti5, MULTI5_QUESTIONS } from "../contracts/multi5";
import { scoreAnchor } from "../contracts/careerAnchor";
import { scoreHolland } from "../contracts/holland";
import { scoreMental, scoreMentalLegacy, scoreMentalSdq, scoreMentalPa, MENTAL_V2_QUESTION_COUNT, MENTAL_SDQ_QUESTION_COUNT, MENTAL_PA_QUESTION_COUNT, MENTAL_RATINGS } from "../contracts/mentalHealth";
import { scoreE3V37Parent, E3V37P_MIRROR_QUESTIONS, E3V37P_FAMILY_QUESTIONS, E3V37P_COND_OBSERVE } from "../contracts/e3v37Parent";

const out: string[] = [];
const ck = (name: string, cond: boolean, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

// MBTI 28 题全 0 / 全 1
const m0 = scoreMbti(Array(28).fill(0)), m1 = scoreMbti(Array(28).fill(1));
ck("MBTI 全0/全1 类型相反", m0.type !== m1.type && m0.type.length === 4 && m1.type.length === 4, `${m0.type}/${m1.type}`);

// DISC V1 24 题全 0 vs 全 1：维度此消彼长
const d0 = scoreDisc(Array(24).fill(0)), d1 = scoreDisc(Array(24).fill(1));
ck("DISC V1 全0/全1 主型不同", d0.primary !== d1.primary, `${d0.primary}/${d1.primary}`);
const sumD = (d: any) => (["D","I","S","C"] as const).reduce((s, k) => s + d.dims[k], 0);
ck("DISC V1 总分守恒=12", sumD(d0) === 12 && sumD(d1) === 12, `${sumD(d0)}/${sumD(d1)}`);

// DISC V2：每组最像第一个词、最不像第二个词（稳定模式）→ 各组 type 映射一致
const most = Array(24).fill(0), least = Array(24).fill(1);
const dv2 = scoreDiscV2({ most, least });
const expectType0 = DISC_V2_GROUPS[0].types[0], expectType1 = DISC_V2_GROUPS[0].types[1];
ck("DISC V2 模式作答主型=首词维度", dv2.primary === expectType0, `${dv2.primary} 期望 ${expectType0}`);
ck("DISC V2 量尺 0-24", Object.values(dv2.dims).every((v) => v >= 0 && v <= 24), JSON.stringify(dv2.dims));
const dv2p = scoreDiscV2({ most, least }, DISC_PARENT_V2_GROUPS);
ck("DISC 家长版 V2 与学生版维度顺序一致", dv2p.primary === dv2.primary, `${dv2p.primary}/${dv2.primary}`);

// E3 全 5 分（反向题全 5 会被反转 → 不能期望全正常）；全 3 分
const e3all3 = scoreE3V37({ stage: "junior", ratings: Array(E3V37_RATING_COUNT).fill(3), motivation: "want", subjects: [], lossReasons: [], scoreTrend: "基本稳定", lifeEvents: Array(8).fill(0), openAnswers: [] } as any);
const scores3 = e3all3.systems.core.map((c) => c.score);
ck("E3 全3分 → 三系统均为 3±0.6", scores3.every((s) => Math.abs(s - 3) <= 0.6), JSON.stringify(scores3));
// 反向题检查：全 5 分时反向题应拉低相关维度（相比无反向假设）
const e3all5 = scoreE3V37({ stage: "junior", ratings: Array(E3V37_RATING_COUNT).fill(5), motivation: "want", subjects: [], lossReasons: [], scoreTrend: "基本稳定", lifeEvents: Array(8).fill(0), openAnswers: [] } as any);
ck("E3 全5分仍有维度 <5（反向题生效）", e3all5.abilities.some((a) => a.score < 5), e3all5.abilities.map((a) => `${a.label}${a.score}`).join(" "));

// multi5：全对 vs 全错
const m5ok = scoreMulti5(MULTI5_QUESTIONS.map((q: any) => q.answer));
const m5bad = scoreMulti5(MULTI5_QUESTIONS.map((q: any) => (q.answer + 1) % 4));
ck("multi5 全对 overall≥90", m5ok.overall >= 90, `${m5ok.overall}`);
ck("multi5 全错 overall≤30", m5bad.overall <= 30, `${m5bad.overall}`);

// anchor/holland 全 3
const a3 = scoreAnchor(Array(40).fill(3)), h3 = scoreHolland(Array(36).fill(3));
ck("职业锚/霍兰德 全3 不报错且有代码", !!a3 && !!h3.code);

// mental V2 全 0 / 全 3
const v0 = scoreMental(Array(MENTAL_V2_QUESTION_COUNT).fill(0));
const v3 = scoreMental(Array(MENTAL_V2_QUESTION_COUNT).fill(3));
ck("mental V2 全0=良好", v0.level === "良好" && !v0.selfHarm);
ck("mental V2 全3=高风险+selfHarm", v3.level === "高风险" && v3.selfHarm && v3.phq9 === 27 && v3.gad7 === 21);
// mental V1 legacy 30 题全 1 / 全 5
const l1 = scoreMentalLegacy(Array(30).fill(1)), l5 = scoreMentalLegacy(Array(30).fill(5));
ck("mental V1 全1=良好", l1.level === "良好" && l1.positiveCount === 0);
ck("mental V1 全5=预警", l5.level === "预警" && l5.positiveFactors.length === 10);
// SDQ 极值
const s0 = scoreMentalSdq(Array(MENTAL_SDQ_QUESTION_COUNT).fill(0));
const s2 = scoreMentalSdq(Array(MENTAL_SDQ_QUESTION_COUNT).fill(2));
ck("SDQ 全0 totalDiff=10（反向题），全2 totalDiff=30", s0.totalDiff === 10 && s2.totalDiff === 30, `${s0.totalDiff}/${s2.totalDiff}`);
ck("SDQ 全2 selfHarm", s2.selfHarm && s2.level === "高风险");
// PA
const pa0 = scoreMentalPa(Array(MENTAL_PA_QUESTION_COUNT).fill(0));
ck("PA 全0=良好 version=pa", pa0.level === "良好" && pa0.version === "pa");

// 家长卷：全「不了解」(mirror 全 0)
const pUnknown = scoreE3V37Parent({ family: Object.fromEntries(E3V37P_FAMILY_QUESTIONS.map((q) => [q.key, 0])), condObserve: Object.fromEntries(E3V37P_COND_OBSERVE.map((c) => [c.key, 3])), mirror: Array(E3V37P_MIRROR_QUESTIONS.length).fill(0) } as any, null, null);
ck("家长卷全不了解 unknownCount=16", pUnknown.unknownCount === E3V37P_MIRROR_QUESTIONS.length, `${pUnknown.unknownCount}`);

console.log(out.join("\n"));
console.log(out.some((l) => l.startsWith("FAIL")) ? "AUDIT_HAS_FAIL" : "AUDIT_ALL_PASS");
