/* v167 冒烟：分配伴学师面板改 portal 固定定位——
   原先 absolute 定位在表格行内，会被表格容器 overflow 裁剪盖住，
   末行向下弹出还会被截断。v167 要求：portal 到 body、fixed 定位、
   下方空间不足自动向上翻、点外部/Esc/滚动关闭。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v167 分配伴学师面板 portal 定位", () => {
  const src = readFileSync("src/components/TutorAssignButton.tsx", "utf-8");

  it("面板 portal 到 body 且 fixed 定位", () => {
    if (!/createPortal\(/.test(src)) throw new Error("缺：createPortal");
    if (!/document\.body/.test(src)) throw new Error("缺：portal 到 body");
    if (!/className="fixed z-\[90\]/.test(src)) throw new Error("缺：fixed 定位");
  });

  it("下方放不下时向上翻", () => {
    if (!/rect\.top - panelH - gap/.test(src)) throw new Error("缺：向上翻逻辑");
  });

  it("点外部 / Esc 关闭", () => {
    if (!/mousedown/.test(src)) throw new Error("缺：点外部关闭");
    if (!/Escape/.test(src)) throw new Error("缺：Esc 关闭");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v167-2026-10-14";')) throw new Error("BUILD_TAG 未递增到 v167");
  });
});
