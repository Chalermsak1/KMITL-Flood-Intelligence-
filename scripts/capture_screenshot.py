import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
import websockets

async def capture(url, output_path, width=1440, height=900, wait_sec=4):
    port = 9223
    chrome_proc = subprocess.Popen([
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless=new",
        f"--remote-debugging-port={port}",
        "--use-gl=angle", "--use-angle=swiftshader",
        f"--window-size={width},{height}",
        "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        # Wait for debugging port
        for _ in range(30):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=1) as resp:
                    info = json.loads(resp.read().decode())
                    ws_url = info["webSocketDebuggerUrl"]
                    break
            except Exception:
                time.sleep(0.2)
        else:
            raise RuntimeError("Could not connect to Chrome debugging port")

        async with websockets.connect(ws_url) as ws:
            msg_id = 0
            async def send(method, params=None, session_id=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method}
                if params:
                    payload["params"] = params
                if session_id:
                    payload["sessionId"] = session_id
                await ws.send(json.dumps(payload))
                while True:
                    raw = await ws.recv()
                    data = json.loads(raw)
                    if data.get("method") == "Runtime.consoleAPICalled":
                        print("CONSOLE:", data["params"]["type"], [arg.get("value") for arg in data["params"].get("args", [])])
                    elif data.get("method") == "Runtime.exceptionThrown":
                        print("EXCEPTION:", data["params"]["exceptionDetails"])
                    elif data.get("id") == msg_id:
                        if "error" in data:
                            raise RuntimeError(data["error"])
                        return data.get("result", {})

            # Create target and attach
            target_res = await send("Target.createTarget", {"url": "about:blank"})
            session_res = await send("Target.attachToTarget", {"targetId": target_res["targetId"], "flatten": True})
            session_id = session_res["sessionId"]

            await send("Page.enable", session_id=session_id)
            await send("Runtime.enable", session_id=session_id)
            await send("Console.enable", session_id=session_id)
            await send("Emulation.setDeviceMetricsOverride", {
                "width": width,
                "height": height,
                "deviceScaleFactor": 1,
                "mobile": width < 768
            }, session_id=session_id)

            print(f"Navigating to {url}...")
            await send("Page.navigate", {"url": url}, session_id=session_id)
            await asyncio.sleep(wait_sec)

            print("Capturing screenshot...")
            res = await send("Page.captureScreenshot", {"format": "png"}, session_id=session_id)
            import base64
            img_data = base64.b64decode(res["data"])
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(img_data)
            print(f"Saved {len(img_data)} bytes to {output_path}")

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except Exception:
            chrome_proc.kill()

if __name__ == "__main__":
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
    out = sys.argv[2] if len(sys.argv) > 2 else "screenshot.png"
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 1440
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 900
    sec = int(sys.argv[5]) if len(sys.argv) > 5 else 4
    asyncio.run(capture(target_url, out, w, h, sec))
