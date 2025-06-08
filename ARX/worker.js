const { workerData, parentPort } = require('worker_threads');
const http = require('http');
const https = require('https');

const { id, url, rps, duration } = workerData;

let sent = 0;
let success = 0;
let failed = 0;

const protocol = url.startsWith('https') ? https : http;

function sendRequest() {
  const req = protocol.get(url, (res) => {
    res.on('data', () => {}); // consume data to free memory
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
  parentPort.postMessage({
    stat: true,
    id,
    sent,
    success,
    failed
  });
}

const intervalTime = 1000 / rps;
const interval = setInterval(() => {
  sendRequest();
}, intervalTime);

setTimeout(() => {
  clearInterval(interval);
  parentPort.postMessage({ done: true, id });
}, duration * 1000);
