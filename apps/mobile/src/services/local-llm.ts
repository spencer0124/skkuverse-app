/**
 * 로컬 GGUF LLM 어댑터 — @react-native-ai/llama + llama.rn 래퍼.
 *
 * 의존성:
 *   - @react-native-ai/llama (downloadModel / LlamaLanguageModel)
 *   - llama.rn (initLlama 기반, @react-native-ai/llama가 내부 사용)
 *   - react-native-blob-util (downloadModel 내부 사용, 별도 설치 불필요)
 *
 * 외부 API:
 *   - ensureModel(onProgress)  → 모델 파일 경로 (이미 있으면 즉시 반환)
 *   - initContext(modelPath)   → LlamaLanguageModel 인스턴스
 *   - makeStreamChatFn(model)  → StreamChatFn (화면에 주입)
 *   - releaseModel(model)      → 메모리 해제
 *
 * EmbedFn 패턴(apple-embed.ts) 미러:
 *   순수 타입(StreamChatFn)은 @skkuverse/shared/localllm에 정의.
 *   네이티브 의존 코드는 이 파일에만 존재.
 *
 * TODO: 도그푸딩 평가 완료 후 이 파일과 debug-local-llm.tsx 제거.
 */

import {
  downloadModel,
  isModelDownloaded,
  LlamaLanguageModel,
  llama,
} from '@react-native-ai/llama';
import type { DownloadProgress } from '@react-native-ai/llama';
import type { StreamChatFn, GenerateResult } from '@skkuverse/shared';

// ──────────────────────────────────────────────────────────────
// 모델 상수
// ──────────────────────────────────────────────────────────────

/**
 * HuggingFace 모델 ID: owner/repo/filename.gguf 형식.
 * downloadModel()이 해당 경로로 HF resolve URL을 조립.
 */
export const KANANA_MODEL_ID =
  'DevQuasar/kakaocorp.kanana-1.5-2.1b-instruct-2505-GGUF/kakaocorp.kanana-1.5-2.1b-instruct-2505.Q4_K_M.gguf';

/** 예상 파일 크기(bytes). 캐시 히트 여부 표시용 참고값. */
export const KANANA_Q4_KM_SIZE_BYTES = 1_630_000_000; // ~1.52 GB

// ──────────────────────────────────────────────────────────────
// 모델 다운로드 / 캐시
// ──────────────────────────────────────────────────────────────

/**
 * 모델 파일이 기기에 없으면 HF에서 다운로드 후 로컬 경로 반환.
 * 이미 존재하면 즉시 경로 반환 (progressCallback은 percentage:100 한 번 호출).
 *
 * @param onProgress 0~100 정수 진행률 콜백 (react-native-blob-util 기반)
 */
export async function ensureModel(
  onProgress?: (percentage: number) => void,
): Promise<string> {
  const alreadyExists = await isModelDownloaded(KANANA_MODEL_ID);
  if (alreadyExists) {
    onProgress?.(100);
  }

  const progressCallback = onProgress
    ? (p: DownloadProgress) => onProgress(p.percentage)
    : undefined;

  return downloadModel(KANANA_MODEL_ID, progressCallback);
}

// ──────────────────────────────────────────────────────────────
// 모델 초기화
// ──────────────────────────────────────────────────────────────

/**
 * 다운로드된 GGUF 파일 경로를 받아 LlamaLanguageModel 인스턴스 반환.
 * prepare()까지 완료 → context가 메모리에 올라온 상태.
 *
 * n_gpu_layers: 99 → Metal GPU 최대 사용 (iOS 실기기).
 * n_ctx: 2048 → 프롬프트 + 생성 합산 컨텍스트 창.
 */
export async function initModel(modelPath: string): Promise<LlamaLanguageModel> {
  const model = llama.languageModel(modelPath, {
    contextParams: {
      n_ctx: 2048,
      n_gpu_layers: 99,
      use_mlock: true,
    },
  });
  await model.prepare();
  return model;
}

// ──────────────────────────────────────────────────────────────
// 스트리밍 생성 seam
// ──────────────────────────────────────────────────────────────

/**
 * StreamChatFn 팩토리.
 *
 * 반환된 함수는 메시지 배열 + onToken 콜백을 받아
 * llama.rn context.completion() 기반 스트리밍 생성을 실행하고
 * GenerateResult(text / 토큰 수 / 첫 토큰 latency / tok/s)를 반환.
 *
 * ai SDK의 streamText 대신 doStream 하위 레이어 직접 사용:
 *   - timings 객체 접근을 위해 finish 이벤트가 필요한데
 *     streamText wrapper가 이를 추상화해버리기 때문.
 *   - onToken UI 콜백을 ReadableStream 외부로 꺼내려면
 *     context.completion(opts, tokenCb)의 직접 호출이 더 단순.
 */
export function makeStreamChatFn(model: LlamaLanguageModel): StreamChatFn {
  return async (
    messages,
    onToken,
    signal,
  ): Promise<GenerateResult> => {
    const context = model.getContext() ?? await model.prepare();

    const t0 = Date.now();
    let firstTokenMs = -1;
    let accText = '';

    const result = await context.completion(
      {
        messages,
        n_predict: 512,
        temperature: 0.7,
        stop: ['<|end|>', '<|eot_id|>', '<|im_end|>'],
      },
      (data) => {
        if (signal?.aborted) return;
        const { token } = data;
        if (firstTokenMs < 0) {
          firstTokenMs = Date.now() - t0;
        }
        accText += token;
        onToken(token);
      },
    );

    const outputTokens = result.timings?.predicted_n ?? accText.split(/\s+/).length;
    const inputTokens = result.timings?.prompt_n ?? 0;
    const totalMs = Date.now() - t0;
    const tokPerSec =
      result.timings?.predicted_per_second ??
      (outputTokens / Math.max(totalMs, 1)) * 1000;

    return {
      text: result.content ?? accText,
      outputTokens,
      inputTokens,
      firstTokenMs: firstTokenMs < 0 ? totalMs : firstTokenMs,
      tokPerSec,
    };
  };
}

// ──────────────────────────────────────────────────────────────
// 메모리 해제
// ──────────────────────────────────────────────────────────────

/** LlamaContext를 네이티브 메모리에서 해제. 화면 unmount 시 호출. */
export async function releaseModel(model: LlamaLanguageModel): Promise<void> {
  await model.unload();
}
