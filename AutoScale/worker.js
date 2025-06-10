// worker.js

const { parentPort, workerData } = require("worker_threads");
const http = require("http");
const https = require("https");

const target = workerData.target || "http://localhost";
let rps = workerData.rps || 1;
const keepAliveAgent = target.startsWith("https")
  ? new https.Agent({ keepAlive: true, maxSockets: 200 })
  : new http.Agent({ keepAlive: true, maxSockets: 200 });

let sent = 0;
let success = 0;
let failed = 0;
let statusCodes = {};
let shouldStop = false;

parentPort.on("message", (msg) => {
  if (msg === "stop") shouldStop = true;
  if (msg.type === "updateRPS") rps = msg.rps;
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
      const code = res.statusCode;
      statusCodes[code] = (statusCodes[code] || 0) + 1;
      res.on("data", () => {});
      res.on("end", () => {
        if (code >= 200 && code < 400) success++;
        else failed++;
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
  while (!shouldStop) {
    const start = Date.now();
    for (let i = 0; i < rps; i++) {
      setImmediate(makeRequest);
    }
    const elapsed = Date.now() - start;
    if (elapsed < 1000) await delay(1000 - elapsed);
  }
};

// Kirim statistik setiap detik
setInterval(() => {
  parentPort.postMessage({
    type: "stats",
    sent,
    success,
    failed,
    codes: statusCodes,
  });
  statusCodes = {};
}, 60000);

// Proteksi failover otomatis
process.on("uncaughtException", (err) => {
  parentPort.postMessage({ type: "error", error: err.message });
});

run();
