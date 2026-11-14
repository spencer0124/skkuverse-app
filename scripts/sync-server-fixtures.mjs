#!/usr/bin/env node
// Keeps the app's copies of the server's contract fixtures equal to the server.
//
//   node scripts/sync-server-fixtures.mjs --check   fail when a copy differs from the pinned server commit
//   node scripts/sync-server-fixtures.mjs --write   rewrite each copy from that commit
//
// apps/mobile/server-fixtures.json lists each copy, the server path it comes
// from and the key it fills (`data` unless named). server-fixtures.lock.json
// pins the public server commit, which Renovate moves to the head of `main`.
// Each file is read from raw.githubusercontent.com under the owner in
// repo-links.json; SERVER_FIXTURES_BASE replaces that host in tests.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = 'node scripts/sync-server-fixtures.mjs --write';

const readJson = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

export function loadConfig(dir = root) {
  const { owner } = readJson(dir, 'repo-links.json');
  const lock = readJson(dir, 'server-fixtures.lock.json');
  const entries = readJson(dir, 'apps/mobile/server-fixtures.json').map((e) => ({ key: 'data', ...e }));
  const base = process.env.SERVER_FIXTURES_BASE ?? `https://raw.githubusercontent.com/${owner}/${lock.repo}`;
  return { dir, owner, lock, entries, base };
}

class NetworkError extends Error {}

async function fetchServerFile({ base, lock }, path) {
  const url = `${base}/${lock.sha}/${path}`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    const cause = err.cause?.code ?? err.cause?.message ?? err.message;
    throw new NetworkError(`could not reach ${url} (network: ${cause})`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new NetworkError(`${url} answered HTTP ${res.status}`);
  return res.json();
}

/** One result per entry: `equal`, `differs` or `missing` (no such file at the pinned commit). */
export async function compare(config) {
  const servers = await Promise.all(config.entries.map((e) => fetchServerFile(config, e.server)));
  return config.entries.map((entry, i) => {
    const server = servers[i];
    if (server === null) return { entry, status: 'missing' };
    const local = readJson(config.dir, entry.local);
    return { entry, server, status: isDeepStrictEqual(local[entry.key], server.data) ? 'equal' : 'differs' };
  });
}

/** Rewrites every copy with a `differs` result from the server, and its `_about` from every source it has. */
export function write(config, results) {
  const byLocal = Map.groupBy(results, (r) => r.entry.local);
  const written = [];
  for (const [local, rs] of byLocal) {
    if (!rs.some((r) => r.status === 'differs')) continue;
    const file = readJson(config.dir, local);
    const notes = rs.map(
      (r) => `${r.entry.key} from skkuverse-server ${r.entry.server} at ${config.lock.sha}${r.server?._about ? `. Its own note: ${r.server._about}` : ''}`,
    );
    const next = { _about: `Copied by \`${WRITE}\`: ${notes.join(' | ')}` };
    for (const [k, v] of Object.entries(file)) if (!k.startsWith('_')) next[k] = v;
    for (const r of rs) if (r.server) next[r.entry.key] = r.server.data;
    writeFileSync(join(config.dir, local), `${JSON.stringify(next, null, 2)}\n`);
    written.push(local);
  }
  return written;
}

export async function main(argv, config = loadConfig()) {
  const mode = argv[0];
  if (mode !== '--check' && mode !== '--write') {
    console.error('usage: node scripts/sync-server-fixtures.mjs --check | --write');
    return 2;
  }
  let results;
  try {
    results = await compare(config);
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    console.error(`sync-server-fixtures: ${err.message}. No fixture was compared.`);
    return 2;
  }
  for (const r of results) console.log(`${r.status.padEnd(7)} ${r.entry.local} (${r.entry.key}) <- ${r.entry.server}`);
  const missing = results.filter((r) => r.status === 'missing');
  if (missing.length > 0) {
    console.error(`\n${missing.length} server path(s) do not exist at skkuverse-server ${config.lock.sha}. Fix apps/mobile/server-fixtures.json.`);
    return 1;
  }
  if (mode === '--write') {
    const written = write(config, results);
    console.log(`\nwrote ${written.length} file(s) from skkuverse-server ${config.lock.sha}`);
    return 0;
  }
  const differs = results.filter((r) => r.status === 'differs');
  if (differs.length > 0) {
    console.error(`\n${differs.length} fixture(s) differ from skkuverse-server ${config.lock.sha}. Adopt the server's shape with \`${WRITE}\`, then fix what fails.`);
    return 1;
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
