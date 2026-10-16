const { execSync } = require('child_process');

const ports = [8001, 5173];

for (const port of ports) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        // Ensure the local address actually matches the port
        if (parts.length >= 5 && (parts[1].endsWith(`:${port}`) || parts[1].includes(`:${port}`))) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && pid !== `${process.pid}`) {
            pids.add(pid);
          }
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
          console.log(`[Clean] Successfully freed port ${port} (killed lingering process ${pid})`);
        } catch (_) {}
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch (_) {
    // Port is free
  }
}
console.log('[Clean] Ports 8001 and 5173 are ready.');
