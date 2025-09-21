"use strict"
import fsExtra from "fs-extra"
import * as path from "path"
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.resolve(__dirname, "../config.json")

export class ConfigManager {
    static config = {
        datastoreCache: false,
        timeout: 10000,
        port: "3000",
        width: 1000,
        height: 1000
    }

    static async getConfiguration() {
        // Load config.json if it exists.
        // if (fse.pathExists(CONFIG_PATH)) {
        //     ConfigManager.config = Object.assign(
        //         ConfigManager.config,
        //         await fse.readJson(CONFIG_PATH)
        //     )
        // }
        // return ConfigManager.config
        try {
            if (await fsExtra.pathExists(CONFIG_PATH)) {
                const fileConfig = await fsExtra.readJson(CONFIG_PATH);
                ConfigManager.config = {
                    ...ConfigManager.config,
                    ...fileConfig
                };
            }
        } catch (err) {
            console.error("Failed to load config.json:", err);
        }
        return ConfigManager.config;
    }
}
