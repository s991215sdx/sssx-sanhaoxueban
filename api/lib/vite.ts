import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  /* v71：缓存策略——带内容哈希的 assets 文件可长缓存（ immutable ）；
     HTML（含 notFound 回退的 index.html）一律 no-store，保证每次部署后客户端刷新即拿到新版本。
     否则微信/webview 会启发式缓存 index.html，旧页面引用已被删除的旧哈希 JS，版本永远停在旧版。 */
  app.use("*", async (c, next) => {
    await next();
    try {
      const p = c.req.path;
      const ct = c.res.headers.get("content-type") ?? "";
      if (p.startsWith("/assets/")) {
        c.header("Cache-Control", "public, max-age=31536000, immutable");
      } else if (ct.includes("text/html")) {
        c.header("Cache-Control", "no-store, must-revalidate");
      }
    } catch {
      /* 响应已发出等场景下静默跳过 */
    }
  });

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    c.header("Cache-Control", "no-store, must-revalidate");
    return c.html(content);
  });
}
