/**
 * The notices tab gate: the list only for a signed-in user who finished the
 * notices onboarding. And the name a source goes by, from the tab config.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import tabs from './__fixtures__/notice-tabs.json';
import { noticeTabsSchema } from './notices.schema';
import { showsOnboardingLanding, toBoardName, toSourceName } from './notices.rules';

describe('showsOnboardingLanding', () => {
  it.each([
    { isAnonymous: true, onboardingCompleted: false, landing: true },
    { isAnonymous: true, onboardingCompleted: true, landing: true },
    { isAnonymous: false, onboardingCompleted: false, landing: true },
    { isAnonymous: false, onboardingCompleted: true, landing: false },
  ])('anonymous $isAnonymous, onboarded $onboardingCompleted -> landing $landing', ({ landing, ...inputs }) => {
    // Act
    const shows = showsOnboardingLanding(inputs);

    // Assert
    expect(shows).toBe(landing);
  });
});

describe('toSourceName', () => {
  const config = parseOrThrow(noticeTabsSchema, tabs.data, 'notices.tabs');

  it.each([
    ['a fixed tab', 'skku-notice02', '성균관대_통합(학사)'],
    ['a picker source', 'cheme', '화학공학과'],
    ['a source in a later picker tab', 'lib-nsc', '삼성학술정보관'],
    ['a source no tab lists', 'nowhere', null],
  ])('names %s', (_name, sourceId, expected) => {
    // Act & Assert
    expect(toSourceName(config, sourceId)).toBe(expected);
  });

  it('names nothing before the config arrives', () => {
    // Act & Assert
    expect(toSourceName(undefined, 'skku-notice02')).toBeNull();
  });
});

describe('toBoardName', () => {
  const config = parseOrThrow(noticeTabsSchema, tabs.data, 'notices.tabs');

  it('names a listed source by the tab config, not by the notice', () => {
    // Act & Assert
    expect(toBoardName(config, { sourceId: 'cheme', department: '화학공학과 홈페이지' })).toBe('화학공학과');
  });

  it.each([
    ['a source no tab lists', config],
    ['a config that has not arrived', undefined],
  ])('falls back to the notice department for %s', (_name, noConfig) => {
    // Act & Assert
    expect(toBoardName(noConfig, { sourceId: 'nowhere', department: '학사과' })).toBe('학사과');
  });

  it('names nothing when the notice has no department either', () => {
    // Act & Assert
    expect(toBoardName(config, { sourceId: 'nowhere', department: null })).toBeNull();
  });
});
