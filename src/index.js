import puppeteer from "puppeteer-core"; //"puppeteer-core": "^24.22.0",
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { createServer } from "http";
import chromium from "@sparticuz/chromium"; //"@sparticuz/chromium": "^133.0.0",

import { Renderer } from "./renderer.js"
import { ConfigManager } from "./config.js"

async function findAvailablePort(startPort = 5050) {
    console.log(`📄 env port: ${process.env.PORT}`)
    if (process.env.PORT) {
        let port = parseInt(process.env.PORT, 10)
        console.log("📄 use existing port " + port)
        return port
        // try {
        //     await new Promise((resolve, reject) => {
        //         const server = createServer();
        //         server.listen(port, () => {
        //             server.close(() => resolve(port));
        //         });
        //         server.on('error', reject);
        //     });
        //     return port;
        // } catch (error) {
        //     throw new Error(error);
        // }
    } else {
        console.log(`📄 check startPort ${startPort}`)
        return startPort
        for (let port = startPort; port < startPort + 100; port++) {
            try {
                // await new Promise((resolve, reject) => {
                //     const server = createServer();
                //     server.listen(port, () => {
                //         server.close(() => resolve(port));
                //     });
                //     server.on('error', reject);
                // });
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
        tag = false,
        setStorage = {},
    } = config;

    // var rendertronConfig = await ConfigManager.getConfiguration()
    var rendertronConfig = {
        datastoreCache: false,
        timeout: 120000,
        port: "3000",
        width: 1000,
        height: 1000,
        tag: tag
    }

    const outDirPath = path.resolve(process.cwd(), outDir);
    const port = await findAvailablePort()

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
        const chromiumExecutablePath = await chromium.executablePath()

        if (!chromiumExecutablePath) {
            throw new Error("Chromium executablePath not found!");
        }
        console.log(`🚀 Server started on port ${port}`);
        console.log(`📄 chromium executable path: ${chromiumExecutablePath}`)
        // console.log(`📄 chromium args: ${chromium.args}`)

        let puppeteerOptions = {
            dumpio: true, // stream chromium logs
            executablePath: chromiumExecutablePath,
            // executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
            // headless: chromium.headless,
            headless: true,
            // args: ['--no-sandbox', '--disable-dev-shm-usage', "--remote-debugging-pipe"]
            // args: [
            //     "--no-sandbox",
            //     "--disable-setuid-sandbox",
            //     "--disable-gpu",
            //     "--disable-dev-shm-usage",
            //     "--disable-software-rasterizer",
            //     "--single-process",
            //     "--no-zygote",
            //     "--remote-debugging-pipe",
            // ],
            args: [
                // ...chromium.args,
                // "--allow-pre-commit-input",
                // "--disable-background-networking",
                // "--disable-background-timer-throttling",
                // "--disable-backgrounding-occluded-windows",
                // "--disable-breakpad",
                // "--disable-client-side-phishing-detection",
                // "--disable-component-extensions-with-background-pages",
                // "--disable-component-update",
                // "--disable-default-apps",
                // "--disable-hang-monitor",
                // "--disable-ipc-flooding-protection",
                // "--disable-popup-blocking",
                // "--disable-prompt-on-repost",
                // "--disable-renderer-backgrounding",
                // "--disable-sync",
                // "--enable-automation",
                // "--enable-blink-features=IdleDetection",
                // "--export-tagged-pdf",
                // "--force-color-profile=srgb",
                // "--metrics-recording-only",
                // "--no-first-run",
                // "--password-store=basic",
                // "--use-mock-keychain",
                // "--disable-domain-reliability",
                // "--disable-print-preview",
                // "--disable-speech-api",
                // "--disk-cache-size=33554432",
                // "--mute-audio",
                // "--no-default-browser-check",
                // "--no-pings",
                // "--font-render-hinting=none",
                // "--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints,AudioServiceOutOfProcess,IsolateOrigins,site-per-process",
                // "--enable-features=NetworkServiceInProcess2,SharedArrayBuffer",
                // "--hide-scrollbars",
                // "--window-size=1920,1080",
                // "--allow-running-insecure-content",
                // "--disable-site-isolation-trials",
                // "--disable-web-security",
                // "--headless='shell'",

                // "--disable-features=CanvasOopRasterization,SwapChainForDCOMPOSITION",

                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--no-zygote",
                "--single-process",
                "--disable-extensions",
                // "--remote-debugging-port=0", // 🔑 prevents opening port 9222

                "--disable-gpu",
                // "--disable-software-rasterizer",
                // "--disable-dev-shm-usage",

                "--disable-features=VizDisplayCompositor",
                "--disable-accelerated-2d-canvas",

                "--disable-webgl",
                "--disable-webgl2",
                "--use-gl=swiftshader", // fallback pure software renderer,

                "--disable-features=UseDBusInGpuProcess", // 👈 key line
                "--disable-features=UseDBusInSandbox",   // 👈 sometimes also needed
                "--disable-dbus"                         // 👈 blanket disable
            ],
            // defaultViewport: chromium.defaultViewport,
            protocolTimeout: 60000,
        }
        // if (puppeteerExecutablePath) {
        //     puppeteerOptions['executablePath'] = puppeteerExecutablePath
        // }

        console.log("📄 launch puppeteer with options: ", puppeteerOptions)

        browser = await puppeteer.launch(puppeteerOptions);
        console.log("📄 created browser")
        var renderer = new Renderer(browser, rendertronConfig)
        console.log("📄 created renderer")
        // const page = await browser.newPage();

        let keys = Object.keys(setStorage)
        if (keys.length > 0) {
            console.log("set storage:", setStorage)
            const page = await browser.newPage()
            await page.goto(`http://localhost:${port}`)

            const currentUrl = await page.url()
            const cookies = await browser.cookies()
            console.log(`🍪 cookies for ${currentUrl}:`, cookies)

            await page.evaluate((storage) => {
                for (const key in storage) {
                    console.log(`set ${key} : ${storage[key]}`)
                    localStorage.setItem(key, storage[key]);
                }
            }, setStorage);

            var keySet = true
            console.log("setstorage: ", setStorage)
            keys.forEach(async function(key) {
                const storedValue = await page.evaluate(() => localStorage.getItem(key))
                console.log(`check ${key} : ${setStorage[key]} => ${storedValue}`)
                if (storedValue !== setStorage[key]) {
                    keySet = false
                }
            })

            if (keySet) {
                await page.close()
            } else {
                throw new Error("localStorage keys not set")
            }
            // await page.close()
        }

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
            console.log(`📄 serialized page: ${html.content}`)

            if (route === "/") {
                await fs.writeFile(path.join(outDirPath, "index.html"), html.content);
                console.log(`✅ Saved static page: index.html`);
            } else {
                const safeName = route.replace(/^\//, "").replace(/\//g, "-") || "root";
                console.log("output safename:", safeName)

                if (flatOutput) {
                    const fileName = `${route}.html`;
                    await fs.writeFile(path.join(outDirPath, fileName), html.content);
                    console.log(`✅ Saved static page: ${fileName}`);
                } else {
                    const routeDir = path.join(outDirPath, route);
                    await fs.mkdir(routeDir, { recursive: true });
                    await fs.writeFile(path.join(routeDir, "index.html"), html.content);
                    console.log(`✅ Saved static page: ${path.join(routeDir, "index.html")}`);
                }
            }
        }

    } catch (error) {
        console.error("❌ Prerendering failed:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log("closed browser")
        }
        if (serveProcess) {
            await killProcessGroup(serveProcess);
            console.log("killed process group")
        }

        return true
    }
}