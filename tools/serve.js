// Servidor local para testar o app: node tools/serve.js (abre em http://localhost:5173)
const http = require("http"), fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, ".."), porta = +process.env.PORT || 5173;
const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".json": "application/json" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const arq = path.join(raiz, p);
  if (!arq.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  fs.readFile(arq, (e, d) => {
    if (e) { res.writeHead(404); return res.end("não encontrado"); }
    res.writeHead(200, { "Content-Type": tipos[path.extname(arq)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(d);
  });
}).listen(porta, () => console.log("http://localhost:" + porta));
