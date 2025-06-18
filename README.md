[![npm version](https://img.shields.io/npm/v/react-static-prerender.svg)](https://www.npmjs.com/package/react-static-prerender)
[![MIT license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
# react-static-prerender

A lightweight CLI tool that converts your React SPA into static HTML files, each acting as a standalone entry point.

## Features

- Prerender specified React app routes into static HTML files
- Flexible output structure (flat files or nested directories)
- Outputs static pages in a configurable directory
- Supports custom route lists via `prerender.config.js`
- Copies static assets excluding HTML files
- Easy-to-use CLI with debug support
- Cross-platform compatibility

## Installation

Install as a development dependency:

    npm install --save-dev react-static-prerender

## Usage

1. Create a `prerender.config.js` file in your project root to specify routes, input build directory, and output directory.

   **Example `prerender.config.js`**

   If your project has `"type": "module"` in package.json:
    ```js
    export default async function () {
      return {
        routes: ["/", "/about", "/contact"],
        outDir: "static-pages",
        serveDir: "build",
        flatOutput: false, // Optional: true for about.html, false for about/index.html
      };
    }
    ```

   If your project uses CommonJS (no `"type": "module"`):
    ```js
    module.exports = {
        routes: ["/", "/about", "/contact"],
        outDir: "static-pages",
        serveDir: "build",
        flatOutput: false, // Optional: true for about.html, false for about/index.html
   };
    ```

2. Make sure your React app is built and ready to be prerendered or run the command with --with-build flag.

3. Run the prerender command to generate static HTML pages.

    ```
    npx react-static-prerender
    ```

   If you want to automatically build before prerendering:

    ```
    npx react-static-prerender --with-build
    ```

   For debugging server issues:

    ```
    npx react-static-prerender --debug
    ```

**(Optional)** Add an npm script to simplify future runs:

```json
"scripts": {
  "prerender": "react-static-prerender --with-build"
}
```

Then run with:

```
npm run prerender
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `routes` | `string[]` | `[]` | Array of routes to prerender (e.g., `["/", "/about"]`) |
| `outDir` | `string` | `"static-pages"` | Output directory for generated static files |
| `serveDir` | `string` | `"build"` | Directory containing your built React app |
| `flatOutput` | `boolean` | `false` | Output structure: `true` = `about.html`, `false` = `about/index.html` |

## CLI Options

| Flag | Description |
|------|-------------|
| `--with-build` | Runs `npm run build` before prerendering |
| `--debug` | Shows detailed server logs for troubleshooting |

## Output Structure

### Nested Structure (default: `flatOutput: false`)
```
static-pages/
├── index.html           # / route
├── about/
│   └── index.html       # /about route
└── contact/
    └── index.html       # /contact route
```

### Flat Structure (`flatOutput: true`)
```
static-pages/
├── index.html           # / route
├── about.html           # /about route
└── contact.html         # /contact route
```

## Why use this?

- **SEO Friendly**: Pre-generated HTML improves search engine crawling
- **Fast Loading**: Eliminates client-side rendering delay for initial page load
- **Static Hosting**: Perfect for CDNs, GitHub Pages, Netlify, Vercel
- **Minimal Setup**: Simple configuration with sensible defaults
- **Flexible Output**: Choose between flat files or nested directory structure

## Requirements

- **Node.js 18 or higher**
- React app build ready for prerendering or run the command with --with-build flag

## Troubleshooting

### Build folder not found
Make sure your React app is built before running prerender, or use the `--with-build` flag.

### Server startup issues
Use the `--debug` flag to see detailed server logs:
```bash
npx react-static-prerender --debug
```

### Port conflicts
The tool automatically finds available ports starting from 5050, so port conflicts should be rare.

## Contributing

Contributions are welcome. Please keep code clean and follow best practices.

## License

MIT © Janko Stanic