/**
 * v286 家长 DISC 融合读本 · 打印页（/pd-report）
 * v289 增：双人对照读本（`?a=&b=`）走同一页，版式一致。
 *
 * 只放书本身，不放侧栏、不放按钮进纸面。两个用途：
 *   1. 服务端 /api/report-pdf 用无头浏览器打开本页出 PDF（后台「导出 PDF」与家长端同一个入口）；
 *   2. 家长/老师在手机上直接打开，用浏览器「打印 / 存为 PDF」带走。
 *
 * 权限三路：
 *   - `?id=&k=<查看钥匙>`：家长本人（钥匙存在本机，测完就写进去了），免登录；
 *   - `?id=`：登录中的伴学师/管理员，走 standaloneDiscDetail，与后台抽屉同一套权限；
 *   - `?a=&b=`：双人对照，只走登录态（两条记录家长手上不可能都有钥匙）。
 */
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Printer } from "lucide-react";
import { trpc } from "@/providers/trpc";
import ParentDiscReader from "@/components/reports/ParentDiscReader";
import ParentDiscCompare from "@/components/reports/ParentDiscCompare";
import type { DiscResult } from "@contracts/assessments";

export default function ParentDiscPrintPage() {
  const [sp] = useSearchParams();
  const id = Number(sp.get("id") ?? 0);
  const aId = Number(sp.get("a") ?? 0);
  const bId = Number(sp.get("b") ?? 0);
  const viewKey = (sp.get("k") ?? "").trim();
  const byKey = id > 0 && viewKey.length >= 8;
  const isPair = aId > 0 && bId > 0 && aId !== bId;

  const pub = trpc.assessment.standaloneDiscReport.useQuery(
    { id, viewKey },
    { enabled: byKey, retry: false },
  );
  const staff = trpc.assessment.standaloneDiscDetail.useQuery(
    { id },
    { enabled: id > 0 && !byKey, retry: false },
  );
  const pair = trpc.assessment.standaloneDiscPair.useQuery(
    { a: aId, b: bId },
    { enabled: isPair, retry: false },
  );

  const single = byKey
    ? pub.data
      ? { label: pub.data.label, result: pub.data.result as unknown as DiscResult, metaText: "" }
      : null
    : staff.data
      ? {
          label: staff.data.label,
          result: staff.data.result as unknown as DiscResult,
          metaText: `测于 ${staff.data.createdAtText}${staff.data.studentUserId ? " · 已并入学员档案" : " · 尚未绑定学员"}`,
        }
      : null;

  const data = isPair ? null : single;
  const loading = isPair ? pair.isLoading : byKey ? pub.isLoading : staff.isLoading;
  const failed = isPair
    ? !pair.isLoading && !pair.data
    : byKey
      ? !pub.isLoading && !pub.data
      : !staff.isLoading && !staff.data;

  /* 打印页不套 Layout，页面标题就是纸面上的标题 */
  useEffect(() => {
    if (isPair && pair.data) {
      document.title = `家长 DISC · 双人对照读本 · ${pair.data.a.label}×${pair.data.b.label}`;
    } else {
      document.title = data ? `家长 DISC · 家庭沟通读本 · ${data.label}` : "家长 DISC · 家庭沟通读本";
    }
  }, [data, isPair, pair.data]);

  if (id <= 0 && !isPair) {
    return <Hint text="这个链接缺少报告编号，请回到上一页重新点「导出 PDF」。" />;
  }
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      </div>
    );
  }
  if (failed || (isPair ? !pair.data : !data)) {
    return (
      <Hint
        text={
          isPair
            ? "读不到这两份报告：登录可能已过期，或其中一条不属于你所在的机构。"
            : byKey
              ? "这份报告打不开：查看钥匙不对，或这条记录已被删除。"
              : "读不到这份报告：登录可能已过期，或这条记录不属于你所在的机构。"
        }
      />
    );
  }

  return (
    <div className="bg-white">
      {/* 纸面尺寸与页边距：浏览器打印与服务端 PDF 走同一份，两边版式对得上 */}
      <style>{`@page { size: A4; margin: 0; }
        @media print { .no-print { display: none !important; } body { background: #fff !important; } }`}</style>

      <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-cream/95 px-4 py-2.5 backdrop-blur">
        <span className="text-[12.5px] text-olive-soft">
          家长 DISC · {isPair ? "双人对照读本" : "家庭沟通读本"}
        </span>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-cream hover:bg-lime"
        >
          <Printer size={13} />
          打印 / 存为 PDF
        </button>
        <Link to="/pd" className="text-[12.5px] text-olive-mute hover:text-olive">
          返回
        </Link>
      </div>

      <div
        id="pd-print-root"
        data-ready="1"
        className="mx-auto w-full max-w-[210mm] px-4 py-6 sm:px-[15mm] sm:py-[16mm]"
      >
        {isPair && pair.data ? (
          <ParentDiscCompare
            a={{ label: pair.data.a.label, result: pair.data.a.result }}
            b={{ label: pair.data.b.label, result: pair.data.b.result }}
            printMode
            metaText={`${pair.data.a.label} 测于 ${pair.data.a.createdAtText} · ${pair.data.b.label} 测于 ${pair.data.b.createdAtText}`}
          />
        ) : data ? (
          <ParentDiscReader label={data.label} result={data.result} printMode metaText={data.metaText} />
        ) : null}
      </div>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <div data-pd-error="1" className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="paper-card max-w-sm p-6 text-center">
        <p className="text-[13.5px] leading-relaxed text-olive">{text}</p>
        <Link
          to="/pd"
          className="mt-4 inline-block rounded-xl bg-brand px-5 py-2 text-[13px] font-semibold text-cream hover:bg-lime"
        >
          回到家长测评页
        </Link>
      </div>
    </div>
  );
}
