import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * Builds the webview React app (the Atrium cockpit) into `dist/webview/`.
 * The VS Code extension host (src/extension.ts) reads main.js / main.css from
 * there and injects them into a sandboxed webview with a strict CSP.
 *
 * Fixed output filenames (no content hash) so the host can reference them
 * without parsing a manifest. IIFE format keeps the bundle self-contained.
 * `base: "./"` makes url() refs in the bundled CSS (the codicon font) resolve
 * relative to the webview resource origin instead of an absolute "/".
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist/webview",
    emptyOutDir: true,
    cssCodeSplit: false,
    target: "es2020",
    rollupOptions: {
      input: fileURLToPath(new URL("./webview/main.tsx", import.meta.url)),
      output: {
        format: "iife",
        name: "atriumCockpit",
        inlineDynamicImports: true,
        entryFileNames: "main.js",
        assetFileNames: "main.[ext]",
      },
    },
  },
});
