/**
 * 로컬 LLM 스트리밍 생성 주입 인터페이스.
 *
 * 네이티브 모듈(@react-native-ai/llama / llama.rn)에 의존하지 않는
 * 순수 타입만 정의 — vitest 환경에서 자유롭게 목(mock) 가능.
 * EmbedFn 패턴(packages/shared/src/foodclass/types.ts)과 동일한 설계.
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * 스트리밍 완료 후 반환되는 지표.
 * timings는 llama.rn `NativeCompletionResult.timings`에서 파생.
 */
export interface GenerateResult {
  /** 전체 생성 텍스트 */
  text: string;
  /** 출력 토큰 수 */
  outputTokens: number;
  /** 입력(프롬프트) 토큰 수 */
  inputTokens: number;
  /** 첫 번째 토큰까지 경과 시간 (ms) */
  firstTokenMs: number;
  /** 초당 출력 토큰 수 */
  tokPerSec: number;
}

/**
 * per-call 생성 파라미터.
 *
 * 화면(소비자)마다 톤·길이·중단 조건을 다르게 줄 수 있도록 호출 시점에 주입.
 * 모두 optional — 미지정 필드는 어댑터의 DEFAULT_GENERATE_OPTIONS로 채워진다.
 *
 * 컨텍스트 파라미터(n_ctx / n_gpu_layers)는 여기 포함하지 않는다:
 * 그것들은 모델 load-time에 고정되는 값이라 per-call이 아니라 acquire-time에 결정.
 */
export interface GenerateOptions {
  /** 최대 생성 토큰 수 (llama n_predict) */
  nPredict?: number;
  /** 샘플링 온도 — 낮을수록 결정적 */
  temperature?: number;
  /** nucleus 샘플링 (llama top_p) */
  topP?: number;
  /** 생성 중단 토큰들 */
  stop?: string[];
  /** 생성 취소 시그널 */
  signal?: AbortSignal;
}

/**
 * 스트리밍 생성 seam.
 * 어댑터(local-llm.ts)가 구현하고, 화면에 주입한다.
 */
export type StreamChatFn = (
  messages: ChatMessage[],
  onToken: (token: string) => void,
  options?: GenerateOptions,
) => Promise<GenerateResult>;
