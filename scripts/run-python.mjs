// Runs a Python script with whichever interpreter exists: python3 (Linux/macOS)
// or python / py (Windows, where python3 is often a Microsoft Store stub).
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
for (const cmd of ["python3", "python", "py"]) {
  const probe = spawnSync(cmd, ["-c", "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"], { stdio: "ignore" });
  if (probe.status !== 0) continue;
  const run = spawnSync(cmd, args, { stdio: "inherit" });
  process.exit(run.status ?? 1);
}
console.error("Python 3.8+ not found. Install Python 3 and make sure python3 or python is on PATH.");
process.exit(1);
