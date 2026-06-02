/**
 * Apple NLContextualEmbedding 래퍼 — EmbedFn 주입 인터페이스.
 *
 * iOS 17+ 전용. 네이티브 모듈이라 기기/시뮬레이터에서만 실제 임베딩 생성.
 * 분류 로직(packages/shared/foodclass)에 EmbedFn으로 주입해 사용.
 *
 * 한국어('ko') 에셋이 기기에 없으면 `hasAvailableAssets: false` 반환 →
 * eval 화면에서 에러 상태로 표시 (Settings에서 언어 모델 다운로드 유도).
 */

import { apple, AppleEmbeddings } from '@react-native-ai/apple';
import { embedMany } from 'ai';
import type { EmbedFn } from '@skkuverse/shared';

export interface EmbedServiceInfo {
  hasAssets: boolean;
  dimension: number;
  languages: string[];
  modelId: string;
  maximumSequenceLength: number;
}

/**
 * 지정 언어의 임베딩 모델 에셋 정보 조회.
 * iOS 17 미만이거나 모듈 초기화 실패 시 throw.
 */
export async function getEmbedInfo(language = 'ko'): Promise<EmbedServiceInfo> {
  const info = await AppleEmbeddings.getInfo(language);
  return {
    hasAssets: info.hasAvailableAssets,
    dimension: info.dimension,
    languages: info.languages,
    modelId: info.modelIdentifier,
    maximumSequenceLength: info.maximumSequenceLength,
  };
}

/**
 * 임베딩 에셋 사전 로드. 첫 사용 전 호출하면 latency 감소.
 * hasAvailableAssets=false인 경우엔 throw되므로 getEmbedInfo 먼저 확인.
 */
export async function prepareEmbed(language = 'ko'): Promise<void> {
  const model = apple.textEmbeddingModel({ language });
  await model.prepare();
}

/**
 * EmbedFn 팩토리.
 *
 * 반환된 함수는 texts 배열을 `embedMany`로 일괄 인코딩하고
 * `number[][]`(각 텍스트 당 512-dim 벡터)를 반환한다.
 * buildPrototypes / evaluate에 주입해 사용.
 */
export function makeAppleEmbedFn(language = 'ko'): EmbedFn {
  const model = apple.textEmbeddingModel({ language });

  return async (texts: string[]) => {
    const result = await embedMany({ model, values: texts });
    return result.embeddings;
  };
}
