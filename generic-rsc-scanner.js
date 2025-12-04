#!/usr/bin/env node

/**
 * Generic React Server Components scanner.
 *
 * ✔ Recursively list ALL folders
 * ✔ For each folder: show whether package.json is present
 * ✔ If package.json exists, check for:
 *      - react
 *      - react@19+
 *      - next
 *      - react-server-dom-webpack
 *      - RSC "use server" markers in JS/TS files
 * ✔ Output SAFE (✔️) or POSSIBLY VULNERABLE (❌)
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const ROOT = process.argv[2] || process.cwd();

const CODE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const SKIP_DIRS = new Set(["node_modules", ".git", "vendor", "dist", "build", ".next"]);

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

async function readJsonSafe(filePath) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

/** Recursively walk all directories */
async function getAllFolders(startDir) {
  const folders = [];
  const stack = [startDir];

  while (stack.length) {
    const current = stack.pop();
    folders.push(current);

    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const item of entries) {
      if (!item.isDirectory()) continue;
      if (SKIP_DIRS.has(item.name)) continue;

      stack.push(path.join(current, item.name));
    }
  }

  return folders;
}

/** Collect JS/TS sources to scan */
async function getCodeFiles(dir) {
  const files = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();

    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const item of entries) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        if (!SKIP_DIRS.has(item.name)) stack.push(full);
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (CODE_EXTENSIONS.includes(ext)) files.push(full);
      }
    }
  }

  return files;
}

async function hasRSCMarkers(file) {
  try {
    const content = await fsp.readFile(file, "utf8");
    return (
      content.includes('"use server"') ||
      content.includes("'use server'") ||
      content.includes("react-server-dom-webpack")
    );
  } catch {
    return false;
  }
}

/** Analyze a folder containing package.json */
async function analyzePackage(dir) {
  const pkg = await readJsonSafe(path.join(dir, "package.json"));
  if (!pkg) {
    return { vulnerable: false, reason: "Invalid or unreadable package.json" };
  }

  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  if (deps.next) {
    return { vulnerable: true, reason: `Next.js detected (${deps.next})` };
  }

  if (deps["react-server-dom-webpack"]) {
    return { vulnerable: true, reason: "react-server-dom-webpack detected" };
  }

  if (deps.react) {
    const major = parseInt(String(deps.react).split(".")[0], 10);
    if (major >= 19) {
      return { vulnerable: true, reason: `React ${deps.react} (19+) detected` };
    }
  }

  const files = await getCodeFiles(dir);
  for (const file of files) {
    if (await hasRSCMarkers(file)) {
      return {
        vulnerable: true,
        reason: `"use server" / RSC markers detected in ${path.relative(dir, file)}`
      };
    }
  }

  return { vulnerable: false, reason: "No RSC indicators found" };
}

// -----------------------------------------------------------
// Main
// -----------------------------------------------------------

async function main() {
  console.log("\n🔍 Generic React Surface Scanner");
  console.log("Root directory:", ROOT, "\n");

  const folders = await getAllFolders(ROOT);
  const results = [];

  for (const folder of folders) {
    const pkgPath = path.join(folder, "package.json");
    const hasPkg = fs.existsSync(pkgPath);

    if (!hasPkg) {
      results.push({
        folder,
        hasPackageJson: false,
        vulnerable: false,
        reason: "No package.json found"
      });
      continue;
    }

    const analysis = await analyzePackage(folder);
    results.push({
      folder,
      hasPackageJson: true,
      vulnerable: analysis.vulnerable,
      reason: analysis.reason
    });
  }

  console.log("======== Scan Results ========\n");

  results.forEach(r => {
    const mark = r.vulnerable ? "❌" : "✔️";
    console.log(`${mark} ${r.folder}`);
    console.log(`    package.json: ${r.hasPackageJson ? "Yes" : "No"}`);
    console.log(`    Reason: ${r.reason}\n`);
  });

  console.log("==============================\n");

  const vulnerableCount = results.filter(r => r.vulnerable).length;
  if (vulnerableCount === 0) {
    console.log("✔️ All scanned folders appear SAFE.\n");
  } else {
    console.log(`❌ ${vulnerableCount} folder(s) may be vulnerable.\n`);
  }
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

