/**
 * What a hook with a fallback hands its caller: the last good answer if there
 * is one, the fallback once a fetch has failed with nothing to fall back on,
 * and `undefined` while the first fetch is still in flight.
 *
 * The queryFn behind it must THROW on failure rather than return the fallback.
 * A returned fallback is a success to React Query: it replaces good data and is
 * then kept for the whole staleTime, so one failed request during a spike would
 * pin the defaults for minutes. A thrown failure keeps the last good data in
 * place (React Query does not clear `data` on a failed refetch), and a query
 * that failed with no data refetches on the next mount or foreground.
 */
export function dataOrFallback<T>(
  query: { data: T | undefined; isError: boolean },
  fallback: T,
): T | undefined {
  if (query.data !== undefined) return query.data;
  return query.isError ? fallback : undefined;
}
