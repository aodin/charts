const esbuild = require("esbuild");
const { externalGlobalPlugin } = require("esbuild-plugin-external-global");

esbuild.build({
  entryPoints: ["src/area.js", "src/line.js", "src/ohlcv.js", "src/bar.js"],
  globalName: "charts",
  bundle: true,
  minify: true,
  sourcemap: true,
  outExtension: { ".js": ".min.js" },
  target: "es2020",
  outdir: "dist",
  external: Object.keys(require("./package.json").dependencies),
  plugins: [
    externalGlobalPlugin({
      d3: "d3",
    }),
  ],
});
