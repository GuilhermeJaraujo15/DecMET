import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const name = join(dir, entry.name);
    return entry.isDirectory() ? files(name) : /\.(js|cjs)$/.test(name) ? [name] : [];
  });
}
const targets = ["api", "backend", "public/js", "tests", "scripts"].flatMap(files);
for (const filename of targets) {
  const result = spawnSync(process.execPath, ["--check", filename], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax OK: ${targets.length} JavaScript files`);
