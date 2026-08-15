/**
 * Start API + UI together — works in VS Code CMD, PowerShell, and Git Bash.
 * From the repo root: npm run dev
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");
const frontend = path.join(root, "frontend");
const children = [];

function hasModules(dir) {
  return fs.existsSync(path.join(dir, "node_modules"));
}

function start(name, cwd) {
  const child = spawn("npm", ["run", "dev"], {
    cwd,
    stdio: "inherit",
    shell: true,
    windowsHide: true,
  });
  child.on("error", (err) => {
    console.error(`[${name}]`, err.message);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`[${name}] stopped (${signal || code})`);
    shutdown(code || 0);
  });
  children.push(child);
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 400);
}

function main() {
  if (!hasModules(backend) || !hasModules(frontend)) {
    console.error("Packages are not installed. In this folder run:");
    console.error("  npm run setup");
    process.exit(1);
  }

  const envFile = path.join(backend, ".env");
  const example = path.join(backend, ".env.example");
  if (!fs.existsSync(envFile) && fs.existsSync(example)) {
    fs.copyFileSync(example, envFile);
    console.log("Created backend/.env from .env.example");
  }

  console.log("");
  console.log("Starting Jamhuriya RMS");
  console.log("  API:  http://localhost:5000");
  console.log("  App:  http://localhost:5173");
  console.log("Stop with Ctrl+C");
  console.log("");

  start("backend", backend);
  start("frontend", frontend);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main();
