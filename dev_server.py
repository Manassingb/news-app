#!/usr/bin/env python3
import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.js"

CONFIG_RE = re.compile(
    r"(newsApiGlobalKey|newsApiUsKey|newsDataIndiaKey)\s*:\s*(['\"])(.*?)\2"
)


def load_config():
    if not CONFIG_PATH.exists():
        return {}

    text = CONFIG_PATH.read_text(encoding="utf-8")
    return {match.group(1): match.group(3).strip() for match in CONFIG_RE.finditer(text)}


def public_params(path):
    query = urlsplit(path).query
    return dict(parse_qsl(query, keep_blank_values=True))


class NewsAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        route = urlsplit(self.path).path

        if route == "/config.js":
            self.send_json(404, {"status": "error", "message": "config.js is server-only"})
            return

        if route == "/api/newsapi/everything":
            self.proxy(
                base_url="https://newsapi.org/v2/everything",
                api_key_name="newsApiGlobalKey",
                api_key_param="apiKey",
                allowed={"q", "language", "page", "pageSize"},
            )
            return

        if route == "/api/newsapi/top-headlines":
            self.proxy(
                base_url="https://newsapi.org/v2/top-headlines",
                api_key_name="newsApiUsKey",
                api_key_param="apiKey",
                allowed={"country", "category", "page", "pageSize"},
            )
            return

        if route == "/api/newsdata/news":
            self.proxy(
                base_url="https://newsdata.io/api/1/news",
                api_key_name="newsDataIndiaKey",
                api_key_param="apikey",
                allowed={"country", "category", "language", "page"},
            )
            return

        super().do_GET()

    def proxy(self, base_url, api_key_name, api_key_param, allowed):
        config = load_config()
        api_key = config.get(api_key_name)

        if not api_key:
            self.send_json(
                500,
                {
                    "status": "error",
                    "message": f"Missing {api_key_name} in config.js",
                },
            )
            return

        params = {
            key: value
            for key, value in public_params(self.path).items()
            if key in allowed and value
        }
        params[api_key_param] = api_key
        upstream_url = f"{base_url}?{urlencode(params)}"

        request = Request(upstream_url, headers={"User-Agent": "news-app-local-dev/1.0"})

        try:
            with urlopen(request, timeout=20) as response:
                body = response.read()
                status = response.status
                content_type = response.headers.get("Content-Type", "application/json")
        except HTTPError as error:
            body = error.read()
            status = error.code
            content_type = error.headers.get("Content-Type", "application/json")
        except URLError as error:
            self.send_json(
                502,
                {"status": "error", "message": f"Upstream request failed: {error.reason}"},
            )
            return

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), NewsAppHandler)
    print(f"News app backend running at http://localhost:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
