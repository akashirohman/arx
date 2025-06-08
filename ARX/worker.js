// worker.js
const { parentPort, workerData } = require('worker_threads');
const http = require('http');
const https = require('https');
const urlLib = require('url');

const { url, rps, duration, index, statsInterval } = workerData;
const endTime = Date.now() + duration * 1000;

let sent = 0;
let success = 0;
let failed = 0;

const { protocol } = urlLib.parse(url);
const agent = protocol === 'https:' ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true });
const lib = protocol === 'https:' ? https : http;

function sendRequest() {
  const req = lib.get(url, { agent }, (res) => {
    res.on('data', () => {});
    res.on('end', () => { success++; });
  });

  req.on('error', () => { failed++; });
  req.end();
  sent++;
}

function scheduleRequest() {
  if (Date.now() >= endTime) return;
  sendRequest();
  setTimeout(scheduleRequest, 1000 / rps);
}

setInterval(() => {
  parentPort.postMessage({ type: 'stats', sent, success, failed, index });
  sent = 0; success = 0; failed = 0;
}, statsInterval * 60000);

scheduleRequest();
