#!/usr/bin/env python3
"""
CivicPulse Instant Local Live Preview Server
Zero-dependency Python 3 HTTP Server serving the CivicPulse Interactive System.
Automatically binds to http://localhost:3000 and launches the browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class CivicPulseHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Route root requests directly to standalone-preview.html
        if self.path == '/' or self.path == '':
            self.path = '/standalone-preview.html'
        return super().do_GET()

    def log_message(self, format, *args):
        sys.stderr.write(f"[CivicPulse Telemetry] {self.address_string()} - {format % args}\n")

def run():
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), CivicPulseHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print("   [LIVE SERVER] CivicPulse: High-Concurrency Civic Issue Tracker")
        print("   Mission-Critical Real-Time Telemetry & Radar Mesh")
        print("=" * 60)
        print(f"\n[ACTIVE] Serving on: {url}")
        print("[HOTKEY] Press Ctrl+C in this window to stop server.\n")
        
        # Open web browser automatically
        try:
            webbrowser.open(url)
        except Exception:
            pass

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[STOPPED] CivicPulse server shutdown cleanly.")

if __name__ == '__main__':
    run()
