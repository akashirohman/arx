const { parentPort, workerData } = require('worker_threads');
const http = require('http');
const https = require('https');
const url = require('url');

const { id, url: targetUrl, rps, duration } = workerData;

let sent = 0;
let success = 0;
let failed = 0;

function sendRequest() {
  const parsed = url.parse(targetUrl);
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.path || '/',
    method: 'GET',
    timeout: 5000
  };

  const lib = parsed.protocol === 'https:' ? https : http;

  const req = lib.request(options, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      success++;
    });
  });

  req.on('error', () => {
    failed++;
  });

  req.on('timeout', () => {
    req.abort();
    failed++;
  });

  req.end();
  sent++;
}

const interval = setInterval(() => {
  for (let i = 0; i < rps; i++) {
    sendRequest();
  }
  parentPort.postMessage({ id, stat: true, sent, success, failed });
}, 1000);

setTimeout(() => {
  clearInterval(interval);
  parentPort.postMessage({ id, done: true });
}, duration * 1000);
