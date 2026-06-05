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
  getModelPath,
  getDownloadedModels,
  removeModel,
  LlamaLanguageModel,
  llama,
} from '@react-native-ai/llama';
import type { DownloadProgress, ContextParams } from '@react-native-ai/llama';
import type { StreamChatFn, GenerateResult, GenerateOptions } from '@skkuverse/shared';
import { devLog } from './dev-log';

// ──────────────────────────────────────────────────────────────
// 모델 상수
// ──────────────────────────────────────────────────────────────

/**
 * HuggingFace 모델 ID: owner/repo/filename.gguf 형식.
 * downloadModel()이 해당 경로로 HF resolve URL을 조립.
 */
export const KANANA_MODEL_ID =
  'DevQuasar/kakaocorp.kanana-1.5-2.1b-instruct-2505-GGUF/kakaocorp.kanana-1.5-2.1b-instruct-2505.Q4_K_M.gguf';

/**
 * 모델 GGUF의 정확한 크기(bytes). HuggingFace Content-Length / x-linked-size 실측값.
 * 무결성 검사 기준 — 중단된 다운로드(부분 파일) 탐지에 사용한다.
 */
export const KANANA_Q4_KM_SIZE_BYTES = 1_522_796_768; // 정확히 1.52 GB

// ──────────────────────────────────────────────────────────────
// 파라미터 기본값 (호출부에서 override 가능)
// ──────────────────────────────────────────────────────────────

/**
 * per-call 생성 파라미터 기본값.
 * makeStreamChatFn이 호출 시점 options와 병합 (options 우선).
 * 화면별 개인화는 streamChat(msgs, onToken, { temperature, ... })로 override.
 */
export const DEFAULT_GENERATE_OPTIONS: Required<Omit<GenerateOptions, 'signal'>> = {
  nPredict: 512,
  temperature: 0.7,
  topP: 0.95,
  stop: ['<|end|>', '<|eot_id|>', '<|im_end|>'],
};

/**
 * 모델 load-time 컨텍스트 파라미터 기본값.
 * 싱글톤 매니저(local-llm-manager.ts)에서 첫 cold load 시에만 적용 — 런타임 값이라
 * 변경해도 prebuild 불필요(JS-only).
 *
 * n_gpu_layers: 99 → Metal GPU 최대 사용 (iOS 실기기).
 * n_ctx: 8192 → 프롬프트 + 생성 합산 컨텍스트 창. Kanana 1.5는 네이티브 32K까지
 *   지원하지만 n_ctx는 KV 캐시 메모리에 비례하므로, 긴 공지+Q&A에 충분한 8192로 둔다
 *   (모델 최대가 아니라 필요 최소+여유). 변경 시 CONTEXT_CHAR_BUDGET도 함께 맞출 것.
 *
 * use_mlock는 의도적으로 끈다(미설정 → false). mlock은 모델 페이지를 RAM에 잠가
 * OS가 메모리 압박 시 evict하지 못하게 해, 모바일에서 1.5GB 상주 + jetsam kill을
 * 유발한다. 기본 mmap을 유지하면 커널이 압박 시 페이지를 evict해 프로세스 kill을
 * 피한다(llama.cpp 모바일 권장). 백그라운드 unload는 매니저(local-llm-manager)가 담당.
 */
export const DEFAULT_CONTEXT_PARAMS: Partial<ContextParams> = {
  n_ctx: 8192,
  n_gpu_layers: 99,
};

// ──────────────────────────────────────────────────────────────
// 모델 다운로드 / 캐시
// ──────────────────────────────────────────────────────────────

/** 캐시된 모델 파일의 실제 크기(bytes). 없거나 stat 실패 시 null. */
async function cachedModelSize(): Promise<number | null> {
  try {
    const path = getModelPath(KANANA_MODEL_ID);
    const models = await getDownloadedModels();
    return models.find((m) => m.path === path)?.sizeBytes ?? null;
  } catch {
    return null;
  }
}

