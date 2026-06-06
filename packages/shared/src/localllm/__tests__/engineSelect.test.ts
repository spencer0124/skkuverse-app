import { describe, it, expect } from 'vitest';
import {
  canUseAnemllEngine,
  resolveEngine,
  type LlmEngineId,
} from '../engineSelect';

describe('canUseAnemllEngine', () => {
  it('true on iOS 18+', () => {
    expect(canUseAnemllEngine({ platform: 'ios', osMajor: 18 })).toBe(true);
    expect(canUseAnemllEngine({ platform: 'ios', osMajor: 26 })).toBe(true);
  });

  it('false on iOS < 18 (ANE multifunction CoreML needs iOS 18)', () => {
    expect(canUseAnemllEngine({ platform: 'ios', osMajor: 17 })).toBe(false);
    expect(canUseAnemllEngine({ platform: 'ios', osMajor: 15 })).toBe(false);
  });

  it('false on Android (Anemll is iOS/ANE-only)', () => {
    expect(canUseAnemllEngine({ platform: 'android', osMajor: 34 })).toBe(false);
  });
});

describe('resolveEngine', () => {
  const ios18 = { platform: 'ios' as const, osMajor: 18 };
  const ios17 = { platform: 'ios' as const, osMajor: 17 };

  it('honors anemll request on supported device', () => {
    expect(resolveEngine('anemll', ios18)).toBe<LlmEngineId>('anemll');
  });

  it('falls back to llama when anemll requested on unsupported device', () => {
    expect(resolveEngine('anemll', ios17)).toBe<LlmEngineId>('llama');
  });

  it('always allows llama (universal default)', () => {
    expect(resolveEngine('llama', ios18)).toBe<LlmEngineId>('llama');
    expect(resolveEngine('llama', ios17)).toBe<LlmEngineId>('llama');
  });
});
