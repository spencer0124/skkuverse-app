/**
 * 로컬 LLM 전역 싱글톤 매니저.
 *
 * 왜 필요한가:
 *   Kanana Q4_K_M는 ~1.5GB를 메모리에 상주시킨다. 화면마다 initModel하면
 *   1.5GB × N → iOS jetsam OOM-kill. 그래서 앱 전역에서 모델 인스턴스를 하나만
 *   들고, 여러 소비자(화면)가 ref counting으로 공유한다.
 *
 * 수명 정책 (ref counting + idle grace):
 *   - acquire()로 참조 등록, 핸들 release()로 해제.
 *   - refCount가 0이 되면 즉시 해제하지 않고 IDLE_RELEASE_MS 후 해제.
 *     A→B 화면 전환 시 1→0→1로 1.5GB를 재로딩하는 thrash를 막는다.
 *     grace 내에 재획득하면 타이머 취소.
 *   - forceUnloadLocalLlm(): refCount 무시하고 강제 해제 (메모리 경고/설정용).
 *
 * 설계:
 *   저수준 함수(local-llm.ts)만 사용 — @react-native-ai/llama를 직접 import하지
 *   않아 seam 패턴 유지. 반응형 상태는 useSyncExternalStore (zustand 미도입).
 */

import { useSyncExternalStore } from 'react';
import type { LlamaLanguageModel, ContextParams } from '@react-native-ai/llama';
import type { StreamChatFn } from '@skkuverse/shared';
import {
  ensureModel,
  initModel,
  makeStreamChatFn,
  releaseModel,
} from './local-llm';

// ──────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────

/**
 * refCount가 0이 된 뒤 모델을 실제로 해제하기까지의 유예 시간(ms).
 * 화면 전환(unmount→mount) thrash를 흡수. 늘리면 메모리 점유가 길어지고,
 * 줄이면 빠른 재진입에서 재로딩 비용 발생.
 */
const IDLE_RELEASE_MS = 30_000;

// ──────────────────────────────────────────────────────────────
// 상태 타입
// ──────────────────────────────────────────────────────────────

export type LlmPhase = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

export interface LlmStatus {
  phase: LlmPhase;
  /** 다운로드 진행률 0~100 (downloading phase에서만 의미) */
  downloadPct: number;
  error?: string;
  /** 현재 모델을 점유 중인 소비자 수 */
  refCount: number;
}

export interface AcquireOptions {
  /** 다운로드 진행률 콜백 (0~100). 캐시 히트 시 100 한 번. */
  onProgress?: (pct: number) => void;
  /**
   * 컨텍스트 파라미터 override — 첫 cold load에만 적용된다.
   * 모델이 이미 로드/로딩 중이면 무시되고 경고를 남긴다 (싱글톤이라 단일 context).
   */
  contextParams?: Partial<ContextParams>;
}

export interface LlmHandle {
  /** 이 핸들 전용 스트리밍 생성 함수 (per-call GenerateOptions 지원) */
  streamChat: StreamChatFn;
  /** 이 소비자의 점유 해제. 여러 번 호출해도 안전(idempotent). */
  release: () => void;
}

// ──────────────────────────────────────────────────────────────
// 내부 싱글톤 상태
// ──────────────────────────────────────────────────────────────

let model: LlamaLanguageModel | null = null;
let loadPromise: Promise<LlamaLanguageModel> | null = null;
let refCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

let status: LlmStatus = {
  phase: 'idle',
  downloadPct: 0,
  refCount: 0,
};

// ──────────────────────────────────────────────────────────────
// 구독 (useSyncExternalStore 백엔드)
// ──────────────────────────────────────────────────────────────

const subscribers = new Set<() => void>();

function setStatus(patch: Partial<LlmStatus>): void {
  status = { ...status, ...patch, refCount };
  subscribers.forEach((cb) => cb());
}

export function subscribeLlmStatus(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function getLlmStatus(): LlmStatus {
  return status;
}

/** React 훅 — 매니저 상태를 구독해 리렌더. */
export function useLocalLlmStatus(): LlmStatus {
  return useSyncExternalStore(subscribeLlmStatus, getLlmStatus, getLlmStatus);
}

// ──────────────────────────────────────────────────────────────
// 내부 로드
// ──────────────────────────────────────────────────────────────

/**
 * 모델을 cold load. 동시 호출은 loadPromise를 공유해 중복 다운로드/init 방지.
 */
function loadModel(opts?: AcquireOptions): Promise<LlamaLanguageModel> {
  if (model) return Promise.resolve(model);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    setStatus({ phase: 'downloading', downloadPct: 0, error: undefined });

    // 1. 다운로드 (캐시 히트 시 즉시 100%)
    const modelPath = await ensureModel((pct) => {
      opts?.onProgress?.(pct);
      setStatus({ downloadPct: pct });
    });

    // 2. initLlama + prepare (Metal 로딩)
    setStatus({ phase: 'loading', downloadPct: 100 });
    const loaded = await initModel(modelPath, opts?.contextParams);

    model = loaded;
    setStatus({ phase: 'ready' });
    return loaded;
  })();

  // 성공/실패와 무관하게 in-flight 플래그 정리
  loadPromise.finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

// ──────────────────────────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────────────────────────

/**
 * 모델 점유를 획득. 미로드면 로드(또는 진행 중 로드에 합류)한 뒤 핸들 반환.
 * 반환 핸들의 release()를 반드시 호출(화면 unmount cleanup 등).
 */
export async function acquireLocalLlm(opts?: AcquireOptions): Promise<LlmHandle> {
  // pending idle release 취소 — 재획득은 해제를 무효화
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }

  if (opts?.contextParams && (model || loadPromise)) {
    console.warn(
      '[local-llm-manager] contextParams ignored — model already loaded/loading (singleton)',
    );
  }

  refCount += 1;
  setStatus({}); // refCount 반영

  try {
    const loaded = await loadModel(opts);
    return makeHandle(loaded);
  } catch (e) {
    // 로드 실패 시 이 acquire의 참조를 되돌린다 (누수 방지)
    refCount = Math.max(0, refCount - 1);
    setStatus({ phase: 'error', error: String(e) });
    throw e;
  }
}

function makeHandle(loaded: LlamaLanguageModel): LlmHandle {
  const streamChat = makeStreamChatFn(loaded);
  let released = false;

  return {
    streamChat,
    release: () => {
      if (released) return; // idempotent
      released = true;
      refCount = Math.max(0, refCount - 1);
      setStatus({});
      if (refCount === 0) scheduleIdleRelease();
    },
  };
}

/** refCount가 0이 된 뒤 grace 경과 시 실제 해제 예약. */
function scheduleIdleRelease(): void {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    // 타이머 발화 시점에도 여전히 0일 때만 해제
    if (refCount === 0 && model) {
      void doRelease();
    }
  }, IDLE_RELEASE_MS);
}

async function doRelease(): Promise<void> {
  const m = model;
  model = null;
  setStatus({ phase: 'idle', downloadPct: 0, error: undefined });
  if (m) {
    try {
      await releaseModel(m);
    } catch (e) {
      console.warn('[local-llm-manager] releaseModel failed', e);
    }
  }
}

/**
 * refCount를 무시하고 모델을 즉시 강제 해제.
 * RN 메모리 경고 핸들러 / 설정 화면의 "메모리 비우기" 등에서 사용.
 * 이후 acquire는 cold load부터 다시 시작.
 */
export async function forceUnloadLocalLlm(): Promise<void> {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  refCount = 0;
  await doRelease();
}
