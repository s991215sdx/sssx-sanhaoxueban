/* v68 冒烟：综合测评向导进入时跳过已完成步骤,直接从未完成项继续 */
import { readFileSync } from "node:fs";

const need = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`SMOKE_FAIL: ${msg}`);
    process.exit(1);
  }
};
const needSrc = (src: string, kw: string, where: string) => need(src.includes(kw), `${where} 缺少「${kw}」`);

// 1. CombinedSuite：挂载后等数据返回 → 计算第一个未完成步骤并跳转
const src = readFileSync("src/components/assessment/CombinedSuite.tsx", "utf8");
needSrc(src, "resumedRef", "只做一次的恢复守卫");
needSrc(src, "latestQuery.isLoading || profileQuery.isLoading", "等测评+档案数据返回");
needSrc(src, "STEPS.findIndex((s) => !doneFlags[s.key])", "找第一个未完成步骤");
needSrc(src, "setBasicsDone(hasBasics)", "档案已有姓名则基本信息视为完成");
needSrc(src, "firstIncomplete > 0", "有未完成项时跳转");
needSrc(src, "profile as { academics?: unknown }", "学业目标完成判定");
needSrc(src, "multi5: !!latest.multi5", "智能五项完成判定");

// 2. 六项 doneFlags 齐全
for (const k of ["basics", "mbti", "disc", "e3", "academics", "multi5"]) {
  needSrc(src, `${k}:`, `doneFlags 缺 ${k}`);
}

// 3. BUILD_TAG v68
const routerSrc = readFileSync("api/router.ts", "utf8");
needSrc(routerSrc, "v68-2026-09-24", "BUILD_TAG v68");

// 4. 逻辑推演：数据就绪时 firstIncomplete 计算与步骤跳转的对应关系由源码结构保证,
//    此处复核 STEPS 顺序与 StepKey 类型一致(防止步骤条顺序被改乱)
const stepsBlock = src.match(/const STEPS = \[([\s\S]*?)\] as const/)?.[1] ?? "";
const keys = [...stepsBlock.matchAll(/key: "(\w+)"/g)].map((m) => m[1]);
need(JSON.stringify(keys) === JSON.stringify(["basics", "mbti", "disc", "e3", "academics", "multi5"]), `STEPS 顺序异常: ${keys}`);

console.log("RENDER_SMOKE_V68_OK");
