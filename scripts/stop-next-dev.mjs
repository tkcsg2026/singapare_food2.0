/**
 * Stops the process listening on the Next dev port (default 3000) and removes
 * `.next/dev/lock` so `npm run dev` can start again.
 *
 * Use when you see:
 *   Unable to acquire lock at .next/dev/lock, is another instance of next dev running?
 *
 * Run: npm run dev:stop
 * Then: npm run dev
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const ports = (process.env.DEV_STOP_PORTS || "3000,3001")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

function killListenersOnPortWin(port) {
  try {
    const out = execSync(`netstat -ano -p tcp`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
        console.log(`Stopped process ${pid} (was listening on port ${port}).`);
      } catch {
        console.warn(`Could not stop PID ${pid} (may need admin or already exited).`);
      }
    }
    if (pids.size === 0) {
      console.log(`No LISTENING process found on port ${port}.`);
    }
  } catch (e) {
    console.warn(`Port ${port}: ${e?.message || e}`);
  }
}

if (process.platform === "win32") {
  for (const port of ports) {
    killListenersOnPortWin(port);
  }
} else {
  try {
    const out = execSync(`lsof -ti:${ports[0]}`, { encoding: "utf8" }).trim();
    if (out) {
      for (const pid of out.split("\n")) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: "inherit" });
          console.log(`Stopped process ${pid}.`);
        } catch {}
      }
    }
  } catch {
    console.log(`No process found on port ${ports[0]} (lsof).`);
  }
}

const lockPath = join(process.cwd(), ".next", "dev", "lock");
if (existsSync(lockPath)) {
  try {
    rmSync(lockPath, { force: true });
    console.log("Removed .next/dev/lock");
  } catch (e) {
    console.warn(`Could not remove lock file: ${e?.message || e}`);
  }
} else {
  console.log("No .next/dev/lock file (already clean).");
}
