/**
 * 로컬 LLM 엔진 선택 store (A/B 토글).
 *
 * 기본 'llama'(GGUF/Metal, 전 기기). 'anemll'(CoreML/ANE)은 iOS 18+에서만 선택 가능 —
 * 미지원 기기에서 요청 시 resolveEngine(순수, vitest 검증)이 'llama'로 강등한다.
 * MMKV 영속(device-id.ts의 createMMKV 패턴). 엔진 교체 시 실제 force-unload+swap은
 * 디버그 화면이 forceUnloadLocalLlm()로 오케스트레이션(여기선 선호값만 보관 — 순환 의존 회피).
 */
import { create } from 'zustand';
import { Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { resolveEngine, type LlmEngineId, type DeviceEnv } from '@skkuverse/shared';

const mmkv = createMMKV({ id: 'skkubus-llm' });
const ENGINE_KEY = 'engine';

export function deviceEnv(): DeviceEnv {
  return {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    osMajor: parseInt(String(Platform.Version), 10) || 0,
  };
}

/** anemll 엔진이 이 기기에서 선택 가능한지(iOS 18+). */
export function isAnemllSupported(): boolean {
  return resolveEngine('anemll', deviceEnv()) === 'anemll';
}

function loadInitialEngine(): LlmEngineId {
  const raw = mmkv.getString(ENGINE_KEY);
  const requested: LlmEngineId = raw === 'anemll' ? 'anemll' : 'llama';
  // 저장값이 anemll이어도 미지원 기기면 llama로 강등(앱 재설치/기기 변경 방어).
  return resolveEngine(requested, deviceEnv());
}

interface EngineState {
  engine: LlmEngineId;
  /** 요청 엔진을 기기 게이트로 해석·영속하고 상태 갱신. 실제 적용 엔진을 반환. */
  setEngine: (requested: LlmEngineId) => LlmEngineId;
}

export const useLlmEngineStore = create<EngineState>((set) => ({
  engine: loadInitialEngine(),
  setEngine: (requested) => {
    const effective = resolveEngine(requested, deviceEnv());
    mmkv.set(ENGINE_KEY, effective);
    set({ engine: effective });
    return effective;
  },
}));

/** 매니저(비-React)가 현재 선택 엔진을 읽을 때. */
export function getSelectedEngine(): LlmEngineId {
  return useLlmEngineStore.getState().engine;
}
