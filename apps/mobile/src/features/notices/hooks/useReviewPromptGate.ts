/**
 * Re-export from the shared feedback module.
 * The review-prompt gate is no longer notices-specific — it now lives in
 * src/features/feedback/ to support multiple surfaces (notices, shuttle, etc.).
 */
export {
  shouldShowReviewPrompt,
  DEV_ALWAYS_SHOW,
  THREE_DAYS_MS,
  SEVEN_DAYS_MS,
  NINETY_DAYS_MS,
} from '@/features/feedback/useReviewPromptGate';
