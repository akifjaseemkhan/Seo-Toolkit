// Local project fact-gathering: read-only, bounded, and deliberately
// judgment-free. This mirrors docs/architecture.md's detection procedure
// as executable code so workflows/discovery.md can run it instead of
// re-deriving the same facts by hand every time — but it only ever
// returns facts ("found app/ directory", "package.json lists next as a
// dependency"). Interpreting what that means for a specific project is
// the SEO reasoning layer's job, not this module's.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'vendor', '.cache', 'coverage', '.turbo']);
const MAX_FILES_SCANNED = 3000;
const MAX_DEPTH = 8;
const MAX_FILE_READ_BYTES = 200_000;
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro', '.php', '.html']);

const LOCKFILE_TO_MANAGER = {
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lockb': 'bun',
};

const FRAMEWORK_CONFIG_FILES = [
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'vite.config.js',
  'vite.config.ts',
  'vite.config.mjs',
  'astro.config.js',
  'astro.config.mjs',
  'astro.config.ts',
  'nuxt.config.js',
  'nuxt.config.ts',
  'svelte.config.js',
  'remix.config.js',
  'gatsby-config.js',
  'wp-config.php',
  'composer.json',
];

const METADATA_SIGNAL_STRINGS = [
  'generateMetadata',
  'next/head',
  'react-helmet',
  'Helmet',
  'application/ld+json',
  'next-seo',
  'vite-plugin-prerender',
  'react-snap',
  'yoast',
  'rank-math',
];

function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function walk(rootDir, { maxFiles = MAX_FILES_SCANNED, maxDepth = MAX_DEPTH } = {}) {
  const files = [];
  const dirsFound = new Set();
  let truncated = false;

  function recurse(dir, depth) {
    if (depth > maxDepth || files.length >= maxFiles) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }
      if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        dirsFound.add(relative(rootDir, full).replace(/\\/g, '/'));
        recurse(full, depth + 1);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }

  recurse(rootDir, 0);
  return { files, dirsFound, truncated };
}

function detectPackageManager(rootDir) {
  for (const [lockfile, manager] of Object.entries(LOCKFILE_TO_MANAGER)) {
    if (existsSync(join(rootDir, lockfile))) return manager;
  }
  return null;
}

function detectFrameworkConfigFiles(rootDir) {
  return FRAMEWORK_CONFIG_FILES.filter((f) => existsSync(join(rootDir, f)));
}

function detectDirectoryConventions(dirsFound) {
  const has = (name) => dirsFound.has(name) || Array.from(dirsFound).some((d) => d === name || d.startsWith(name + '/'));
  return {
    hasAppRouterDir: has('app'),
    hasPagesRouterDir: has('pages'),
    hasSrcPagesDir: has('src/pages'),
    hasWpContentDir: has('wp-content'),
    hasPublicDir: has('public'),
    hasStaticDir: has('static'),
  };
}

function findFileCaseInsensitive(rootDir, candidateRelativePaths) {
  return candidateRelativePaths.filter((p) => existsSync(join(rootDir, p)));
}

function scanForMetadataSignals(files) {
  const hits = new Map(); // signal -> Set(file)
  let filesScanned = 0;
  let truncated = false;

  for (const file of files) {
    if (!SOURCE_EXTENSIONS.has(extname(file))) continue;
    let stat;
    try {
      stat = statSync(file);
    } catch {
      continue;
    }
    if (stat.size > MAX_FILE_READ_BYTES) continue;
    if (filesScanned >= MAX_FILES_SCANNED) {
      truncated = true;
      break;
    }
    filesScanned++;
    let content;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    for (const signal of METADATA_SIGNAL_STRINGS) {
      if (content.includes(signal)) {
        if (!hits.has(signal)) hits.set(signal, new Set());
        hits.get(signal).add(file);
      }
    }
  }

  const result = {};
  for (const [signal, fileSet] of hits) {
    const list = Array.from(fileSet);
    result[signal] = { fileCount: list.length, samplePaths: list.slice(0, 5) };
  }
  return { signals: result, filesScanned, truncated };
}

/**
 * Gather local project facts. Returns raw facts only — no framework/site-type
 * verdict, no recommendations. See workflows/discovery.md for how these
 * facts should be interpreted.
 */
export function inspectProject(rootDir) {
  const packageJsonPath = join(rootDir, 'package.json');
  const packageJson = existsSync(packageJsonPath) ? safeReadJson(packageJsonPath) : null;

  const { files, dirsFound, truncated: walkTruncated } = walk(rootDir);
  const directoryConventions = detectDirectoryConventions(dirsFound);
  const metadataScan = scanForMetadataSignals(files);

  const seoFiles = findFileCaseInsensitive(rootDir, [
    'robots.txt',
    'public/robots.txt',
    'static/robots.txt',
    'sitemap.xml',
    'public/sitemap.xml',
    'static/sitemap.xml',
    'app/sitemap.ts',
    'app/sitemap.js',
    'app/robots.ts',
    'app/robots.js',
  ]);

  return {
    rootDir,
    packageJson: packageJson
      ? {
          name: packageJson.name || null,
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {}),
          scripts: packageJson.scripts || {},
          type: packageJson.type || null,
        }
      : null,
    packageManager: detectPackageManager(rootDir),
    hasComposerJson: existsSync(join(rootDir, 'composer.json')),
    hasWpConfig: existsSync(join(rootDir, 'wp-config.php')),
    frameworkConfigFiles: detectFrameworkConfigFiles(rootDir),
    directoryConventions,
    seoRelatedFilesFound: seoFiles,
    metadataImplementationSignals: metadataScan.signals,
    scan: {
      filesWalked: files.length,
      directoriesFound: dirsFound.size,
      filesScannedForSignals: metadataScan.filesScanned,
      truncated: walkTruncated || metadataScan.truncated,
    },
  };
}
