import { NativeModule, requireNativeModule } from 'expo';

/** Token stream + load-progress events emitted by the native module. */
export type AnemllModuleEvents = {
  onToken: (e: { requestId: string; token: string }) => void;
  onLoadProgress: (e: {
    percentage: number;
    stage: string;
    detail?: string | null;
  }) => void;
  onLoadComplete: (e: Record<string, never>) => void;
  onLoadError: (e: { error: string }) => void;
};

export interface AnemllChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AnemllGenerateOptions {
  /** Max output tokens (maps to maxTokens). */
  nPredict?: number;
  /** Sampling temperature. */
  temperature?: number;
}

export interface AnemllGenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  firstTokenMs: number;
  tokPerSec: number;
  stopReason: string;
}

declare class AnemllNativeModule extends NativeModule<AnemllModuleEvents> {
  /** Load meta.yaml + .mlmodelc chunks + tokenizer from a model directory (ANE). */
  prepareModel(modelDir: string): Promise<void>;
  /** Stream a chat completion; tokens arrive via `onToken` keyed by requestId. */
  generate(
    requestId: string,
    messages: AnemllChatMessage[],
    options: AnemllGenerateOptions,
  ): Promise<AnemllGenerateResult>;
  /** Abort the active generation (real native stop). */
  stop(requestId: string): Promise<void>;
  /** Free the model + resident memory. */
  unloadModel(): Promise<void>;
  isReady(): boolean;
  isBusy(): boolean;
}

// Resolves to the native module registered by AnemllModule.swift (Name("Anemll")).
export default requireNativeModule<AnemllNativeModule>('Anemll');
