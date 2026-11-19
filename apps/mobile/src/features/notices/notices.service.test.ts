/**
 * The onboarding choices that travel between this device and the account's
 * preferences document: what a missing document is seeded with, and what an
 * onboarded document restores on this device. Then the account's bookmarks,
 * which the bookmark store follows while their listener is attached. Only
 * Firestore, App Check and the crash log are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBookmarkStore, useSettingsStore, type BookmarkEntry, type PreferencesDocument } from '@skkuverse/shared';
import { listenToBookmarks, onboardingRestore, restoreOnboardingFromPreferences } from './notices.service';

type Snapshot = { forEach: (visit: (doc: { id: string; data: () => BookmarkEntry }) => void) => void };

const sdk = vi.hoisted(() => ({
  listening: [] as { path: string; deliver: (snap: Snapshot) => void; fail: (err: unknown) => void }[],
  detached: 0,
}));

vi.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  query: (ref: { path: string }) => ref,
  orderBy: () => ({}),
  onSnapshot: (ref: { path: string }, deliver: (snap: Snapshot) => void, fail: (err: unknown) => void) => {
    sdk.listening.push({ path: ref.path, deliver, fail });
    return () => {
      sdk.detached++;
    };
  },
}));
vi.mock('@/platform/app-check', () => ({ primeAppCheck: vi.fn() }));
vi.mock('@/platform/crashlytics', () => ({ logHandledError: vi.fn() }));

beforeEach(() => {
  useSettingsStore.setState({
    onboardingCompleted: true,
    preferredCampus: 'hssc',
    primaryDeptId: 'cse',
    interestDeptIds: ['ee', 'cse', 'me'],
  });
});

describe('onboardingRestore', () => {
  it('restores the departments chosen here, primary first, as onboarded', () => {
    // Act & Assert
    expect(onboardingRestore()).toStrictEqual({ pickerSelections: { dept: ['cse', 'ee', 'me'] }, onboarded: true });
  });

  it('keeps the skipped-primary sentinel first', () => {
    // Arrange
    useSettingsStore.setState({ primaryDeptId: null, interestDeptIds: ['ee'] });

    // Act & Assert
    expect(onboardingRestore()).toStrictEqual({ pickerSelections: { dept: ['', 'ee'] }, onboarded: true });
  });

  it('restores nothing when onboarding never finished here', () => {
    // Arrange
    useSettingsStore.setState({ onboardingCompleted: false });

    // Act & Assert
    expect(onboardingRestore()).toBeUndefined();
  });
});

describe('restoreOnboardingFromPreferences', () => {
  const prefs = (fields: Partial<PreferencesDocument>): PreferencesDocument => ({
    enabled: true,
    categoryEnabled: { essential: true, services: false, notices: true },
    noticeTabEnabled: {},
    pickerSelections: {},
    subscribedTopics: [],
    derivedAt: null,
    onboardedAt: 'server-ts',
    ...fields,
  });

  beforeEach(() => {
    useSettingsStore.setState({ onboardingCompleted: false, primaryDeptId: null, interestDeptIds: [] });
  });

  it.each([
    ['primary first, then at most four interests', ['cse', 'a', 'b', 'c', 'd', 'e'], 'cse', ['a', 'b', 'c', 'd']],
    ['the skipped-primary sentinel as no primary', ['', 'a'], null, ['a']],
    ['no departments as none', undefined, null, []],
  ])('restores an onboarded account: %s', (_case, dept, primaryDeptId, interestDeptIds) => {
    // Act
    restoreOnboardingFromPreferences(prefs({ pickerSelections: dept ? { dept } : {} }));

    // Assert
    expect(useSettingsStore.getState()).toMatchObject({ onboardingCompleted: true, primaryDeptId, interestDeptIds });
  });

  it('leaves an account that never finished onboarding alone', () => {
    // Act
    restoreOnboardingFromPreferences(prefs({ onboardedAt: null, pickerSelections: { dept: ['cse'] } }));

    // Assert
    expect(useSettingsStore.getState()).toMatchObject({ onboardingCompleted: false, primaryDeptId: null });
  });
});

describe('listenToBookmarks', () => {
  const entry = (sourceId: string, articleNo: number): BookmarkEntry => ({
    sourceId,
    articleNo,
    savedAt: {} as BookmarkEntry['savedAt'],
    title: `notice ${articleNo}`,
    department: null,
    date: '2026-10-28',
    sourceUrl: `https://example.com/${articleNo}`,
    hasContent: true,
    hasAttachments: false,
  });
  const snapshot = (entries: Record<string, BookmarkEntry>): Snapshot => ({
    forEach: (visit) => Object.entries(entries).forEach(([id, data]) => visit({ id, data: () => data })),
  });
  const failures: { label: string; err: unknown }[] = [];
  const listen = <T>(
    subscribe: (onNext: (value: T) => void, onError: (err: unknown) => void) => () => void,
    label: string,
    onNext: (value: T) => void,
  ) => subscribe(onNext, (err) => failures.push({ label, err }));

  beforeEach(() => {
    sdk.listening.length = 0;
    sdk.detached = 0;
    failures.length = 0;
    useBookmarkStore.getState().clearEntries();
  });

  it("fills the bookmark store with the account's bookmarks, keyed by document id", () => {
    // Arrange
    const saved = { 'cse:5847': entry('cse', 5847), 'skku:12': entry('skku', 12) };

    // Act
    listenToBookmarks('u1', listen);
    sdk.listening[0].deliver(snapshot(saved));

    // Assert
    expect(sdk.listening.map((l) => l.path)).toStrictEqual(['users/u1/bookmarks']);
    expect(useBookmarkStore.getState()).toMatchObject({ entries: saved, loaded: true });
  });

  it('hands a listener failure to the attach under the bookmarks log key', () => {
    // Arrange
    const denied = Object.assign(new Error('denied'), { code: 'firestore/permission-denied' });
    listenToBookmarks('u1', listen);

    // Act
    sdk.listening[0].fail(denied);

    // Assert
    expect(failures).toStrictEqual([{ label: 'bookmarks/onSnapshot', err: denied }]);
    expect(useBookmarkStore.getState().loaded).toBe(false);
  });

  it('detaches the Firestore listener through what it returns', () => {
    // Arrange
    const unsubscribe = listenToBookmarks('u1', listen);

    // Act
    unsubscribe();

    // Assert
    expect(sdk.detached).toBe(1);
  });
});
