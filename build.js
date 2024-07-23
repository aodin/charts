const esbuild = require("esbuild");
const { externalGlobalPlugin } = require("esbuild-plugin-external-global");

(async() => {
  const options = {
    entryPoints: ["src/area.js", "src/line.js", "src/ohlcv.js", "src/bar.js", "src/pie.js", "src/candlestick.js"],
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
  };

  let ctx = await esbuild.context(options)
  await ctx.watch()
  console.log('watching...')
})()
