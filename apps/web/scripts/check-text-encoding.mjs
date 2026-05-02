import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rootsToScan = ["src", "scripts", "next.config.ts", "package.json"];
const allowedExtensions = new Set([
  ".css",
  ".env",
  ".example",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".scss",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const skippedDirectories = new Set([".git", ".next", "node_modules"]);
const skippedFiles = /(?:package-lock|pnpm-lock|yarn\.lock|\.tsbuildinfo|\.log|\.gz)$/;

// Catches replacement characters, private-use glyphs and common UTF-8/GBK mojibake fragments.
const mojibakePattern =
  /[\uFFFD\uE000-\uF8FF\u00C2\u00C3\u00E2\u20AC\u9286\u934F\u935A\u9396\u93B4\u93C2\u93C9\u941E\u9422\u9427\u9428\u951B]/u;
const quotedTextPattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;

function decodeEscapedString(value) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\`/g, "`");
}

function hasPlaceholderQuestionMarks(line) {
  let match;

  quotedTextPattern.lastIndex = 0;
  while ((match = quotedTextPattern.exec(line))) {
    const text = decodeEscapedString(match[1] ?? match[2] ?? match[3] ?? "");
    const compact = text.replace(/\s/g, "");

    if (/^\?{2,}$/.test(compact) || /\?{3,}/.test(text)) {
      return true;
    }
  }

  return false;
}

function shouldScanFile(filePath) {
  if (skippedFiles.test(filePath)) {
    return false;
  }

  const name = path.basename(filePath);

  if (name.startsWith(".env")) {
    return true;
  }

  return allowedExtensions.has(path.extname(name));
}

function collectFiles(targetPath, files) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stat = fs.statSync(targetPath);

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      if (entry.isDirectory() && skippedDirectories.has(entry.name)) {
        continue;
      }

      collectFiles(path.join(targetPath, entry.name), files);
    }

    return;
  }

  if (shouldScanFile(targetPath)) {
    files.push(targetPath);
  }
}

const files = [];
for (const scanRoot of rootsToScan) {
  collectFiles(path.join(root, scanRoot), files);
}

const findings = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (mojibakePattern.test(line) || hasPlaceholderQuestionMarks(line)) {
      findings.push({
        file: path.relative(root, file),
        line: index + 1,
        text: line.trim().slice(0, 180),
      });
    }
  });
}

if (findings.length > 0) {
  console.error("Possible mojibake or invalid UTF-8 text found:");

  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}: ${finding.text}`);
  }

  process.exit(1);
}

console.log(`Text encoding check passed (${files.length} files scanned).`);
