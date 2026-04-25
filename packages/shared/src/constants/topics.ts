/**
 * Notification topic constants and utilities.
 *
 * Topics use a `prefix:id` namespace convention:
 *   category:scholarship, dept:cs, library:insa, dorm:jagwa
 *
 * Convention: picker tab keys (`dept`, `library`, `dorm`, `general`) are
 * identical to their topic prefix. The Cloud Function derive logic (v5
 * SSOT) relies on this — no separate prefix mapping is needed on either
 * side. See `functions/src/notifications/tabsContract.ts` for the canonical
 * fixed/picker key lists.
 *
 * Clients no longer subscribe to topics directly. They write *intent*
 * (categoryEnabled + pickerSelections) to Firestore, and the
 * `onPreferencesWrite` Cloud Function derives `subscribedTopics`. Hence
 * `pickerPrefixForTabKey` and `MANDATORY_TOPICS` were removed in Phase D
 * — derivation lives only in the server.
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

export function parseTopic(topic: string): { prefix: string; id: string } {
  const colonIndex = topic.indexOf(':');
  if (colonIndex === -1) return { prefix: '', id: topic };
  return {
    prefix: topic.substring(0, colonIndex),
    id: topic.substring(colonIndex + 1),
  };
}
