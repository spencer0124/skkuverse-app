// Every external action a workflow runs is pinned to a commit, and Dependabot
// keeps the pins current (the server's workflow-pins test, ported):
//
//   - each `uses:` in `.github/workflows/*.yml` is a local `./...` workflow or
//     `<owner>/<repo>[/<path>]@<40 hex>` followed by `# v<version>`, so a tag
//     moved upstream cannot change what runs, and a reader still sees which
//     release it is;
//   - `.github/dependabot.yml` updates the `github-actions` ecosystem monthly,
//     seven days after a release, as one grouped pull request into `dev`, and on
//     npm only the `@skkuverse/*` packages.
//
// Patterns rather than a YAML parser: the repo avoids the dependency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = '.github/workflows';
const PINNED = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40} # v\d+(?:\.\d+)*$/;

/** `<line>: <uses value>` for each `uses:` that is neither local nor pinned to a SHA with its version. */
function unpinnedUses(yaml) {
  return yaml.split('\n').flatMap((line, i) => {
    const value = /^\s*(?:-\s+)?uses:\s*(.*?)\s*$/.exec(line)?.[1];
    if (value === undefined || value.startsWith('./') || PINNED.test(value)) return [];
    return [`${i + 1}: ${value}`];
  });
}

const REFUSED = [
  ['a tag', '      - uses: actions/checkout@v4'],
  ['a branch', '        uses: foo/bar@main'],
  ['a short SHA', '      - uses: actions/checkout@11d5960 # v4.4.0'],
  ['a SHA without its version', '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262'],
  ['a docker image', '      - uses: docker://alpine:3.20'],
];

for (const [name, line] of REFUSED) {
  test(`the pin rule refuses ${name}`, () => {
    assert.equal(unpinnedUses(line).length, 1);
  });
}

test('the pin rule passes a SHA pin with its version, a sub-path action and a local workflow', () => {
  const yaml = [
    '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
    '        uses: github/codeql-action/init@0123456789abcdef0123456789abcdef01234567 # v3',
    '    uses: ./.github/workflows/reusable.yml',
    '      - run: echo uses: nothing',
  ].join('\n');
  assert.deepEqual(unpinnedUses(yaml), []);
});

test('.github/workflows pins every external action to a commit SHA with its version', () => {
  const files = readdirSync(join(root, WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f));
  const unpinned = files.flatMap((f) =>
    unpinnedUses(readFileSync(join(root, WORKFLOWS, f), 'utf8')).map((u) => `${f}:${u}`),
  );
  assert.ok(files.length > 0);
  assert.deepEqual(unpinned, []);
});

test('.github/dependabot.yml updates the github-actions pins monthly in one grouped pull request, and the @skkuverse/* packages alone on npm, seven days after a release, into dev', () => {
  const config = readFileSync(join(root, '.github/dependabot.yml'), 'utf8');
  const ecosystems = [...config.matchAll(/^\s*- package-ecosystem: (\S+)$/gm)].map((m) => m[1]);
  assert.deepEqual(ecosystems, ['github-actions', 'npm']);
  const npm = config.slice(config.indexOf('- package-ecosystem: npm'));
  const allow = npm.slice(npm.indexOf('\n    allow:\n') + 1).split('\n').slice(1).filter((line) => /^ {6}\S/.test(line));
  assert.deepEqual(allow, ['      - dependency-name: "@skkuverse/*"']);
  assert.match(npm, /^ {4}target-branch: dev$/m);
  assert.match(npm, /^ {4}cooldown:\n {6}default-days: 7$/m);
  assert.match(config, /^ {4}schedule:\n {6}interval: monthly$/m);
  assert.match(config, /^ {4}cooldown:\n {6}default-days: 7$/m);
  assert.match(config, /^ {4}target-branch: dev$/m);
  assert.match(config, /^ {4}groups:\n {6}github-actions:\n {8}patterns:\n {10}- "\*"$/m);
});
