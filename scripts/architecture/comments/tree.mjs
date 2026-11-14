import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoFiles, repoRoot } from '../ratchet.mjs';
import { longCommentViolations } from './blocks.mjs';
import { docPathViolations } from './doc-paths.mjs';
import { hangulCommentViolations } from './english.mjs';
import { historyCommentViolations } from './history.mjs';
import { routeCommentViolations } from './routes.mjs';
import { sectionCommentViolations } from './sections.mjs';
import { featuresOf, sharedCommentViolations } from './shared.mjs';
import { commentTagViolations } from './tags.mjs';

export const RULES = [
  { name: 'comment-tags', check: commentTagViolations },
  { name: 'comment-blocks', check: longCommentViolations },
  { name: 'history-comments', check: historyCommentViolations },
  { name: 'section-comments', check: sectionCommentViolations },
  { name: 'shared-comments', check: sharedCommentViolations },
  { name: 'english-comments', check: hangulCommentViolations },
  { name: 'doc-paths', check: docPathViolations },
  { name: 'route-comments', check: routeCommentViolations },
];

const ROOTS = /^(?:apps\/mobile\/(?:src|app)|packages\/[^/]+\/src)\//;
const TEST_OR_FIXTURE = /\.(?:test|typetest)\.[cm]?tsx?$|\/__(?:tests|fixtures|mocks)__\//;

/** Whether the comment rules read a path: a TypeScript source of the app or a package that is not a test, a fixture, generated, a declaration or vendored. */
export function isCommentScoped(path, vendored) {
  return (
    ROOTS.test(path) &&
    /\.tsx?$/.test(path) &&
    !path.endsWith('.d.ts') &&
    !path.endsWith('.generated.ts') &&
    !TEST_OR_FIXTURE.test(path) &&
    !vendored.has(path)
  );
}

/** The report's area: the top folder under apps/mobile/src, `app` for the routes, or the package. */
export function areaOf(path) {
  if (path.startsWith('apps/mobile/app/')) return 'app';
  const packageName = /^packages\/([^/]+)\//.exec(path)?.[1];
  if (packageName) return `packages/${packageName}`;
  return path.split('/')[3];
}

/** Every rule's violations over `files`, as `{ rule, file, line, message }`, by rule, then file, then line. */
export function checkFiles(files, read, ctx) {
  const out = [];
  for (const [order, rule] of RULES.entries()) {
    for (const file of [...files].sort()) {
      for (const { line, message } of rule.check(file, read(file), ctx)) out.push({ order, rule: rule.name, file, line, message });
    }
  }
  return out
    .sort((a, b) => a.order - b.order || a.file.localeCompare(b.file) || a.line - b.line)
    .map(({ rule, file, line, message }) => ({ rule, file, line, message }));
}

/** WHY: a vendored file listed in .contracts.lock.json is edited at its source, never here. */
function vendoredSources() {
  const lock = JSON.parse(readFileSync(join(repoRoot, '.contracts.lock.json'), 'utf8'));
  return new Set(Object.values(lock.contracts).map((contract) => contract.path));
}

/** The violations in the tree, limited to `rels` (repository-relative files or folders) when any is given. */
export function treeViolations(rels = []) {
  const inRels = (file) => rels.length === 0 || rels.some((rel) => file === rel || file.startsWith(`${rel.replace(/\/$/, '')}/`));
  const all = repoFiles();
  const vendored = vendoredSources();
  const files = all
    .filter((file) => isCommentScoped(file, vendored))
    .filter(inRels);
  const read = (file) => readFileSync(join(repoRoot, file), 'utf8');
  const ctx = {
    features: featuresOf(all),
    exists: (path) => existsSync(join(repoRoot, path)),
    readDoc: (path) => read(path),
  };
  return checkFiles(files, read, ctx);
}

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  return counts;
}

/** The violations grouped by rule and file, then the totals by rule and by area. */
export function formatReport(violations) {
  if (violations.length === 0) return 'Total: 0';
  const lines = [];
  for (const [rule, ruleCount] of countBy(violations, (v) => v.rule)) {
    lines.push(`${rule} (${ruleCount})`);
    const ofRule = violations.filter((v) => v.rule === rule);
    for (const [file, fileCount] of countBy(ofRule, (v) => v.file)) {
      lines.push(`  ${file} (${fileCount})`);
      for (const v of ofRule.filter((x) => x.file === file)) lines.push(`    ${v.line}: ${v.message}`);
    }
  }
  lines.push('', 'By rule:');
  for (const [rule, count] of countBy(violations, (v) => v.rule)) lines.push(`  ${rule}: ${count}`);
  lines.push('By area:');
  const areas = [...countBy(violations, (v) => areaOf(v.file))].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [area, count] of areas) lines.push(`  ${area}: ${count}`);
  lines.push(`Total: ${violations.length}`);
  return lines.join('\n');
}
