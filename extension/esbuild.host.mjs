/**
 * Bundles the extension host (src/extension.ts + its imports, including
 * @linear/sdk) into a single self-contained dist/extension.js. This is what
 * makes live mode work in the installed .vsix: node_modules is excluded from the
 * package (.vscodeignore), so the SDK must be inlined here rather than required
 * from node_modules at runtime.
 *
 * `vscode` stays external (provided by the host). The dynamic import of
 * ./linear-source is preserved as a lazily-evaluated chunk by esbuild, so the
 * SDK only executes when a Linear API key is set.
 */
import { build } from "esbuild";

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"],
  sourcemap: false,
  legalComments: "none",
});

console.log("Bundled host → dist/extension.js");
