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
 * 스트리밍 생성 seam.
 * 어댑터(local-llm.ts)가 구현하고, 화면에 주입한다.
 */
export type StreamChatFn = (
  messages: ChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
) => Promise<GenerateResult>;
