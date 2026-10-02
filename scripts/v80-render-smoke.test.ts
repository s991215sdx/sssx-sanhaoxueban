/* v80 SSR 渲染冒烟：学科分析报告卡片 + 全局返回按钮 在 node 端渲染不得抛错且内容到位 */
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { default: ReportView } = await import("../src/components/reports/ReportView");
const { default: BackBar } = await import("../src/components/BackBar");
const { trpc } = await import("../src/providers/trpc");
const { scoreSubjectAssessment, SUBJECT_BANK, buildSubjectAnalysis } = await import("@contracts/subjectAssessment");

/* 与 scripts/smoke-report-render 同款：无网络环境给 trpc 挂全 undefined mock */
const mockClient = new Proxy({}, { get: () => new Proxy({}, { get: () => async () => undefined }) }) as never;
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrap(el: unknown, route = "/") {
  return h(trpc.Provider, { client: mockClient as never, queryClient: qc },
    h(QueryClientProvider, { client: qc },
      h(MemoryRouter, { initialEntries: [route] }, el as never)));
}

describe("v80 SSR 渲染冒烟", () => {
  it("学科能力评估栏目渲染「学科分析报告」（数据驱动内容）", () => {
    const answers = { 语文: SUBJECT_BANK["语文"].map(() => 5), 数学: SUBJECT_BANK["数学"].map(() => 2) };
    const result = scoreSubjectAssessment(answers);
    const html = renderToString(wrap(
      h(ReportView, { data: { subject: result }, profile: { name: "测试", grade: "初三", academics: null }, viewer: "student" }),
      "/report-detail?tab=subject",
    ));
    expect(html).toContain("学科分析报告");
    expect(html).toContain("优先行动清单");
    expect(html).toContain(buildSubjectAnalysis(result).headline.slice(0, 12));
    /* 逐科折叠头默认渲染科目名（展开详情为客户端交互态，SSR 不展开） */
    expect(html).toContain("数学");
  });

  it("非首页渲染返回按钮（无历史时不报错）", () => {
    const html = renderToString(wrap(h(BackBar), "/report-detail?tab=subject"));
    expect(html).toContain("返回");
  });

  it("学科分析报告纯函数：全部优秀时不出现「待提升」误判", () => {
    const answers = { 英语: SUBJECT_BANK["英语"].map(() => 5) };
    const a = buildSubjectAnalysis(scoreSubjectAssessment(answers));
    expect(a.subjects[0].grade).toBe("优秀");
    expect(a.headline).toContain("英语");
  });
});
