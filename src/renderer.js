import * as url from "url"

const MOBILE_USERAGENT =
    "Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2 XL Build/OPD1.170816.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.75 Mobile Safari/537.36"

/**
 * Wraps Puppeteer's interface to Headless Chrome to expose high level rendering
 * APIs that are able to handle web components and PWAs.
 */
export class Renderer {
    constructor(browser, config, setStorage) {
        this.browser = browser
        this.config = config
        this.setStorage = setStorage
    }

    async serialize(requestUrl, isMobile) {
        /**
         * Executed on the page after the page has loaded. Strips script and
         * import tags to prevent further loading of resources.
         */
        function stripPage() {
            // Strip only script tags that contain JavaScript (either no type attribute or one that contains "javascript")
            const elements = document.querySelectorAll(
                'script:not([type]), script[type*="javascript"], link[rel=import]'
            )
            for (const e of Array.from(elements)) {
                e.remove()
            }
        }

        /**
         * Injects a <base> tag which allows other resources to load. This
         * has no effect on serialized output, but allows it to verify render
         * quality.
         */
        function injectBaseHref(origin) {
            const base = document.createElement("base")
            base.setAttribute("href", origin)

            const bases = document.head.querySelectorAll("base")
            if (bases.length) {
                // Patch existing <base> if it is relative.
                const existingBase = bases[0].getAttribute("href") || ""
                if (existingBase.startsWith("/")) {
                    bases[0].setAttribute("href", origin + existingBase)
                }
            } else {
                // Only inject <base> if it doesn't already exist.
                document.head.insertAdjacentElement("afterbegin", base)
            }
        }

        console.log(`📄 create page`)
        const page = await this.browser.newPage()

        await page.setUserAgent(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );

        page.on('console', async msg => {
            // const args = msg.args()
            // const values = []
            // for (let i = 0; i < args.length; i++) {
            //     values.push(await args[i].jsonValue())
            // }

            // console.log(`BROWSER [${msg.type()}]: `, ...values)
            try {
                // Get all args passed into console.log
                const args = await Promise.all(msg.args().map(arg => arg.jsonValue()));

                // Format them similar to how they'd appear in the browser
                console.log(
                    `BROWSER [${msg.type()}]`,
                    ...args.map(a => (typeof a === "object" ? JSON.stringify(a) : a))
                );
            } catch (err) {
                console.error("Error parsing console message:", err);
            }
        })

        console.log(`set storage for requested page ${requestUrl}:`, this.setStorage)
        await page.evaluateOnNewDocument((storage) => {
            for (const key in storage) {
                console.log(`set ${key} : ${storage[key]}`)
                localStorage.setItem(JSON.stringify(key), storage[key]);
                console.log(localStorage.getItem(JSON.stringify(key)))
            }
        }, this.setStorage)

        var keysSet = await page.evaluate((storage) => {
            var confirmKeys = true

            for (const key in storage) {
                let storedValue = null
                try {
                    storedValue = localStorage.getItem(JSON.stringify(key))
                } catch (error) {
                    console.error('Error accessing Local Storage:', error);
                }

                console.log(`check ${key} : ${storage[key]} => ${storedValue}`)
                if (storedValue !== JSON.stringify(storage[key])) {
                    confirmKeys = false
                }
            }

            return confirmKeys
        }, this.setStorage)

        if (keysSet) {
            console.log("keys set")
        } else {
            console.log("keys not set")
        }

        // Page may reload when setting isMobile
        // https://github.com/GoogleChrome/puppeteer/blob/v1.10.0/docs/api.md#pagesetviewportviewport
        // await page.setViewport({
        //     width: this.config.width,
        //     height: this.config.height,
        // })

        if (isMobile) {
            page.setUserAgent(MOBILE_USERAGENT)
        }

        // page.evaluateOnNewDocument("customElements.forcePolyfill = true")
        // page.evaluateOnNewDocument("ShadyDOM = {force: true}")
        // page.evaluateOnNewDocument("ShadyCSS = {shimcssproperties: true}")

        let response = null
        // Capture main frame response. This is used in the case that rendering
        // times out, which results in puppeteer throwing an error. This allows us
        // to return a partial response for what was able to be rendered in that
        // time frame.
        page.on("response", r => {
            if (!response) {
                response = r
            }
        })

        try {
            // Navigate to page. Wait until there are no outstanding network requests.
            console.log(`📄 navigate to ${requestUrl}`)
            response = await page.goto(requestUrl, {
                timeout: this.config.timeout,
                waitUntil: "networkidle0"
            })

            try {
                const el = await page.waitForSelector("#pageLoaded", { visible: true, timeout: 120000 })
                console.log(`#pageLoaded found on page ${requestUrl}`)
            } catch (err) {
                console.log(`#pageLoaded not found on page ${requestUrl}`)
                response = null
            }
        } catch (e) {
            console.error(e)
        }

        const currentUrl = await page.url()
        const cookies = await this.browser.cookies()
        console.log(`🍪 cookies for ${currentUrl}:`, cookies)
        if (currentUrl !== requestUrl) {
            console.log(`url mismatch. current url: ${currentUrl} - target url: ${requestUrl}`)
            // await page.close()
            // throw new Error(`url mismatch`);
        }

        const keySet = await page.evaluate((storage) => {
            var confirmKeys = true

            for (const key in storage) {
                let storedValue = null
                try {
                    storedValue = localStorage.getItem(JSON.stringify(key))
                } catch (error) {
                    console.error('Error accessing Local Storage:', error);
                }

                console.log(`check ${key} : ${storage[key]} => ${storedValue}`)
                if (storedValue !== JSON.stringify(storage[key])) {
                    confirmKeys = false
                }
            }

            return confirmKeys
        }, this.setStorage)

        if (keySet) {
            console.log("keys set")
        } else {
            console.log("keys not set")
        }

        if (!response) {
            console.error("response does not exist")
            // This should only occur when the page is about:blank. See
            // https://github.com/GoogleChrome/puppeteer/blob/v1.5.0/docs/api.md#pagegotourl-options.
            await page.close()
            return { status: 400, content: "" }
        }

        // Disable access to compute metadata. See
        // https://cloud.google.com/compute/docs/storing-retrieving-metadata.
        if (response.headers()["metadata-flavor"] === "Google") {
            await page.close()
            return { status: 403, content: "" }
        }

        // Set status to the initial server's response code. Check for a <meta
        // name="render:status_code" content="4xx" /> tag which overrides the status
        // code.
        let statusCode = response.status()
        const newStatusCode = await page
            .$eval('meta[name="render:status_code"]', element =>
                parseInt(element.getAttribute("content") || "")
            )
            .catch(() => undefined)
        // On a repeat visit to the same origin, browser cache is enabled, so we may
        // encounter a 304 Not Modified. Instead we'll treat this as a 200 OK.
        if (statusCode === 304) {
            statusCode = 200
        }
        // Original status codes which aren't 200 always return with that status
        // code, regardless of meta tags.
        if (statusCode === 200 && newStatusCode) {
            statusCode = newStatusCode
        }

        // Remove script & import tags.
        // await page.evaluate(stripPage)
        // Inject <base> tag with the origin of the request (ie. no path).
        const parsedUrl = url.parse(requestUrl)
        await page.evaluate(
            injectBaseHref,
            `${parsedUrl.protocol}//${parsedUrl.host}`
        )

        if (this.config.tag) {
            await page.evaluate(() => {
                const div = document.createElement("div");
                div.textContent = "prerendered";
                document.body.insertBefore(div, document.body.firstChild);
            });
        }

        // Serialize page.
        const result = await page.evaluate("document.firstElementChild.outerHTML")
        console.log(`status code: ${statusCode}`)

        await page.close()
        return { status: statusCode, content: result }
    }

