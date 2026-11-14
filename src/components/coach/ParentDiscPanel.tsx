/**
 * v283 「家长扫码」板块（伴学工作台）：家长 DISC 扫码直测的二维码与待融合池。
 *
 * 左卡：入口 /pd 的二维码——打印贴门店或发家长群，家长免登录免邀请码直接测。
 *       机构账号生成的码带 ?o=<机构 id>，扫进来直接归本机构；平台超管的码进公共池。
 * 右卡：待融合池——扫码直测的家长 DISC（未绑定孩子）列表，
 *       点「看报告」当场翻完整报告，选择学员后一键绑定；
 *       绑定后与孩子账号里直接填的家长 DISC 完全同权（家长报告、亲子对照自动出现）。
 *
 * v285：
 * - 加「看报告」抽屉（不绑定也能看完整报告，验收题目、给家长解读都用得上）；
 * - 加机构归属与「认领」——公共池里的记录由机构管理员认领后可长期查看，别的机构看不到；
 * - 平台超管（无机构）可看全部记录并看到归属机构名，用来跨机构巡检。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, FileText, QrCode, UserCheck, Users, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import StandaloneParentDiscReport from "@/components/reports/StandaloneParentDiscReport";
import type { DiscResult } from "@contracts/assessments";

const RESPONDENT_LABEL: Record<string, string> = { dad: "爸爸", mom: "妈妈", other: "其他" };

export default function ParentDiscPanel() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const myOrgId = user?.orgId ?? null;
  /** 平台超管：admin 且没有机构归属——看全部，不需要认领 */
  const isPlatform = user?.role === "admin" && myOrgId == null;
  const url = useMemo(
    () => `${window.location.origin}/pd${myOrgId != null ? `?o=${myOrgId}` : ""}`,
    [myOrgId],
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 300, margin: 2 }).catch(() => {});
  }, [url]);

  const pool = trpc.assessment.standaloneDiscs.useQuery();
  const students = trpc.coach.myStudents.useQuery();
  const utils = trpc.useUtils();
  const bind = trpc.assessment.bindStandaloneDisc.useMutation({
    onSuccess: () => {
      void utils.assessment.standaloneDiscs.invalidate();
    },
  });
  const claim = trpc.assessment.claimStandaloneDiscs.useMutation({
    onSuccess: () => {
      void utils.assessment.standaloneDiscs.invalidate();
    },
  });
  /* 平台超管：跨机构改归属（家长在 A 机构码上测的，事后并到 B 机构） */
  const orgs = trpc.org.list.useQuery(undefined, { enabled: isPlatform });
  const transfer = trpc.assessment.transferStandaloneDiscs.useMutation({
    onSuccess: () => {
      void utils.assessment.standaloneDiscs.invalidate();
    },
  });
  const [toOrg, setToOrg] = useState<Record<number, number>>({});
  /** 每条记录当前选中的学员 userId */
  const [pick, setPick] = useState<Record<number, number>>({});
  /** 正在看报告的记录 id */
  const [viewing, setViewing] = useState<number | null>(null);
  const detail = trpc.assessment.standaloneDiscDetail.useQuery(
    { id: viewing ?? 0 },
    { enabled: viewing != null },
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时不阻塞 */
    }
  };

  const rows = pool.data ?? [];
  const freeIds = rows.filter((r) => r.orgId == null).map((r) => r.id);
  const canClaim = !isPlatform && myOrgId != null && freeIds.length > 0;

  const orgTag = (r: (typeof rows)[number]) => {
    if (r.orgId == null)
      return <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[11.5px] text-olive-mute">未归属 · 公共池</span>;
    if (myOrgId != null && r.orgId === myOrgId)
      return <span className="rounded-full bg-mint-pale px-2 py-0.5 text-[11.5px] text-brand">本机构</span>;
    return (
      <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[11.5px] text-olive-soft">
        归 {r.orgName || `机构 ${r.orgId}`}
      </span>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* 左卡：二维码 */}
      <div className="paper-card p-5">
        <div className="flex items-center gap-2">
          <QrCode size={18} className="text-olive" />
          <h3 className="text-[16px] font-bold text-olive">家长 DISC 扫码直测</h3>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-olive-soft">
          家长扫码免登录直接测（约 5 分钟），测完当场就能看自己的报告；
          结果同时进入右侧列表，孩子建档后在这里一键绑定，报告自动并入家长报告。
        </p>
        <div className="mt-4 flex justify-center rounded-xl border border-border bg-white p-3">
          <canvas ref={canvasRef} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-cream px-2 py-1.5 text-[12px] text-olive-soft">{url}</code>
          <button
            onClick={copy}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-olive-soft hover:text-olive"
          >
            <Copy size={13} />
            {copied ? "已复制" : "复制"}
          </button>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-olive-mute">
          {myOrgId != null
            ? "这张码带着本机构标记：家长扫进来测完，记录直接归本机构，其他机构看不到。"
            : "平台超管的码不绑定机构：扫码记录先落在公共池，由机构管理员在列表里认领。"}
        </p>
      </div>

      {/* 右卡：待融合池 */}
      <div className="paper-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-olive" />
            <h3 className="text-[16px] font-bold text-olive">家长扫码记录（未绑定学员）</h3>
            <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[11.5px] text-olive-soft">共 {rows.length} 条</span>
          </div>
          <div className="flex items-center gap-2">
            {canClaim && (
              <button
                onClick={() => {
                  if (window.confirm(`把 ${freeIds.length} 条未归属记录归到本机构？归属后其他机构不再看到。`)) {
                    claim.mutate(
                      { ids: freeIds },
                      { onError: (e) => window.alert(e instanceof Error ? e.message : "认领失败") },
                    );
                  }
                }}
                disabled={claim.isPending}
                className="rounded-lg border border-brand/40 bg-brand-pale px-2.5 py-1.5 text-[12.5px] font-semibold text-brand transition-colors hover:border-brand disabled:opacity-40"
              >
                认领 {freeIds.length} 条未归属
              </button>
            )}
            <button onClick={() => void pool.refetch()} className="text-[12.5px] text-olive-mute hover:text-olive">
              刷新
            </button>
          </div>
        </div>

        {pool.isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
          </div>
        ) : !rows.length ? (
          <p className="mt-6 py-8 text-center text-[13px] text-olive-mute">
            还没有扫码直测的记录。把左侧二维码发给家长，测完这里就会出现。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-16 shrink-0 text-[14px] font-semibold text-olive">{r.label}</span>
                  <span className="shrink-0 rounded-full bg-cream-deep px-2 py-0.5 text-[11.5px] text-olive-soft">
                    {RESPONDENT_LABEL[r.respondent] ?? "其他"}
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-pale px-2 py-0.5 text-[11.5px] font-medium text-brand">
                    DISC {r.primary} 型
                  </span>
                  {r.phone && <span className="shrink-0 text-[12.5px] text-olive-mute">{r.phone}</span>}
                  <span className="shrink-0 text-[12px] text-olive-mute">{r.createdAtText}</span>
                  {orgTag(r)}
                  {r.mine && (
                    <span className="shrink-0 rounded-full bg-[#E3B53A]/20 px-2 py-0.5 text-[11.5px] font-medium text-[#8A6500]">
                      本机构家长
                    </span>
                  )}
                  <button
                    onClick={() => setViewing(r.id)}
                    className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-olive-soft transition-colors hover:border-olive/40 hover:text-olive"
                  >
                    <FileText size={13} />
                    看报告
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {isPlatform && (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={toOrg[r.id] ?? ""}
                        onChange={(e) => setToOrg((p) => ({ ...p, [r.id]: Number(e.target.value) }))}
                        className="w-[168px] shrink-0 rounded-lg border border-border bg-cream px-2 py-1.5 text-[12.5px] text-olive outline-none focus:border-lime"
                      >
                        <option value="">转到机构…</option>
                        {(orgs.data ?? []).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.brandName || o.name}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!toOrg[r.id] || transfer.isPending}
                        onClick={() => {
                          const target = toOrg[r.id];
                          if (!target) return;
                          const name = (orgs.data ?? []).find((o) => Number(o.id) === target)?.brandName ?? `机构 ${target}`;
                          if (!window.confirm(`把「${r.label}」这条测评转到 ${name}？转过去后原机构看不到。`)) return;
                          transfer.mutate(
                            { ids: [r.id], orgId: target },
                            {
                              onSuccess: () => setToOrg((p) => ({ ...p, [r.id]: 0 })),
                              onError: (e) => window.alert(e instanceof Error ? e.message : "转移失败"),
                            },
                          );
                        }}
                        className="flex items-center gap-1 rounded-lg border border-brand/40 bg-brand-pale px-2.5 py-1.5 text-[12.5px] font-semibold text-brand transition-colors hover:border-brand disabled:opacity-40"
                      >
                        转移
                      </button>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <select
                      value={pick[r.id] ?? ""}
                      onChange={(e) => setPick((p) => ({ ...p, [r.id]: Number(e.target.value) }))}
                      className="w-[150px] shrink-0 rounded-lg border border-border bg-cream px-2 py-1.5 text-[12.5px] text-olive outline-none focus:border-lime"
                    >
                      <option value="">选择学员…</option>
                      {(students.data ?? []).map((s) => (
                        <option key={s.userId} value={s.userId}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!pick[r.id] || bind.isPending}
                      onClick={() =>
                        pick[r.id] &&
                        bind.mutate(
                          { resultId: r.id, studentUserId: pick[r.id] },
                          {
                            onSuccess: () => setPick((p) => ({ ...p, [r.id]: 0 })),
                            onError: (e) => window.alert(e instanceof Error ? e.message : "绑定失败"),
                          },
                        )
                      }
                      className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-[12.5px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
                    >
                      <UserCheck size={13} />
                      绑定到学员
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {bind.isError && (
          <p className="mt-2 text-[12.5px] text-terra">
            {bind.error instanceof Error ? bind.error.message : "绑定失败，请重试"}
          </p>
        )}
        {claim.isError && (
          <p className="mt-2 text-[12.5px] text-terra">
            {claim.error instanceof Error ? claim.error.message : "认领失败，请重试"}
          </p>
        )}
      </div>

      {/* 报告抽屉：不绑定也能看完整报告 */}
      {viewing != null && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#1E3530]/45" onClick={() => setViewing(null)}>
          <div
            className="h-full w-full max-w-2xl overflow-y-auto bg-cream p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-bold text-olive">
                  家长 DISC 报告{detail.data ? ` · ${detail.data.label}` : ""}
                </h3>
                <p className="mt-0.5 text-[12.5px] text-olive-mute">
                  {detail.data
                    ? `测于 ${detail.data.createdAtText}${
                        detail.data.studentUserId ? " · 已并入学员档案" : " · 尚未绑定学员"
                      }`
                    : "读取中…"}
                </p>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-olive-mute hover:text-olive"
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            {detail.isLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
              </div>
            ) : detail.isError ? (
              <p className="paper-card p-6 text-center text-[13.5px] text-terra">
                {detail.error instanceof Error ? detail.error.message : "报告读取失败"}
              </p>
            ) : detail.data ? (
              <StandaloneParentDiscReport label={detail.data.label} result={detail.data.result as DiscResult} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
