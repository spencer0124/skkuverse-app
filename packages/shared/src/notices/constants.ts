/**
 * Departments that are actually crawled by skkuverse-crawler.
 *
 * Mirrors the `CRAWL_DEPT_FILTER` env var in
 * `skkuverse-crawler/py/docker-compose.yml`. The server's
 * `GET /notices/departments` endpoint returns ALL 144 departments from
 * `departments.json`, with no "has data" filtering — so the client must
 * whitelist to avoid routing users to empty notice lists.
 *
 * TODO: Move this gating server-side. If skkuverse-server adds a
 * `crawlerEnabled: boolean` flag to each entry in the departments endpoint
 * response, the app can drop this constant and just filter by the flag,
 * removing the need for an app release whenever the crawler adds a dept.
 */
export const CRAWLER_ENABLED_DEPT_IDS = [
  'skku-main',
  'cal-undergrad',
  'bio-undergrad',
  'nano',
  'dorm-seoul',
  'medicine',
  'cheme',
] as const;

export type CrawlerEnabledDeptId = (typeof CRAWLER_ENABLED_DEPT_IDS)[number];
