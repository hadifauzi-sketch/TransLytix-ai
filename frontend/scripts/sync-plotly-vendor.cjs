const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const rootDir = path.resolve(__dirname, "..");
const targetDir = path.join(rootDir, "public", "vendor");
const targetFile = path.join(targetDir, "plotly.min.js");

const entrySource = `
  const Plotly = require("plotly.js/lib/index-gl3d");
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.Plotly = Plotly;
  if (root.window) {
    root.window.Plotly = Plotly;
  }
`;

async function main() {
  fs.mkdirSync(targetDir, { recursive: true });

  await esbuild.build({
    stdin: {
      contents: entrySource,
      resolveDir: rootDir,
      sourcefile: "plotly-gl3d-entry.js",
      loader: "js",
    },
    bundle: true,
    minify: true,
    format: "iife",
    platform: "browser",
    target: ["es2018"],
    banner: {
      // Some Plotly dependencies expect Node-style globals in browser bundles.
      js: "var __plotlyGlobal = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {})); var global = __plotlyGlobal; var process = __plotlyGlobal.process || { env: {} };",
    },
    legalComments: "none",
    outfile: targetFile,
  });

  console.log(`Built custom Plotly GL3D vendor file to ${targetFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
