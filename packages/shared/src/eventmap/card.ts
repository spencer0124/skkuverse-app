/**
 * Card template → the slots a card actually has content for.
 *
 * The server picks a template per item (`item.cardTemplateId`, derived from the
 * session category) and ships the templates on the snapshot. The slot vocabulary
 * is closed: `title | subtitle | hours | thumbnail | tags | field{fieldKey,label}`.
 *
 * ## "Render nothing for a slot you cannot fill" is a mechanism, not politeness
 *
 * ESKARA's three templates all declare a `field` slot for `cancelled`, but
 * `fields.cancelled` is injected by the materializer ONLY when a session is
 * cancelled. So on every healthy booth that slot resolves to nothing, and on a
 * rained-out one it resolves to 운영 취소. Dropping unfillable slots is what makes
 * the cancellation badge work — a renderer that emitted a placeholder instead
 * would put an empty 안내 row on all ~50 booths.
 *
 * Pure and in packages/shared for the reason `derive.ts` gives: vitest reaches
 * here, apps/mobile's `node --test` runner does not reach `.tsx`. The component
 * maps `ResolvedSlot[]` to views and holds no logic worth testing.
 */

import type { EventMapCardSlot, EventMapCardTemplate, EventMapItem } from '../types/eventmap';

export type ResolvedSlot =
  | { kind: 'title'; value: string }
  | { kind: 'subtitle'; value: string }
  | { kind: 'hours'; value: string }
  | { kind: 'thumbnail'; uri: string }
  | { kind: 'tags'; values: string[] }
  | { kind: 'field'; fieldKey: string; label: string; value: string };

/**
 * What the peek sheet rendered before templates existed. Used when the item
 * names no template, names a missing one, or names one the parser stripped to
 * zero slots — all three are ordinary, not errors: `parseItem` defaults
 * `cardTemplateId` to `''`, and `parseCardTemplate` keeps a template whose slot
 * kinds were all unrecognised.
 *
 * Deliberately excludes `tags`: they were not rendered before either, and a
 * fallback is not the place to introduce something new.
 */
const FALLBACK_SLOTS: readonly EventMapCardSlot[] = [
  { kind: 'thumbnail' },
  { kind: 'title' },
  { kind: 'subtitle' },
  { kind: 'hours' },
];

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveSlot(slot: EventMapCardSlot, item: EventMapItem): ResolvedSlot | null {
  switch (slot.kind) {
    case 'title': {
      const value = nonEmpty(item.title);
      return value ? { kind: 'title', value } : null;
    }
    case 'subtitle': {
      const value = nonEmpty(item.subtitle);
      return value ? { kind: 'subtitle', value } : null;
    }
    case 'hours': {
      const value = nonEmpty(item.hoursLabel);
      return value ? { kind: 'hours', value } : null;
    }
    case 'thumbnail': {
      const uri = nonEmpty(item.media.thumbnailUrl);
      return uri ? { kind: 'thumbnail', uri } : null;
    }
    case 'tags': {
      const values = item.tags.filter((t) => nonEmpty(t) !== null);
      return values.length > 0 ? { kind: 'tags', values } : null;
    }
    case 'field': {
      const raw = item.fields[slot.fieldKey];
      // `fields` is Record<string, string | number>, so a number is legal data
      // rather than a defect — 0 and '' differ, and only '' means "no content".
      const value = typeof raw === 'number' ? String(raw) : nonEmpty(raw);
      return value === null
        ? null
        : { kind: 'field', fieldKey: slot.fieldKey, label: slot.label, value };
    }
    default:
      // Unreachable for a parsed snapshot: parseCardSlot drops unknown kinds.
      return null;
  }
}

export function resolveSlots(
  template: EventMapCardTemplate | undefined,
  item: EventMapItem,
): ResolvedSlot[] {
  const slots = template && template.slots.length > 0 ? template.slots : FALLBACK_SLOTS;
  const out: ResolvedSlot[] = [];
  for (const slot of slots) {
    const resolved = resolveSlot(slot, item);
    if (resolved) out.push(resolved);
  }
  return out;
}
