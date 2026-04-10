import { describe, it, expect } from 'vitest';
import { CRAWLER_ENABLED_DEPT_IDS } from '../constants';

describe('CRAWLER_ENABLED_DEPT_IDS', () => {
  it('mirrors the 7 departments enabled in skkuverse-crawler docker-compose', () => {
    // Source: skkuverse-crawler/py/docker-compose.yml CRAWL_DEPT_FILTER
    // TODO: replace with a server-provided `crawlerEnabled` flag so we don't
    // need an app release every time the crawler adds a department.
    expect([...CRAWLER_ENABLED_DEPT_IDS]).toEqual([
      'skku-main',
      'cal-undergrad',
      'bio-undergrad',
      'nano',
      'dorm-seoul',
      'medicine',
      'cheme',
    ]);
  });

  it('has no duplicates', () => {
    const set = new Set(CRAWLER_ENABLED_DEPT_IDS);
    expect(set.size).toBe(CRAWLER_ENABLED_DEPT_IDS.length);
  });
});
