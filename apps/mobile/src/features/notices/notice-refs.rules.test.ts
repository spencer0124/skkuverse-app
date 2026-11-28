import { describe, expect, it } from 'vitest';
import { toLinkHref, toMailtoHref, toTelHref } from './notice-refs.rules';

describe('toLinkHref', () => {
  it.each([
    ['www.snukdt.com', 'https://www.snukdt.com'],
    ['example.edu/apply?x=1', 'https://example.edu/apply?x=1'],
    ['https://example.edu/a', 'https://example.edu/a'],
    ['HTTP://example.edu', 'HTTP://example.edu'],
    ['javascript:alert(1)', 'https://javascript:alert(1)'],
  ])('opens %s as %s', (url, href) => {
    // Act & Assert
    expect(toLinkHref(url)).toBe(href);
  });
});

describe('toTelHref', () => {
  it.each([
    ['02-740-1724', 'tel:027401724'],
    ['02.760.1092', 'tel:027601092'],
    [' +82-2-760-1092', 'tel:+8227601092'],
    ['031) 290-5832 (내선)', 'tel:0312905832'],
  ])('dials %s as %s', (value, href) => {
    // Act & Assert
    expect(toTelHref(value)).toBe(href);
  });
});

describe('toMailtoHref', () => {
  it('opens the address in mail', () => {
    // Act & Assert
    expect(toMailtoHref(' dellik@skku.edu ')).toBe('mailto:dellik@skku.edu');
  });
});
