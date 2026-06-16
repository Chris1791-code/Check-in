# ==========================================================================
# LAN SYNC SERVER FOR QR CHECK-IN SYSTEM
# Author: Antigravity Team
# Stack: Built-in Python 3 (No external library installation needed)
# Usage: python server.py
# ==========================================================================

import os
import json
import socket
import http.server
import socketserver

PORT = 3000
DIRECTORY = "."

def get_local_ip():
    """Detects the active local IP address of the server machine."""
    try:
        # We establish a dummy connection to a public DNS server to find our interface IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        # Fallback to hostname lookup
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"

class SyncHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Initialize SimpleHTTPRequestHandler serving DIRECTORY
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Add CORS Headers so that other clients in the network can connect without restriction
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        # Pre-flight request for CORS
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # API endpoint to retrieve all datasets stored on this server
        if self.path == "/api/data":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            
            data = {}
            keys = ["customers", "logs", "users", "emails", "activityFeed", "settings"]
            for key in keys:
                filename = f"data_{key}.json"
                if os.path.exists(filename):
                    try:
                        with open(filename, "r", encoding="utf-8") as f:
                            data[key] = json.load(f)
                    except Exception as e:
                        print(f"Error reading {filename}: {e}")
                        data[key] = None
                else:
                    data[key] = None
            
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
        else:
            # Fall back to standard static file serving
            super().do_GET()

    def do_POST(self):
        # API endpoint to save state from a client
        if self.path == "/api/save":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode("utf-8"))
                key = payload.get("key")
                value = payload.get("value")
                
                valid_keys = ["customers", "logs", "users", "emails", "activityFeed", "settings"]
                if key in valid_keys:
                    filename = f"data_{key}.json"
                    with open(filename, "w", encoding="utf-8") as f:
                        json.dump(value, f, ensure_ascii=False, indent=4)
                    
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success", "key": key}).encode("utf-8"))
                    print(f"Sync Success: Saved state for '{key}'")
                    return
            except Exception as e:
                print("Error saving payload data:", e)
                
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": "Invalid request payload"}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    local_ip = get_local_ip()
    
    # Enable socket re-use to avoid port-binding locks on restarts
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), SyncHTTPRequestHandler) as httpd:
        print("\n" + "="*70)
        print("    [SERVER] HE THONG MAY CHU DONG BO LAN - QR CHECK-IN SU KIEN")
        print("="*70)
        print(f"  * Trang thai: Dang hoat dong...")
        print(f"  * May chu chinh (Laptop nay) truy cap qua:")
        print(f"      [LINK]  http://localhost:{PORT}")
        print(f"  * Cac may phu (Laptop khac) trong cung mang Wi-Fi truy cap qua:")
        print(f"      [LINK]  http://{local_ip}:{PORT}")
        print("-"*70)
        print("  [GUIDE] HUONG DAN DANH CHO CAC MAY PHU:")
        print("  1. Ket noi laptop phu vao cung mot mang Wi-Fi/LAN voi may chu nay.")
        print(f"  2. Mo trinh duyet (Chrome/Edge) va nhap dia chi: http://{local_ip}:{PORT}")
        print("  3. Check-in logs va du lieu se tu dong dong bo giua cac may sau moi 5s.")
        print("="*70 + "\n")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  [INFO] May chu da duoc dung bang ban phim (Ctrl+C).")
