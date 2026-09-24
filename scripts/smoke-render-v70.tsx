/* v70 冒烟：测评草稿换号防污染 + 作答期间取消不留洞 */
import { readFileSync } from "node:fs";

const need = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`SMOKE_FAIL: ${msg}`);
    process.exit(1);
  }
};
const needSrc = (src: string, kw: string, where: string) => need(src.includes(kw), `${where} 缺少「${kw}」`);

/* ---------- localStorage mock（与浏览器行为一致的最小实现） ---------- */
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
(globalThis as Record<string, unknown>).localStorage = new MemStorage();

const { loadQuizDraft, patchQuizDraft, clearQuizDraft, hasMeaningfulDraft } = await import("../src/lib/quizDraft");

/* ---------- 1. _w 写入者标记：旧版无标记草稿一律视为无草稿 ---------- */
(globalThis as Record<string, unknown>).localStorage = new MemStorage();
localStorage.setItem("sanhao.quizDraft.1001.discv2", JSON.stringify({ idx: 5, most: [0, 1], least: [2, 3] }));
need(loadQuizDraft(1001, "discv2") === null, "旧版无 _w 草稿必须丢弃（不能恢复来源不明的进度）");

/* ---------- 2. _w 与当前账号不一致 = 换号污染草稿，视为无草稿 ---------- */
localStorage.setItem(
  "sanhao.quizDraft.2002.discv2",
  JSON.stringify({ idx: 5, most: [0, 1], least: [2, 3], _w: "1001" }),
);
need(loadQuizDraft(2002, "discv2") === null, "_w 与当前 uid 不一致必须丢弃");
localStorage.setItem(
  "sanhao.quizDraft.1001.discv2",
  JSON.stringify({ idx: 2, most: [0], least: [1], _w: "1001" }),
);
need(loadQuizDraft(1001, "discv2") !== null && (loadQuizDraft(1001, "discv2")?.idx as number) === 2, "_w 与当前 uid 一致必须可读");

/* ---------- 3. patchQuizDraft 盖章 _w，写后立即可读 ---------- */
patchQuizDraft(2002, "discv2", { idx: 3, most: [1], least: [2] });
const d3 = loadQuizDraft(2002, "discv2");
need(d3 !== null && (d3._w as string) === "2002" && d3.idx === 3, "patch 后 _w 必须等于当前 uid 且字段可读");
// patch 会整体重写该 key：旧污染数据被覆盖
need(JSON.stringify(d3?.most) === "[1]", "patch 后旧污染 most 必须被覆盖");

/* ---------- 4. hasMeaningfulDraft：只有 _w 的空草稿不算有进度 ---------- */
patchQuizDraft(3003, "mbti", { idx: 0 });
need(hasMeaningfulDraft(3003, "mbti", "answers") === false, "仅 _w+idx 不算有实质进度");
patchQuizDraft(3003, "mbti", { answers: [0, 1] });
need(hasMeaningfulDraft(3003, "mbti", "answers") === true, "有答案数组算有实质进度");
// 全 null 数组也不算
patchQuizDraft(3004, "e3", { ratings: [null, null] });
need(hasMeaningfulDraft(3004, "e3", "ratings") === false, "全 null 数组不算有实质进度");
patchQuizDraft(3004, "e3", { ratings: [null, 2] });
need(hasMeaningfulDraft(3004, "e3", "ratings") === true, "部分作答算有实质进度");

/* ---------- 5. 清除草稿 ---------- */
clearQuizDraft(3003, "mbti");
need(loadQuizDraft(3003, "mbti") === null, "clear 后必须无草稿");

/* ---------- 6. 源码结构断言 ---------- */
const draftSrc = readFileSync("src/lib/quizDraft.ts", "utf8");
needSrc(draftSrc, "_w", "草稿写入者标记");
needSrc(draftSrc, "String(parsed._w) !== String(uid ?? \"anon\")", "_w 归属校验");
needSrc(draftSrc, "setValue(initialValue)", "换号无草稿时重置为初始值");
needSrc(draftSrc, "skipPersistRef", "persist 跳过 uid 切换批次");
needSrc(draftSrc, "useDraftResumed", "uid 跟随的恢复提示 hook");

const discSrc = readFileSync("src/components/companion/DiscV2Quiz.tsx", "utf8");
needSrc(discSrc, "advanceTimer", "跳组定时器先清后挂");
needSrc(discSrc, "window.clearTimeout(advanceTimer.current)", "取消选择时清掉 pending 定时器");
needSrc(discSrc, "useDraftResumed(user?.id, DRAFT, \"most\")", "恢复提示按 uid 重算");
needSrc(discSrc, "!user?.id || authRefreshing", "自动补提交等账号稳定");
needSrc(discSrc, "setResumed(false); // 已开始新作答", "作答即清恢复提示条");

const parentSrc = readFileSync("src/components/companion/DiscParentQuiz.tsx", "utf8");
needSrc(parentSrc, "advanceTimer", "家长版同样先清后挂");
needSrc(parentSrc, "useDraftResumed(user?.id, DRAFT, \"most\")", "家长版恢复提示按 uid 重算");

// 全部测评组件的恢复提示都换用 uid 跟随逻辑（E3ParentQuiz 是复合判断，用内联 computeResumed）
for (const f of [
  "src/components/welcome/ChoiceStage.tsx",
  "src/components/welcome/E3Stage.tsx",
  "src/components/companion/AnchorQuiz.tsx",
  "src/components/companion/HollandQuiz.tsx",
  "src/components/companion/MultiQuiz.tsx",
  "src/components/companion/Multi5Quiz.tsx",
  "src/components/companion/MentalQuiz.tsx",
  "src/components/companion/MentalPaQuiz.tsx",
  "src/components/companion/MentalSdqQuiz.tsx",
  "src/components/companion/MentalScl90Quiz.tsx",
]) {
  needSrc(readFileSync(f, "utf8"), "useDraftResumed", `${f} 恢复提示须跟随 uid`);
}
const e3pSrc = readFileSync("src/components/companion/E3ParentQuiz.tsx", "utf8");
needSrc(e3pSrc, "computeResumed", "E3ParentQuiz 复合判断恢复提示");
needSrc(e3pSrc, "[user?.id]", "E3ParentQuiz 恢复提示跟随 uid");

// useAuth 暴露 isFetching（自动补提交/恢复逻辑等账号稳定用）
needSrc(readFileSync("src/hooks/useAuth.ts", "utf8"), "isFetching", "useAuth 暴露 isFetching");

// BUILD_TAG v70
needSrc(readFileSync("api/router.ts", "utf8"), "v70-2026-09-24", "BUILD_TAG v70");

console.log("RENDER_SMOKE_V70_OK");
