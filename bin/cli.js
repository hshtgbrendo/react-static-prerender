#!/usr/bin/env node

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { spawn } from "child_process";
import { prerender } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configPath = path.resolve(process.cwd(), "prerender.config.js");
const configModule = await import(configPath);
const config =
  typeof configModule.default === "function"
    ? await configModule.default()
    : configModule.default;

const buildDir = path.resolve(process.cwd(), config.serveDir || "build");

const shouldBuild = process.argv.includes("--with-build");

if (shouldBuild) {
  console.log("🏗️ Running npm run build...");
  await new Promise((resolve, reject) => {
    const build = spawn("npm", ["run", "build"], { stdio: "inherit" });
    build.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error("❌ Build failed"));
    });
  });
} else {
  const hasIndex = await fs.pathExists(path.join(buildDir, "index.html"));
  if (!hasIndex) {
    console.error(
      "❌ Build folder not found. Run `npm run build` or use --with-build."
    );
    process.exit(1);
  }
}

await fs.remove(path.resolve(process.cwd(), config.outDir || "static-pages"));

await prerender(config);
await copyBuildAssets(config.serveDir, config.outDir);

async function copyBuildAssets(serveDir, outDir) {
  const buildDir = path.resolve(process.cwd(), serveDir);
  const outDirFull = path.resolve(process.cwd(), outDir);

  try {
    await fs.copy(buildDir, outDirFull, {
      filter: (src) => !src.endsWith(".html"),
    });
    console.log(`✅ Copied assets from ${serveDir} to ${outDir}`);
  } catch (err) {
    console.error("❌ Error copying build assets:", err);
  }
}
