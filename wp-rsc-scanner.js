#!/usr/bin/env node

/**
 * Scan WordPress plugins and themes for React Server Components usage.
 *
 * ✔ Recursively looks for package.json inside each plugin/theme
 * ✔ For every package.json found:
 *    - checks dependencies (react, next, react-server-dom-webpack, React 19+)
 *    - scans that package folder for "use server" / react-server-dom-webpack
 * ✔ Outputs ✔️ SAFE or ❌ POSSIBLY VULNERABLE per package path
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const ROOT = process.argv[2] || process.cwd();

const CONTENT = path.join(ROOT, "wp-content");
const PLUGINS = path.join(CONTENT, "plugins");
const THEMES = path.join(CONTENT, "themes");

const CODE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const SKIP_DIRS = new Set(["node_modules", ".git", "vendor", "build", "dist", ".next"]);

// ---------- UTILITIES ----------

async function readJsonSafe(filePath) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function collectFilesRecursively(dir) {
  const result = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    let items;

    try {
      items = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const item of items) {
      const full = path.join(current, item.name);

      if (item.isDirectory()) {
        if (!SKIP_DIRS.has(item.name)) {
          stack.push(full);
        }
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (CODE_EXTENSIONS.includes(ext)) {
          result.push(full);
        }
      }
    }
  }

  return result;
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

/**
 * Find all directories under rootDir (including rootDir) that contain a package.json
 */
async function findAllPackageDirs(rootDir) {
  const packageDirs = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();

    // If this dir has a package.json, record it
    const pkgPath = path.join(current, "package.json");
    if (fs.existsSync(pkgPath)) {
      packageDirs.push(current);
      // We still continue deeper, in case of nested packages
    }

    let items;
    try {
      items = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const item of items) {
      if (!item.isDirectory()) continue;
      if (SKIP_DIRS.has(item.name)) continue;
      const full = path.join(current, item.name);
      stack.push(full);
    }
  }

  return packageDirs;
}

/**
 * Analyze one package.json located in dir
 */
async function analyzePackageDir(dir) {
  const pkgPath = path.join(dir, "package.json");

  if (!fs.existsSync(pkgPath)) {
    return {
      hasPackageJson: false,
      vulnerable: false,
      reason: "No package.json found",
    };
  }

  const pkg = await readJsonSafe(pkgPath);
  if (!pkg) {
    return {
      hasPackageJson: true,
      vulnerable: false,
      reason: "Invalid package.json (cannot parse JSON)",
    };
  }

  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const hasReact = Boolean(deps.react);
  const hasNext = Boolean(deps.next);
  const hasRSDW = Boolean(deps["react-server-dom-webpack"]);

  if (hasNext) {
    return {
      hasPackageJson: true,
      vulnerable: true,
      reason: `Next.js dependency detected ("next": "${deps.next}")`,
    };
  }

  if (hasRSDW) {
    return {
      hasPackageJson: true,
      vulnerable: true,
      reason: `react-server-dom-webpack dependency detected ("react-server-dom-webpack": "${deps["react-server-dom-webpack"]}")`,
    };
  }

  if (hasReact) {
    try {
      const major = parseInt(String(deps.react).split(".")[0].replace(/[^0-9]/g, ""), 10);
      if (!Number.isNaN(major) && major >= 19) {
        return {
          hasPackageJson: true,
          vulnerable: true,
          reason: `React ${deps.react} (19+) detected`,
        };
      }
    } catch {
      // ignore parsing issues
    }
  }

  // If none of the dependency-based indicators are present, do a code scan
  const files = await collectFilesRecursively(dir);
  for (const file of files) {
    if (await hasRSCMarkers(file)) {
      return {
        hasPackageJson: true,
        vulnerable: true,
        reason: `RSC-like markers (e.g. "use server") found in ${path.relative(dir, file)}`,
      };
    }
  }

  return {
    hasPackageJson: true,
    vulnerable: false,
    reason: "No RSC indicators found in this package",
  };
}

// ---------- MAIN SCAN HELPERS ----------

async function scanContainerFolder(containerPath, label) {
  console.log(`\n📂 Scanning ${label}: ${containerPath}\n`);

  if (!fs.existsSync(containerPath)) {
    console.log(`⚠️  Folder not found: ${containerPath}`);
    return [];
  }

  const entries = await fsp.readdir(containerPath, { withFileTypes: true });
  const results = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;

    const rootDir = path.join(containerPath, ent.name);
    const rootLabel = `${label}/${ent.name}`;

    const packageDirs = await findAllPackageDirs(rootDir);

    if (packageDirs.length === 0) {
      results.push({
        target: rootLabel,
        hasPackageJson: false,
        vulnerable: false,
        reason: "No package.json found anywhere in this directory",
      });
      continue;
    }

    for (const pkgDir of packageDirs) {
      const rel = path.relative(rootDir, pkgDir);
      const targetLabel = rel ? `${rootLabel}/${rel}` : rootLabel;

      const analysis = await analyzePackageDir(pkgDir);

      results.push({
        target: targetLabel,
        ...analysis,
      });
    }
  }

  return results;
}

// ---------- MAIN ----------

async function main() {
  console.log("🔍 WordPress React Server Components Scanner");
  console.log("============================================\n");
  console.log(`Root: ${ROOT}\n`);

  const pluginResults = await scanContainerFolder(PLUGINS, "plugins");
  const themeResults = await scanContainerFolder(THEMES, "themes");

  const results = [...pluginResults, ...themeResults];

  console.log("\n====== RSC Vulnerability Report ======\n");

  for (const r of results) {
    const mark = r.vulnerable ? "❌" : "✔️";
    console.log(`${mark}  ${r.target}`);
    console.log(`    - package.json: ${r.hasPackageJson ? "Yes" : "No"}`);
    console.log(`    - Reason: ${r.reason}\n`);
  }

  console.log("======================================\n");

  const vulnerableCount = results.filter((r) => r.vulnerable).length;

  if (vulnerableCount === 0) {
    console.log("✅ All scanned plugins & themes look SAFE (no React Server Components detected).\n");
  } else {
    console.log(`⚠️ ${vulnerableCount} package(s) may be using React Server Components — please review.\n`);
  }

  // non-zero exit if any suspicious
  if (vulnerableCount > 0) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

