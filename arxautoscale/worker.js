// worker.js
const { parentPort } = require('worker_threads');
const http = require('http');

let stop = false;

parentPort.on('message', ({ url, rps }) => {
  const interval = 1000 / rps;
  const agent = new http.Agent({ keepAlive: true });

  async function sendRequest() {
    if (stop) return;
    let sent = 0, success = 0, failed = 0;
    const promises = [];

    for (let i = 0; i < rps; i++) {
      promises.push(new Promise(resolve => {
        const req = http.get(url, { agent }, res => {
          res.resume();
          res.on('end', () => {
            success++;
            resolve();
          });
        });
        req.on('error', () => {
          failed++;
          resolve();
        });
        req.setTimeout(5000, () => {
          req.abort();
          failed++;
          resolve();
        });
        sent++;
      }));
    }

    await Promise.all(promises);
    parentPort.postMessage({ sent, success, failed });
    setTimeout(sendRequest, 1000);
  }

  sendRequest();
});
