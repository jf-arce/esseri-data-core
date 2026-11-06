"""Prueba Nginx real con una API sintética, sin Docker ni base de datos."""

import http.client
import json
import os
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Api(BaseHTTPRequestHandler):
    def do_GET(self):
        self.responder()

    def do_POST(self):
        self.responder()

    def responder(self):
        size = int(self.headers.get("Content-Length", "0"))
        self.rfile.read(size)
        body = json.dumps(
            {
                "path": self.path,
                "size": size,
                "cookie": self.headers.get("Cookie"),
                "ip": self.headers.get("X-Forwarded-For"),
                "proto": self.headers.get("X-Forwarded-Proto"),
            }
        ).encode()
        self.send_response(401 if self.path == "/denegado" else 200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header(
            "Set-Cookie", "oauth_state=test; Path=/auth; HttpOnly; Secure; SameSite=Lax"
        )
        self.send_header(
            "Set-Cookie", "access_token=test; Path=/; HttpOnly; Secure; SameSite=Lax"
        )
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class RailwayProxyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        binary = os.environ.get("NGINX_BINARY") or shutil.which("nginx")
        if not binary:
            raise RuntimeError(
                "Instalar Nginx o definir NGINX_BINARY; esta prueba no usa Docker"
            )
        cls.tmp = tempfile.TemporaryDirectory(prefix="esseri-proxy-")
        cls.addClassCleanup(cls.tmp.cleanup)
        root = Path(cls.tmp.name)
        (root / "index.html").write_text("ESSERI SPA")
        cls.api = ThreadingHTTPServer(("127.0.0.1", 0), Api)
        threading.Thread(target=cls.api.serve_forever, daemon=True).start()
        cls.addClassCleanup(cls.api.server_close)
        cls.addClassCleanup(cls.api.shutdown)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        template = (
            Path(__file__).resolve().parents[2] / "frontend/nginx-railway.conf"
        ).read_text()
        # Mismas sustituciones que envsubst del entrypoint oficial; rutas/puerto locales aislados.
        server = template.replace("${NGINX_LOCAL_RESOLVERS}", "127.0.0.1")
        server = server.replace(
            "${BACKEND_UPSTREAM}", f"127.0.0.1:{cls.api.server_port}"
        )
        server = server.replace("listen 80;", f"listen 127.0.0.1:{cls.port};")
        server = server.replace("/usr/share/nginx/html", str(root))
        config = root / "nginx.conf"
        config.write_text(
            f"pid {root}/nginx.pid;\nerror_log {root}/error.log;\n"
            "events {}\nhttp {\naccess_log off;\n"
            f"client_body_temp_path {root}/body;\nproxy_temp_path {root}/proxy;\n"
            + server
            + "\n}\n"
        )
        subprocess.run(
            [binary, "-t", "-p", str(root), "-c", str(config)],
            check=True,
            capture_output=True,
        )
        cls.proc = subprocess.Popen(
            [binary, "-p", str(root), "-c", str(config), "-g", "daemon off;"],
            stderr=subprocess.PIPE,
        )
        cls.addClassCleanup(cls.stop_nginx)
        for _ in range(100):
            try:
                conn = socket.create_connection(("127.0.0.1", cls.port), timeout=0.1)
                conn.close()
                break
            except OSError:
                if cls.proc.poll() is not None:
                    raise RuntimeError(cls.proc.stderr.read().decode())
                time.sleep(0.02)
        else:
            raise RuntimeError("Nginx no inició")

    @classmethod
    def stop_nginx(cls):
        cls.proc.terminate()
        cls.proc.communicate(timeout=5)

    def request(self, path, method="GET", body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            conn.request(method, path, body=body, headers=headers or {})
            response = conn.getresponse()
            return response.status, response.getheaders(), response.read()
        finally:
            conn.close()

    def test_spa_route(self):
        status, _, body = self.request("/familia/comunicaciones")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"ESSERI SPA")

    def test_api_path_query_and_cookies(self):
        status, headers, body = self.request(
            "/api/auth/google/callback?code=abc%2B123&state=xyz"
        )
        self.assertEqual(status, 200)
        self.assertEqual(
            json.loads(body)["path"], "/auth/google/callback?code=abc%2B123&state=xyz"
        )
        cookies = [value for name, value in headers if name.lower() == "set-cookie"]
        self.assertIn("Path=/api/auth; HttpOnly; Secure; SameSite=Lax", cookies[0])
        self.assertIn("Path=/; HttpOnly; Secure; SameSite=Lax", cookies[1])

    def test_session_and_edge_headers(self):
        _, _, body = self.request(
            "/api/auth/me",
            headers={
                "Cookie": "access_token=test",
                "X-Real-IP": "192.0.2.1",
                "X-Forwarded-For": "203.0.113.99",
                "X-Forwarded-Proto": "http",
            },
        )
        result = json.loads(body)
        self.assertEqual(result["cookie"], "access_token=test")
        self.assertEqual(result["ip"], "192.0.2.1")
        self.assertEqual(result["proto"], "https")

    def test_upload_above_nginx_default_limit(self):
        status, _, body = self.request(
            "/api/adjuntos", "POST", b"x" * (2 * 1024 * 1024)
        )
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["size"], 2 * 1024 * 1024)

    def test_denied_api_does_not_return_spa(self):
        status, _, body = self.request("/api/denegado")
        self.assertEqual(status, 401)
        self.assertEqual(json.loads(body)["path"], "/denegado")


if __name__ == "__main__":
    unittest.main()