/**
 * 모델 파일이 기기에 없으면 HF에서 다운로드 후 로컬 경로 반환.
 *
 * ⚠️ 무결성 검사 (2026-06-05 추가): 존재 여부만으론 부족하다. 중단된 다운로드는 부분
 * .gguf 파일을 남기는데(react-native-blob-util은 취소 시 부분 파일을 삭제하지 않음),
 * isModelDownloaded(=fs.exists)는 true를 반환하고 downloadModel은 그 손상 파일을 그대로
 * early-return → initModel의 prepare()가 "Failed to load model"로 영구 실패한다.
 * (OTA 재시작이 진행 중이던 모델 다운로드를 끊으면 이 상태가 재현됨 — 실제 회귀 원인.)
 * 그래서 캐시 파일 크기가 기대값에 못 미치면 손상으로 보고 삭제 후 재다운로드한다.
 *
 * @param onProgress 0~100 정수 진행률 콜백 (react-native-blob-util 기반)
 */
export async function ensureModel(
  onProgress?: (percentage: number) => void,
): Promise<string> {
  if (await isModelDownloaded(KANANA_MODEL_ID)) {
    const size = await cachedModelSize();
    // size를 못 읽으면(stat 실패) 멀쩡한 파일을 1.5GB 재다운로드하는 오탐을 피해 신뢰.
    if (size == null || size >= KANANA_Q4_KM_SIZE_BYTES) {
      onProgress?.(100);
      return getModelPath(KANANA_MODEL_ID);
    }
    devLog('local-llm.model.corrupt', { size, expected: KANANA_Q4_KM_SIZE_BYTES });
    await removeModel(KANANA_MODEL_ID); // 부분/손상 파일 제거 → 아래에서 재다운로드
  }

  const progressCallback = onProgress
    ? (p: DownloadProgress) => onProgress(p.percentage)
    : undefined;

  const path = await downloadModel(KANANA_MODEL_ID, progressCallback);
  devLog('local-llm.download.complete', { size: await cachedModelSize() });
  return path;
}

// ──────────────────────────────────────────────────────────────
// 모델 초기화
// ──────────────────────────────────────────────────────────────

/**
 * 다운로드된 GGUF 파일 경로를 받아 LlamaLanguageModel 인스턴스 반환.
 * prepare()까지 완료 → context가 메모리에 올라온 상태.
 *
 * @param contextParams DEFAULT_CONTEXT_PARAMS에 얕게 병합되는 override
 *                      (싱글톤 매니저가 첫 cold load 시에만 전달).
 */
export async function initModel(
  modelPath: string,
  contextParams?: Partial<ContextParams>,
): Promise<LlamaLanguageModel> {
  const model = llama.languageModel(modelPath, {
    contextParams: { ...DEFAULT_CONTEXT_PARAMS, ...contextParams },
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
    options,
  ): Promise<GenerateResult> => {
    const context = model.getContext() ?? await model.prepare();

    // per-call options를 기본값과 병합 (options 우선).
    const { nPredict, temperature, topP, stop } = {
      ...DEFAULT_GENERATE_OPTIONS,
      ...options,
    };
    const signal = options?.signal;

    // abort 시 네이티브 생성을 실제로 멈춘다(stopCompletion). 이게 없으면 JS 토큰만
    // 무시되고 네이티브 completion이 context를 계속 점유 → llama.rn은 context당
    // 동시 completion 1개라 다음 질문이 막히고, 백그라운드 서스펜드 시 Promise가
    // 영영 resolve되지 않는다. stopCompletion 호출 시 completion은 부분 결과로
    // resolve되어 finally까지 정상 진행된다.
    // stopCompletion()은 llama.rn JSI 바인딩으로 Promise가 아니라 void(undefined)를
    // 반환할 수 있다. 바로 .catch()를 부르면 "cannot read property 'catch' of
    // undefined"가 난다 → Promise.resolve로 감싸고 sync throw도 try로 흡수.
    const onAbort = () => {
      try {
        Promise.resolve(context.stopCompletion()).catch(() => {});
      } catch {
        /* stopCompletion이 sync void일 수 있음 */
      }
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    const t0 = Date.now();
    let firstTokenMs = -1;
    let accText = '';

    let result;
    try {
      result = await context.completion(
        {
          messages,
          n_predict: nPredict,
          temperature,
          top_p: topP,
          stop,
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
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }

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