    async screenshot(url, isMobile, dimensions, options) {
        const page = await this.browser.newPage()

        // Page may reload when setting isMobile
        // https://github.com/GoogleChrome/puppeteer/blob/v1.10.0/docs/api.md#pagesetviewportviewport
        await page.setViewport({
            width: dimensions.width,
            height: dimensions.height,
            isMobile
        })

        if (isMobile) {
            page.setUserAgent(MOBILE_USERAGENT)
        }

        let response = null

        try {
            // Navigate to page. Wait until there are no outstanding network requests.
            response = await page.goto(url, {
                timeout: 10000,
                waitUntil: "networkidle0"
            })
        } catch (e) {
            console.error(e)
        }

        if (!response) {
            throw new ScreenshotError("NoResponse")
        }

        // Disable access to compute metadata. See
        // https://cloud.google.com/compute/docs/storing-retrieving-metadata.
        if (response.headers()["metadata-flavor"] === "Google") {
            throw new ScreenshotError("Forbidden")
        }

        // Must be jpeg & binary format.
        const screenshotOptions = Object.assign({}, options, {
            type: "jpeg",
            encoding: "binary"
        })
        // Screenshot returns a buffer based on specified encoding above.
        // https://github.com/GoogleChrome/puppeteer/blob/v1.8.0/docs/api.md#pagescreenshotoptions
        const buffer = await page.screenshot(screenshotOptions)
        return buffer
    }
}

export class ScreenshotError extends Error {
    constructor(type) {
        super(type)

        this.name = this.constructor.name

        this.type = type
    }
}
