/**
 * Predicates, and the hole that makes validation rather than `default: false`
 * the real defence.
 *
 * "Unknown node evaluates false" reads like a complete fail-closed story until
 * you compose it with negation: `['not', ['bogus']]` inverts the false and
 * returns true, revealing an item the filter existed to hide. Safety properties
 * that must survive composition belong at the boundary, not the leaf.
 */

import { describe, it, expect } from 'vitest';
import { evaluatePredicate, isValidPredicate } from '../predicate';
import type { Predicate } from '../../types/eventmap';
import eskaraPredicates from './fixtures/eskara-predicates.json';

const subject = { tags: ['cat:bar', 'day:1', 'slot:night'], status: 'open' as const };

const evalP = (p: Predicate) => evaluatePredicate(p, subject);

describe('evaluatePredicate — each node kind, both ways', () => {
  it('all', () => {
    expect(evalP(['all'])).toBe(true);
  });

  it('has', () => {
    expect(evalP(['has', 'cat:bar'])).toBe(true);
    expect(evalP(['has', 'cat:food'])).toBe(false);
  });

  it('hasAny', () => {
    expect(evalP(['hasAny', ['cat:food', 'cat:bar']])).toBe(true);
    expect(evalP(['hasAny', ['cat:food', 'cat:stage']])).toBe(false);
  });

  it('hasAll', () => {
    expect(evalP(['hasAll', ['cat:bar', 'day:1']])).toBe(true);
    expect(evalP(['hasAll', ['cat:bar', 'day:2']])).toBe(false);
  });

  it('not', () => {
    expect(evalP(['not', ['has', 'cat:food']])).toBe(true);
    expect(evalP(['not', ['has', 'cat:bar']])).toBe(false);
  });

  it('and', () => {
    expect(evalP(['and', [['has', 'cat:bar'], ['has', 'day:1']]])).toBe(true);
    expect(evalP(['and', [['has', 'cat:bar'], ['has', 'day:2']]])).toBe(false);
  });

  it('or', () => {
    expect(evalP(['or', [['has', 'cat:food'], ['has', 'day:1']]])).toBe(true);
    expect(evalP(['or', [['has', 'cat:food'], ['has', 'day:2']]])).toBe(false);
  });

  it('status matches the DERIVED status, so "지금 운영중" tracks the clock', () => {
    expect(evalP(['status', ['open']])).toBe(true);
    expect(evalP(['status', ['closed', 'upcoming']])).toBe(false);
    expect(
      evaluatePredicate(['status', ['closed']], { tags: [], status: 'closed' }),
    ).toBe(true);
  });

  it('evaluates an unknown node false as a second line of defence', () => {
    expect(evaluatePredicate(['bogus'] as unknown as Predicate, subject)).toBe(false);
  });
});

describe('isValidPredicate — the boundary that makes fail-closed hold', () => {
  it('rejects a negated unknown node, which would otherwise evaluate TRUE', () => {
    // The whole reason this function exists. `['not', ['bogus']]` inverts the
    // unknown-node false and reveals what the filter meant to hide.
    expect(isValidPredicate(['not', ['bogus']])).toBe(false);
    expect(evaluatePredicate(['not', ['bogus']] as unknown as Predicate, subject)).toBe(true);
  });

  it('accepts every well-formed node kind', () => {
    expect(isValidPredicate(['all'])).toBe(true);
    expect(isValidPredicate(['has', 'cat:bar'])).toBe(true);
    expect(isValidPredicate(['hasAny', ['a', 'b']])).toBe(true);
    expect(isValidPredicate(['hasAll', ['a']])).toBe(true);
    expect(isValidPredicate(['not', ['all']])).toBe(true);
    expect(isValidPredicate(['and', [['all'], ['has', 'x']]])).toBe(true);
    expect(isValidPredicate(['or', [['all']]])).toBe(true);
    expect(isValidPredicate(['status', ['open', 'closed']])).toBe(true);
  });

  it('rejects empty operand arrays, so vacuous truth never arises', () => {
    // `['and', []]` and `['hasAll', []]` are both vacuously true under plain
    // boolean algebra. Refusing them means the evaluator needs no special cases.
    expect(isValidPredicate(['and', []])).toBe(false);
    expect(isValidPredicate(['or', []])).toBe(false);
    expect(isValidPredicate(['hasAll', []])).toBe(false);
    expect(isValidPredicate(['hasAny', []])).toBe(false);
    expect(isValidPredicate(['status', []])).toBe(false);
  });

  it('rejects wrong operand types', () => {
    expect(isValidPredicate(['has', 123])).toBe(false);
    expect(isValidPredicate(['has', ''])).toBe(false);
    expect(isValidPredicate(['hasAny', 'cat:bar'])).toBe(false);
    expect(isValidPredicate(['hasAny', ['a', 7]])).toBe(false);
    expect(isValidPredicate(['status', ['open', 'sideways']])).toBe(false);
    expect(isValidPredicate(['all', 'extra'])).toBe(false);
  });

  it('rejects non-arrays and empty arrays', () => {
    expect(isValidPredicate(null)).toBe(false);
    expect(isValidPredicate(undefined)).toBe(false);
    expect(isValidPredicate('has')).toBe(false);
    expect(isValidPredicate({ kind: 'has' })).toBe(false);
    expect(isValidPredicate([])).toBe(false);
  });

  it('caps recursion depth on a hostile or mistaken payload', () => {
    let deep: unknown = ['all'];
    for (let i = 0; i < 12; i++) deep = ['not', deep];
    expect(isValidPredicate(deep)).toBe(false);
  });

  it('rejects an invalid node nested inside a valid one', () => {
    expect(isValidPredicate(['and', [['all'], ['bogus']]])).toBe(false);
    expect(isValidPredicate(['or', [['has', 'x'], ['hasAll', []]]])).toBe(false);
  });
});

/**
 * Cross-repo drift alarm. The node set is implemented twice — the server
 * validates against its own allowlist in eventmap.config.ts, this file carries
 * the app's. Without this fixture a node kind added server-side would ship, pass
 * server validation, and silently drop every layer using it at the festival.
 *
 * Fixture generated from skkuverse-server/src/eventmap/config/eskara-2026.json.
 */
describe('parity with the live ESKARA config', () => {
  it('has predicates to check', () => {
    expect(eskaraPredicates.predicates.length).toBeGreaterThan(0);
  });

  it.each(eskaraPredicates.predicates)(
    'accepts the predicate at $where',
    ({ predicate }) => {
      expect(isValidPredicate(predicate)).toBe(true);
    },
  );
});
