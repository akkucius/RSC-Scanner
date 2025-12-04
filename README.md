# React Server Components Scanner Suite

## Overview

This repository contains two Node.js utilities designed to scan directories for potential usage of React Server Components (RSC), React 19+, Next.js, or other related indicators:

1. **`rsc-scanner.js`** - A generic scanner that recursively scans **all folders** in any given directory
2. **`wp-rsc-scanner.js`** - A WordPress-specific scanner optimized for scanning `wp-content/plugins` and `wp-content/themes`

Both tools perform deep inspection of discovered package directories and produce clear line-by-line reports marking each item as **SAFE (✔️)** or **POSSIBLY VULNERABLE (❌)**, along with detailed reasoning.

These tools are particularly useful for:
- Security audits of JavaScript projects
- Detecting React Server Component usage in large codebases
- WordPress environments where plugins or themes may contain embedded JavaScript applications
- CI/CD pipelines requiring automated vulnerability checks

## Common Features

Both scanners share these core capabilities:

- **Detects any `package.json` file at any directory depth**

- **Analyzes JavaScript/TypeScript dependencies:**
  - `react` (specifically version 19 or above)
  - `next`
  - `react-server-dom-webpack`

- **Performs file-level scans for RSC markers:**
  - `"use server"`
  - `'use server'`
  - Direct imports referencing `react-server-dom-webpack`

- **Scans common JavaScript/TypeScript file extensions:**
  - `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`

- **Automatically skips common directories:**
  - `node_modules`, `.git`, `vendor`, `dist`, `build`, `.next`

- **Outputs concise safety or vulnerability status** for each detected package directory

- **Provides exit codes suitable for CI/CD pipelines**

## Installation

Both scanner scripts are standalone Node.js files requiring no external dependencies.

### Option 1: Make Scripts Executable

```bash
chmod +x rsc-scanner.js
chmod +x wp-rsc-scanner.js
```

### Option 2: Run with Node

No installation needed - just run with `node` command.

---

## Tool 1: Generic RSC Scanner (`rsc-scanner.js`)

### Description

The generic scanner recursively examines **all folders** in a given directory tree, making it suitable for any JavaScript/TypeScript project structure.

### Usage

#### Basic Usage (Current Directory)

```bash
node rsc-scanner.js
```

#### Specify Custom Path

```bash
node rsc-scanner.js "/path/to/your/project"
```

#### Examples

```bash
# Scan a monorepo
node rsc-scanner.js "/Users/ankur.sr/projects/my-monorepo"

# Scan a Next.js project
node rsc-scanner.js "/Users/ankur.sr/projects/nextjs-app"

# Scan any JavaScript project
node rsc-scanner.js "/Users/ankur.sr/projects/react-app"
```

### Expected Behavior

- Recursively walks through **every folder** in the target directory
- Reports on **all folders** (whether they contain `package.json` or not)
- Analyzes each discovered `package.json` for RSC indicators
- Ideal for comprehensive scans of entire project structures

### Sample Output

```
🔍 Generic React Surface Scanner
Root directory: /path/to/project

======== Scan Results ========

✔️ /path/to/project
    package.json: Yes
    Reason: No RSC indicators found

❌ /path/to/project/apps/web
    package.json: Yes
    Reason: Next.js detected (14.2.1)

✔️ /path/to/project/apps/api
    package.json: Yes
    Reason: No RSC indicators found

✔️ /path/to/project/packages
    package.json: No
    Reason: No package.json found

==============================

❌ 1 folder(s) may be vulnerable.
```

---

## Tool 2: WordPress-Specific Scanner (`wp-rsc-scanner.js`)

### Description

A specialized scanner optimized for WordPress installations. It specifically targets `wp-content/plugins` and `wp-content/themes` directories, making it faster and more focused for WordPress security audits.

### Folder Structure Example

```
your-wordpress-site/
├── wp-admin/
├── wp-content/
│   ├── plugins/
│   │   ├── plugin-one/
│   │   └── plugin-two/
│   │       └── assets/
│   │           └── react-app/
│   │               └── package.json
│   └── themes/
│       ├── theme-one/
│       └── theme-two/
│           └── fadv/
│               └── package.json
├── wp-includes/
└── ...
```

### Usage

#### Basic Usage (Run from WordPress Root)

```bash
node wp-rsc-scanner.js
```

#### Specify WordPress Installation Path

```bash
node wp-rsc-scanner.js "/path/to/wordpress/root"
```

#### Example

```bash
node wp-rsc-scanner.js "/Users/ankur.sr/Local Sites/advisorus/app/public"
```

### Expected Behavior

- Automatically detects and scans:
  - `wp-content/plugins`
  - `wp-content/themes`
- Identifies every nested `package.json` file within these directories
- Reports results grouped by plugins and themes
- Faster than the generic scanner for WordPress-specific audits

### Sample Output

