// worker.js
const { parentPort, workerData } = require('worker_threads');
const http = require('http');
const https = require('https');

const { target, rps } = workerData;

let shouldStop = false;

parentPort.on('message', (msg) => {
  if (msg === 'stop') shouldStop = true;
});

const agent = target.startsWith('https')
  ? new https.Agent({ keepAlive: true })
  : new http.Agent({ keepAlive: true });

function sendRequest(callback) {
  const mod = target.startsWith('https') ? https : http;

  const req = mod.get(target, { agent }, (res) => {
    res.on('data', () => {});
    res.on('end', () => callback(true));
  });

  req.on('error', () => callback(false));
  req.setTimeout(3000, () => {
    req.destroy();
    callback(false);
  });
}

function loop() {
  if (shouldStop) return;

  let sent = 0, success = 0, failed = 0;
  const interval = setInterval(() => {
    for (let i = 0; i < rps; i++) {
      if (shouldStop) break;
      sendRequest((ok) => {
        sent++;
        if (ok) success++;
        else failed++;
      });
    }
  }, 1000);

  const statTimer = setInterval(() => {
    if (shouldStop) {
      clearInterval(interval);
      clearInterval(statTimer);
      return;
    }
    parentPort.postMessage({ sent, success, failed });
  }, 60000);
}

loop();
