import { describe, it, expect } from 'vitest';
import {
  TopicPrefix,
  buildTopic,
  parseTopic,
  pickerPrefixForTabKey,
} from '../topics';

describe('buildTopic / parseTopic', () => {
  it('round-trips prefix and id', () => {
    const topic = buildTopic('dept', 'cs');
    expect(topic).toBe('dept:cs');
    expect(parseTopic(topic)).toEqual({ prefix: 'dept', id: 'cs' });
  });

  it('handles ids containing colons without breaking the first segment', () => {
    expect(parseTopic('library:lib-hssc')).toEqual({
      prefix: 'library',
      id: 'lib-hssc',
    });
  });
});

describe('pickerPrefixForTabKey', () => {
  it.each([
    ['dept', TopicPrefix.DEPT],
    ['library', TopicPrefix.LIBRARY],
  ])('maps %s → %s', (tabKey, expected) => {
    expect(pickerPrefixForTabKey(tabKey)).toBe(expected);
  });

  it('returns undefined for unknown tab keys (forward-compat safety)', () => {
    expect(pickerPrefixForTabKey('dorm')).toBeUndefined();
    expect(pickerPrefixForTabKey('')).toBeUndefined();
    expect(pickerPrefixForTabKey('academic')).toBeUndefined();
  });
});