```
🔍 WordPress React Server Components Scanner
============================================

Root: /path/to/wordpress

📂 Scanning plugins: /path/to/wordpress/wp-content/plugins

📂 Scanning themes: /path/to/wordpress/wp-content/themes

====== RSC Vulnerability Report ======

✔️  plugins/ninja-tables
    - package.json: No
    - Reason: No package.json found anywhere in this directory

❌  plugins/custom-react-app/src
    - package.json: Yes
    - Reason: React 19.2.1 (19+) detected

✔️  themes/twentytwentyfive
    - package.json: No
    - Reason: No package.json found anywhere in this directory

❌  themes/demo-section/demo
    - package.json: Yes
    - Reason: "use server" marker found in src/app/index.js

======================================

⚠️ 2 package(s) may be using React Server Components — please review.
```

---

## Which Scanner Should I Use?

### Use `rsc-scanner.js` (Generic) when:
- Scanning any JavaScript/TypeScript project
- You need to scan an entire monorepo
- Scanning Next.js applications
- Auditing React applications outside WordPress
- You want comprehensive coverage of all directories

### Use `wp-rsc-scanner.js` (WordPress-Specific) when:
- Auditing WordPress installations
- You only care about plugins and themes
- You want faster, focused scans
- Integrating into WordPress deployment pipelines
- The target is specifically a WordPress site

---

## Exit Codes

Both scanners use the following exit codes:

- **0** — No potentially vulnerable packages found
- **2** — One or more packages may be vulnerable

These exit codes allow straightforward integration into CI/CD workflows for automated checks.

## Important Notes

### For `rsc-scanner.js` (Generic Scanner)
- Scans **all directories** recursively from the starting point
- May be slower on very large directory trees
- Automatically skips `node_modules`, `.git`, `vendor`, `dist`, `build`, and `.next` directories
- Reports on every folder, whether it has a `package.json` or not

### For `wp-rsc-scanner.js` (WordPress Scanner)
- Only inspects `wp-content/plugins` and `wp-content/themes`
- Does **not** scan `wp-admin`, `wp-includes`, `uploads`, `cache`, or MU plugins
- Optimized for WordPress-specific structures
- Faster for WordPress audits due to focused scanning

### General Notes
- Both tools use **heuristic detection** and cannot provide absolute guarantees
- A flagged package does not necessarily mean it is actively exploitable
- The scanners are safe to extend if your project has non-standard structures

## Security Considerations

- This is a detection tool that identifies **potential** vulnerabilities
- A flagged package does not necessarily mean it is exploitable
- Manual review of flagged packages is recommended
- Always keep WordPress, plugins, and themes updated to the latest versions

## CI/CD Integration Examples

### For Generic Projects

```bash
#!/bin/bash
# Run generic scanner
node rsc-scanner.js "/path/to/project"
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  echo "⚠️ Potentially vulnerable packages detected!"
  exit 1
fi

echo "✅ No vulnerable packages found"
exit 0
```

### For WordPress Sites

```bash
#!/bin/bash
# Run WordPress-specific scanner
node wp-rsc-scanner.js "/path/to/wordpress"
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  echo "⚠️ Potentially vulnerable WordPress plugins/themes detected!"
  exit 1
fi

echo "✅ No vulnerable WordPress packages found"
exit 0
```

### GitHub Actions Example

```yaml
name: RSC Security Scan

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run RSC Scanner
        run: |
          node rsc-scanner.js .
          
      # For WordPress projects:
      # - name: Run WordPress RSC Scanner
      #   run: |
      #     node wp-rsc-scanner.js .
```

## Troubleshooting

### Generic Scanner (`rsc-scanner.js`)

#### Scanner is too slow
- The generic scanner checks every folder - consider using the WordPress-specific scanner if auditing WordPress
- Ensure the starting directory is not too broad (e.g., don't scan your entire home directory)
- Check if skipped directories list needs adjustment

#### Scanner doesn't find package.json files
- Verify you're in the correct directory
- Check file permissions
- Ensure `package.json` files actually exist in subdirectories

### WordPress Scanner (`wp-rsc-scanner.js`)

#### Scanner doesn't find wp-content
- Ensure you're running from the correct WordPress root directory
- Verify that `wp-content/plugins` and `wp-content/themes` directories exist
- Check that the path provided contains `wp-content`

#### Scanner doesn't find package.json files
- Check file permissions
- Verify plugins/themes actually contain `package.json` files
- Some plugins may have `package.json` in subdirectories

### Common Issues (Both Scanners)

#### False positives
- Review the reason provided in the output
- Manually inspect the flagged package
- Check if the package truly uses React Server Components
- Consider adding exclusions if needed (requires script modification)

#### Permission errors
- Ensure you have read access to all directories
- On Unix systems, check file permissions with `ls -la`
- May need to run with appropriate user privileges

## License

This tool is provided as-is for security scanning purposes.

---

**Last Updated:** December 2025
