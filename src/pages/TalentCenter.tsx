/**
 * 人才测评中心（v253）。
 *
 * 这个页面解决一件事：让用人的人在两分钟内决定「给谁做哪一套」。
 * 所以先给四张岗位卡（各自缺什么、要加测什么、花多少分钟），再给两条入口——
 * 本人登录自测，或者发一张码让候选人在自己手机上答。
 *
 * 岗位权重表直接摊开放在这里，不做成「内部资料」：
 * 一个岗位真正吃哪几维，被评估的人也应该知道，否则发展建议就成了单向论断。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import QRCode from "qrcode";
import { ArrowRight, ClipboardCheck, Clock, Copy, Link2, QrCode, Target, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { DIM_LABEL, WEIGHT_LABEL, type JobKey, type TalentDim } from "@contracts/talent/score";

const POS_TAG: Record<JobKey, string> = {
  sales: "招生顾问 / 课程咨询",
  service: "班主任 / 学管师",
  admin: "教务行政 / 前台",
  mgmt: "校区负责人 / 主管",
};

function fmtDate(v: string | Date) {
  const d = typeof v === "string" ? new Date(v) : v;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export default function TalentCenter() {
  const { data: catalog } = trpc.talent.catalog.useQuery();
  const { user } = useAuth();
  const staff = user?.role === "admin" || user?.role === "tutor";

  const [pos, setPos] = useState<JobKey>("sales");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const mine = trpc.talent.mine.useQuery(undefined, { retry: false });
  const list = trpc.talent.list.useQuery({ limit: 30 }, { enabled: !!staff, retry: false });
  const invite = trpc.talent.invite.useMutation();

  const job = useMemo(() => catalog?.jobs.find((j) => j.key === pos), [catalog, pos]);
  const url = useMemo(() => {
    if (!invite.data) return "";
    return `${window.location.origin}/t/${invite.data.code}`;
  }, [invite.data]);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 420, margin: 2 }).catch(() => {});
  }, [url]);

  const openInvite = () => {
    setInviteOpen(true);
    if (!invite.data) invite.mutate({ position: pos });
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 浏览器不给剪贴板权限时，让用户手选链接 */
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mono text-[11px] font-bold tracking-wider text-olive-mute">人才测评 · TALENT</div>
          <h1 className="mt-1.5 text-[24px] font-bold tracking-tight text-olive">看看他适合哪一类活</h1>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-olive-soft">
            四类岗位共用一套底盘（大五 20 题、价值观 18 题、职场 DISC 24 组、特质情商 30 题），
            再按岗位加测一段。一套数据、四张岗位画像——同一个人在这里是长处，换个岗位可能就是隐患。
          </p>
        </div>
        {staff && (
          <button
            type="button"
            onClick={openInvite}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2.5 text-[13px] font-medium text-olive transition-colors hover:bg-butter-pale"
          >
            <QrCode size={15} /> 发一张码给候选人
          </button>
        )}
      </header>

      <section className="mt-6">
        <div className="text-[11px] font-bold tracking-wider text-olive-mute">选岗位</div>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {(catalog?.jobs ?? []).map((j) => {
            const on = j.key === pos;
            return (
              <button
                key={j.key}
                type="button"
                onClick={() => {
                  setPos(j.key);
                  invite.reset();
                }}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  on ? "border-brand bg-brand-pale/40 shadow-sm" : "border-border bg-white hover:bg-butter-pale/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold text-olive">{j.label}</span>
                  <span className="mono flex items-center gap-1 text-[10.5px] text-olive-mute">
                    <Clock size={11} /> {j.minutes} 分钟
                  </span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-olive-mute">{POS_TAG[j.key as JobKey]}</div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">{j.blurb}</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {(Object.keys(j.weights) as TalentDim[])
                    .filter((d) => j.weights[d] === 3)
                    .map((d) => (
                      <span key={d} className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10.5px] text-brand">
                        核心 · {DIM_LABEL[d]}
                      </span>
                    ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 选中岗位的细节：加测什么、权重怎么分 */}
      {job && (
        <section className="paper-card mt-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-olive">
                加测：{job.dutyName}（{job.dutyMinutes} 分钟 · {job.dutyPack === "admin" ? "含校对题" : "情境题"}）
              </div>
              <div className="mt-1 text-[12px] text-olive-mute">
                这个岗最吃的情商维：{(job as { eqFocus?: string[] }).eqFocus?.join("、") ?? "—"}
              </div>
            </div>
            <Link
              to={`/talent/quiz?position=${pos}`}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep"
            >
              <ClipboardCheck size={15} /> 我自己做这一套 <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {(Object.keys(job.weights) as TalentDim[]).map((d) => (
              <div key={d} className="rounded-lg border border-border bg-white px-2 py-1.5">
                <div className="text-[11.5px] text-olive-soft">{DIM_LABEL[d]}</div>
                <div className={`mono text-[10.5px] ${job.weights[d] === 3 ? "font-bold text-brand" : "text-olive-mute"}`}>
                  {WEIGHT_LABEL[job.weights[d]]}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 我的记录 */}
      <section className="mt-7">
        <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-olive-mute">
          <Target size={12} /> 我自己的记录
        </div>
        <div className="mt-2 space-y-1.5">
          {(mine.data ?? []).length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-3.5 py-4 text-[12.5px] text-olive-mute">
              还没做过。选一个岗位，做完当场出报告。
            </div>
          )}
          {(mine.data ?? []).map((r) => (
            <Link
              key={r.id}
              to={`/talent/report/${r.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-2.5 transition-colors hover:bg-butter-pale/50"
            >
              <span className="text-[13px] font-medium text-olive">{catalog?.jobs.find((j) => j.key === r.position)?.label ?? r.position}</span>
              <span className="mono text-[11px] text-olive-mute">{fmtDate(r.createdAt)}</span>
              <span className="ml-auto flex items-center gap-0.5">
                <span className="mono text-[17px] font-bold text-brand">{r.fitScore}</span>
                <span className="mono text-[10px] text-olive-mute">/100</span>
              </span>
              <span className={`mono rounded px-1.5 py-0.5 text-[10px] ${r.completeness >= 100 ? "bg-brand-pale text-brand" : "bg-butter-pale text-olive-soft"}`}>
                完成 {r.completeness}%
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 机构名单 */}
      {staff && (
        <section className="mt-7">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-olive-mute">
            <Users size={12} /> 评估名单（共 {list.data?.total ?? 0} 份）
          </div>
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-white">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-border bg-cream-deep/60 text-left text-[11px] text-olive-mute">
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">岗位</th>
                  <th className="px-3 py-2 font-medium">来源</th>
                  <th className="px-3 py-2 text-right font-medium">匹配</th>
                  <th className="px-3 py-2 text-right font-medium">完成</th>
                  <th className="px-3 py-2 text-right font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {(list.data?.rows ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-[12px] text-olive-mute">
                      还没有人做。点右上角「发一张码给候选人」，或者自己先做一份看看报告长什么样。
                    </td>
                  </tr>
                )}
                {(list.data?.rows ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-butter-pale/40">
                    <td className="px-3 py-2">
                      <Link to={`/talent/report/${r.id}`} className="font-medium text-brand hover:underline">
                        {r.candidateName || "未署名"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-olive-soft">{catalog?.jobs.find((j) => j.key === r.position)?.label ?? r.position}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10.5px] ${r.source === "invite" ? "bg-butter-pale text-olive-soft" : "bg-brand-pale text-brand"}`}>
                        {r.source === "invite" ? "扫码作答" : "本人自测"}
                      </span>
                    </td>
                    <td className="mono px-3 py-2 text-right font-bold text-olive">{r.fitScore}</td>
                    <td className="mono px-3 py-2 text-right text-olive-mute">{r.completeness}%</td>
                    <td className="mono px-3 py-2 text-right text-olive-mute">{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-8 rounded-xl border border-border bg-butter-pale/40 px-3.5 py-3 text-[11.5px] leading-relaxed text-olive-soft">
        题本自编，结构参考大五人格、DISC、特质情绪智力的公开框架，不是任何商业量表的授权版本，也没有外部常模。
        分数是「和自己比、和同事比」的参考，不构成录用或淘汰的唯一依据——真正预测绩效的排序是
        工作样本测验 ≈ 结构化面试 &gt; 认知能力 &gt; 尽责性与情绪稳定 &gt; 其余性格维度。
      </p>

      {/* 邀请码弹层 */}
      {inviteOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-olive/30 backdrop-blur-sm" onClick={() => setInviteOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[15px] font-bold text-olive">给候选人的一张码</div>
                <div className="mt-0.5 text-[11.5px] text-olive-mute">岗位：{job?.label ?? pos} · 7 天内有效</div>
              </div>
              <button type="button" onClick={() => setInviteOpen(false)} className="rounded-lg px-2 py-1 text-[12px] text-olive-mute hover:bg-butter-pale">
                关闭
              </button>
            </div>
            <div className="mt-4 flex justify-center rounded-xl border border-border bg-cream-deep/40 p-3">
              {invite.isPending && <div className="py-10 text-[12px] text-olive-mute">正在出码…</div>}
              {invite.error && <div className="py-10 text-[12px] text-terra">{invite.error.message}</div>}
              <canvas ref={canvasRef} className={`h-[188px] w-[188px] ${url ? "" : "hidden"}`} />
            </div>
            {url && (
              <>
                <div className="mono mt-3 break-all rounded-lg bg-cream-deep/50 px-2.5 py-2 text-[11px] text-olive-soft">{url}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={copy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-deep"
                  >
                    <Copy size={13} /> {copied ? "已复制" : "复制链接"}
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12.5px] text-olive-soft hover:bg-butter-pale"
                  >
                    <Link2 size={13} /> 打开看看
                  </a>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-olive-mute">
                  候选人扫码后先看到「谁请他答、答哪个岗」，填个姓名就能开始，不用注册。
                  答完他看不到分数，报告只回你这边——自评分数当场摆在候选人面前，他会开始按岗位调答案。
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
