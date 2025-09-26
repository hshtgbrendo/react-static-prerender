#!/usr/bin/env node

import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { prerender } from "../src/index.js";

async function loadConfig() {
  const configPath = path.resolve(process.cwd(), "prerender.config.js");

  try {
    await fs.access(configPath);
  } catch (error) {
    console.error(`❌ Configuration file not found: ${configPath}`);
    console.log(`
      Please create a prerender.config.js file with your configuration:
      
      Static routes:
      module.exports = {
        routes: ["/", "/about", "/contact"],
        outDir: "static-pages", 
        serveDir: "build",
        flatOutput: false, // true for about.html, false for about/index.html
      };
      
      Dynamic routes:
      export default async function() {
        const blogPosts = await getBlogPosts(); // Your data fetching logic
        const blogRoutes = blogPosts.map(post => \`/blog/\${post.slug}\`);
        
        return {
          routes: ["/", "/blog", ...blogRoutes],
          outDir: "static-pages",
          serveDir: "build",
        };
      }
    `);
    process.exit(1);
  }

  try {

    const configUrl = `file://${configPath}`;
    const configModule = await import(configUrl);
    
    const config = typeof configModule.default === "function"
        ? await configModule.default()
        : configModule.default;
        
    if (!config) {
      throw new Error('Config file must export a configuration object or function');
    }
    
    return config;
  } catch (error) {
    if (error.code === 'ERR_REQUIRE_ESM' || error.message.includes('Unexpected token')) {
      console.error(`
        ❌ Configuration file error: ${error.message}
        
        Your prerender.config.js uses ES module syntax but your project setup doesn't support it.
        
        Solutions:
        1. Add "type": "module" to your package.json, OR
        2. Use CommonJS syntax:
        
        module.exports = {
          routes: ["/", "/about", "/contact"],
          outDir: "static-pages",
          serveDir: "build",
        };
        
        OR for dynamic routes:
        
        module.exports = async function() {
          const fs = require('fs/promises');
          // Your dynamic route logic here
          return { routes: [...], outDir: "static-pages", serveDir: "build" };
        };
      `);
      process.exit(1);
    }
    
    if (error.message.includes('Cannot resolve module')) {
      console.error(`
        ❌ Module resolution error in config file: ${error.message}
        
        Make sure all imported modules in your config file are installed:
        - If using 'fs/promises', 'path', etc. - these are built-in Node.js modules
        - If using external packages, run: npm install <package-name>
      `);
      process.exit(1);
    }
    
    console.error(`❌ Error loading configuration: ${error.message}`);
    process.exit(1);
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyBuildAssets(serveDir, outDir) {
  const buildDir = path.resolve(process.cwd(), serveDir);
  const outDirFull = path.resolve(process.cwd(), outDir);

  async function copyRecursive(src, dest) {
    const stat = await fs.stat(src);

    if (stat.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      const entries = await fs.readdir(src);

      for (const entry of entries) {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        await copyRecursive(srcPath, destPath);
      }
    } else if (!src.endsWith(".html")) {
      await fs.copyFile(src, dest);
    }
  }

  try {
    await copyRecursive(buildDir, outDirFull);
    console.log(`✅ Copied assets from ${serveDir} to ${outDir}`);
  } catch (err) {
    console.error("❌ Error copying build assets:", err);
  }
}

async function main() {
    try {
        const config = await loadConfig();
        const buildDir = path.resolve(process.cwd(), config.serveDir || "build");
        const shouldBuild = process.argv.includes("--with-build");
        const isDebug = process.argv.includes("--debug");

        if (isDebug) {
            process.env.DEBUG = "1";
        }

        if (shouldBuild) {
            const buildCommand = config.buildCommand || "npm run build";
            console.log(`🏗️ Running ${buildCommand}...`);

            const [command, ...args] = buildCommand.split(' ');

            await new Promise((resolve, reject) => {
                const build = spawn(command, args, {
                    stdio: "inherit",
                    shell: true
                });
                build.on("exit", (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`❌ Build failed with exit code ${code}`));
                });
            });
        } else {
            const hasIndex = await pathExists(path.join(buildDir, "index.html"));
            if (!hasIndex) {
                console.error(
                    "❌ Build folder not found. Run `npm run build` or use --with-build."
                );
                process.exit(1);
            }
        }

        const outDirPath = path.resolve(process.cwd(), config.outDir || "static-pages");
        try {
            await fs.rm(outDirPath, { recursive: true, force: true });
            console.log(`🧹 Cleaned existing output directory: ${config.outDir || "static-pages"}`);
        } catch (err) {
        }

        await prerender(config);

        await copyBuildAssets(config.serveDir || "build", config.outDir || "static-pages");

        console.log("🎉 Prerendering completed successfully!");
        process.env.PRERENDER_FINISHED = "true"
    } catch (error) {
        console.error("❌ Process failed:", error.message);
        process.exit(1);
    }
}

main();