/**
 * 测评答题的跳题逻辑（纯函数，与 UI 无关）。
 *
 * 单独放一个文件，一是 fast-refresh 只认「一个文件只导出组件」，
 * 二是这个分支太容易被写错、又不容易人工回归——「最后一题答完提交」
 * 曾经因为读到上一帧 state 判成「还没答」，人卡在最后一题上走不掉。
 */

/**
 * 从 from 起往后找第一道没答的题，绕回开头再找一遍；全答完返回 -1。
 *
 * @param total 总题数
 * @param from  从第几题开始找（通常是当前题 +1）
 * @param isDone 判断第 i 题是否已答——**必须把「刚点的这一题」也算进去**，
 *               否则调用方读到的还是上一帧的作答状态，最后一题永远判成没答。
 */
export function nextOpenIndex(total: number, from: number, isDone: (i: number) => boolean): number {
  for (let i = from; i < total; i++) if (!isDone(i)) return i;
  for (let i = 0; i < total; i++) if (!isDone(i)) return i;
  return -1;
}
