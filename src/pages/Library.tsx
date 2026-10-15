import { useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import Pager from "@/components/Pager";
import DisciplineTreeChart from "@/components/reports/DisciplineTreeChart";
import { BookOpen, Briefcase, Building2, ClipboardList, Network, School, Upload, X } from "lucide-react";

/**
 * v171 智慧生涯 · 资料库（/library）：伴学师/管理员查询三库 + 12 学科门类图。
 * 管理员额外拥有 JSON 分块导入（专业库、院校分数库）与职业库编辑能力。
 */

type TabKey = "majors" | "careers" | "scores" | "universities" | "disciplines";

const TABS: { key: TabKey; label: string; icon: typeof BookOpen }[] = [
  { key: "majors", label: "查专业", icon: BookOpen },
  { key: "universities", label: "查大学", icon: Building2 },
  { key: "careers", label: "职业库", icon: Briefcase },
  { key: "scores", label: "院校专业分数库", icon: ClipboardList },
  { key: "disciplines", label: "12 学科门类", icon: Network },
];

/** 查专业三大领域（掌上高考式归纳）。 */
const FIELD_GROUPS: { label: string; sub: string; menleis: string[] }[] = [
  { label: "自然科学", sub: "理 · 工 · 农 · 医", menleis: ["理学", "工学", "农学", "医学"] },
  { label: "社会科学", sub: "经 · 管 · 法 · 教", menleis: ["经济学", "管理学", "法学", "教育学"] },
  { label: "人文科学", sub: "文 · 史 · 哲 · 艺", menleis: ["文学", "历史学", "哲学", "艺术学"] },
];

const MAJOR_FIELD_LABELS: [key: string, label: string][] = [
  ["one_liner", "一句话介绍"],
  ["intro", "专业介绍"],
  ["jobs", "就业方向"],
  ["goal", "培养目标"],
  ["require", "能力要求"],
  ["knowledge", "知识要求"],
  ["courses", "核心课程"],
  ["kaoyan", "考研方向"],
  ["famous", "著名人物"],
  ["employment", "就业领域"],
  ["regions", "就业地区分布"],
  ["industries", "就业行业分布"],
  ["occupations", "就业岗位分布"],
  ["salary", "薪资走势"],
  ["schools", "开设院校"],
  ["internship", "实习实训"],
  ["certs", "职业资格"],
  ["degree", "授予学位"],
  ["male_pct", "男生比例"],
  ["female_pct", "女生比例"],
];

/** 通用 JSON 分块导入：FileReader 读取 → 分块顺序上传（院校库字段多，块大小 300）。 */
function useJsonImport(
  mutate: (args: { rows: Record<string, unknown>[]; clear: boolean }) => Promise<{ imported: number }>,
  chunkSize = 2000,
) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const run = async (file: File, clear: boolean) => {
    setBusy(true);
    setProgress("读取文件…");
    try {
      const text = await file.text();
      const arr = JSON.parse(text) as Record<string, unknown>[];
      if (!Array.isArray(arr)) throw new Error("文件必须是 JSON 数组");
      const CHUNK = chunkSize;
      let done = 0;
      for (let i = 0; i < arr.length; i += CHUNK) {
        setProgress(`导入中 ${Math.min(i + CHUNK, arr.length)} / ${arr.length}…`);
        const r = await mutate({ rows: arr.slice(i, i + CHUNK), clear: clear && i === 0 });
        done += r.imported;
      }
      setProgress(`完成，共导入 ${done} 条 ✓`);
    } catch (e) {
      setProgress(`失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return { busy, progress, run, reset: () => setProgress("") };
}

function ImportButton({
  onFile,
  label,
  busy,
}: {
  onFile: (f: File) => void;
  label: string;
  busy: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium whitespace-nowrap text-olive transition-colors hover:bg-mint-pale/60 disabled:opacity-40"
      >
        <Upload size={14} /> {busy ? "导入中…" : label}
      </button>
    </>
  );
}

/* ---------------------------------- 专业库 ---------------------------------- */

function MajorsTab({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [menlei, setMenlei] = useState("");
  const [cat, setCat] = useState("");
  const [keyword, setKeyword] = useState("");
  const [detail, setDetail] = useState<number | null>(null);
  const { data: nav } = trpc.library.majorNav.useQuery();
  const query = trpc.library.majors.useQuery(
    { page, pageSize: 20, menlei: menlei || undefined, cat: cat || undefined, keyword: keyword || undefined },
  );
  const importMut = trpc.library.majorsImport.useMutation();
  const utils = trpc.useUtils();
  const imp = useJsonImport(async ({ rows }) => {
    const r = await importMut.mutateAsync({ rows });
    await utils.library.majors.invalidate();
    await utils.library.majorNav.invalidate();
    return r;
  });

  const cats = useMemo(
    () => (nav?.cats ?? []).filter((c) => !menlei || c.menlei === menlei),
    [nav, menlei],
  );
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 20));
  const detailRow = query.data?.rows.find((r) => r.id === detail) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={menlei}
          onChange={(e) => { setMenlei(e.target.value); setCat(""); setPage(1); }}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime"
        >
          <option value="">全部门类</option>
          {(nav?.menleis ?? []).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={cat}
          onChange={(e) => { setCat(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime"
        >
          <option value="">全部专业类</option>
          {cats.map((c) => (
            <option key={`${c.menlei}-${c.cat}`} value={c.cat}>{c.cat}</option>
          ))}
        </select>
        <input
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          placeholder="搜索专业名称 / 代码 / 介绍"
          className="w-60 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime"
        />
        <span className="text-[12px] text-olive-mute">{query.data?.total ?? 0} 个专业</span>
        {isAdmin && (
          <span className="ml-auto">
            <ImportButton label="导入专业库 JSON" busy={imp.busy} onFile={(f) => imp.run(f, false)} />
          </span>
        )}
      </div>
      {/* 三大领域快捷筛选：自然 / 社会 / 人文（参考掌上高考） */}
      <div className="flex flex-wrap gap-1.5">
        {FIELD_GROUPS.map((g) => {
          const active = g.menleis.includes(menlei);
          return (
            <button
              key={g.label}
              type="button"
              onClick={() => { setMenlei(active ? "" : g.menleis[0]); setCat(""); setPage(1); }}
              className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                active ? "border-transparent bg-brand text-white" : "border-border bg-cream-card text-olive hover:bg-mint-pale/60"
              }`}
              title={g.sub}
            >
              {g.label}
            </button>
          );
        })}
        {menlei && (
          <button type="button" onClick={() => { setMenlei(""); setCat(""); setPage(1); }}
            className="rounded-full border border-border bg-cream-card px-3 py-1 text-[11.5px] text-olive-mute hover:bg-mint-pale/60">
            清除筛选 ✕
          </button>
        )}
      </div>
      {imp.progress && <p className="text-[12px] text-olive-mute">{imp.progress}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-cream/60 text-[11.5px] text-olive-mute">
              <th className="px-3 py-2 font-semibold">代码</th>
              <th className="px-3 py-2 font-semibold">专业名称</th>
              <th className="px-3 py-2 font-semibold">门类</th>
              <th className="px-3 py-2 font-semibold">专业类</th>
              <th className="px-3 py-2 font-semibold">一句话介绍</th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows ?? []).map((r) => (
              <tr
                key={r.id}
                onClick={() => setDetail(r.id)}
                className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-mint-pale/40"
              >
                <td className="px-3 py-2 font-mono text-[11.5px] text-olive-mute">{r.code}</td>
                <td className="px-3 py-2 font-semibold text-olive">{r.name}</td>
                <td className="px-3 py-2 text-olive-mute">{r.menlei}</td>
                <td className="px-3 py-2 text-olive-mute">{r.cat}</td>
                <td className="max-w-[360px] truncate px-3 py-2 text-olive-mute">{r.oneLiner ?? "—"}</td>
              </tr>
            ))}
            {query.isLoading && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-olive-mute">加载中…</td></tr>
            )}
            {!query.isLoading && (query.data?.rows.length ?? 0) === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-olive-mute">
                {isAdmin ? "库里还没有数据，点右上角「导入专业库 JSON」上传" : "库里还没有数据，请联系管理员导入"}
              </td></tr>
            )}
          </tbody>
        </table>
        <Pager page={page} totalPages={totalPages} total={query.data?.total ?? 0} onChange={setPage} />
      </div>

      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={() => setDetail(null)}>
          <div
            className="paper-card my-6 w-full max-w-3xl space-y-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-olive">
                  {detailRow.name}
                  <span className="ml-2 font-mono text-[12px] font-normal text-olive-mute">{detailRow.code}</span>
                </h3>
                <p className="mt-1 text-[12.5px] text-olive-mute">
                  {detailRow.menlei} · {detailRow.cat} · {detailRow.level}
                  {detailRow.addedYear ? ` · ${detailRow.addedYear} 年增设` : ""}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 text-olive-mute hover:bg-cream" aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {MAJOR_FIELD_LABELS.map(([key, label]) => {
                const v = (detailRow as unknown as Record<string, string | null>)[key];
                if (!v) return null;
                return (
                  <div key={key}>
                    <div className="text-[12px] font-bold text-olive">{label}</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-olive-mute">{v}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- 职业库 ---------------------------------- */

function CareersTab({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const query = trpc.library.careers.useQuery(
    { page, pageSize: 12, keyword: keyword || undefined },
  );
  const utils = trpc.useUtils();
  const upsert = trpc.library.careersUpsert.useMutation({
    onSuccess: () => utils.library.careers.invalidate(),
  });
  const [editing, setEditing] = useState<Record<string, unknown> | "new" | null>(null);

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 12));
  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          placeholder="搜索职业名称 / 大类"
          className="w-56 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime"
        />
        <span className="text-[12px] text-olive-mute">{query.data?.total ?? 0} 个职业</span>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="ml-auto rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap text-cream hover:bg-lime"
          >
            + 新增职业
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <div key={c.id} className="paper-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-[14.5px] font-bold text-olive">{c.name}</h4>
                <p className="mt-0.5 text-[11.5px] text-olive-mute">{c.category || "—"}</p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setEditing(c as unknown as Record<string, unknown>)}
                  className="rounded-lg border border-border bg-cream-card px-2.5 py-1 text-[11.5px] text-olive hover:bg-mint-pale/60"
                >
                  编辑
                </button>
              )}
            </div>
            {c.content && <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-olive-mute">{c.content}</p>}
          </div>
        ))}
      </div>
      {rows.length === 0 && !query.isLoading && (
        <p className="py-8 text-center text-[12.5px] text-olive-mute">
          {isAdmin ? "还没有职业数据，点右上角新增" : "还没有职业数据"}
        </p>
      )}
      <Pager page={page} totalPages={totalPages} total={query.data?.total ?? 0} onChange={setPage} />

      {editing && (
        <CareerEditModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await upsert.mutateAsync(v as never);
            setEditing(null);
          }}
          busy={upsert.isPending}
        />
      )}
    </div>
  );
}

