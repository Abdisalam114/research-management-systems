/**
 * First-time setup — works in VS Code CMD, PowerShell, and Git Bash.
 * From the repo root: npm run setup
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");
const frontend = path.join(root, "frontend");

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: true,
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed (exit ${code})`));
    });
  });
}

function copyEnvIfMissing() {
  const dest = path.join(backend, ".env");
  const src = path.join(backend, ".env.example");
  if (fs.existsSync(dest)) {
    console.log("backend/.env already exists — skipped copy.");
    return;
  }
  if (!fs.existsSync(src)) {
    throw new Error("backend/.env.example is missing.");
  }
  fs.copyFileSync(src, dest);
  console.log("Created backend/.env from .env.example");
}

async function main() {
  console.log("");
  console.log("=== Jamhuriya RMS setup ===");
  console.log("Repo:", root);
  console.log("");

  copyEnvIfMissing();

  console.log("Installing backend packages...");
  await run("npm", ["install"], backend);

  console.log("Installing frontend packages...");
  await run("npm", ["install"], frontend);

  console.log("");
  console.log("Seeding demo users (needs MongoDB running)...");
  try {
    await run("npm", ["run", "seed"], backend);
  } catch (err) {
    console.log("");
    console.log("Seed failed. Start MongoDB, then run:  npm run seed");
    console.log("Windows:  net start MongoDB");
    console.log("Or install MongoDB Community / MongoDB Atlas and set MONGO_URI in backend/.env");
    console.log("");
    throw err;
  }

  console.log("");
  console.log("Setup complete. Start the app with:  npm run dev");
  console.log("Then open:  http://localhost:5173");
  console.log("Login:  director@rms.edu   /   Director2024!");
  console.log("");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
