#!/usr/bin/env python3
"""Serve this folder so the game can be installed, then played offline."""

import http.server
import mimetypes
import os

mimetypes.add_type("application/manifest+json", ".webmanifest")
os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(os.environ.get("PORT", "8731"))
http.server.ThreadingHTTPServer(
    ("127.0.0.1", port),
    http.server.SimpleHTTPRequestHandler,
).serve_forever()
