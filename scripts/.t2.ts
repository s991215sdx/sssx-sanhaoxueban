import { DISC_V2_GROUPS, DISC_PARENT_V2_GROUPS, DISC_QUESTIONS } from "../contracts/assessments";
// V1：每个维度作为 aType / bType 出现次数
const cnt: Record<string, number[]> = { D: [0, 0], I: [0, 0], S: [0, 0], C: [0, 0] };
DISC_QUESTIONS.forEach((q: any) => { cnt[q.aType][0]++; cnt[q.bType][1]++; });
console.log("V1 a/b 分布", JSON.stringify(cnt));
// V2：每个维度在 4 个词位的出现次数（学生版 / 家长版）
for (const [name, groups] of [["学生", DISC_V2_GROUPS], ["家长", DISC_PARENT_V2_GROUPS]] as const) {
  const pos: Record<string, number[]> = { D: [0,0,0,0], I: [0,0,0,0], S: [0,0,0,0], C: [0,0,0,0] };
  groups.forEach((g) => g.types.forEach((t, i) => pos[t][i]++));
  console.log(`V2 ${name}版位置分布`, JSON.stringify(pos));
}
