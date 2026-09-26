/* 报告渲染冒烟：ReportView 在各类残缺/完整数据下 SSR 渲染不得抛错（"查看报告没反应"回归）。 */
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { default: ReportView } = await import("../src/components/reports/ReportView");
const { trpc } = await import("../src/providers/trpc");

/* SSR 无网络：给 trpc Provider 挂一个全返回 undefined 的 mock client */
const mockClient = new Proxy(
  {},
  {
    get: () =>
      new Proxy(
        {},
        {
          get: () => async () => undefined,
        },
      ),
  },
) as never;

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const need = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`SMOKE_FAIL: ${msg}`);
    process.exit(1);
  }
};

const TABS = ["combined", "guidance", "e3", "mbti", "disc", "multi5", "academics", "anchor", "holland", "mental", "parent", "discparent", "profile"];

function render(tab: string, data: unknown, profile: unknown): string {
  return renderToString(
    <trpc.Provider client={mockClient} queryClient={qc}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/report-detail?tab=${tab}`]}>
          {/* @ts-expect-error 冒烟直传 */}
          <ReportView data={data} profile={profile} viewer="student" />
        </MemoryRouter>
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

/* 形态 1：完全没数据（新用户，什么都没测） */
const empty = {};
const profEmpty = { name: "测试", grade: "初一", academics: null };
for (const t of TABS) {
  const html = render(t, empty, profEmpty);
  need(typeof html === "string" && html.length > 100, `空数据 tab=${t} 渲染异常`);
}

/* 形态 2：只有 disc（用户实际场景：做了 DISC 去看报告） */
const discOnly = { disc: { primary: "S", dims: { D: 20, I: 30, S: 40, C: 10 } } };
for (const t of ["combined", "disc", "profile"]) {
  const html = render(t, discOnly, profEmpty);
  need(html.length > 100, `仅DISC tab=${t} 渲染异常`);
}

/* 形态 3：只有 mbti */
const mbtiOnly = { mbti: { type: "INFP", dims: { E: 30, I: 70, S: 40, N: 60, T: 35, F: 65, J: 20, P: 80 } } };
need(render("mbti", mbtiOnly, profEmpty).length > 100, "仅MBTI 渲染异常");

/* 形态 4：成绩档案 tab 带成绩 */
const profWithAcad = {
  name: "测试",
  grade: "初一",
  academics: {
    examName: "期中",
    subjects: [{ name: "语文", selfLevel: 2, fullScore: 100, lastScore: 82, targetScore: 90 }],
  },
};
need(render("academics", empty, profWithAcad).length > 100, "成绩 tab 渲染异常");

/* 形态 5：升学指导 tab——五项齐全 / 只有 MBTI */
const fullData = {
  mbti: { type: "INTJ", dims: { E: 25, I: 75, S: 30, N: 70, T: 80, F: 20, J: 65, P: 35 } },
  disc: { primary: "C", dims: { D: 20, I: 25, S: 30, C: 45 }, version: 2 },
  multi5: { dims: { reasoning: 82, detail: 70, number: 88, verbal: 60, spatial: 66 }, overall: 73, carefulIndex: 78, perDim: [] },
  holland: { dims: { R: 3.2, I: 4.5, A: 2.8, S: 3.0, E: 2.5, C: 3.8 }, top3: ["I", "C", "R"], code: "ICR", keywords: "", summary: "" },
  anchor: { dims: { TF: 4.2, GM: 3.8, AU: 3.1, SE: 2.9, EC: 2.6, SV: 2.4, CH: 3.3, LS: 2.2 }, top2: ["TF", "GM"], summary: "" },
};
const hFull = render("guidance", fullData, profWithAcad);
need(hFull.includes("升学指导"), "升学 tab 头卡");
need(hFull.includes("选科建议"), "升学 tab 选科块");
need(hFull.includes("推荐专业方向"), "升学 tab 专业块");
need(hFull.includes("ICR"), "升学 tab 霍兰德代码");
need(render("guidance", mbtiOnly, profWithAcad).length > 100, "升学 tab 仅 MBTI 形态");

console.log("REPORT_RENDER_SMOKE_OK");
process.exit(0);
