#!/usr/bin/env node
/**
 * Generates apps/mobile/assets/oss-licenses.json by BFS-traversing the
 * production dependency tree of apps/mobile starting from its top-level
 * `dependencies`.
 *
 * Yarn workspaces hoist packages to the monorepo root, so for each dep we
 * try monorepo `node_modules/<name>` first, then `apps/mobile/node_modules/<name>`.
 *
 * Run:  yarn licenses:generate
 *
 * Output: { generatedAt, count, packages: Array<{name, version, license, homepage, repository, author}> }
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(APP_DIR, '..', '..');
const OUT_PATH = path.join(APP_DIR, 'assets', 'oss-licenses.json');

async function readJson(p) {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findPackageJson(name) {
  for (const base of [MONOREPO_ROOT, APP_DIR]) {
    const candidate = path.join(base, 'node_modules', name, 'package.json');
    if (await exists(candidate)) return candidate;
  }
  return null;
}

function normalizeLicense(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license === 'object' && pkg.license.type) {
    return pkg.license.type;
  }
  if (Array.isArray(pkg.licenses) && pkg.licenses[0]?.type) {
    return pkg.licenses[0].type;
  }
  return 'UNKNOWN';
}

function normalizeRepository(pkg) {
  const repo =
    typeof pkg.repository === 'string'
      ? pkg.repository
      : pkg.repository?.url ?? null;
  if (!repo) return null;
  return repo
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\.git$/, '');
}

function normalizeAuthor(pkg) {
  if (typeof pkg.author === 'string') return pkg.author;
  if (pkg.author?.name) return pkg.author.name;
  return null;
}

async function collectPackages() {
  const appPkg = await readJson(path.join(APP_DIR, 'package.json'));
  if (!appPkg) throw new Error('apps/mobile/package.json not readable');

  const visited = new Set();
  const queue = Object.keys(appPkg.dependencies ?? {});
  const result = [];

  while (queue.length > 0) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);

    // Skip our own workspace packages — not "open source" in disclosure sense.
    if (name.startsWith('@skkuverse/')) continue;

    const pkgPath = await findPackageJson(name);
    if (!pkgPath) {
      console.warn(`[oss-licenses] not found in node_modules: ${name}`);
      continue;
    }

    const pkg = await readJson(pkgPath);
    if (!pkg) continue;

    result.push({
      name: pkg.name,
      version: pkg.version,
      license: normalizeLicense(pkg),
      homepage: pkg.homepage ?? null,
      repository: normalizeRepository(pkg),
      author: normalizeAuthor(pkg),
    });

    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

async function main() {
  const packages = await collectPackages();
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    count: packages.length,
    packages,
  };
  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✓ ${packages.length} OSS license entries → ${path.relative(APP_DIR, OUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
