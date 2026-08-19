/**
 * Where a notification tap lands.
 *
 * Two properties matter more than the individual cases. First, an action type
 * newer than this build must never reach a URL opener as a raw string — that was
 * the failure `parseActionType`'s `'unknown'` sentinel was introduced to stop,
 * and this resolver must not reintroduce it one layer up. Second, a mini-app
 * push must not produce a dead tap: anything the build cannot navigate falls
 * back to the mini app itself, resolved by id through the registry.
 */

import { describe, it, expect } from 'vitest';
import { resolveNotificationTap } from '../resolveNotificationTap';

describe('resolveNotificationTap', () => {
  describe('nothing to do', () => {
    it('returns null for undefined data', () => {
      expect(resolveNotificationTap(undefined)).toBeNull();
    });

    it('returns null when type is missing or empty', () => {
      expect(resolveNotificationTap({})).toBeNull();
      expect(resolveNotificationTap({ type: '' })).toBeNull();
    });

    it('returns null for an unrecognised message type', () => {
      expect(resolveNotificationTap({ type: 'bus-arrival' })).toBeNull();
    });

    it('returns null for eventmap-refresh, which is silent and never tapped', () => {
      expect(resolveNotificationTap({ type: 'eventmap-refresh', miniAppId: 'eskara' })).toBeNull();
    });
  });

  describe('notice — unchanged behaviour', () => {
    it('resolves a complete notice payload', () => {
      expect(
        resolveNotificationTap({ type: 'notice', sourceId: 'cse', articleNo: '5847' }),
      ).toEqual({ kind: 'notice', sourceId: 'cse', articleNo: '5847' });
    });

    it.each([
      ['no articleNo', { type: 'notice', sourceId: 'cse' }],
      ['no sourceId', { type: 'notice', articleNo: '5847' }],
      ['empty sourceId', { type: 'notice', sourceId: '', articleNo: '5847' }],
    ])('returns null with %s', (_label, data) => {
      expect(resolveNotificationTap(data)).toBeNull();
    });
  });

  describe('miniapp — a target this build can navigate', () => {
    it.each(['route', 'webview', 'external'] as const)('dispatches %s as an SDUI action', (actionType) => {
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara',
          actionType,
          actionValue: 'https://webview.skkuverse.com/eskara',
        }),
      ).toEqual({
        kind: 'sdui-action',
        actionType,
        actionValue: 'https://webview.skkuverse.com/eskara',
      });
    });

    it("maps the legacy 'url' spelling onto external, as parseActionType does", () => {
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara',
          actionType: 'url',
          actionValue: 'https://x.test/a',
        }),
      ).toEqual({ kind: 'sdui-action', actionType: 'external', actionValue: 'https://x.test/a' });
    });
  });

  describe('miniapp — falling back to the mini app itself', () => {
    it('falls back when the payload names no target', () => {
      expect(resolveNotificationTap({ type: 'miniapp', miniAppId: 'eskara' })).toEqual({
        kind: 'miniapp',
        id: 'eskara',
      });
    });

    it('falls back for an action type newer than this build, rather than opening the raw string', () => {
      const tap = resolveNotificationTap({
        type: 'miniapp',
        miniAppId: 'eskara',
        actionType: 'teleport',
        actionValue: 'javascript:alert(1)',
      });
      expect(tap).toEqual({ kind: 'miniapp', id: 'eskara' });
    });

    it.each(['content', 'miniapp'])('falls back for the non-navigable type %s', (actionType) => {
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara',
          actionType,
          actionValue: 'https://x.test/a',
        }),
      ).toEqual({ kind: 'miniapp', id: 'eskara' });
    });

    it('falls back when actionValue is empty despite a valid actionType', () => {
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara',
          actionType: 'webview',
          actionValue: '',
        }),
      ).toEqual({ kind: 'miniapp', id: 'eskara' });
    });

    it('returns null when there is no miniAppId to fall back to', () => {
      expect(resolveNotificationTap({ type: 'miniapp' })).toBeNull();
      expect(
        resolveNotificationTap({ type: 'miniapp', actionType: 'teleport', actionValue: 'x' }),
      ).toBeNull();
    });
  });

  describe('non-string values cannot smuggle through', () => {
    it('ignores fields FCM could never have sent as strings', () => {
      const hostile = {
        type: 'miniapp',
        miniAppId: 7,
        actionType: { actionType: 'webview' },
        actionValue: ['https://x.test'],
      } as unknown as Parameters<typeof resolveNotificationTap>[0];
      expect(resolveNotificationTap(hostile)).toBeNull();
    });
  });
});
