const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const CONFIG_PATH = path.join(ROOT, "config.js");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const KEY_PATTERN =
  /(newsApiGlobalKey|newsApiUsKey|newsDataIndiaKey)\s*:\s*(['"])(.*?)\2/g;

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};

  const text = fs.readFileSync(CONFIG_PATH, "utf8");
  const config = {};
  for (const match of text.matchAll(KEY_PATTERN)) {
    config[match[1]] = match[3].trim();
  }
  return config;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(body);
}

function publicParams(url, allowed) {
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (allowed.has(key) && value) params.set(key, value);
  }
  return params;
}

async function proxyNews(req, res, options) {
  const config = loadConfig();
  const apiKey = config[options.apiKeyName];

  if (!apiKey) {
    sendJson(res, 500, {
      status: "error",
      message: `Missing ${options.apiKeyName} in config.js`,
    });
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const params = publicParams(requestUrl, options.allowed);
  params.set(options.apiKeyParam, apiKey);

  const upstreamUrl = `${options.baseUrl}?${params.toString()}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { "User-Agent": "news-app-node-backend/1.0" },
      signal: AbortSignal.timeout(20000),
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      "Cache-Control": "no-store",
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    });
    res.end(body);
  } catch (error) {
    sendJson(res, 502, {
      status: "error",
      message: `Upstream request failed: ${error.message}`,
    });
  }
}

function serveStatic(req, res, pathname) {
  if (pathname === "/config.js") {
    sendJson(res, 404, {
      status: "error",
      message: "config.js is server-only",
    });
    return;
  }

  const requestPath = pathname === "/" ? "/index.html" : pathname;
  let filePath = path.normalize(path.join(ROOT, decodeURIComponent(requestPath)));

  if (!(filePath === ROOT || filePath.startsWith(`${ROOT}${path.sep}`))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      filePath = path.join(ROOT, "index.html");
    }

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, {
        "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { status: "error", message: "Method not allowed" });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/newsapi/everything") {
    proxyNews(req, res, {
      baseUrl: "https://newsapi.org/v2/everything",
      apiKeyName: "newsApiGlobalKey",
      apiKeyParam: "apiKey",
      allowed: new Set(["q", "language", "page", "pageSize"]),
    });
    return;
  }

  if (url.pathname === "/api/newsapi/top-headlines") {
    proxyNews(req, res, {
      baseUrl: "https://newsapi.org/v2/top-headlines",
      apiKeyName: "newsApiUsKey",
      apiKeyParam: "apiKey",
      allowed: new Set(["country", "category", "page", "pageSize"]),
    });
    return;
  }

  if (url.pathname === "/api/newsdata/news") {
    proxyNews(req, res, {
      baseUrl: "https://newsdata.io/api/1/news",
      apiKeyName: "newsDataIndiaKey",
      apiKeyParam: "apikey",
      allowed: new Set(["country", "category", "language", "page"]),
    });
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`News app backend running at http://localhost:${PORT}/`);
});