function CareerEditModal({
  initial,
  onClose,
  onSave,
  busy,
}: {
  initial: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (v: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => ({
    id: initial?.id ? String(initial.id) : "",
    name: (initial?.name as string) ?? "",
    category: (initial?.category as string) ?? "",
    content: (initial?.content as string) ?? "",
    prospect: (initial?.prospect as string) ?? "",
    path: (initial?.path as string) ?? "",
    trend: (initial?.trend as string) ?? "",
    duties: JSON.stringify((initial?.duties as string[]) ?? []),
    skillsPro: JSON.stringify((initial?.skillsPro as string[]) ?? []),
    skillsGen: JSON.stringify((initial?.skillsGen as string[]) ?? []),
  }));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const arr = (s: string) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return s.split("\n").map((x) => x.trim()).filter(Boolean);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={onClose}>
      <div className="paper-card my-6 w-full max-w-2xl space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-olive">{form.id ? "编辑职业" : "新增职业"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-olive-mute hover:bg-cream" aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="text-[12px] font-semibold text-olive">名称
            <input value={form.name} onChange={set("name")} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-1.5 text-[12.5px] outline-none focus:border-lime" />
          </label>
          <label className="text-[12px] font-semibold text-olive">大类
            <input value={form.category} onChange={set("category")} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-1.5 text-[12.5px] outline-none focus:border-lime" />
          </label>
        </div>
        {(
          [
            ["content", "职业内容", true],
            ["duties", "工作内容（JSON 数组或每行一条）", true],
            ["skillsPro", "专业技能（同上）", true],
            ["skillsGen", "通用技能（同上）", true],
            ["prospect", "发展前景", true],
            ["path", "发展路径", false],
            ["trend", "就业趋势", false],
          ] as const
        ).map(([k, label, area]) => (
          <label key={k} className="block text-[12px] font-semibold text-olive">
            {label}
            {area ? (
              <textarea value={form[k]} onChange={set(k)} rows={k === "content" ? 3 : 2}
                className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-1.5 text-[12.5px] outline-none focus:border-lime" />
            ) : (
              <input value={form[k]} onChange={set(k)}
                className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-1.5 text-[12.5px] outline-none focus:border-lime" />
            )}
          </label>
        ))}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-border bg-cream-card px-4 py-2 text-[13px] text-olive">取消</button>
          <button
            disabled={busy || !form.name.trim()}
            onClick={() =>
              onSave({
                id: form.id ? Number(form.id) : undefined,
                name: form.name.trim(),
                category: form.category.trim(),
                content: form.content || undefined,
                duties: arr(form.duties),
                skillsPro: arr(form.skillsPro),
                skillsGen: arr(form.skillsGen),
                prospect: form.prospect || undefined,
                path: form.path || undefined,
                trend: form.trend || undefined,
              })
            }
            className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- 院校专业分数库 -------------------------------- */

function ScoresTab({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [minRank, setMinRank] = useState("");
  const [maxRank, setMaxRank] = useState("");
  const query = trpc.library.gdScores.useQuery(
    {
      page, pageSize: 20,
      school: school || undefined,
      major: major || undefined,
      minRank: minRank ? Number(minRank) : undefined,
      maxRank: maxRank ? Number(maxRank) : undefined,
    },
  );
  const importMut = trpc.library.gdScoresImport.useMutation();
  const utils = trpc.useUtils();
  const [confirmClear, setConfirmClear] = useState(false);
  const imp = useJsonImport(async ({ rows, clear }) => {
    const r = await importMut.mutateAsync({ rows, clear });
    await utils.library.gdScores.invalidate();
    return r;
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 20));
  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={school} onChange={(e) => { setSchool(e.target.value); setPage(1); }} placeholder="院校名称"
          className="w-44 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <input value={major} onChange={(e) => { setMajor(e.target.value); setPage(1); }} placeholder="专业名称"
          className="w-44 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <span className="text-[12px] text-olive-mute">预估位次</span>
        <input value={minRank} onChange={(e) => { setMinRank(e.target.value); setPage(1); }} placeholder="≥"
          className="w-24 rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <span className="text-[12px] text-olive-mute">—</span>
        <input value={maxRank} onChange={(e) => { setMaxRank(e.target.value); setPage(1); }} placeholder="≤"
          className="w-24 rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <span className="text-[12px] text-olive-mute">{query.data?.total ?? 0} 条</span>
        {isAdmin && (
          <span className="ml-auto flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-[12px] text-terra">首次导入将清空旧数据，确认？</span>
                <button type="button" onClick={() => { setConfirmClear(false); }}
                  className="rounded-lg border border-border bg-cream-card px-3 py-2 text-[12.5px] text-olive">取消</button>
                <ImportButton label="选文件并清空导入" busy={imp.busy} onFile={(f) => { setConfirmClear(false); imp.run(f, true); }} />
              </>
            ) : (
              <>
                <ImportButton label="导入分数 JSON（追加）" busy={imp.busy} onFile={(f) => imp.run(f, false)} />
                <button type="button" onClick={() => setConfirmClear(true)}
                  className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] text-olive hover:bg-mint-pale/60">
                  清空并重新导入
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {imp.progress && <p className="text-[12px] text-olive-mute">{imp.progress}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-cream/60 text-[11.5px] text-olive-mute">
              <th className="px-3 py-2 font-semibold">院校</th>
              <th className="px-3 py-2 font-semibold">专业</th>
              <th className="px-3 py-2 font-semibold">门类</th>
              <th className="px-3 py-2 font-semibold">选科要求</th>
              <th className="px-3 py-2 font-semibold">24 分/位</th>
              <th className="px-3 py-2 font-semibold">25 分/位</th>
              <th className="px-3 py-2 font-semibold">26 分/位</th>
              <th className="px-3 py-2 font-semibold">26 预估位次</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-mint-pale/40">
                <td className="px-3 py-2 font-semibold text-olive">{r.school}<div className="text-[11px] font-normal text-olive-mute">{r.groupName}</div></td>
                <td className="px-3 py-2 text-olive">{r.majorFull || r.major}<div className="text-[11px] text-olive-mute">{r.years} · 计划 {r.plan ?? "—"} · {r.fee || "学费—"}</div></td>
                <td className="px-3 py-2 text-olive-mute">{r.menlei}</td>
                <td className="px-3 py-2 text-olive-mute">{r.req || "不限"}</td>
                <td className="px-3 py-2 text-olive-mute">{r.y1Min ?? "—"} / {r.y1Rank ?? "—"}</td>
                <td className="px-3 py-2 text-olive-mute">{r.y2Min ?? "—"} / {r.y2Rank ?? "—"}</td>
                <td className="px-3 py-2 text-olive-mute">{r.y3Min ?? "—"} / {r.y3Rank ?? "—"}</td>
                <td className="px-3 py-2 font-semibold text-olive">{r.estRank26 ?? "—"}</td>
              </tr>
            ))}
            {query.isLoading && <tr><td colSpan={8} className="px-3 py-8 text-center text-olive-mute">加载中…</td></tr>}
            {!query.isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-olive-mute">
                {isAdmin ? "库里还没有数据，点右上角导入分数 JSON" : "库里还没有数据，请联系管理员导入"}
              </td></tr>
            )}
          </tbody>
        </table>
        <Pager page={page} totalPages={totalPages} total={query.data?.total ?? 0} onChange={setPage} />
      </div>
    </div>
  );
}

/* ---------------------------------- 查大学 ---------------------------------- */

const UNI_FIELD_LABELS: [key: string, label: string][] = [
  ["intro", "院校简介"],
  ["introShort", "简介摘要"],
  ["supervisor", "主管部门"],
  ["foundYear", "建校时间"],
  ["area", "占地面积"],
  ["alias", "简称"],
  ["formerNames", "曾用名"],
  ["motto", "校训"],
  ["ranking", "平台排名"],
  ["subjectEval", "学科评估等级数量"],
  ["academicians", "院士数量"],
  ["libraryBooks", "图书馆藏书"],
  ["labs", "实验室数量"],
  ["baoyan", "保研比例"],
  ["doctor", "博士点"],
  ["doctorDetail", "博士点明细"],
  ["master", "硕士点"],
  ["masterDetail", "硕士点明细"],
  ["keyDisciplines", "国家重点学科"],
  ["dfc", "双一流建设学科"],
  ["departments", "院系设置（含专业）"],
  ["campus", "校园配置"],
  ["dorm", "宿舍介绍"],
  ["canteen", "食堂介绍"],
  ["scholarship", "奖学金设置"],
  ["aid", "困难生资助"],
  ["malePct", "男生比例"],
  ["femalePct", "女生比例"],
  ["history", "历史沿革"],
  ["address", "学校地址"],
  ["zsPhone", "招生电话"],
  ["zsWebsite", "招生官网"],
  ["website", "学校官网"],
];

function UniversitiesTab({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [province, setProvince] = useState("");
  const [keyword, setKeyword] = useState("");
  const [level, setLevel] = useState("");
  const [nature, setNature] = useState("");
  const [tag, setTag] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: provinces } = trpc.library.universityProvinces.useQuery();
  const query = trpc.library.universities.useQuery(
    {
      page, pageSize: 15,
      province: province || undefined,
      keyword: keyword || undefined,
      level: level || undefined,
      nature: nature || undefined,
      tag: tag || undefined,
    },
  );
  const detail = trpc.library.university.useQuery(
    { id: detailId ?? 0 },
    { enabled: detailId != null },
  );
  const importMut = trpc.library.universitiesImport.useMutation();
  const utils = trpc.useUtils();
  const [confirmClear, setConfirmClear] = useState(false);
  const imp = useJsonImport(async ({ rows, clear }) => {
    const r = await importMut.mutateAsync({ rows, clear });
    await utils.library.universities.invalidate();
    await utils.library.universityProvinces.invalidate();
    return r;
  }, 300);

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 15));
  const rows = query.data?.rows ?? [];
  const d = detail.data;

  return (
    <div className="space-y-3">
      {/* 省份归类导航（参考掌上高考查大学） */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => { setProvince(""); setPage(1); }}
          className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
            !province ? "border-transparent bg-brand text-white" : "border-border bg-cream-card text-olive hover:bg-mint-pale/60"
          }`}
        >
          全部
        </button>
        {(provinces ?? []).map((p) => (
          <button
            key={p.province}
            type="button"
            onClick={() => { setProvince(p.province === province ? "" : p.province); setPage(1); }}
            className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
              province === p.province ? "border-transparent bg-brand text-white" : "border-border bg-cream-card text-olive hover:bg-mint-pale/60"
            }`}
          >
            {p.province}
            <span className="ml-1 text-[10px] opacity-70">{p.n}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} placeholder="搜索校名 / 简称 / 城市"
          className="w-52 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime">
          <option value="">全部层次</option>
          <option value="本科">本科</option>
          <option value="专科">专科</option>
        </select>
        <select value={nature} onChange={(e) => { setNature(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime">
          <option value="">全部性质</option>
          <option value="公办">公办</option>
          <option value="民办">民办</option>
          <option value="中外合作办学">中外合作办学</option>
          <option value="内地与港澳台合作办学">内地与港澳台合作办学</option>
        </select>
        <select value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime">
          <option value="">全部标签</option>
          <option value="985">985</option>
          <option value="211">211</option>
          <option value="双一流">双一流</option>
        </select>
        <span className="text-[12px] text-olive-mute">{query.data?.total ?? 0} 所</span>
        {isAdmin && (
          <span className="ml-auto flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-[12px] text-terra">首次导入将清空旧数据，确认？</span>
                <button type="button" onClick={() => setConfirmClear(false)}
                  className="rounded-lg border border-border bg-cream-card px-3 py-2 text-[12.5px] text-olive">取消</button>
                <ImportButton label="选文件并清空导入" busy={imp.busy} onFile={(f) => { setConfirmClear(false); imp.run(f, true); }} />
              </>
            ) : (
              <>
                <ImportButton label="导入院校库 JSON（追加）" busy={imp.busy} onFile={(f) => imp.run(f, false)} />
                <button type="button" onClick={() => setConfirmClear(true)}
                  className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] text-olive hover:bg-mint-pale/60">
                  清空并重新导入
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {imp.progress && <p className="text-[12px] text-olive-mute">{imp.progress}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setDetailId(u.id)}
            className="paper-card flex items-start gap-3 p-4 text-left transition-shadow hover:shadow-md"
          >
            {u.logoUrl ? (
              <img src={u.logoUrl} alt="" className="mt-0.5 h-11 w-11 rounded-lg border border-border object-contain" loading="lazy" />
            ) : (
              <School size={26} className="mt-1 shrink-0 text-olive-mute" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-bold text-olive">{u.name}</span>
              </span>
              <span className="mt-0.5 block text-[11.5px] text-olive-mute">
                {u.province} · {u.city} · {u.schoolType || "综合"} · {u.nature}
              </span>
              {u.tags && (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {u.tags.split("；").filter(Boolean).slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full bg-mint-pale px-2 py-0.5 text-[10.5px] font-semibold text-olive">{t}</span>
                  ))}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      {rows.length === 0 && !query.isLoading && (
        <p className="py-8 text-center text-[12.5px] text-olive-mute">
          {isAdmin ? "库里还没有数据，点右上角导入院校库 JSON（掌上高考院校基础信息总表）" : "库里还没有数据，请联系管理员导入"}
        </p>
      )}
      <Pager page={page} totalPages={totalPages} total={query.data?.total ?? 0} onChange={setPage} />

      {detailId != null && d && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={() => setDetailId(null)}>
          <div className="paper-card my-6 w-full max-w-3xl space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              {d.logoUrl && <img src={d.logoUrl} alt="" className="h-14 w-14 rounded-xl border border-border object-contain" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[18px] font-bold text-olive">{d.name}</h3>
                  <button onClick={() => setDetailId(null)} className="rounded-lg p-1.5 text-olive-mute hover:bg-cream" aria-label="关闭">
                    <X size={18} />
                  </button>
                </div>
                <p className="mt-1 text-[12.5px] text-olive-mute">
                  {d.province} · {d.city} · {d.schoolType || "院校"} · {d.nature}
                  {d.foundYear ? ` · 建于${d.foundYear}` : ""}
                  {d.supervisor ? ` · 主管部门：${d.supervisor}` : ""}
                </p>
                {d.tags && (
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {d.tags.split("；").filter(Boolean).map((t) => (
                      <span key={t} className="rounded-full bg-mint-pale px-2 py-0.5 text-[10.5px] font-semibold text-olive">{t}</span>
                    ))}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {UNI_FIELD_LABELS.map(([key, label]) => {
                const v = (d as unknown as Record<string, string | null>)[key];
                if (!v) return null;
                return (
                  <div key={key}>
                    <div className="text-[12px] font-bold text-olive">{label}</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-olive-mute">{v}</div>
                  </div>
                );
              })}
            </div>
            {d.detailUrl && (
              <a href={d.detailUrl} target="_blank" rel="noreferrer"
                className="inline-block rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[12.5px] text-olive hover:bg-mint-pale/60">
                查看掌上高考详情页 ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- 页面主体 ---------------------------------- */

export default function Library() {
  const { user } = useAuth();
  const allowed = user?.role === "tutor" || user?.role === "admin";
  const [tab, setTab] = useState<TabKey>("majors");
  const isAdmin = user?.role === "admin";

  if (!allowed) {
    return (
      <div className="mx-auto mt-16 max-w-md">
        <div className="paper-card p-8 text-center">
          <BookOpen className="mx-auto text-olive" size={34} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">智慧生涯 · 资料库</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">
            专业底层库、职业库、院校专业分数库仅供伴学师与管理员查询，需要相应权限。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-olive">智慧生涯 · 资料库</h1>
        <p className="mt-1 text-[13px] text-olive-mute">
          专业底层库（天生智慧 1152+ 专业）、职业库、广东院校专业分数库与 12 学科门类图，供咨询与报告生成时查询调用。
        </p>
        <div className="mt-3 flex rounded-xl border border-[#1E3530]/10 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition ${
                tab === t.key ? "bg-[#0C7064] text-white shadow" : "text-[#1E3530] hover:bg-[#0C7064]/10"
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </header>
      {tab === "majors" && <MajorsTab isAdmin={isAdmin} />}
      {tab === "universities" && <UniversitiesTab isAdmin={isAdmin} />}
      {tab === "careers" && <CareersTab isAdmin={isAdmin} />}
      {tab === "scores" && <ScoresTab isAdmin={isAdmin} />}
      {tab === "disciplines" && (
        <div className="paper-card p-5">
          <DisciplineTreeChart />
        </div>
      )}
    </div>
  );
}
