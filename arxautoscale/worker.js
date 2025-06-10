// worker.js

const { parentPort, workerData } = require("worker_threads");
const http = require("http");
const https = require("https");

const target = workerData.target;
const rps = workerData.rps;
const keepAliveAgent = target.startsWith("https")
  ? new https.Agent({ keepAlive: true })
  : new http.Agent({ keepAlive: true });

let sent = 0;
let success = 0;
let failed = 0;
let shouldStop = false;

parentPort.on("message", (msg) => {
  if (msg === "stop") shouldStop = true;
});

const makeRequest = () => {
  const lib = target.startsWith("https") ? https : http;
  const req = lib.get(
    target,
    {
      agent: keepAliveAgent,
      timeout: 5000,
    },
    (res) => {
      res.on("data", () => {});
      res.on("end", () => {
        success++;
      });
    }
  );

  req.on("error", () => failed++);
  req.on("timeout", () => {
    req.destroy();
    failed++;
  });

  req.end();
  sent++;
};

const run = async () => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const interval = Math.floor(1000 / rps);

  while (!shouldStop) {
    const start = Date.now();
    for (let i = 0; i < rps; i++) makeRequest();
    const elapsed = Date.now() - start;
    if (elapsed < 1000) await delay(1000 - elapsed);
  }
};

setInterval(() => {
  parentPort.postMessage({
    type: "stats",
    sent,
    success,
    failed,
  });
  sent = success = failed = 0;
}, 60000);

run();
