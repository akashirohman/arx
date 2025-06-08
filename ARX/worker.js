const { workerData, parentPort } = require('worker_threads');
const http = require('http');
const https = require('https');

const { id, url, rps, duration } = workerData;

let sent = 0;
let success = 0;
let failed = 0;

// Untuk mengirim delta tiap request, agar di agregat di main thread
let lastSent = 0;
let lastSuccess = 0;
let lastFailed = 0;

const protocol = url.startsWith('https') ? https : http;

function sendRequest() {
  const req = protocol.get(url, (res) => {
    // Consume response data to free memory
    res.on('data', () => {});
    res.on('end', () => {
      success++;
      reportStats();
    });
  });

  req.on('error', () => {
    failed++;
    reportStats();
  });

  req.end();
  sent++;
  reportStats();
}

function reportStats() {
  const sentDelta = sent - lastSent;
  const successDelta = success - lastSuccess;
  const failedDelta = failed - lastFailed;

  lastSent = sent;
  lastSuccess = success;
  lastFailed = failed;

  if (sentDelta > 0 || successDelta > 0 || failedDelta > 0) {
    parentPort.postMessage({
      stat: true,
      id,
      sentDelta,
      successDelta,
      failedDelta
    });
  }
}

const intervalMs = 1000 / rps;
const interval = setInterval(() => {
  sendRequest();
}, intervalMs);

setTimeout(() => {
  clearInterval(interval);
  process.exit(0);
}, duration * 1000);
