"""Start one backend instance, checking the occupied port before startup."""
import argparse
import hashlib
import json
import socket
import subprocess
from pathlib import Path
from urllib.request import urlopen
import uvicorn


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    instance = hashlib.sha256(str(Path(__file__).resolve().parent).encode()).hexdigest()[:16]
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
    try:
        sock.bind(("127.0.0.1", args.port))
    except OSError as exc:
        sock.close()
        print(f"Port {args.port} already occupied ({exc}). No process will be terminated.")
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            result = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True)
            for line in result.stdout.splitlines():
                fields = line.split()
                if len(fields) >= 5 and fields[1].endswith(f":{args.port}") and fields[3] == "LISTENING":
                    print(f"Listener: {fields[1]}, PID={fields[4]}")
        try:
            with urlopen(f"http://127.0.0.1:{args.port}/api/health", timeout=5) as response:
                health = json.load(response)
            print(f"Existing health: {health}")
            if health.get("backend_instance") == instance and health.get("status") == "ok" and health.get("persistent"):
                print("Healthy backend from this workspace is already running; reusing it.")
                return 0
        except Exception as error:
            print(f"Health check failed: {type(error).__name__}")
        print("Startup refused. Inspect the listener before restarting it, or choose --port.")
        return 1
    try:
        sock.listen(2048)
        config = uvicorn.Config("app.main:app", host="127.0.0.1", port=args.port, workers=1)
        server = uvicorn.Server(config)
        server.run(sockets=[sock])
    finally:
        sock.close()
    return 0 if server.started else 1


if __name__ == "__main__":
    raise SystemExit(main())
