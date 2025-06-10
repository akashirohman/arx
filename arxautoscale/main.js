// main.js
const readline = require('readline');
const { Worker } = require('worker_threads');
const os = require('os');
const http = require('http');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let targets = [];
let currentTarget = null;
let targetId = 0;
let workers = [];
let running = false;
let statsMap = new Map();

function ask(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function checkTarget(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.abort();
      resolve(false);
    });
  });
}

async function main() {
  console.log('\x1b[36m%s\x1b[0m', 'Selamat datang di ARX - Advanced Request eXecutor');
  while (true) {
    const url = await ask('Target URL: ');
    targets.push({ url, id: targetId++, rps: 10, threads: 1 });
    currentTarget = targets[targets.length - 1];
    console.log(`[INFO] Testing target ${url}...`);
    const alive = await checkTarget(url);
    if (!alive) {
      console.log(`\x1b[31m[ERROR]\x1b[0m Target ${url} is unreachable.`);
      continue;
    }
    console.log(`[INFO] Target ${url} is live.`);
    startTarget(currentTarget);
    waitCommand();
    break;
  }
}

function startTarget(target) {
  running = true;
  for (let i = 0; i < target.threads; i++) {
    const worker = new Worker('./worker.js');
    worker.postMessage({ url: target.url, rps: target.rps });
    worker.on('message', msg => {
      if (!statsMap.has(target.id)) {
        statsMap.set(target.id, { sent: 0, success: 0, failed: 0 });
      }
      const s = statsMap.get(target.id);
      s.sent += msg.sent;
      s.success += msg.success;
      s.failed += msg.failed;
    });
    workers.push(worker);
  }
  monitor(target);
  printStats();
}

function stopTarget() {
  running = false;
  workers.forEach(w => w.terminate());
  workers = [];
  console.log(`\n\x1b[33m[STOPPED]\x1b[0m Target ${currentTarget.url}`);
}

function waitCommand() {
  rl.on('line', line => {
    const input = line.trim();
    if (input === 'stop') {
      stopTarget();
    } else if (input === 'next') {
      stopTarget();
      main();
    }
  });
}

function monitor(target) {
  setInterval(() => {
    if (!running) return;
    const cpuLoad = os.loadavg()[0] / os.cpus().length;
    if (cpuLoad < 0.8) {
      target.threads++;
      target.rps += 10;
      const worker = new Worker('./worker.js');
      worker.postMessage({ url: target.url, rps: target.rps });
      worker.on('message', msg => {
        const s = statsMap.get(target.id);
        s.sent += msg.sent;
        s.success += msg.success;
        s.failed += msg.failed;
      });
      workers.push(worker);
    }
  }, 30000);
}

function printStats() {
  setInterval(() => {
    if (!running) return;
    statsMap.forEach((s, id) => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`\x1b[32m[STATS #${id}]\x1b[0m Sent: ${s.sent} | Success: ${s.success} | Failed: ${s.failed}    `);
    });
    readline.moveCursor(process.stdout, 0, 1);
  }, 60000);
}

main();
