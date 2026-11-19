/**
 * Which view the notice detail shows: the skeleton while the first fetch runs,
 * the tombstone for a saved notice the server no longer has, the error with a
 * retry for every other failure or a missing answer, and the notice itself.
 */
import { describe, expect, it } from 'vitest';
import { Failure, parseOrThrow, type AppFailure, type BookmarkEntry } from '@skkuverse/shared';
import detail from './__fixtures__/notice-detail.json';
import { noticeDetailSchema } from './notices.schema';
import { decideNoticeDetailState } from './notice-detail.rules';

const notice = parseOrThrow(noticeDetailSchema, detail.data, 'notices.detail');
const saved: BookmarkEntry = {
  sourceId: notice.sourceId,
  articleNo: notice.articleNo,
  savedAt: {} as BookmarkEntry['savedAt'],
  title: notice.title,
  department: notice.department,
  date: notice.date,
  sourceUrl: notice.sourceUrl,
  hasContent: true,
  hasAttachments: true,
};
const notFound = Failure.server(404, 'not found');

const failed = (error: AppFailure) => ({ isLoading: false, isError: true, error });
const settled = { isLoading: false, isError: false, error: null };

describe('decideNoticeDetailState', () => {
  it('shows the skeleton while the first fetch runs, saved or not', () => {
    // Arrange
    const loading = { isLoading: true, isError: false, error: null, data: undefined };

    // Act & Assert
    expect(decideNoticeDetailState({ ...loading, bookmark: saved })).toEqual({ status: 'loading' });
    expect(decideNoticeDetailState({ ...loading, bookmark: null })).toEqual({ status: 'loading' });
  });

  it('shows the tombstone for a saved notice that 404s', () => {
    // Act
    const state = decideNoticeDetailState({ ...failed(notFound), data: undefined, bookmark: saved });

    // Assert
    expect(state).toEqual({ status: 'deleted', entry: saved });
  });

  it('keeps the tombstone when a refetch 404s under a notice already on screen', () => {
    // Act
    const state = decideNoticeDetailState({ ...failed(notFound), data: notice, bookmark: saved });

    // Assert
    expect(state).toEqual({ status: 'deleted', entry: saved });
  });

  it.each([
    { name: 'a 404 on a notice nobody saved', error: notFound, bookmark: null },
    { name: 'a server error on a saved notice', error: Failure.server(500, 'boom'), bookmark: saved },
    { name: 'a network failure on a saved notice', error: Failure.network('offline'), bookmark: saved },
    { name: 'an unreadable answer on a saved notice', error: Failure.parse('bad'), bookmark: saved },
  ])('shows the error for $name', ({ error, bookmark }) => {
    // Act
    const state = decideNoticeDetailState({ ...failed(error), data: undefined, bookmark });

    // Assert
    expect(state).toEqual({ status: 'error' });
  });

  it('shows the error when a refetch fails under a notice nobody saved, dropping the notice', () => {
    // Act
    const state = decideNoticeDetailState({ ...failed(Failure.network('offline')), data: notice, bookmark: null });

    // Assert
    expect(state).toEqual({ status: 'error' });
  });

  it('shows the error for a query with no answer and no failure, as when it waits offline', () => {
    // Act
    const state = decideNoticeDetailState({ ...settled, data: undefined, bookmark: saved });

    // Assert
    expect(state).toEqual({ status: 'error' });
  });

  it('shows the notice once it arrives, saved or not', () => {
    // Act & Assert
    expect(decideNoticeDetailState({ ...settled, data: notice, bookmark: saved })).toEqual({ status: 'ready', notice });
    expect(decideNoticeDetailState({ ...settled, data: notice, bookmark: null })).toEqual({ status: 'ready', notice });
  });
});
