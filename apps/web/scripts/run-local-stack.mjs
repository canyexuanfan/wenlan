import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const webRoot = path.resolve(path.dirname(scriptPath), "..");
const repoRoot = path.resolve(webRoot, "..", "..");
const stackDir = path.resolve(repoRoot, "infra", "supabase", "runtime", "official-stack");
const composeFile = path.resolve(stackDir, "docker-compose.yml");
const wenlanSqlDir = path.resolve(stackDir, "wenlan", "sql");
const envFile = path.resolve(webRoot, ".env.local");
const nextBin = path.resolve(webRoot, "node_modules", "next", "dist", "bin", "next");

const [command = "dev", ...extraArgs] = process.argv.slice(2);

const dockerCandidates = [
  process.env.DOCKER_BIN,
  "E:\\Program\\Docker\\Docker\\resources\\bin\\docker.exe",
  "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
  "C:\\Program Files\\Docker\\Docker\\resources\\com.docker.cli.exe",
  "docker",
].filter(Boolean);

const dockerDesktopCandidates = [
  process.env.DOCKER_DESKTOP_BIN,
  "E:\\Program\\Docker\\Docker\\Docker Desktop.exe",
  "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
].filter(Boolean);

function log(message) {
  console.log(`[local-stack] ${message}`);
}

function fail(message) {
  console.error(`[local-stack] ${message}`);
  process.exit(1);
}

function readDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const result = {};
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function run(commandPath, args, options = {}) {
  return spawnSync(commandPath, args, {
    cwd: webRoot,
    encoding: "utf8",
    ...options,
  });
}

function envWithDockerPath(dockerBin) {
  const isPath = dockerBin.includes("\\") || dockerBin.includes("/");
  if (!isPath) {
    return process.env;
  }

  const dockerDir = path.dirname(dockerBin);
  return {
    ...process.env,
    PATH: `${dockerDir}${path.delimiter}${process.env.PATH || ""}`,
    Path: `${dockerDir}${path.delimiter}${process.env.Path || ""}`,
  };
}

function canUseDocker(dockerBin) {
  const result = run(dockerBin, ["version", "--format", "{{.Server.Version}}"]);
  return result.status === 0 && Boolean(result.stdout.trim());
}

function findDocker() {
  for (const candidate of dockerCandidates) {
    const isPath = candidate.includes("\\") || candidate.includes("/");
    if (isPath && !existsSync(candidate)) {
      continue;
    }

    if (canUseDocker(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDocker() {
  const found = findDocker();
  if (found) {
    return found;
  }

  const desktopBin = dockerDesktopCandidates.find((candidate) => existsSync(candidate));
  if (desktopBin) {
    log("Docker engine is not ready; starting Docker Desktop...");
    spawn(desktopBin, [], {
      detached: true,
      stdio: "ignore",
    }).unref();

    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(2000);
      const dockerBin = findDocker();
      if (dockerBin) {
        return dockerBin;
      }
    }
  }

  fail(
    "Docker is not available. Start Docker Desktop, or set DOCKER_BIN to docker.exe."
  );
}

function ensureComposeStack(dockerBin) {
  if (!existsSync(composeFile)) {
    fail(`Supabase compose file was not found: ${composeFile}`);
  }

  log("Starting local Supabase with Docker Compose...");
  const result = run(dockerBin, ["compose", "-f", composeFile, "up", "-d"], {
    cwd: stackDir,
    env: envWithDockerPath(dockerBin),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    fail("Docker Compose failed to start local Supabase.");
  }
}

function runDocker(dockerBin, args, options = {}) {
  return spawnSync(dockerBin, args, {
    cwd: stackDir,
    encoding: "utf8",
    env: envWithDockerPath(dockerBin),
    ...options,
  });
}

function applySql(dockerBin, sqlFile) {
  const sqlPath = path.resolve(wenlanSqlDir, sqlFile);
  if (!existsSync(sqlPath)) {
    fail(`Wenlan SQL file was not found: ${sqlPath}`);
  }

  const result = runDocker(
    dockerBin,
    ["exec", "-i", "supabase-db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    {
      input: readFileSync(sqlPath, "utf8"),
    },
  );

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    fail(`Failed to apply SQL file: ${sqlFile}`);
  }
}

function applyDatabaseBootstrap(dockerBin) {
  const schemaCheck = runDocker(dockerBin, [
    "exec",
    "supabase-db",
    "psql",
    "-t",
    "-A",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-c",
    "select to_regclass('app.site_settings') is not null;",
  ]);

  if (schemaCheck.status !== 0) {
    console.error(schemaCheck.stderr || schemaCheck.stdout);
    fail("Could not inspect local Supabase schema.");
  }

  log("Applying Wenlan database bootstrap...");
  if (schemaCheck.stdout.trim() !== "t") {
    applySql(dockerBin, "001_wenlan_v1_schema.sql");
  }

  for (const sqlFile of [
    "002_storage_bootstrap.sql",
    "003_postgrest_permissions.sql",
    "004_login_content_policies.sql",
    "005_document_render_mode.sql",
    "006_access_driven_visibility.sql",
    "007_document_render_cache.sql",
    "009_share_visibility_and_root_documents.sql",
  ]) {
    applySql(dockerBin, sqlFile);
  }
}

async function waitForSupabase(supabaseUrl, anonKey) {
  const restUrl = new URL("/rest/v1/", supabaseUrl).toString();
  const authHealthUrl = new URL("/auth/v1/health", supabaseUrl).toString();
  const headers = anonKey
    ? {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      }
    : {};

  log(`Waiting for Supabase at ${supabaseUrl}...`);
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(restUrl, { headers });
      if (response.status < 500) {
        log("Supabase REST is reachable.");
        return;
      }
    } catch {
      // Try auth health below; early startup often refuses the REST request.
    }

    try {
      const response = await fetch(authHealthUrl);
      if (response.status < 500) {
        log("Supabase gateway is reachable.");
        return;
      }
    } catch {
      // Keep waiting.
    }

    await sleep(1000);
  }

  fail(`Supabase did not become reachable at ${supabaseUrl}.`);
}

function runNext(supabaseUrl, envValues) {
  if (!existsSync(nextBin)) {
    fail("Next.js is not installed. Run npm install in apps/web first.");
  }

  const nextArgs =
    command === "dev" && !extraArgs.includes("--webpack") && !extraArgs.includes("--turbopack")
      ? [nextBin, "dev", "--webpack", ...extraArgs]
      : [nextBin, command, ...extraArgs];

  log(`Using Supabase URL: ${supabaseUrl}`);
  log(command === "dev" ? "Starting Next.js at http://127.0.0.1:3000 ..." : `Running next ${command} ...`);

  const child = spawn(process.execPath, nextArgs, {
    cwd: webRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      ...envValues,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_FORCE_MOCK: "false",
      WENLAN_FORCE_MOCK: "false",
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

async function main() {
  const envValues = readDotEnv(envFile);
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    envValues.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:18000";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    envValues.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  const dockerBin = await ensureDocker();
  ensureComposeStack(dockerBin);
  await waitForSupabase(supabaseUrl, anonKey);
  applyDatabaseBootstrap(dockerBin);

  if (command === "supabase") {
    log("Local Supabase is ready.");
    return;
  }

  runNext(supabaseUrl, envValues);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
