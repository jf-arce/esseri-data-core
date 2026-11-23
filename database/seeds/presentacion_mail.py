"""Capture the demo's automatic workflow email payloads locally; never deliver mail."""

import argparse
import hmac
import json
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import TextIO

MAX_BYTES = 256 * 1024
RECIPIENT = re.compile(r"[a-z]+\.[a-z]+@familias\.esseri\.test")
REQUIRED = {"destinatario", "asunto", "cuerpo"}


def capture_server(port: int, token: str, output: TextIO) -> HTTPServer:
    if not token.strip():
        raise ValueError("Set a demo-only N8N_WEBHOOK_TOKEN.")
    authorization = f"Bearer {token}".encode()

    class Capture(BaseHTTPRequestHandler):
        def setup(self):
            self.request.settimeout(5)
            super().setup()

        def do_POST(self):
            if self.path != "/capture":
                self.respond(404)
                return
            bearer = self.headers.get("Authorization", "").encode()
            if not hmac.compare_digest(bearer, authorization):
                self.respond(403)
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= MAX_BYTES:
                    self.respond(413)
                    return
                payload = json.loads(self.rfile.read(size))
                if (
                    not isinstance(payload, dict)
                    or not REQUIRED <= payload.keys() <= REQUIRED | {"cuerpo_html"}
                    or not all(isinstance(value, str) for value in payload.values())
                    or not RECIPIENT.fullmatch(payload["destinatario"])
                ):
                    raise ValueError("Unsupported payload or recipient.")
            except (ValueError, TimeoutError):
                self.respond(400)
                return
            output.write(json.dumps(payload, ensure_ascii=False) + "\n")
            output.flush()
            self.respond(204)

        def respond(self, status):
            self.send_response(status)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def log_message(self, *_):
            pass

    return HTTPServer(("127.0.0.1", port), Capture)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="New, local JSON Lines capture")
    parser.add_argument("--port", type=int, default=8798)
    args = parser.parse_args()
    try:
        token = os.getenv("N8N_WEBHOOK_TOKEN", "")
        if not token.strip():
            raise ValueError("Set a demo-only N8N_WEBHOOK_TOKEN.")
        if not 0 <= args.port <= 65535:
            raise ValueError("Capture port must be between 0 and 65535.")
        with args.output.open("x", encoding="utf-8") as output:
            try:
                server = capture_server(args.port, token, output)
            except OSError:
                # A failed bind must not leave a capture file that blocks the retry.
                output.close()
                args.output.unlink(missing_ok=True)
                raise
            with server:
                print(f"Capturing on http://127.0.0.1:{server.server_port}/capture", flush=True)
                server.serve_forever()
    except KeyboardInterrupt:
        pass
    except (OSError, ValueError) as exc:
        parser.exit(1, f"{exc}\n")


if __name__ == "__main__":
    main()
