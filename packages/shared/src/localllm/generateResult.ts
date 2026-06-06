/**
 * Pure helpers for assembling GenerateResult and resolving per-call options.
 * No native deps — shared by both the llama.cpp and Anemll adapters, vitest-testable.
 */
import type { GenerateOptions, GenerateResult } from './types';

/** Per-call options after defaults are applied (no AbortSignal — not a generation param). */
export interface ResolvedGenerateOptions {
  nPredict: number;
  temperature: number;
  topP: number;
  stop: string[];
}

/**
 * Build a GenerateResult, computing tokens/sec defensively.
 * Anemll's `generateResponse` returns (tokens, elapsed, stopReason); the llama
 * adapter derives the same shape from `NativeCompletionResult.timings`.
 */
export function buildGenerateResult(args: {
  text: string;
  inputTokens: number;
  outputTokens: number;
  firstTokenMs: number;
  elapsedSec: number;
}): GenerateResult {
  const tokPerSec = args.elapsedSec > 0 ? args.outputTokens / args.elapsedSec : 0;
  return {
    text: args.text,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    firstTokenMs: args.firstTokenMs,
    tokPerSec,
  };
}

/**
 * Merge per-call GenerateOptions over the adapter's defaults. Explicit `undefined`
 * fields fall back to the default; `signal` is intentionally dropped (cancellation
 * is wired separately, not passed to native generation params).
 */
export function resolveGenerateOptions(
  opts: GenerateOptions | undefined,
  defaults: ResolvedGenerateOptions,
): ResolvedGenerateOptions {
  return {
    nPredict: opts?.nPredict ?? defaults.nPredict,
    temperature: opts?.temperature ?? defaults.temperature,
    topP: opts?.topP ?? defaults.topP,
    stop: opts?.stop ?? defaults.stop,
  };
}
