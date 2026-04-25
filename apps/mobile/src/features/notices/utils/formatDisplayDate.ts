/** "YYYY-MM-DD" → "YY.MM.DD" */
export function formatDisplayDate(date: string): string {
  return date.slice(2).replace(/-/g, '.');
}
