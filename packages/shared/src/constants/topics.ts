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
