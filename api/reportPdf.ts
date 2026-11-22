/**
 * v211：报告 PDF 下载——服务端用 Playwright(无头 Chromium) 把报告页按打印样式渲染成 PDF。
 * 解决「下载/打印」按钮实际只有打印（window.print）没有真下载的问题。
 * 口径：
 * - 仅放行白名单页面（选科及升学规划报告 / 测评报告页 / v286 家长 DISC 读本打印页）；
 * - 登录态：透传请求 Cookie 给无头浏览器，页面权限与当前用户一致（渲染出登录页即判 401）；
 * - v286 例外：/pd-report 带查看钥匙（k=）时不要求登录——家长在自己手机上导出 PDF 不该先注册；
 * - 字体：服务器已装 Noto Sans CJK（渲染前等待图表与字体就绪）；
 * - playwright-core 用 createRequire 运行时加载（esbuild 不打进 bundle）；
 * - 浏览器内核：v286 起按 CHROME_BIN → 应用目录 .chrome/ → 系统 chrome 的顺序找。
 *   原来只认 ms-playwright 缓存，而线上服务以 sanhao 账号跑、HOME=/home/sanhao 并不存在，
 *   缓存落在 /root/.cache 里读不到——PDF 一直 500。内核现在放在应用目录下（随 dist 之外持久，
 *   部署不覆盖），不依赖运行账号的 HOME。
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire as mkRequire } from "node:module";
import type { Context } from "hono";
import type { Browser } from "playwright-core";

/* 别名化：esbuild 构建 banner 已注入 createRequire，这里不能同名顶层导入 */
const req = mkRequire(import.meta.url);
type PlaywrightCore = typeof import("playwright-core");

/** 允许生成 PDF 的页面路径（其余一律 400，防止被当任意网页截图/SSRF 用） */
const PDF_PATH_WHITELIST = ["/zhihui-report", "/report-detail", "/pd-report"];

/**
 * v286：家长 DISC 读本打印页可以免登录——凭证是链接里的查看钥匙（12 位随机十六进制），
 * 与家长在自己手机上回看报告用的是同一把钥匙。后台老师走 Cookie，两路都认。
 */
const PUBLIC_KEY_PATH = "/pd-report";

/** 内核候选路径：应用目录优先（部署不覆盖），其次系统安装的 chrome/chromium */
function findChrome(): string | undefined {
  /* dist/boot.js 的上一级就是应用根目录 */
  const root = path.resolve(import.meta.dirname, "..");
  const candidates = [
    process.env.CHROME_BIN,
    path.join(root, ".chrome/chrome-headless-shell-linux64/chrome-headless-shell"),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter((p): p is string => !!p);
  return candidates.find((p) => {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

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
  /* v286：打印页带查看钥匙时免 Cookie；钥匙由 standaloneDiscReport 二次校验，错的一律取不到数据 */
  const hasViewKey = pathname === PUBLIC_KEY_PATH && /(?:^|[?&])k=[0-9a-f]{8,}/.test(target);
  if (!cookieHeader.trim() && !hasViewKey) return c.json({ error: "未登录" }, 401);

  const pw = loadPlaywright();
  if (!pw) return c.json({ error: "PDF 服务未就绪（缺少 playwright-core）" }, 503);

  const rawName = (c.req.query("name") ?? "报告").slice(0, 120).replace(/[\\/:*?"<>|]/g, "_");
  const filename = rawName.endsWith(".pdf") ? rawName : `${rawName}.pdf`;

  const port = parseInt(process.env.PORT || "3000", 10);
  let browser: Browser | null = null;
  try {
    browser = await pw.chromium.launch({
      ...(findChrome() ? { executablePath: findChrome() } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
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
    if (pathname === PUBLIC_KEY_PATH) {
      /* 打印页要等数据真的到了（data-ready）——只等 DOM 会印出空壳；钥匙错则页面出错误块 */
      await page.waitForSelector('#pd-print-root[data-ready="1"], [data-pd-error="1"]', { timeout: 30_000 });
      if (await page.$('[data-pd-error="1"]')) return c.json({ error: "这份报告打不开（链接失效或钥匙不对）" }, 404);
    } else {
      await page.waitForSelector(".zh-page, #report-print-root, .ob-page", { timeout: 20_000 });
    }
    await page.waitForTimeout(1_000);

    /* v286：家长读本自带 @page 版心，按 CSS 走纸面尺寸，页边距由页面自己给 */
    const pdf =
      pathname === PUBLIC_KEY_PATH
        ? await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } })
        : await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
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
