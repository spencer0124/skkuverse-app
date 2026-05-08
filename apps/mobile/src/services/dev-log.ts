import { createMMKV } from 'react-native-mmkv';

/**
 * Persistent dev-log buffer for production-build diagnosis (TestFlight/Play Internal).
 *
 * Why this exists: `__DEV__` is false in production builds, so `if (__DEV__) console.log`
 * is dead code in TestFlight. To diagnose cold-start FCM races / navigation timing /
 * notifee press handler gaps on real devices, we need a persistent buffer that survives
 * the very crash/reload we're trying to inspect.
 *
 * MMKV (sync) is chosen over AsyncStorage on purpose — sync API means there is no
 * hydrate race: the buffer is populated at module-load time and every devLog call
 * is an atomic read-modify-write. An async hydrate would risk overwriting the very
 * `getInitialNotification.resolve` entry that landed during the await window — i.e.
 * losing the cold-start log we needed most.
 *
 * RELEASE-GATE(debug-menu): the settings entry that exposes this is gated by an
 * explicit comment marker. Search `RELEASE-GATE(debug-menu)` before App Store
 * production builds and remove the entry.
 *
 * Sensitive-data rule: log noticeId / sourceId / articleNo / data keys only.
 * Never feed FCM tokens, user IDs, or auth tokens into devLog — share/copy paths
 * exfiltrate verbatim.
 */

const mmkv = createMMKV({ id: 'skkubus-debug' });
const KEY = 'dev-log:notif';
const MAX = 500;

type LogEntry = { ts: string; tag: string; data: unknown };

function loadFromDisk(): LogEntry[] {
  try {
    const raw = mmkv.getString(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return [];
  }
}

let buf: LogEntry[] = loadFromDisk();

export function devLog(tag: string, data?: unknown): void {
  const entry: LogEntry = { ts: new Date().toISOString(), tag, data };
  buf.push(entry);
  if (buf.length > MAX) buf = buf.slice(-MAX);
  try {
    mmkv.set(KEY, JSON.stringify(buf));
  } catch {
    // serialization failure — drop persistence for this entry, keep in-memory.
  }
  if (__DEV__) {
    console.log(`[${tag}]`, data);
  }
}

export function getDevLogs(): LogEntry[] {
  return buf.slice();
}

export function clearDevLogs(): void {
  buf = [];
  try {
    mmkv.remove(KEY);
  } catch {
    // ignore — buffer already cleared in-memory.
  }
}

export function formatLogsForShare(): string {
  return buf
    .map((e) => `[${e.ts}] ${e.tag}\n${JSON.stringify(e.data, null, 2)}`)
    .join('\n\n');
}
