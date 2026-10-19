/**
 * v211：报告 PDF 下载——服务端用 Playwright(无头 Chromium) 把报告页按打印样式渲染成 PDF。
 * 解决「下载/打印」按钮实际只有打印（window.print）没有真下载的问题。
 * 口径：
 * - 仅放行白名单页面（选科及升学规划报告 / 测评报告页）；
 * - 登录态：透传请求 Cookie 给无头浏览器，页面权限与当前用户一致（渲染出登录页即判 401）；
 * - 字体：服务器已装 Noto Sans CJK（渲染前等待图表与字体就绪）；
 * - playwright-core 用 createRequire 运行时加载（esbuild 不打进 bundle），浏览器内核用服务器
 *   ~/.cache/ms-playwright 的 chromium_headless_shell-1248 目录（官方源国内不可达时可用
 *   1243 复制别名，见手册「内部版/渠道版服务器备忘」，不额外下载。
 */
import { createRequire as mkRequire } from "node:module";
import type { Context } from "hono";
import type { Browser } from "playwright-core";

/* 别名化：esbuild 构建 banner 已注入 createRequire，这里不能同名顶层导入 */
const req = mkRequire(import.meta.url);
type PlaywrightCore = typeof import("playwright-core");

/** 允许生成 PDF 的页面路径（其余一律 400，防止被当任意网页截图/SSRF 用） */
const PDF_PATH_WHITELIST = ["/zhihui-report", "/report-detail"];

function loadPlaywright(): PlaywrightCore | null {
  try {
    return req("playwright-core") as PlaywrightCore;
  } catch {
    return null;
  }
}

export async function reportPdfHandler(c: Context) {
  const target = c.req.query("path") ?? "";
  const pathname = target.split("?")[0] ?? "";
  if (!PDF_PATH_WHITELIST.includes(pathname)) {
    return c.json({ error: "该页面不支持 PDF 下载" }, 400);
  }
  const cookieHeader = c.req.header("cookie") ?? "";
  if (!cookieHeader.trim()) return c.json({ error: "未登录" }, 401);

  const pw = loadPlaywright();
  if (!pw) return c.json({ error: "PDF 服务未就绪（缺少 playwright-core）" }, 503);

  const rawName = (c.req.query("name") ?? "报告").slice(0, 120).replace(/[\\/:*?"<>|]/g, "_");
  const filename = rawName.endsWith(".pdf") ? rawName : `${rawName}.pdf`;

  const port = parseInt(process.env.PORT || "3000", 10);
  let browser: Browser | null = null;
  try {
    browser = await pw.chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 1 });
    /* 会话 Cookie 透传：domain 固定本机回环，页面走 http://127.0.0.1:{port} */
    await ctx.addCookies(
      cookieHeader
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.includes("="))
        .map((pair) => {
          const i = pair.indexOf("=");
          return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), domain: "127.0.0.1", path: "/" };
        }),
    );
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}${target}`, { waitUntil: "networkidle", timeout: 60_000 });
    /* 未登录/无权限会被重定向到登录页——如实返回 401，前端回退打印 */
    if (page.url().includes("/login")) return c.json({ error: "登录已过期，请刷新页面重试" }, 401);
    /* 等报告主体渲染（书页或打印根），再等一拍让 SVG 图表与字体就位 */
    await page.waitForSelector(".zh-page, #report-print-root, .ob-page", { timeout: 20_000 });
    await page.waitForTimeout(1_000);

    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    return c.json({ error: `PDF 生成失败：${e instanceof Error ? e.message.slice(0, 120) : "未知错误"}` }, 500);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
