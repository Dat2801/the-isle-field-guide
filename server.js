// The Isle field guide: serves the page and images, and keeps a live list of who is reading.
// Presence uses Server-Sent Events (one stream per tab) plus a small POST endpoint; no dependencies.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const MAX_PEERS = 500;
const HEARTBEAT_MS = 20000;       // keeps proxies (Render) from closing idle streams
const PENDING_TTL_MS = 60000;     // presence posted before its stream opened

// index.html is written as page content only (the Claude viewer adds the document shell),
// so wrap it in a full document with the same small reset when serving it here.
const SHELL_HEAD = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.5 system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>`;
const SHELL_TAIL = "</body></html>";

const TYPES = { ".png": "image/png", ".jpg": "image/jpeg" };

// id -> { nick, viewing, res, seen }
const peers = new Map();

const cleanId = v => (typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : null);
// Control, zero-width and bidi characters are stripped from nicknames
const NICK_STRIP = new RegExp("[" + [[0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e]]
  .map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b)).join("") + "]", "g");
const cleanNick = v => (typeof v === "string" ? v.replace(NICK_STRIP, "").trim().slice(0, 24) : "");
const cleanViewing = v => (typeof v === "string" && /^[a-z]{2,12}$/.test(v) ? v : null);

function roster() {
  return [...peers].filter(([, p]) => p.res).map(([id, p]) => ({ id, nick: p.nick, viewing: p.viewing }));
}

function broadcast() {
  const data = `data: ${JSON.stringify({ peers: roster() })}\n\n`;
  for (const p of peers.values()) if (p.res) p.res.write(data);
}

function openStream(req, res, url) {
  const id = cleanId(url.searchParams.get("id"));
  if (!id) return send(res, 400, "Missing or invalid id");
  if (!peers.has(id) && peers.size >= MAX_PEERS) return send(res, 503, "Room is full");

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");

  const p = peers.get(id) || { nick: "", viewing: null };
  if (p.res && p.res !== res) p.res.end();     // same tab reconnected: drop the old stream
  p.res = res;
  p.seen = Date.now();
  peers.set(id, p);
  broadcast();

  const beat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
  req.on("close", () => {
    clearInterval(beat);
    const cur = peers.get(id);
    if (cur && cur.res === res) { peers.delete(id); broadcast(); }
  });
}

function updatePresence(req, res) {
  let body = "";
  req.on("data", chunk => {
    body += chunk;
    if (body.length > 1024) { send(res, 413, "Too large"); req.destroy(); }
  });
  req.on("end", () => {
    if (res.writableEnded) return;
    let msg;
    try { msg = JSON.parse(body); } catch { return send(res, 400, "Invalid JSON"); }
    const id = cleanId(msg.id);
    if (!id) return send(res, 400, "Missing or invalid id");
    if (!peers.has(id) && peers.size >= MAX_PEERS) return send(res, 503, "Room is full");
    const p = peers.get(id) || { nick: "", viewing: null, res: null };
    if ("nick" in msg) p.nick = cleanNick(msg.nick);
    if ("viewing" in msg) p.viewing = cleanViewing(msg.viewing);
    p.seen = Date.now();
    peers.set(id, p);
    if (p.res) broadcast();
    send(res, 204);
  });
}

function serveFile(res, file, type) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=86400" });
    res.end(buf);
  });
}

function servePage(res) {
  fs.readFile(path.join(ROOT, "index.html"), "utf8", (err, html) => {
    if (err) return send(res, 500, "Page missing");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(SHELL_HEAD + html + SHELL_TAIL);
  });
}

function send(res, status, text = "") {
  if (res.headersSent) return res.end();
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  if (req.method === "GET" && (p === "/" || p === "/index.html")) return servePage(res);
  if (req.method === "GET" && p === "/healthz") return send(res, 200, "ok");
  if (req.method === "GET" && p === "/api/events") return openStream(req, res, url);
  if (req.method === "POST" && p === "/api/presence") return updatePresence(req, res);
  const img = p.match(/^\/img\/([a-z]+\.(png|jpg))$/);
  if (req.method === "GET" && img) return serveFile(res, path.join(ROOT, "img", img[1]), TYPES["." + img[2]]);
  send(res, 404, "Not found");
});

// Forget presence that was posted but never followed by a stream
setInterval(() => {
  const cutoff = Date.now() - PENDING_TTL_MS;
  for (const [id, p] of peers) if (!p.res && p.seen < cutoff) peers.delete(id);
}, PENDING_TTL_MS).unref();

server.listen(PORT, () => console.log(`The Isle field guide on http://localhost:${PORT}`));
