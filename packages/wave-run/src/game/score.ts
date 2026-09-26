/** Zero-padded to five digits, the way the original shows it. */
export function formatScore(score: number): string {
  return String(Math.min(99999, Math.max(0, Math.floor(score)))).padStart(5, '0');
}
