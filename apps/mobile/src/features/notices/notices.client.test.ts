/**
 * The query keys the notices client builds, pinned as literals, so a move or
 * a port can never split one cache into two or merge two into one.
 */
import { describe, expect, it } from 'vitest';
import {
  multiSourceNoticeListQueryOptions,
  noticeDetailQueryOptions,
  noticeListQueryOptions,
  noticeOverviewQueryOptions,
  noticeTabsQueryOptions,
} from './notices.client';

describe('notice query keys', () => {
  it('keys a source list by source and query', () => {
    // Act
    const all = noticeListQueryOptions({ sourceId: 'skku-notice02' }).queryKey;
    const searched = noticeListQueryOptions({ sourceId: 'cse', q: '장학' }).queryKey;

    // Assert
    expect(all).toStrictEqual(['notices', 'source', 'skku-notice02', { type: 'all', q: '' }]);
    expect(searched).toStrictEqual(['notices', 'source', 'cse', { type: 'all', q: '장학' }]);
  });

  it('keys a multi-source list by its sorted sources', () => {
    // Act
    const key = multiSourceNoticeListQueryOptions({ sourceIds: ['b', 'a'] }).queryKey;

    // Assert
    expect(key).toStrictEqual(['notices', 'multi', 'a,b', { type: 'all', q: '' }]);
  });

  it('keys a detail by source and article', () => {
    // Act
    const key = noticeDetailQueryOptions('cse', 5847).queryKey;

    // Assert
    expect(key).toStrictEqual(['notices', 'detail', 'cse', 5847]);
  });

  it('keys the tabs once', () => {
    // Act
    const key = noticeTabsQueryOptions().queryKey;

    // Assert
    expect(key).toStrictEqual(['notices', 'tabs']);
  });

  it('keys an overview by its sorted sources and the server-normalized query', () => {
    // Act
    const key = noticeOverviewQueryOptions({ q: '  Dorm   Fee ', sourceIds: ['b', 'a'] }).queryKey;
    const none = noticeOverviewQueryOptions({ q: undefined, sourceIds: [] }).queryKey;

    // Assert
    expect(key).toStrictEqual(['notices', 'overview', 'a,b', 'dorm fee']);
    expect(none).toStrictEqual(['notices', 'overview', '', '']);
  });
});
