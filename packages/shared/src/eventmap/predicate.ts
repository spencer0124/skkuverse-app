/**
 * Predicate evaluation over an item's tags.
 *
 * Every chip, filter and layer membership is one of these. The client never
 * learns what `day` or `cat` mean — it compares strings.
 *
 * ## Why validation is the real defence, not `default: false`
 *
 * "An unrecognised node evaluates false" is the stated rule (ADR 0004 invariant
 * 2): hiding an item is recoverable, revealing one is not. But that rule does
 * not survive negation. `['not', ['bogus']]` evaluates the inner node to `false`
 * and therefore returns **`true`** — showing a booth the filter existed to hide,
 * which is the exact outcome failing closed was meant to prevent.
 *
 * So the closed set is enforced at PARSE time by `isValidPredicate`, and a
 * predicate that fails takes its layer or chip out of the snapshot with it. The
 * evaluator's `default: false` is a second line of defence for a value that
 * somehow bypassed the parser, not the primary one.
 *
 * `isValidPredicate` also rejects empty operand arrays. `['and', []]` is
 * vacuously `true` and `['hasAll', []]` likewise, which are useless to author
 * and surprising to debug; refusing them means the evaluator needs no special
 * cases at all.
 */

import type { ItemStatus, Predicate } from '../types/eventmap';
import { ITEM_STATUSES } from '../types/eventmap';

/**
 * Hand-authored config, so depth is a mistake rather than a feature past a
 * handful of levels. Also bounds recursion on a hostile payload.
 */
const MAX_PREDICATE_DEPTH = 8;

export interface PredicateSubject {
  tags: readonly string[];
  /**
   * The DERIVED status, not `item.status` — a `['status', ['open']]` chip has to
   * track the clock, or "지금 운영중" stops matching what the pins show.
   */
  status: ItemStatus;
}

export function evaluatePredicate(node: Predicate, subject: PredicateSubject): boolean {
  const [kind, arg] = node as [string, unknown];
  switch (kind) {
    case 'all':
      return true;
    case 'has':
      return subject.tags.includes(arg as string);
    case 'hasAny':
      return (arg as string[]).some((t) => subject.tags.includes(t));
    case 'hasAll':
      return (arg as string[]).every((t) => subject.tags.includes(t));
    case 'not':
      return !evaluatePredicate(arg as Predicate, subject);
    case 'and':
      return (arg as Predicate[]).every((n) => evaluatePredicate(n, subject));
    case 'or':
      return (arg as Predicate[]).some((n) => evaluatePredicate(n, subject));
    case 'status':
      return (arg as ItemStatus[]).includes(subject.status);
    default:
      // Unreachable for a parsed snapshot — isValidPredicate already rejected it.
      return false;
  }
}

export function isValidPredicate(node: unknown, depth = 0): node is Predicate {
  if (depth > MAX_PREDICATE_DEPTH) return false;
  if (!Array.isArray(node) || node.length === 0) return false;

  const [kind, arg] = node as [unknown, unknown];
  switch (kind) {
    case 'all':
      return node.length === 1;
    case 'has':
      return typeof arg === 'string' && arg.length > 0;
    case 'hasAny':
    case 'hasAll':
      return isNonEmptyStringArray(arg);
    case 'not':
      return isValidPredicate(arg, depth + 1);
    case 'and':
    case 'or':
      return (
        Array.isArray(arg) &&
        arg.length > 0 &&
        arg.every((child) => isValidPredicate(child, depth + 1))
      );
    case 'status':
      return (
        Array.isArray(arg) &&
        arg.length > 0 &&
        arg.every((v) => (ITEM_STATUSES as readonly unknown[]).includes(v))
      );
    default:
      return false;
  }
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === 'string' && v.length > 0)
  );
}
