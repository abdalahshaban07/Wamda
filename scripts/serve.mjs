import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("../dist/cofeed", import.meta.url)));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".json": "application/json",
};
export function startServer(port = 4173) {
  return new Promise((done) => {
    const server = createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        );
        let file = resolve(root, "." + pathname);
        if (file !== root && !file.startsWith(root + sep)) {
          res.writeHead(403);
          res.end();
          return;
        }
        try {
          if (!(await stat(file)).isFile()) file = resolve(root, "index.html");
        } catch {
          if (extname(file)) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          file = resolve(root, "index.html");
        }
        const data = await readFile(file);
        res.writeHead(200, {
          "Content-Type": mime[extname(file)] || "application/octet-stream",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(data);
      } catch {
        res.writeHead(500);
        res.end("Build the app before starting preview.");
      }
    }).listen(port, "127.0.0.1", () => done(server));
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startServer(Number(process.env.PORT || 4173));
  console.log("Wamda isolated preview: http://127.0.0.1:4173");
}
