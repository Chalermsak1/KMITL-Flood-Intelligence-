const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const url = process.argv[2] || 'http://localhost:3000/';
  const outputPath = process.argv[3] || '/tmp/screen.png';
  const width = parseInt(process.argv[4] || '1440', 10);
  const height = parseInt(process.argv[5] || '900', 10);

  console.log(`Launching Chrome for ${url} -> ${outputPath} (${width}x${height})...`);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    `--window-size=${width},${height}`,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  // Get WebSocket debugger URL
  const versionData = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/version', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const wsUrl = versionData.webSocketDebuggerUrl;
  console.log('Connected to Chrome DevTools WebSocket:', wsUrl);

  const WebSocket = require('ws');
  const ws = new WebSocket(wsUrl);

  await new Promise(r => ws.on('open', r));

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Create new page target
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  function sendSession(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, sessionId, method, params }));
    });
  }

  await sendSession('Page.enable');
  await sendSession('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768
  });

  console.log(`Navigating to ${url}...`);
  await sendSession('Page.navigate', { url });

  // Wait 4 seconds for full React hydration and MapLibre rendering
  await new Promise(r => setTimeout(r, 4000));

  console.log('Capturing screenshot...');
  const { data } = await sendSession('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outputPath, Buffer.from(data, 'base64'));
  console.log(`Screenshot saved successfully (${fs.statSync(outputPath).size} bytes) -> ${outputPath}`);

  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('CDP screenshot failed:', err);
  process.exit(1);
});
