import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const [, , command = "dev", ...args] = process.argv;
const nextArgs =
  command === "dev" && !args.includes("--webpack") && !args.includes("--turbopack")
    ? [command, "--webpack", ...args]
    : [command, ...args];

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_FORCE_MOCK: "true",
    WENLAN_FORCE_MOCK: "true",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[mock-runner] failed to start Next.js", error);
  process.exit(1);
});
