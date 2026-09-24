import devServer from "@hono/vite-dev-server"
import path from "path"
import fs from "node:fs"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// v71：把服务端 BUILD_TAG（api/router.ts 里的唯一版本源）注进前端，
// 客户端轮询 ping 对比版本，发现新版本弹提示刷新（专治微信/webview 缓存旧包）。
const BUILD_TAG = fs.readFileSync(path.resolve(__dirname, "api/router.ts"), "utf8").match(/BUILD_TAG = "([^"]+)"/)?.[1] ?? "dev"

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_BUILD_TAG": JSON.stringify(BUILD_TAG),
  },
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
