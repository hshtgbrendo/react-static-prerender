# react-static-prerenderer

A lightweight CLI tool that converts your React SPA into static HTML files, each acting as a standalone entry point.

## Features

- Prerender specified React app routes into static HTML files  
- Adjusts asset paths for static hosting compatibility  
- Outputs static pages in a configurable directory  
- Supports custom route lists via `prerender.config.js`  
- Copies static assets excluding HTML files  
- Easy-to-use CLI  

## Installation

Install as a development dependency:

    npm install --save-dev react-static-prerenderer

## Usage

1. Create a `prerender.config.js` file in your project root to specify routes, input build directory, and output directory.

2. Make sure your React app is built and ready to be prerendered or run the command with --with-build flag.

3. Run the prerender command to generate static HTML pages.

## Example `prerender.config.js`

```js
export default async function () {
  return {
    routes: ["/", "/about", "/contact"],
    outDir: "static-pages",
    serveDir: "build",
  };
}
```

## CLI Options

- `--with-build` – runs `npm run build` before prerendering

## Why use this?

- Ideal for static hosting of React SPA without server-side rendering  
- Improves SEO and initial page load performance  
- Minimal setup and configuration  

## Requirements

- Node.js 18 or higher  
- React app build ready for prerendering or run the command with --with-build flag

## Contributing

Contributions are welcome. Please keep code clean and follow best practices.

## License

MIT © Janko Stanic