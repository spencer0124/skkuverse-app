import type { AppFailure, BookmarkEntry } from '@skkuverse/shared';

export type NoticeDetailState<T> =
  | { status: 'loading' }
  | { status: 'deleted'; entry: BookmarkEntry }
  | { status: 'error' }
  | { status: 'ready'; notice: T };

export interface DecideNoticeDetailStateInputs<T> {
  isLoading: boolean;
  isError: boolean;
  error: AppFailure | null;
  data: T | undefined;
  bookmark: BookmarkEntry | null;
}

// WHY: the tombstone is only for a deleted notice the user saved; any other 404 keeps the plain
// error and retry, as the server's notices API decision says.
export function decideNoticeDetailState<T>({
  isLoading,
  isError,
  error,
  data,
  bookmark,
}: DecideNoticeDetailStateInputs<T>): NoticeDetailState<T> {
  if (isLoading) return { status: 'loading' };
  if (isError && error?.type === 'server' && error.statusCode === 404 && bookmark !== null) {
    return { status: 'deleted', entry: bookmark };
  }
  if (isError || !data) return { status: 'error' };
  return { status: 'ready', notice: data };
}
