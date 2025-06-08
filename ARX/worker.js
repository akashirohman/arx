const { workerData, parentPort } = require('worker_threads');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const { url, rps, duration } = workerData;
const parsedUrl = new URL(url);
const client = parsedUrl.protocol === 'https:' ? https : http;

let stop = false;
const interval = 1000 / rps;
const endTime = Date.now() + duration * 1000;

function sendRequest() {
  if (Date.now() >= endTime || stop) {
    parentPort.postMessage({ done: true });
    return;
  }

  const req = client.request({
    method: 'GET',
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    timeout: 2000,
  }, res => {
    res.on('data', () => {});
    res.on('end', () => {});
  });

  req.on('error', () => {});
  req.end();

  setTimeout(sendRequest, interval);
}

sendRequest();
