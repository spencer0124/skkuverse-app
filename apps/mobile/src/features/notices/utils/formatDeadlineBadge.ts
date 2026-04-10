/**
 * Format a deadline into a D-n / 마감 badge with a severity variant.
 *
 * Day difference is computed against the *start of today* in the device's local
 * timezone (on-device that's KST).
 */
export type DeadlineVariant = 'urgent' | 'soon' | 'normal' | 'closed';

export interface DeadlineBadge {
  text: string; // "D-0" | "D-1" | "D-34" | "마감"
  variant: DeadlineVariant;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatDeadlineBadge(
  endDate: string | null,
): DeadlineBadge | null {
  if (!endDate) return null;
  const parsed = new Date(endDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const todayStart = startOfLocalDay(new Date());
  const endStart = startOfLocalDay(parsed);
  const diffDays = Math.round((endStart - todayStart) / 86_400_000);

  if (diffDays < 0) return { text: '마감', variant: 'closed' };
  if (diffDays <= 3) return { text: `D-${diffDays}`, variant: 'urgent' };
  if (diffDays <= 7) return { text: `D-${diffDays}`, variant: 'soon' };
  return { text: `D-${diffDays}`, variant: 'normal' };
}
