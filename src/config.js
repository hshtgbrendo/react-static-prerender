"use strict"
import * as fse from "fs-extra"
import * as path from "path"

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
        if (fse.pathExistsSync(CONFIG_PATH)) {
            ConfigManager.config = Object.assign(
                ConfigManager.config,
                await fse.readJson(CONFIG_PATH)
            )
        }
        return ConfigManager.config
    }
}
