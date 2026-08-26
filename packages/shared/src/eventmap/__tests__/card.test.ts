/**
 * Card template slot resolution.
 *
 * The load-bearing case is the one that looks like an edge case: ESKARA's three
 * templates all declare a `cancelled` field slot, but the materializer injects
 * `fields.cancelled` only on a cancelled session. Dropping unfillable slots is
 * therefore the mechanism behind the cancellation badge, not a nicety — a
 * renderer that emitted placeholders would put an empty 안내 row on every booth.
 */

import { describe, it, expect } from 'vitest';
import { resolveSlots } from '../card';
import type { EventMapCardTemplate, EventMapItem } from '../../types/eventmap';
import snapshotFixture from './fixtures/eskara-snapshot.json';

const TEMPLATES = snapshotFixture.cardTemplates as unknown as EventMapCardTemplate[];
const ITEMS = snapshotFixture.items as unknown as EventMapItem[];

const template = (id: string): EventMapCardTemplate => {
  const found = TEMPLATES.find((t) => t.id === id);
  if (!found) throw new Error(`fixture has no card template ${id}`);
  return found;
};

const item = (id: string): EventMapItem => {
  const found = ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`fixture has no item ${id}`);
  return found;
};

const kinds = (subject: EventMapItem, tmpl?: EventMapCardTemplate) =>
  resolveSlots(tmpl, subject).map((s) => s.kind);

describe('resolveSlots', () => {
  it('drops the cancelled field on a healthy booth and keeps it on a cancelled one', () => {
    expect(kinds(item('demo-daybooth-01'), template('booth'))).not.toContain('field');

    expect(resolveSlots(template('booth'), item('demo-rain-cancelled'))).toContainEqual({
      kind: 'field',
      fieldKey: 'cancelled',
      label: '안내',
      value: '운영 취소',
    });
  });

  it("preserves the template's declared slot order", () => {
    // Order is meaningful on the wire — the server preserves array order for
    // exactly this reason, so the renderer must not re-group.
    const resolved = kinds(item('demo-rain-cancelled'), template('booth'));
    expect(resolved.indexOf('title')).toBeLessThan(resolved.indexOf('field'));
    expect(resolved.indexOf('field')).toBeLessThan(resolved.indexOf('tags'));
  });

  it('renders only what the facility template declares', () => {
    // facility is [title, field(cancelled), hours] — no thumbnail, no tags.
    const resolved = kinds(item('demo-toilet-bioeng'), template('facility'));
    expect(resolved).toContain('title');
    expect(resolved).not.toContain('tags');
    expect(resolved).not.toContain('thumbnail');
  });

  it('drops thumbnail and subtitle when the item carries neither', () => {
    const bare = { ...item('demo-daybooth-01'), subtitle: null };
    const resolved = kinds(bare, template('booth'));
    expect(resolved).not.toContain('thumbnail');
    expect(resolved).not.toContain('subtitle');
  });

  it('resolves a thumbnail when one is present', () => {
    const withThumb: EventMapItem = {
      ...item('demo-daybooth-01'),
      media: { thumbnailUrl: 'https://cdn.example.com/a.png', images: [] },
    };
    expect(resolveSlots(template('booth'), withThumb)).toContainEqual({
      kind: 'thumbnail',
      uri: 'https://cdn.example.com/a.png',
    });
  });

  it('stringifies a numeric field value', () => {
    // `fields` is Record<string, string | number>, so a number is legal data and
    // 0 is content — only '' means "nothing to show".
    const withCount: EventMapItem = { ...item('demo-daybooth-01'), fields: { cancelled: 0 } };
    expect(resolveSlots(template('booth'), withCount)).toContainEqual({
      kind: 'field',
      fieldKey: 'cancelled',
      label: '안내',
      value: '0',
    });
  });

  it('drops a whitespace-only value rather than rendering an empty row', () => {
    const blank: EventMapItem = {
      ...item('demo-daybooth-01'),
      fields: { cancelled: '   ' },
      subtitle: '  ',
    };
    const resolved = kinds(blank, template('booth'));
    expect(resolved).not.toContain('field');
    expect(resolved).not.toContain('subtitle');
  });

  it('renders tags when the template asks for them', () => {
    const resolved = resolveSlots(template('booth'), item('demo-daybooth-01'));
    expect(resolved).toContainEqual({
      kind: 'tags',
      values: item('demo-daybooth-01').tags,
    });
  });

  it('falls back when the item names no template', () => {
    // parseItem defaults cardTemplateId to '', so an unresolvable lookup is
    // ordinary rather than an error — and must not render an empty card.
    const resolved = kinds(item('demo-daybooth-01'), undefined);
    expect(resolved).toContain('title');
    // The fallback is what shipped before templates existed, which did not
    // include tags. A fallback is not the place to introduce something new.
    expect(resolved).not.toContain('tags');
  });

  it('falls back when the template survived parsing with zero slots', () => {
    // parseCardTemplate keeps a template whose slot kinds were all unrecognised.
    const resolved = kinds(item('demo-daybooth-01'), { id: 'booth', slots: [] });
    expect(resolved).toContain('title');
  });
});
