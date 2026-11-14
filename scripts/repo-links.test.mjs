// Every GitHub link to a skkuverse repository names the owner and a public
// repository from repo-links.json, so moving the repositories to another owner
// is one edit there plus the rewrite command the failure prints. A link to a
// private repository, or an `owner/repo#NN` issue reference to one, answers
// 404 to a reader who is signed out.
//
// Every URL the check refuses is built from parts below: a literal one would
// make this file match its own cases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'repo-links.json'), 'utf8'));

const REPO = '(skkuverse[\\w.-]*?)(?:\\.git)?(?=[/#?)"\'\\s`>\\]]|$)';
const PATTERNS = [
  { kind: 'link', re: new RegExp(`github\\.com[:/]([\\w-]+)/${REPO}`, 'g') },
  { kind: 'link', re: new RegExp(`\\b([\\w-]+)\\.github\\.io/${REPO}`, 'g') },
  { kind: 'issue', re: new RegExp(`(?<![\\w./-])([\\w-]+)/(skkuverse[\\w.-]*)#\\d+`, 'g') },
];

/** Each reference in `text` that leaves the configured owner or its public repositories. */
function badReferences(text, { owner, public: open }) {
  return text.split('\n').flatMap((line, i) =>
    PATTERNS.flatMap(({ kind, re }) =>
      [...line.matchAll(re)]
        .filter(([, who, repo]) => who !== owner || !open.includes(repo))
        .map(([match]) => ({ line: i + 1, kind, match })),
    ),
  );
}

const url = (...parts) => parts.join('/');
const cfg = { owner: 'spencer0124', public: ['skkuverse-server', 'skkuverse-app', 'skkuverse-miniapp'] };

test('a link to a public repository under the configured owner passes', () => {
  const text = [
    url('https://github.com', cfg.owner, 'skkuverse-miniapp', 'blob/main/docs/reference/protocol.md'),
    `git@${url('github.com:' + cfg.owner, 'skkuverse-server.git')}`,
    url(`https://${cfg.owner}.github.io`, 'skkuverse-miniapp', ''),
    `${cfg.owner}/skkuverse-app#12`,
  ].join('\n');
  assert.deepEqual(badReferences(text, cfg), []);
});

test('a link under the wrong owner fails', () => {
  const text = url('https://github.com', 'skkuverse', 'skkuverse-server');
  assert.deepEqual(badReferences(text, cfg).map((r) => r.kind), ['link']);
});

test('a link to a private repository fails, the github.io form included', () => {
  const text = [
    url('https://github.com', cfg.owner, 'skkuverse', 'issues/49'),
    url('https://github.com', cfg.owner, 'skkuverse-web'),
    url(`https://${cfg.owner}.github.io`, 'skkuverse-web'),
  ].join('\n');
  assert.equal(badReferences(text, cfg).length, 3);
});

test('an issue reference to a private repository fails', () => {
  const text = `the crash cluster in ${cfg.owner}/skkuverse#53`;
  assert.deepEqual(badReferences(text, cfg).map((r) => r.kind), ['issue']);
});

test('a file path or a package name is not an issue reference', () => {
  const text = 'see apps/skkuverse-app#readme and @skkuverse/shared';
  assert.deepEqual(badReferences(text, cfg), []);
});

test(`every tracked file links only to ${config.owner}'s public repositories`, () => {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const found = files.flatMap((file) => {
    const buf = readFileSync(join(root, file));
    if (buf.includes(0)) return [];
    return badReferences(buf.toString('utf8'), config).map((r) => `${file}:${r.line}: ${r.match}`);
  });
  const names = '(skkuverse-(?:server|app|miniapp))';
  assert.deepEqual(
    found,
    [],
    'Point each one at a repository in repo-links.json, or write "outside this repository" for a private one' +
      ' ("an issue outside this repository" for an issue). After an owner change in repo-links.json, rewrite every link with:\n' +
      `  git ls-files -z | xargs -0 perl -pi -e 's#github\\.com([:/])<old>/${names}#github.com$1${config.owner}/$2#g; s#\\b<old>\\.github\\.io/${names}#${config.owner}.github.io/$1#g'`,
  );
});
