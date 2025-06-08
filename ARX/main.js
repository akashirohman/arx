const readline = require('readline');
const { Worker } = require('worker_threads');
const path = require('path');

let targetQueue = [];
let isRunning = false;
let workerStats = {};
let targetStats = {};

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

function displayStatsInline() {
  let totalSent = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  Object.values(workerStats).forEach(stat => {
    totalSent += stat.sent;
    totalSuccess += stat.success;
    totalFailed += stat.failed;
  });

  process.stdout.write(`\r[STATS] Sent: ${totalSent} | Success: ${totalSuccess} | Failed: ${totalFailed}               `);
}

function runNextTarget() {
  if (targetQueue.length === 0) return;

  const target = targetQueue.shift();
  const currentTargetUrl = target.url;
  isRunning = true;
  console.log(`\n[INFO] Starting attack on ${currentTargetUrl} for ${target.duration}s with ${target.threads} threads at ${target.rps} RPS.`);

  let activeThreads = 0;
  workerStats = {};

  for (let i = 0; i < target.threads; i++) {
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
      workerData: {
        id: i,
        url: currentTargetUrl,
        rps: Math.floor(target.rps / target.threads),
        duration: target.duration
      }
    });

    workerStats[i] = { sent: 0, success: 0, failed: 0 };
    activeThreads++;

    worker.on('message', (msg) => {
      if (msg.done) {
        activeThreads--;
        if (activeThreads === 0) {
          process.stdout.write('\n');

          // Simpan statistik per-target
          let totalSent = 0, totalSuccess = 0, totalFailed = 0;
          Object.values(workerStats).forEach(stat => {
            totalSent += stat.sent;
            totalSuccess += stat.success;
            totalFailed += stat.failed;
          });

          targetStats[currentTargetUrl] = {
            sent: totalSent,
            success: totalSuccess,
            failed: totalFailed
          };

          console.log(`[INFO] Completed target: ${currentTargetUrl}`);
          console.log(`[RESULT] Sent: ${totalSent}, Success: ${totalSuccess}, Failed: ${totalFailed}\n`);

          isRunning = false;
          if (targetQueue.length > 0) runNextTarget();
          else {
            promptTarget();
          }
        }
      } else if (msg.stat) {
        workerStats[msg.id] = {
          sent: msg.sent,
          success: msg.success,
          failed: msg.failed
        };
      }
    });

    worker.on('error', (err) => {
      console.error(`[ERROR] Worker error: ${err.message}`);
    });
  }

  const statInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(statInterval);
      return;
    }
    displayStatsInline();
  }, 1000);
}

console.log(`\nSelamat datang di ARX - Advanced Request eXecutor`);
promptTarget();

rl.on('line', (input) => {
  if (input.trim().toLowerCase() === 'next') {
    promptTarget();
  } else if (input.trim().toLowerCase() === 'stop') {
    console.log('\n[INFO] Stopping input. Current queue will finish.');
    rl.close();
  }
});
