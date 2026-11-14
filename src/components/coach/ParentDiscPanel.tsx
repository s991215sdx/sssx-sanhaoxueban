/**
 * v283 「家长扫码」板块（伴学工作台）：家长 DISC 扫码直测的二维码与待融合池。
 *
 * 左卡：固定入口 /pd 的二维码——打印贴门店或发家长群，家长免登录免邀请码直接测。
 * 右卡：待融合池——扫码直测的家长 DISC（未绑定孩子）列表，
 *       选择学员后一键绑定，绑定后与孩子账号里直接填的家长 DISC 完全同权
 *       （家长报告、亲子对照自动出现，无需任何额外迁移）。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, QrCode, UserCheck, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";

const RESPONDENT_LABEL: Record<string, string> = { dad: "爸爸", mom: "妈妈", other: "其他" };

export default function ParentDiscPanel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const url = useMemo(() => `${window.location.origin}/pd`, []);
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
  /** 每条记录当前选中的学员 userId */
  const [pick, setPick] = useState<Record<number, number>>({});

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时不阻塞 */
    }
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
          家长扫码免登录直接测（约 5 分钟），结果先进入右侧「待融合池」；
          孩子建档后在这里一键绑定，报告自动并入家长报告。
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
          提示：家长留的手机号是融合时的匹配线索；不填手机号也能绑定——按称呼与测评时间在列表里找到那条记录即可。
        </p>
      </div>

      {/* 右卡：待融合池 */}
      <div className="paper-card p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-olive" />
            <h3 className="text-[16px] font-bold text-olive">待融合池（扫码直测未绑定）</h3>
          </div>
          <button
            onClick={() => void pool.refetch()}
            className="text-[12.5px] text-olive-mute hover:text-olive"
          >
            刷新
          </button>
        </div>

        {pool.isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
          </div>
        ) : !pool.data?.length ? (
          <p className="mt-6 py-8 text-center text-[13px] text-olive-mute">
            还没有扫码直测的记录。把左侧二维码发给家长，测完这里就会出现。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {pool.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="w-16 shrink-0 text-[14px] font-semibold text-olive">{r.label}</span>
                <span className="shrink-0 rounded-full bg-cream-deep px-2 py-0.5 text-[11.5px] text-olive-soft">
                  {RESPONDENT_LABEL[r.respondent] ?? "其他"}
                </span>
                <span className="shrink-0 rounded-full bg-brand-pale px-2 py-0.5 text-[11.5px] font-medium text-brand">
                  DISC {r.primary} 型
                </span>
                {r.phone && <span className="shrink-0 text-[12.5px] text-olive-mute">{r.phone}</span>}
                <span className="shrink-0 text-[12px] text-olive-mute">
                  {new Date(r.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <select
                    value={pick[r.id] ?? ""}
                    onChange={(e) => setPick((p) => ({ ...p, [r.id]: Number(e.target.value) }))}
                    className="max-w-[160px] rounded-lg border border-border bg-cream px-2 py-1.5 text-[12.5px] text-olive outline-none focus:border-lime"
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
                    绑定
                  </button>
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
      </div>
    </div>
  );
}
