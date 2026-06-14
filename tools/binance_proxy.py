import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen


HOST = os.environ.get("BINANCE_PROXY_HOST", "127.0.0.1")
PORT = int(os.environ.get("BINANCE_PROXY_PORT", "8789"))
PROXY_KEY = os.environ.get("BINANCE_PROXY_KEY", "")
ALLOWED_PREFIXES = (
    "https://api.binance.com/api/v3/account?",
    "https://api.binance.com/api/v3/ticker/price?",
)


class BinanceProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path not in ("/", "/binance"):
            return self.respond(404, {"ok": False, "error": "Not found"})

        params = parse_qs(parsed.query)
        action = first(params, "action")
        provided_key = first(params, "key")
        target_url = first(params, "url")
        api_key = first(params, "apiKey")

        if action != "binance_proxy":
            return self.respond(400, {"ok": False, "error": "Accion no valida"})
        if PROXY_KEY and provided_key != PROXY_KEY:
            return self.respond(401, {"ok": False, "error": "Unauthorized"})
        if not any(target_url.startswith(prefix) for prefix in ALLOWED_PREFIXES):
            return self.respond(400, {"ok": False, "error": "URL Binance no permitida"})

        headers = {
            "Accept": "application/json",
            "User-Agent": "FinanzasMayesonLocalProxy/1.0",
        }
        if api_key and target_url.startswith(ALLOWED_PREFIXES[0]):
            headers["X-MBX-APIKEY"] = api_key

        try:
            request = Request(target_url, headers=headers, method="GET")
            with urlopen(request, timeout=12) as response:
                status = response.getcode()
                body = response.read().decode("utf-8", errors="replace")
            return self.respond(200, {
                "ok": True,
                "status": status,
                "body": body,
                "source": "local_binance_proxy",
            })
        except Exception as error:
            return self.respond(502, {"ok": False, "error": str(error)})

    def log_message(self, _format, *_args):
        return

    def respond(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def first(params, key):
    values = params.get(key) or [""]
    return values[0]


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), BinanceProxyHandler)
    print(f"Binance proxy escuchando en http://{HOST}:{PORT}")
    server.serve_forever()
