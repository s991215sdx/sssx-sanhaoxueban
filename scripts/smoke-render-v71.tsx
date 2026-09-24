/* v71 冒烟：HTML no-store 缓存 + 新版本提示条 + 草稿污染物理自清 + 定时器到期复核 */
import { readFileSync } from "node:fs";

const need = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`SMOKE_FAIL: ${msg}`);
    process.exit(1);
  }
};
const needSrc = (src: string, kw: string, where: string) => need(src.includes(kw), `${where} 缺少「${kw}」`);

/* ---------- localStorage mock ---------- */
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
}
(globalThis as Record<string, unknown>).localStorage = new MemStorage();

const { loadQuizDraft } = await import("../src/lib/quizDraft");

/* ---------- 1. 污染草稿读取即物理清除 ---------- */
localStorage.setItem("sanhao.quizDraft.1001.discv2", JSON.stringify({ idx: 5, most: [0], least: [2] }));
need(loadQuizDraft(1001, "discv2") === null, "旧版无 _w 草稿必须视为无草稿");
need(localStorage.getItem("sanhao.quizDraft.1001.discv2") === null, "旧版无 _w 草稿必须被物理清除");
localStorage.setItem("sanhao.quizDraft.2002.discv2", JSON.stringify({ idx: 5, most: [0], least: [2], _w: "1001" }));
need(loadQuizDraft(2002, "discv2") === null, "_w 不符必须视为无草稿");
need(localStorage.getItem("sanhao.quizDraft.2002.discv2") === null, "_w 不符草稿必须被物理清除");
localStorage.setItem("sanhao.quizDraft.3003.discv2", JSON.stringify({ idx: 2, most: [1], least: [3], _w: "3003" }));
need(loadQuizDraft(3003, "discv2") !== null, "_w 一致草稿必须可读");
need(localStorage.getItem("sanhao.quizDraft.3003.discv2") !== null, "合法草稿不得误删");

/* ---------- 2. 源码结构断言 ---------- */
const viteLib = readFileSync("api/lib/vite.ts", "utf8");
needSrc(viteLib, "no-store, must-revalidate", "HTML 禁止缓存");
needSrc(viteLib, "max-age=31536000, immutable", "assets 长缓存");

const viteCfg = readFileSync("vite.config.ts", "utf8");
needSrc(viteCfg, "VITE_BUILD_TAG", "前端注入版本号 define");

const toast = readFileSync("src/components/UpdateToast.tsx", "utf8");
needSrc(toast, "refetchInterval: 60_000", "版本轮询 60s");
needSrc(toast, "立即刷新", "刷新按钮");
needSrc(toast, "window.location.reload()", "点击刷新");

const layout = readFileSync("src/components/Layout.tsx", "utf8");
needSrc(layout, "<UpdateToast />", "Layout 挂载提示条");

const discSrc = readFileSync("src/components/companion/DiscV2Quiz.tsx", "utf8");
needSrc(discSrc, "到期复核", "定时器到期复核");
needSrc(discSrc, "finish(fm, fl)", "提交用最新数组");
const parentSrc = readFileSync("src/components/companion/DiscParentQuiz.tsx", "utf8");
needSrc(parentSrc, "到期复核", "家长版定时器到期复核");

const draftSrc = readFileSync("src/lib/quizDraft.ts", "utf8");
needSrc(draftSrc, "localStorage.removeItem(key)", "归属不符物理清除");

needSrc(readFileSync("api/router.ts", "utf8"), "v71-2026-09-24", "BUILD_TAG v71");

console.log("RENDER_SMOKE_V71_OK");
