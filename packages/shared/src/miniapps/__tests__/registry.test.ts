import { describe, it, expect } from 'vitest';
import indexJson from '../index.json';
import skkuzine from '../details/skkuzine.json';
import skkuw from '../details/skkuw.json';
import hssc from '../details/hssc.json';
import nsc from '../details/nsc.json';
import { assertValidRegistry, type MiniAppDetail, type MiniAppIndex } from '../schema';
import {
  getMiniAppDetailSync,
  getMiniAppIndexSync,
  isMiniAppId,
  localMiniAppRepository,
} from '../repository';

const index = indexJson as unknown as MiniAppIndex;
const details: Record<string, MiniAppDetail> = {
  skkuzine: skkuzine as unknown as MiniAppDetail,
  skkuw: skkuw as unknown as MiniAppDetail,
  hssc: hssc as unknown as MiniAppDetail,
  nsc: nsc as unknown as MiniAppDetail,
};

describe('mini-app registry', () => {
  it('passes referential integrity (ids unique, every index id has a valid detail)', () => {
    expect(() => assertValidRegistry(index, details)).not.toThrow();
  });

  it('exposes the 4 mini-apps via the sync index, sorted by order', () => {
    const list = getMiniAppIndexSync();
    expect(list.map((m) => m.id)).toEqual(['hssc', 'nsc', 'skkuw', 'skkuzine']);
  });

  it('isMiniAppId recognizes registered slugs and rejects unknown ones', () => {
    expect(isMiniAppId('skkuzine')).toBe(true);
    expect(isMiniAppId('nsc')).toBe(true);
    expect(isMiniAppId('webview')).toBe(false);
    expect(isMiniAppId('')).toBe(false);
  });

  it('detail sync getter returns startUrl for a known id, undefined for unknown', () => {
    expect(getMiniAppDetailSync('skkuzine')?.startUrl).toMatch(/^https?:\/\//);
    expect(getMiniAppDetailSync('does-not-exist')).toBeUndefined();
  });

  it('async repository resolves detail and rejects unknown id', async () => {
    await expect(localMiniAppRepository.getDetail('skkuw')).resolves.toMatchObject({ id: 'skkuw' });
    await expect(localMiniAppRepository.getDetail('nope')).rejects.toThrow(/Unknown mini-app id/);
  });

  it('catches a malformed registry (dangling index id)', () => {
    const broken: MiniAppIndex = {
      version: 1,
      miniApps: [{ id: 'ghost', name: 'Ghost', order: 1, logo: { kind: 'bundled', key: 'ghost' } }],
    };
    expect(() => assertValidRegistry(broken, {})).toThrow(/has no detail/);
  });
});
