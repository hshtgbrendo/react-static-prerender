import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { createServer } from "http";

import { Renderer } from "./renderer.js"
import { ConfigManager } from "./config.js"

async function findAvailablePort(startPort = 10000) {
    console.log(`📄 env port: ${process.env.PORT}`)
    if (process.env.PORT) {
        let port = parseInt(process.env.PORT, 10)
        console.log("📄 use existing port " + port)
        try {
            await new Promise((resolve, reject) => {
                const server = createServer();
                server.listen(port, () => {
                    server.close(() => resolve(port));
                });
                server.on('error', reject);
            });
            return port;
        } catch (error) {
            throw new Error(error);
        }
    } else {
        console.log("📄 check startPort 10000")
        for (let port = startPort; port < startPort + 100; port++) {
            try {
                await new Promise((resolve, reject) => {
                    const server = createServer();
                    server.listen(port, () => {
                        server.close(() => resolve(port));
                    });
                    server.on('error', reject);
                });
                return port;
            } catch (error) {
                continue;
            }
        }
        throw new Error('No available port found');
    }
}

async function waitForServer(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok) return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Server on port ${port} did not start within ${maxAttempts} seconds`);
}

async function killProcessGroup(childProcess) {
  return new Promise((resolve) => {
    if (!childProcess || childProcess.killed) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      try {
        process.kill(-childProcess.pid, 'SIGKILL');
      } catch (e) {
        // Process might already be dead
      }
      resolve();
    }, 2000);

    childProcess.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    childProcess.on('error', () => {
      clearTimeout(timeout);
      resolve();
    });

    try {
      process.kill(-childProcess.pid, 'SIGTERM');
    } catch (e) {
      clearTimeout(timeout);
      resolve();
    }
  });
}

export async function prerender(config) {
    const {
        routes = [],
        outDir = "static-pages",
        serveDir = "build",
        flatOutput = false,
        puppeteerExecutablePath = '',
        waitOnSelector = '',
    } = config;

    var rendertronConfig = await ConfigManager.getConfiguration()

    const outDirPath = path.resolve(process.cwd(), outDir);
    const port = await findAvailablePort();

    let serveProcess = null;
    let browser = null;

    try {
        serveProcess = spawn("npx", ["serve", "-s", serveDir, "-l", port.toString()], {
            stdio: ["pipe", "pipe", "pipe"],
            shell: true,
            detached: true,
            });

        serveProcess.stdout.on("data", data => {
            if (process.env.DEBUG) process.stdout.write(`[serve] ${data}`);
        });
        serveProcess.stderr.on("data", data => {
            if (process.env.DEBUG) process.stderr.write(`[serve] ${data}`);
        });

        await waitForServer(port);
        console.log(`🚀 Server started on port ${port}`);
        
        let puppeteerOptions = {
            headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage']
        }
        if (puppeteerExecutablePath) {
            puppeteerOptions['executablePath'] = puppeteerExecutablePath
        }

        console.log("launch puppeteer with executable path " + puppeteerExecutablePath)

        browser = await puppeteer.launch(puppeteerOptions);
        var renderer = new Renderer(browser, rendertronConfig)
        const page = await browser.newPage();

        await fs.mkdir(outDirPath, { recursive: true });

        console.log("config: ", config)

        for (const route of routes) {
            const url = `http://localhost:${port}${route}`;
            console.log(`📄 Processing route: ${route}`);

            // if (waitOnSelector) {
            //     // await page.goto(url, { waitUntil: 'domcontentloaded' })
            //     await page.goto(url, { waitUntil: 'networkidle0' })
            //     console.log(`📄 Wait on selector: "#pageLoaded"`)
            //     await page.waitForSelector("#pageLoaded", {visible: true, timeout: 120000})
            //     // await page.waitForFunction(() =>
            //     //     document.querySelector('[data-page-loaded="true"]') !== null
            //     // );
            // } else {
            //     console.log(`📄 Wait until networkidle0`)
            //     await page.goto(url, { waitUntil: "networkidle0" });
            // }

            // const mobileVersion = "mobile" in ctx.query ? true : false
            const mobileVersion = false
            // const html = await page.content();
            const html = await renderer.serialize(url, mobileVersion)

            if (route === "/") {
                await fs.writeFile(path.join(outDirPath, "index.html"), html);
                console.log(`✅ Saved static page: index.html`);
            } else {
                const safeName = route.replace(/^\//, "").replace(/\//g, "-") || "root";

                if (flatOutput) {
                    const fileName = `${safeName}.html`;
                    await fs.writeFile(path.join(outDirPath, fileName), html);
                    console.log(`✅ Saved static page: ${fileName}`);
                } else {
                    const routeDir = path.join(outDirPath, safeName);
                    await fs.mkdir(routeDir, { recursive: true });
                    await fs.writeFile(path.join(routeDir, "index.html"), html.content);
                    console.log(`✅ Saved static page: ${path.join(safeName, "index.html")}`);
                }
            }
        }

    } catch (error) {
        console.error("❌ Prerendering failed:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
        if (serveProcess) {
            await killProcessGroup(serveProcess);
        }
    }
}