/* v247：统一屏幕缩放为 100%，窄屏只改布局，不再随窗口尺寸改变报告字号。 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const combined = readFileSync(new URL("../src/components/reports/CombinedV39.tsx", import.meta.url), "utf8");
const zhihui = readFileSync(new URL("../src/pages/ZhihuiReport.tsx", import.meta.url), "utf8");

describe("v247 报告屏幕缩放统一", () => {
  it("综合报告不再按桌面断点放大到 1.15 倍", () => {
    expect(css).not.toContain("zoom: 1.15");
    expect(css).toContain(".report-view-zoom {\n    zoom: 1;");
  });

  it("生涯报告不再在手机端整体放大到 1.12 倍", () => {
    expect(zhihui).not.toContain("zoom: 1.12");
  });

  it("冰山舞台不再按窗口宽高做 transform 缩放", () => {
    expect(combined).not.toContain("window.innerHeight");
    expect(combined).not.toContain("transform: `scale(");
    expect(combined).toContain("const naturalH = Math.round(H + 10)");
  });

  it("容器不足时切换堆叠布局，而不是缩小文字", () => {
    expect(combined).toContain("mq.matches || wrap.clientWidth < STAGE_W");
  });
});
