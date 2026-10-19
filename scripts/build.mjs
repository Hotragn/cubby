import { build } from "esbuild";
await build({ entryPoints: ["web/main.jsx"], bundle: true, splitting: true, format: "esm", outdir: "public/build", minify: true, sourcemap: false, jsx: "automatic", loader: { ".json": "json" }, define: { "process.env.NODE_ENV": '"production"' }, target: ["es2020", "safari15"], logLevel: "warning" });
import { copyFileSync } from "node:fs";
copyFileSync("docs/REPORT.md", "public/report.md"); // the landing page links the test report
console.log("built");
