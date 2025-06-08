const readline = require('readline');
const { Worker } = require('worker_threads');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let targetId = 0;
const activeTargets = new Map();
const baseLine = 5; // mulai baris ke-5 untuk statistik supaya ada ruang input

function promptTargetInput() {
  rl.question('Target URL: ', (url) => {
    rl.question('Threads (default 10): ', (threads) => {
      rl.question('RPS (default 100): ', (rps) => {
        rl.question('Duration in seconds (default 30): ', (duration) => {
          startTarget({
            id: targetId++,
            url,
            threads: parseInt(threads) || 10,
            rps: parseInt(rps) || 100,
            duration: parseInt(duration) || 30
          });
          rl.prompt();
        });
      });
    });
  });
}

function startTarget(target) {
  console.log(`\n[INFO] Starting target #${target.id} -> ${target.url} | Threads: ${target.threads}, RPS: ${target.rps}, Duration: ${target.duration}s`);

  let stats = {};
  for (let i = 0; i < target.threads; i++) {
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
      workerData: {
        id: i,
        url: target.url,
        rps: Math.floor(target.rps / target.threads),
        duration: target.duration
      }
    });

    stats[i] = { sent: 0, success: 0, failed: 0 };

    worker.on('message', (msg) => {
      if (msg.stat) {
        stats[msg.id] = {
          sent: msg.sent,
          success: msg.success,
          failed: msg.failed
        };
      } else if (msg.done) {
        stats[msg.id].done = true;
      }
    });

    worker.on('error', (err) => {
      console.error(`[ERROR] Worker error target#${target.id}: ${err.message}`);
    });
  }

  activeTargets.set(target.id, { target, stats });

  const interval = setInterval(() => {
    if (!activeTargets.has(target.id)) {
      clearInterval(interval);
      return;
    }
    printStats(target.id);
  }, 1000);

  setTimeout(() => {
    clearInterval(interval);
    printStats(target.id, true);
    activeTargets.delete(target.id);
    console.log(`[INFO] Target #${target.id} finished.`);
  }, target.duration * 1000);
}

function printStats(targetId, final = false) {
  const entry = activeTargets.get(targetId);
  if (!entry) return;

  const { target, stats } = entry;
  let totalSent = 0, totalSuccess = 0, totalFailed = 0;
  Object.values(stats).forEach(s => {
    totalSent += s.sent || 0;
    totalSuccess += s.success || 0;
    totalFailed += s.failed || 0;
  });

  const line = baseLine + targetId;

  // Simpan posisi cursor sekarang
  readline.cursorTo(process.stdout, 0);
  readline.moveCursor(process.stdout, 0, -(process.stdout.rows - line));

  // Tulis statistik dan pad kanan supaya bersih
  const statText = `[STATS][Target #${targetId}] Sent: ${totalSent} | Success: ${totalSuccess} | Failed: ${totalFailed}   `;
  process.stdout.write(statText);

  // Kembalikan cursor ke prompt input
  readline.cursorTo(process.stdout, 0);
  readline.moveCursor(process.stdout, 0, process.stdout.rows - line);

  if (final) {
    console.log(`\n[RESULT] Target #${targetId} -> ${target.url}`);
    console.log(`Sent: ${totalSent}, Success: ${totalSuccess}, Failed: ${totalFailed}\n`);
  }
}

console.log('Selamat datang di ARX - Advanced Request eXecutor');
promptTargetInput();

rl.setPrompt('Command (next/stop): ');
rl.prompt();

rl.on('line', (input) => {
  const cmd = input.trim().toLowerCase();
  if (cmd === 'next') {
    promptTargetInput();
  } else if (cmd === 'stop') {
    console.log('\n[INFO] Stopping input. All running targets will finish.');
    rl.close();
  } else {
    rl.prompt();
  }
});
