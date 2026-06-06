/**
 * 엔진 seam — 매니저(local-llm-manager.ts)가 엔진 내부를 모른 채 라이프사이클을
 * 돌릴 수 있게 하는 추상화. 현재 구현은 anemll(CoreML/ANE) 하나뿐이지만, seam은
 * 일반화된 인터페이스로 유지한다(향후 엔진 추가 대비).
 *
 * 매니저가 직접 찌르던 엔진 내부(prepare/unload 등)를 EngineModelHandle 메서드 뒤로 숨긴다.
 */
import type { StreamChatFn, LlmEngineId } from '@skkuverse/shared';
import * as anemllAdapter from './local-llm-anemll';

export type { LlmEngineId };

/** 로드된 모델 1개에 대한 엔진-중립 핸들. */
export interface EngineModelHandle {
  /** 모델 레벨 스트리밍 생성 함수(소비자 공유). */
  streamChat: StreamChatFn;
  /** suspend 이후 네이티브 컨텍스트 재준비. */
  prepare(): Promise<void>;
  /** RAM 반납(네이티브 unload), 핸들은 유지. */
  suspend(): Promise<void>;
  /** 완전 teardown. */
  unload(): Promise<void>;
}

export interface EngineInitOptions {
  /** 로드 진행률(0~100) — anemll의 ~135s ANE 컴파일 진행 표시에 사용. */
  onProgress?: (pct: number) => void;
}

export interface LocalLlmEngine {
  id: LlmEngineId;
  /** prepare/init 타임아웃. anemll은 첫 ANE 컴파일이 길어 별도 값 필요. */
  prepareTimeoutMs: number;
  /** 백그라운드 suspend→resume가 저렴한지. anemll은 resume=재컴파일이라 비쌈. */
  supportsSuspendResume: boolean;
  ensureModel(onProgress?: (pct: number) => void): Promise<string>;
  initModel(path: string, opts?: EngineInitOptions): Promise<EngineModelHandle>;
}

// ── Anemll (CoreML / ANE) ──
export const anemllEngine: LocalLlmEngine = {
  id: 'anemll',
  // 첫 ANE 컴파일 ~135s 측정 → 200s 타임아웃(여유).
  prepareTimeoutMs: 200_000,
  // resume=재컴파일(~135s)이라 저렴하지 않음 — 매니저가 백그라운드 정책에 활용.
  supportsSuspendResume: false,
  ensureModel: (onProgress) => anemllAdapter.ensureModel(onProgress),
  async initModel(path, opts) {
    const h = await anemllAdapter.initModel(path, opts?.onProgress);
    return {
      streamChat: anemllAdapter.makeStreamChatFn(h),
      // 네이티브는 단일 인스턴스 — 재준비는 modelDir로 다시 prepare(재컴파일).
      prepare: async () => {
        await anemllAdapter.initModel(h.modelDir, opts?.onProgress);
      },
      suspend: () => anemllAdapter.releaseModel(h),
      unload: () => anemllAdapter.releaseModel(h),
    };
  },
};
