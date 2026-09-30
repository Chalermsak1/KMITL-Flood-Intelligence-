import asyncio
import json
import os
import subprocess
import time
import urllib.request
import websockets

async def capture_detail():
    port = 9224
    chrome_proc = subprocess.Popen([
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless=new",
        f"--remote-debugging-port={port}",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--window-size=1440,900",
        "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
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
                if params: payload["params"] = params
                if session_id: payload["sessionId"] = session_id
                await ws.send(json.dumps(payload))
                while True:
                    raw = await ws.recv()
                    data = json.loads(raw)
                    if data.get("id") == msg_id:
                        if "error" in data: raise RuntimeError(data["error"])
                        return data.get("result", {})

            target_res = await send("Target.createTarget", {"url": "about:blank"})
            session_res = await send("Target.attachToTarget", {"targetId": target_res["targetId"], "flatten": True})
            session_id = session_res["sessionId"]

            await send("Page.enable", session_id=session_id)
            await send("Runtime.enable", session_id=session_id)
            await send("Emulation.setDeviceMetricsOverride", {
                "width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False
            }, session_id=session_id)

            await send("Page.navigate", {"url": "http://127.0.0.1:3000/"}, session_id=session_id)
            await asyncio.sleep(5)

            # Click on the center of the map where the flooded road loop is (x: 650, y: 350)
            print("Clicking road segment on canvas...")
            await send("Input.dispatchMouseEvent", {
                "type": "mousePressed", "x": 650, "y": 350, "button": "left", "clickCount": 1
            }, session_id=session_id)
            await send("Input.dispatchMouseEvent", {
                "type": "mouseReleased", "x": 650, "y": 350, "button": "left", "clickCount": 1
            }, session_id=session_id)

            await asyncio.sleep(2)

            res = await send("Page.captureScreenshot", {"format": "png"}, session_id=session_id)
            import base64
            img = base64.b64decode(res["data"])
            out = "/Users/chalermsak/.gemini/antigravity-ide/brain/cadca6c7-8f45-45c4-9939-b072b8078d46/road_detail_clicked.png"
            with open(out, "wb") as f:
                f.write(img)
            print(f"Saved road detail screenshot: {len(img)} bytes to {out}")

    finally:
        chrome_proc.terminate()

if __name__ == "__main__":
    asyncio.run(capture_detail())
