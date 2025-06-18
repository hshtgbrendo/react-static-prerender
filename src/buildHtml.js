import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";

export async function buildHtml({ prerenderedHtml, serveDir }) {
  const indexPath = path.join(serveDir, "index.html");
  const rawIndex = await fs.readFile(indexPath, "utf-8");

  const $template = cheerio.load(rawIndex);
  const $content = cheerio.load(prerenderedHtml);

  const prerenderedBody = $content("#root").html();

  $template("#root").html(prerenderedBody || "");

  const fixAttr = (selector, attr) => {
    $template(selector).each((_, el) => {
      const $el = $template(el);
      const val = $el.attr(attr);
      if (val && val.startsWith("./")) {
        $el.attr(attr, val.replace(/^.\//, "/"));
      }
    });
  };

  fixAttr("link[href^='./']", "href");
  fixAttr("script[src^='./']", "src");
  fixAttr("img[src^='./']", "src");
  fixAttr("source[srcset^='./']", "srcset");

  return $template.html();
}
