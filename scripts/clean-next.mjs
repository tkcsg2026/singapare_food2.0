/**
 * Remove .next (fixes EBUSY / "unable to rename" on Windows when cache is locked).
 *
 * Before building if you still see EBUSY:
 * 1. Stop `npm run dev` and any other `node` using this project.
 * 2. Close other apps that may scan the folder (optional: add project to AV exclusions).
 * 3. Run: npm run clean
 * 4. Run: npm run build
 *
 * Production build uses webpack by default (`npm run build`) to avoid Turbopack rename races on Windows.
 */
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".next");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function removeWithRetries() {
  const max = 8;
  for (let i = 0; i < max; i++) {
    try {
      if (!existsSync(dir)) {
        console.log(".next not found (nothing to clean)");
        return;
      }
      rmSync(dir, { recursive: true, force: true });
      console.log("Removed .next");
      return;
    } catch (e) {
      const code = e && e.code;
      if ((code === "EBUSY" || code === "EPERM" || code === "ENOTEMPTY") && i < max - 1) {
        console.warn(
          `.next is locked (${code}), retry ${i + 1}/${max} in 500ms… (stop dev server / close IDE preview)`
        );
        await sleep(500);
        continue;
      }
      throw e;
    }
  }
}

await removeWithRetries();
