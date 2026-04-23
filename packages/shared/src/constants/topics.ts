/**
 * Notification topic constants and utilities.
 *
 * Topics use a `prefix:id` namespace convention:
 *   category:scholarship, dept:cs, library:insa, dorm:jagwa
 *
 * This allows the subscribedTopics array to remain flat and extensible —
 * new source types (dorm, club, ...) are added without schema migration.
 */

export const TopicPrefix = {
  CATEGORY: 'category',
  DEPT: 'dept',
  LIBRARY: 'library',
} as const;

export type TopicPrefixValue = (typeof TopicPrefix)[keyof typeof TopicPrefix];

export function buildTopic(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

/**
 * Maps a picker tab's `key` (from /notices/tabs) to the FCM topic prefix used
 * for its selected deptIds. Backend + CF contract: `dept:{id}`, `library:{id}`,
 * `dorm:{id}`. Fixed tabs always use `category:{tabKey}` and never go through
 * this helper.
 *
 * Returns `undefined` for unknown tab keys — callers must skip emission so
 * forward-compat picker types the app doesn't yet understand don't get
 * miscategorised as `dept:*`.
 */
export function pickerPrefixForTabKey(tabKey: string): string | undefined {
  switch (tabKey) {
    case 'dept':
      return TopicPrefix.DEPT;
    case 'library':
      return TopicPrefix.LIBRARY;
    default:
      return undefined;
  }
}

export function parseTopic(topic: string): { prefix: string; id: string } {
  const colonIndex = topic.indexOf(':');
  if (colonIndex === -1) return { prefix: '', id: topic };
  return {
    prefix: topic.substring(0, colonIndex),
    id: topic.substring(colonIndex + 1),
  };
}

/**
 * Mandatory topics that every user must be subscribed to.
 * These cannot be toggled off in the notification settings UI.
 * Security Rules enforce their presence on write.
 */
export const MANDATORY_TOPICS: readonly string[] = [] as const;
