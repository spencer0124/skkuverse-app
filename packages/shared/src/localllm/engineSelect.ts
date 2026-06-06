/**
 * Pure engine-selection policy for the on-device LLM A/B toggle.
 * `llama` (GGUF/Metal) is the universal default; `anemll` (CoreML/ANE) requires
 * iOS 18+ (Anemll's multifunction CoreML models declare .iOS(.v18)) and is iOS-only.
 * No native deps — vitest-testable; consumed by the engine store + debug screen.
 */
export type LlmEngineId = 'llama' | 'anemll';

export interface DeviceEnv {
  platform: 'ios' | 'android';
  /** Major OS version, e.g. 18 for iOS 18.x. */
  osMajor: number;
}

/** Whether the Anemll/ANE engine can run on this device. */
export function canUseAnemllEngine(env: DeviceEnv): boolean {
  return env.platform === 'ios' && env.osMajor >= 18;
}

/**
 * Resolve the effective engine: honor an `anemll` request only on a supported
 * device, otherwise fall back to `llama`. `llama` is always allowed.
 */
export function resolveEngine(requested: LlmEngineId, env: DeviceEnv): LlmEngineId {
  if (requested === 'anemll' && !canUseAnemllEngine(env)) {
    return 'llama';
  }
  return requested;
}
