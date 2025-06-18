import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { buildHtml } from "./buildHtml.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function prerender(config) {
  const { routes = [], outDir = "static-pages", serveDir = "build" } = config;

  const outDirPath = path.resolve(process.cwd(), outDir);

  try {
    await fs.rm(outDirPath, { recursive: true, force: true });
    console.log(`🧹 Cleaned existing output directory: ${outDir}`);
  } catch (err) {
    console.error(`❌ Failed to clean ${outDir}:`, err);
  }

  const serveProcess = spawn("npx", ["serve", "-s", serveDir, "-l", "5050"], {
    stdio: "inherit",
  });

  await new Promise((r) => setTimeout(r, 2000));

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await fs.mkdir(outDirPath, { recursive: true });

  for (const route of routes) {
    const url = `http://localhost:5050${route}`;
    await page.goto(url, { waitUntil: "networkidle0" });

    const html = await page.content();
    const finalHtml = await buildHtml({
      prerenderedHtml: html,
      serveDir,
    });

    if (route === "/") {
      await fs.writeFile(path.join(outDirPath, "index.html"), html);
      console.log(`✅ Saved static page: index.html`);
    } else {
      const safeName = route.replace(/^\//, "");
      const routeDir = path.join(outDirPath, safeName);
      await fs.mkdir(routeDir, { recursive: true });
      await fs.writeFile(path.join(routeDir, "index.html"), html);
      console.log(`✅ Saved static page: ${path.join(safeName, "index.html")}`);
    }
  }

  await browser.close();
  serveProcess.kill();
}
