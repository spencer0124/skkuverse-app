// sync-server-fixtures.mjs against a local fixture server: an equal copy, a
// differing one and its --write, a server path that does not exist, and a
// server that cannot be reached.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compare, main } from './sync-server-fixtures.mjs';

const SHA = 'a'.repeat(40);
const SERVER = {
  [`/${SHA}/fixtures/one.json`]: { _about: 'server note one', data: { n: 1 } },
  [`/${SHA}/fixtures/two.json`]: { _about: 'server note two', data: { n: 2, rows: ['x'] } },
};

async function withServer(fn) {
  const server = createServer((req, res) => {
    const body = SERVER[req.url];
    res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' });
    res.end(body ? JSON.stringify(body) : '404: Not Found');
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

function tree(locals, entries) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-server-fixtures-'));
  for (const [path, json] of Object.entries(locals)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), `${JSON.stringify(json, null, 2)}\n`);
  }
  return { dir, entries: entries.map((e) => ({ key: 'data', ...e })), lock: { repo: 'skkuverse-server', ref: 'main', sha: SHA } };
}

const quiet = async (fn) => {
  const { log, error } = console;
  console.log = console.error = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, { log, error });
  }
};

test('a copy equal to the server passes --check, whatever its own _about says', async () => {
  const t = tree({ 'a.json': { _about: 'my note', data: { n: 1 } } }, [{ local: 'a.json', server: 'fixtures/one.json' }]);
  await withServer(async (base) => {
    assert.deepEqual((await compare({ ...t, base })).map((r) => r.status), ['equal']);
    assert.equal(await quiet(() => main(['--check'], { ...t, base })), 0);
  });
});

test('a differing copy fails --check, and --write adopts the server and cites its commit', async () => {
  const t = tree({ 'b.json': { _about: 'old', data: { n: 2 } } }, [{ local: 'b.json', server: 'fixtures/two.json' }]);
  await withServer(async (base) => {
    assert.equal(await quiet(() => main(['--check'], { ...t, base })), 1);
    assert.equal(await quiet(() => main(['--write'], { ...t, base })), 0);
    const written = JSON.parse(readFileSync(join(t.dir, 'b.json'), 'utf8'));
    assert.deepEqual(written.data, { n: 2, rows: ['x'] });
    assert.match(written._about, new RegExp(`fixtures/two\\.json at ${SHA}\\. Its own note: server note two`));
    assert.equal(await quiet(() => main(['--check'], { ...t, base })), 0);
  });
});

test('a second key of one copy is compared and written from its own server file', async () => {
  const t = tree({ 'c.json': { _about: 'old', data: { n: 1 }, meta: { n: 0 } } }, [
    { local: 'c.json', server: 'fixtures/one.json' },
    { local: 'c.json', server: 'fixtures/two.json', key: 'meta' },
  ]);
  await withServer(async (base) => {
    assert.deepEqual((await compare({ ...t, base })).map((r) => r.status), ['equal', 'differs']);
    await quiet(() => main(['--write'], { ...t, base }));
    const written = JSON.parse(readFileSync(join(t.dir, 'c.json'), 'utf8'));
    assert.deepEqual([written.data, written.meta], [{ n: 1 }, { n: 2, rows: ['x'] }]);
  });
});

test('a server path missing at the pinned commit fails, in both modes', async () => {
  const t = tree({ 'd.json': { data: {} } }, [{ local: 'd.json', server: 'fixtures/gone.json' }]);
  await withServer(async (base) => {
    assert.deepEqual((await compare({ ...t, base })).map((r) => r.status), ['missing']);
    assert.equal(await quiet(() => main(['--check'], { ...t, base })), 1);
    assert.equal(await quiet(() => main(['--write'], { ...t, base })), 1);
  });
});

test('an unreachable server fails with the network cause and compares nothing', async () => {
  const t = tree({ 'a.json': { data: { n: 1 } } }, [{ local: 'a.json', server: 'fixtures/one.json' }]);
  const closed = createServer();
  await new Promise((done) => closed.listen(0, '127.0.0.1', done));
  const { port } = closed.address();
  await new Promise((done) => closed.close(done));
  const messages = [];
  const { error, log } = console;
  console.error = (m) => messages.push(m);
  console.log = () => {};
  try {
    assert.equal(await main(['--check'], { ...t, base: `http://127.0.0.1:${port}` }), 2);
  } finally {
    Object.assign(console, { error, log });
  }
  assert.match(messages.join('\n'), /network: ECONNREFUSED.*No fixture was compared/);
});
