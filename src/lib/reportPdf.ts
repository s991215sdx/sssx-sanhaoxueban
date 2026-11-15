/**
 * v211：报告 PDF 下载——调服务端 /api/report-pdf（Playwright 按打印样式渲染），
 * 成功后以 Blob 存为 .pdf 文件；失败返回 false，调用方回退 window.print。
 */
export async function downloadReportPdf(targetPath: string, filename: string): Promise<boolean> {
  try {
    const qs = new URLSearchParams({ path: targetPath, name: filename });
    const res = await fetch(`/api/report-pdf?${qs.toString()}`, { credentials: "same-origin" });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (!blob.size || blob.type !== "application/pdf") return false;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

/**
 * v286：家长 DISC 融合读本的打印页地址。
 * - 家长自己：`?id=&k=<查看钥匙>`，免登录（钥匙就是凭证）；
 * - 后台老师：只带 `?id=`，凭当前登录态（standaloneDiscDetail 同权限）。
 */
export function parentDiscPrintPath(id: number, viewKey?: string | null): string {
  const qs = new URLSearchParams({ id: String(id) });
  if (viewKey) qs.set("k", viewKey);
  return `/pd-report?${qs.toString()}`;
}

/**
 * v286：家长 DISC 融合读本导出 PDF。
 * 服务端渲染失败时退到打印页（新窗口自己按 Ctrl+P），不让人对着按钮干等。
 */
export async function downloadParentDiscPdf(opts: {
  id: number;
  viewKey?: string | null;
  label?: string | null;
  /** 报告日期，缺省用今天；字符串形如 2026-11-14 */
  day?: string;
}): Promise<boolean> {
  const path = parentDiscPrintPath(opts.id, opts.viewKey);
  const label = (opts.label ?? "家长").replace(/[\\/:*?"<>|\s]/g, "").slice(0, 8) || "家长";
  const day = opts.day || new Date().toISOString().slice(0, 10);
  const name = `家长DISC-家庭沟通读本-${label}-${day}.pdf`;
  const ok = await downloadReportPdf(path, name);
  if (!ok) window.open(path, "_blank", "noopener");
  return ok;
}

/**
 * v289：双人对照读本的打印页地址。
 * 对照要两条记录，家长手里只有自己那一条的钥匙，所以这一本**只走登录态**（后台老师用）。
 */
export function parentDiscPairPrintPath(a: number, b: number): string {
  return `/pd-report?a=${a}&b=${b}`;
}

/** v289：双人对照读本导出 PDF，命名带上两个人的称呼。 */
export async function downloadParentDiscPairPdf(opts: {
  a: number;
  b: number;
  labelA?: string | null;
  labelB?: string | null;
  day?: string;
}): Promise<boolean> {
  const path = parentDiscPairPrintPath(opts.a, opts.b);
  const clean = (s?: string | null) => (s ?? "家长").replace(/[\\/:*?"<>|\s]/g, "").slice(0, 6) || "家长";
  const day = opts.day || new Date().toISOString().slice(0, 10);
  const name = `家长DISC-双人对照-${clean(opts.labelA)}×${clean(opts.labelB)}-${day}.pdf`;
  const ok = await downloadReportPdf(path, name);
  if (!ok) window.open(path, "_blank", "noopener");
  return ok;
}
