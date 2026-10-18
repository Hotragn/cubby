import { build } from "esbuild";
await build({ entryPoints: ["web/main.jsx"], bundle: true, splitting: true, format: "esm", outdir: "public/build", minify: true, sourcemap: false, jsx: "automatic", loader: { ".json": "json" }, define: { "process.env.NODE_ENV": '"production"' }, target: ["es2020", "safari15"], logLevel: "warning" });
console.log("built");
