/* v67 冒烟：测评草稿按账号隔离（换账号不串草稿） */
import { readFileSync } from "node:fs";

const need = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`SMOKE_FAIL: ${msg}`);
    process.exit(1);
  }
};
const needSrc = (src: string, kw: string, where: string) => need(src.includes(kw), `${where} 缺少「${kw}」`);

// 1. 源码断言：quizDraft 模块带 uid 维度 + useDraftState 内部接 useAuth
const draftSrc = readFileSync("src/lib/quizDraft.ts", "utf8");
needSrc(draftSrc, "sanhao.quizDraft.", "草稿前缀");
needSrc(draftSrc, "${uid ?? \"anon\"}.${kind}", "草稿 key 含 uid");
needSrc(draftSrc, "useAuth()", "useDraftState 接入会话");
needSrc(draftSrc, "[value, uid]", "uid 变化时改写对应账号草稿");
needSrc(draftSrc, "setSeenUid(uid)", "uid 迟到重读草稿");

// 2. 组件直调点断言：全部带 user?.id
const files = [
  "src/components/companion/AnchorQuiz.tsx",
  "src/components/companion/DiscParentQuiz.tsx",
  "src/components/companion/DiscV2Quiz.tsx",
  "src/components/companion/E3ParentQuiz.tsx",
  "src/components/companion/HollandQuiz.tsx",
  "src/components/companion/MentalPaQuiz.tsx",
  "src/components/companion/MentalQuiz.tsx",
  "src/components/companion/MentalScl90Quiz.tsx",
  "src/components/companion/MentalSdqQuiz.tsx",
  "src/components/companion/Multi5Quiz.tsx",
  "src/components/companion/MultiQuiz.tsx",
  "src/components/welcome/ChoiceStage.tsx",
  "src/components/welcome/E3Stage.tsx",
];
for (const f of files) {
  const s = readFileSync(f, "utf8");
  needSrc(s, "useAuth", `${f} 接入 useAuth`);
  const loads = s.match(/loadQuizDraft\(/g) ?? [];
  const uidLoads = s.match(/loadQuizDraft\(user\?\.id, /g) ?? [];
  need(loads.length === uidLoads.length, `${f} loadQuizDraft 未全部带 uid（${uidLoads.length}/${loads.length}）`);
  const clears = s.match(/clearQuizDraft\(/g) ?? [];
  const uidClears = s.match(/clearQuizDraft\(user\?\.id, /g) ?? [];
  need(clears.length === uidClears.length, `${f} clearQuizDraft 未全部带 uid（${uidClears.length}/${clears.length}）`);
}

// 3. 行为断言：localStorage mock 下验证账号隔离
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
const { loadQuizDraft, patchQuizDraft, clearQuizDraft, hasMeaningfulDraft } = await import("../src/lib/quizDraft");

patchQuizDraft("u-old", "mbti", { answers: [1, 2, 3], idx: 3 });
patchQuizDraft("u-new", "mbti", { answers: [] });

// 新账号读不到旧账号草稿
need(loadQuizDraft("u-new", "mbti")?.answers?.length === 0, "新账号不应读到旧账号草稿内容");
need(hasMeaningfulDraft("u-new", "mbti") === false, "新账号不应被判定有进度");
need(hasMeaningfulDraft("u-old", "mbti") === true, "旧账号草稿仍应存在");
// 匿名/未登录空间互相独立
need(loadQuizDraft(null, "mbti") === null, "anon 空间不应有草稿");
patchQuizDraft(undefined, "mbti", { answers: [9] });
need((loadQuizDraft("u-old", "mbti")?.answers as number[])?.[0] === 1, "anon 写入不影响旧账号");
need((loadQuizDraft(undefined, "mbti")?.answers as number[])?.[0] === 9, "anon 空间自读一致");
// 清除只影响指定账号
clearQuizDraft("u-old", "mbti");
need(loadQuizDraft("u-old", "mbti") === null, "清除后旧账号草稿应为 null");
need(hasMeaningfulDraft(undefined, "mbti") === true, "清除旧账号不影响 anon");

// 4. BUILD_TAG 升级
const routerSrc = readFileSync("api/router.ts", "utf8");
needSrc(routerSrc, "v67-2026-09-24", "BUILD_TAG v67");

console.log("RENDER_SMOKE_V67_OK");
