import { describe, it, expect } from 'vitest';
import { parseAppConfig } from '../parser';
import type { ApiEnvelope } from '../../api/types';

/**
 * `webview.bridgeOrigins` is a SECURITY list — it decides which pages may reach
 * the native bridge from the /webview shell. Every degraded path here must
 * shrink the grant, never widen it, which is the opposite of how the rest of
 * this package falls back (useMapConfig serves defaults when the API dies).
 */

const envelope = (data: unknown): ApiEnvelope<unknown> => ({
  meta: { code: 200 },
  data,
});

const platforms = {
  ios: { minVersion: '2.0.0', updateUrl: 'https://apps.apple.com/x' },
  android: { minVersion: '2.0.0', updateUrl: null },
};

describe('parseAppConfig — version gate', () => {
  it('parses the platform gates', () => {
    const cfg = parseAppConfig(envelope(platforms));
    expect(cfg.ios).toEqual(platforms.ios);
    expect(cfg.android).toEqual(platforms.android);
  });

  it('defaults a missing platform to 0.0.0 so nobody is force-updated', () => {
    const cfg = parseAppConfig(envelope({}));
    expect(cfg.ios.minVersion).toBe('0.0.0');
    expect(cfg.android.updateUrl).toBeNull();
  });
});

describe('parseAppConfig — bridgeOrigins (fail-closed)', () => {
  it('parses a well-formed allowlist', () => {
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        webview: { bridgeOrigins: ['https://webview.skkuuniverse.com'] },
      }),
    );
    expect(cfg.webview.bridgeOrigins).toEqual([
      'https://webview.skkuuniverse.com',
    ]);
  });

  it('grants nothing when the section is missing or malformed', () => {
    // An older server, a partial response, or a shape change must all mean
    // "grant nobody" — never a baked-in default list.
    for (const data of [
      { ...platforms },
      { ...platforms, webview: null },
      { ...platforms, webview: {} },
      { ...platforms, webview: { bridgeOrigins: null } },
      { ...platforms, webview: { bridgeOrigins: 'https://x.test' } },
      { ...platforms, webview: { bridgeOrigins: {} } },
      {},
      null,
    ]) {
      expect(parseAppConfig(envelope(data)).webview.bridgeOrigins).toEqual([]);
    }
  });

  it('normalizes entries to bare origins so comparison can match', () => {
    // The client compares against `new URL(pageUrl).origin`, which never has a
    // path or trailing slash. An un-normalized entry would silently never match.
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        webview: {
          bridgeOrigins: [
            'https://a.test/',
            'https://b.test/some/path?q=1#h',
            'https://c.test:8443',
          ],
        },
      }),
    );
    expect(cfg.webview.bridgeOrigins).toEqual([
      'https://a.test',
      'https://b.test',
      'https://c.test:8443',
    ]);
  });

  it('rejects non-https and unparseable entries', () => {
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        webview: {
          bridgeOrigins: [
            'http://insecure.test',
            'javascript:alert(1)',
            'not a url',
            '',
            42,
            null,
            'https://ok.test',
          ],
        },
      }),
    );
    expect(cfg.webview.bridgeOrigins).toEqual(['https://ok.test']);
  });

  it('de-duplicates entries that normalize to the same origin', () => {
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        webview: {
          bridgeOrigins: ['https://a.test', 'https://a.test/', 'https://a.test/x'],
        },
      }),
    );
    expect(cfg.webview.bridgeOrigins).toEqual(['https://a.test']);
  });
});

describe('parseAppConfig — web.origin', () => {
  it('parses a valid https origin', () => {
    const cfg = parseAppConfig(
      envelope({ ...platforms, web: { origin: 'https://skkuverse.com' } }),
    );
    expect(cfg.web.origin).toBe('https://skkuverse.com');
  });

  it('is null when absent or unusable, so callers degrade instead of guessing', () => {
    for (const web of [
      undefined,
      null,
      {},
      { origin: 42 },
      { origin: 'http://skkuverse.com' },
      { origin: 'not a url' },
    ]) {
      expect(parseAppConfig(envelope({ ...platforms, web })).web.origin).toBeNull();
    }
  });
});

describe('parseAppConfig — miniapps.origins', () => {
  it('parses origin → mini-app id', () => {
    const origins = {
      'https://eskara.miniapp.skkuverse.com': 'eskara-2026',
      'https://mukja.mini.skkuverse.com': 'mukja',
    };
    const cfg = parseAppConfig(envelope({ ...platforms, miniapps: { origins } }));
    expect(cfg.miniapps.origins).toEqual(origins);
  });

  it('is empty when absent or malformed, which leaves every URL in /webview', () => {
    for (const miniapps of [undefined, null, {}, { origins: null }, { origins: [] }, { origins: 'x' }]) {
      expect(parseAppConfig(envelope({ ...platforms, miniapps })).miniapps.origins).toEqual({});
    }
  });

  it('drops entries a page origin could never match, or whose id is not a registry id', () => {
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        miniapps: {
          origins: {
            'https://mukja.mini.skkuverse.com': 'mukja',
            'http://playlist.mini.skkuverse.com': 'playlist',
            'https://inja.mini.skkuverse.com/': 'inja',
            'https://booth-box.mini.skkuverse.com/x': 'booth-box',
            'not a url': 'eskara-2026',
            'https://a.mini.skkuverse.com': 'Bad Id',
            'https://b.mini.skkuverse.com': 42,
          },
        },
      }),
    );
    expect(cfg.miniapps.origins).toEqual({ 'https://mukja.mini.skkuverse.com': 'mukja' });
  });
});
