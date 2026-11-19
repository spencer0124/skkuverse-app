import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideScreenView, resolveScreenName, screenKey, urlHost } from './screen-names.rules.ts';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app');

/** Values for dynamic segments and query params, so every route resolves. */
const SAMPLE_SEGMENTS: Record<string, string> = {
  sourceId: 'cs',
  articleNo: '123',
};
const SAMPLE_PARAMS = { url: 'https://www.skku.edu/notice', id: 'eskara', videoId: 'v1' };

/** Routes allowed no screen name, with the reason. */
const UNNAMED: Record<string, string> = {
  '/': 'app/index.tsx only redirects to /home',
};

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** `app/(tabs)/notices/index.tsx` → `/notices`; `[id]` takes a sample value. */
function toPathname(file: string): string | null {
  const parts = relative(APP_DIR, file).split(sep);
  const last = parts.pop()!.replace(/\.tsx?$/, '');
  if (last.startsWith('_') || last.startsWith('+')) return null; // layouts, native intent
  if (last !== 'index') parts.push(last);
  const segments = parts
    .filter((p) => !/^\(.+\)$/.test(p)) // route groups
    .map((p) => {
      const dynamic = /^\[(.+)\]$/.exec(p);
      if (!dynamic) return p;
      const name = dynamic[1]!;
      // A game id must be one the router accepts; any id names the feed.
      return SAMPLE_SEGMENTS[name] ?? (parts.includes('games') ? 'wave-run' : 'eskara');
    });
  return `/${segments.join('/')}`;
}

describe('every route has a screen name', () => {
  const pathnames = routeFiles(APP_DIR)
    .map(toPathname)
    .filter((p): p is string => p !== null);

  test('the route list is read', () => {
    assert.ok(pathnames.includes('/home'), 'app/(tabs)/home/index.tsx resolves to /home');
    assert.ok(pathnames.length > 30, `only ${pathnames.length} routes found`);
  });

  for (const pathname of pathnames) {
    test(pathname, () => {
      if (pathname in UNNAMED) return;
      assert.ok(
        resolveScreenName(pathname, SAMPLE_PARAMS),
        `${pathname} has no screen name: add it to SCREEN_NAMES in src/bootstrap/screen-names.rules.ts`,
      );
    });
  }
});

describe('resolveScreenName', () => {
  test('names kept from the first rollout are unchanged', () => {
    assert.equal(resolveScreenName('/campus', {}), 'campus_screen');
    assert.equal(resolveScreenName('/notices', {}), 'notices_tab');
    assert.equal(resolveScreenName('/notices/saved', {}), 'notices_bookmarks');
    assert.equal(resolveScreenName('/notices/cs', {}), 'notices_list');
    assert.equal(resolveScreenName('/notices/cs/123', {}), 'notice_detail');
    assert.equal(resolveScreenName('/notices/cs/123/body', {}), 'notice_body');
    assert.equal(resolveScreenName('/routes/hssc-to-nsc', {}), 'campus_route');
    assert.equal(resolveScreenName('/games/wave-run', {}), 'game_wave_run');
    assert.equal(resolveScreenName('/games/subway-typing/leaderboard', {}), 'game_subway_typing_leaderboard');
  });

  test('a game is named from its id', () => {
    assert.equal(resolveScreenName('/games/new-game', {}), 'game_new_game');
    assert.equal(resolveScreenName('/games/new-game/leaderboard', {}), 'game_new_game_leaderboard');
  });

  test('the cafeteria menus are one screen, whatever the campus or day', () => {
    assert.equal(resolveScreenName('/meals', {}), 'meals');
    assert.equal(screenKey('/meals', {}), '/meals');
  });

  test('a webview is named from the host, whatever the title', () => {
    const name = resolveScreenName('/webview', { url: 'https://www.skku.edu/a?b=1', title: '공지' });
    assert.equal(name, 'webview_skku_edu');
    assert.equal(resolveScreenName('/webview', { url: 'not a url' }), 'webview');
    assert.equal(resolveScreenName('/webview', {}), 'webview');
  });

  test('an unknown route has no name', () => {
    assert.equal(resolveScreenName('/nowhere', {}), null);
  });
});

describe('urlHost', () => {
  test('host only, lowercased, without www', () => {
    assert.equal(urlHost('HTTPS://WWW.Example.com:8443/x'), 'example.com');
    assert.equal(urlHost('http://user@host.kr/'), 'host.kr');
    assert.equal(urlHost('mailto:a@b.c'), '');
  });
});

describe('screenKey', () => {
  test('the pathname, plus the target where the path does not carry it', () => {
    assert.equal(screenKey('/notices/cs/1', { id: 'x' }), '/notices/cs/1');
    assert.equal(screenKey('/mini-app', { id: 'eskara' }), '/mini-app?id=eskara');
    assert.equal(screenKey('/webview', { url: 'https://a.b' }), '/webview?url=https://a.b');
    assert.equal(screenKey('/video-player', { videoId: 'v1' }), '/video-player?videoId=v1');
  });
});

describe('decideScreenView', () => {
  const at = (pathname: string, params = {}) => ({ ready: true, overlay: null, pathname, params });

  test('nothing is logged before init; the screen on show is logged once it completes', () => {
    const before = decideScreenView(null, { ...at('/home'), ready: false });
    assert.deepEqual(before, { key: null, log: null });
    assert.deepEqual(decideScreenView(before.key, at('/home')), { key: '/home', log: 'home' });
  });

  test('the intro is its own screen, and closing it logs the screen under it', () => {
    const intro = decideScreenView(null, { ...at('/home'), overlay: 'intro' });
    assert.deepEqual(intro, { key: '#intro', log: 'intro' });
    assert.deepEqual(decideScreenView(intro.key, at('/home')), { key: '/home', log: 'home' });
  });

  test('moving between two notices or two mini apps is two screen_views', () => {
    const a = decideScreenView(null, at('/notices/cs/1'));
    assert.equal(decideScreenView(a.key, at('/notices/cs/2')).log, 'notice_detail');
    const m = decideScreenView(null, at('/mini-app', { id: 'a' }));
    assert.equal(decideScreenView(m.key, at('/mini-app', { id: 'b' })).log, 'mini_app_screen');
  });

  test('the same screen again is not logged', () => {
    assert.deepEqual(decideScreenView('/home', at('/home')), { key: '/home', log: null });
  });

  test('an unnamed route still moves the key, so returning logs again', () => {
    const away = decideScreenView('/home', at('/nowhere'));
    assert.deepEqual(away, { key: '/nowhere', log: null });
    assert.equal(decideScreenView(away.key, at('/home')).log, 'home');
  });
});
