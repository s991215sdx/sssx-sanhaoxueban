import { scoreE3V37 } from "../contracts/e3v37";
const ratings70 = Array.from({ length: 70 }, (_, i) => (i % 5) + 1);
const e3 = scoreE3V37({ stage: "junior", ratings: ratings70, motivation: "want", subjects: [], lossReasons: [], scoreTrend: "基本稳定", lifeEvents: Array.from({ length: 8 }, () => 0), openAnswers: [] } as any);
console.log(JSON.stringify(e3.systems));console.log(JSON.stringify(e3.aptitude));
console.log("cond", (e3 as any).conditionAvg, "apt", (e3 as any).aptitudeAvg);
