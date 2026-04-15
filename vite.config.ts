import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * `file://` pages cannot load external ES modules (Chrome CORS). Build one IIFE
 * bundle and emit a classic `<script>` so double‑clicking `dist/index.html` works.
 */
function classicScriptForFileProtocol(): Plugin {
  return {
    name: "classic-script-file-protocol",
    enforce: "post",
    apply: "build",
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin /g, "<script ")
        .replace(/<script type="module" /g, "<script ")
        .replace(/<script src=/g, "<script defer src=")
        .replace(/<link rel="stylesheet" crossorigin /g, '<link rel="stylesheet" ');
    },
  };
}

export default defineConfig({
  base: "/",
  server: {
    // `npm run dev` 时自动用默认浏览器打开本地地址，改代码会热更新，无需 build。
    open: true,
  },
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: "iife",
        name: "StudentToolsHub",
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  plugins: [react(), classicScriptForFileProtocol()],
});
