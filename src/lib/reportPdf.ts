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
