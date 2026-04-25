import { describe, it, expect } from 'vitest';
import { buildTopic, parseTopic } from '../topics';

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
