/**
 * 로컬 CoreML/ANE LLM 어댑터 — AnemllCore(Swift) Expo 모듈 래퍼.
 *
 * local-llm.ts(GGUF/llama.cpp)의 미러 — 동일한 StreamChatFn seam을 구현해
 * 엔진 교체가 가능하게 한다. 무거운 추론은 AnemllCore가 ANE에서 수행하고,
 * 이 파일은 모델 디렉터리 준비(다운로드/무결성) + 네이티브 호출만 담당한다.
 *
 * 모델은 단일 GGUF가 아니라 7개 파일 디렉터리(.mlmodelc 번들 + meta.yaml + tokenizer).
 * 무결성 검사는 packages/shared의 checkModelDir/ANEMLL_KANANA_FILES(순수, vitest 검증).
 *
 * TODO: 도그푸딩 평가 완료 후 이 파일 제거(local-llm.ts와 함께).
 */
import RNBlobUtil from 'react-native-blob-util';
import { unzip, subscribe as subscribeUnzip } from 'react-native-zip-archive';
import {
  buildGenerateResult,
  resolveGenerateOptions,
  checkModelDir,
  ANEMLL_KANANA_FILES,
  type StreamChatFn,
  type GenerateResult,
  type PresentModelFile,
  type ResolvedGenerateOptions,
} from '@skkuverse/shared';
import Anemll, { type AnemllChatMessage } from '../../modules/anemll';
import { devLog } from './dev-log';

// ──────────────────────────────────────────────────────────────
// 모델 상수
// ──────────────────────────────────────────────────────────────

/** 변환된 Kanana CoreML 모델 식별자(디렉터리 이름). */
export const ANEMLL_KANANA_MODEL_ID = 'kanana-1.5-2.1b-ane-lut6-ctx1024';

/** 디바이스 내 모델 디렉터리 루트. */
const ANEMLL_MODELS_ROOT = `${RNBlobUtil.fs.dirs.DocumentDir}/anemll-models`;
const modelDirPath = (): string => `${ANEMLL_MODELS_ROOT}/${ANEMLL_KANANA_MODEL_ID}`;

/**
 * 호스팅된 모델 zip URL (HuggingFace 공개 레포의 resolve URL). 비어 있으면 ensureModel은
 * side-load된 디렉터리만 검사한다. 패키징: 호스트에서 `prepare_hf.sh --ios` 후 내용 flat zip.
 * blob-util이 HF resolve→LFS-CDN 302를 따라간다(GGUF 경로와 동일).
 */
export const ANEMLL_MODEL_ZIP_URL =
  'https://huggingface.co/spencer0124/kanana-1.5-2.1b-ane-coreml/resolve/main/kanana-ane-lut6-ctx1024-v1.zip?download=true';

/**
 * 모델 zip의 정확한 크기(bytes). 중단된 다운로드(부분 파일) 탐지용 — local-llm.ts의
 * KANANA_Q4_KM_SIZE_BYTES 미러.
 */
export const ANEMLL_MODEL_ZIP_SIZE_BYTES = 1_916_713_547;

/** per-call 생성 파라미터 기본값(local-llm.ts와 동일 톤). topP는 AnemllCore가 별도 처리. */
export const DEFAULT_ANEMLL_OPTIONS: ResolvedGenerateOptions = {
  nPredict: 512,
  temperature: 0.7,
  topP: 0.95,
  stop: ['<|eot_id|>', '<|end_of_text|>'],
};

// ──────────────────────────────────────────────────────────────
// 모델 디렉터리 준비 / 무결성
// ──────────────────────────────────────────────────────────────

/** 디렉터리의 실제 재귀 합산 크기(bytes). `.mlmodelc`는 nested `weights/`까지 내려간다. */
async function dirSizeRecursive(dir: string): Promise<number> {
  let total = 0;
  let names: string[];
  try {
    names = await RNBlobUtil.fs.ls(dir);
  } catch {
    return 0;
  }
  for (const name of names) {
    const p = `${dir}/${name}`;
    try {
      const stat = await RNBlobUtil.fs.stat(p);
      if (stat.type === 'directory') {
        total += await dirSizeRecursive(p);
      } else {
        const b = Number(stat.size);
        if (Number.isFinite(b)) total += b;
      }
    } catch {
      /* skip unreadable */
    }
  }
  return total;
}

/**
 * 모델 디렉터리의 top-level 엔트리 목록 — `.mlmodelc` 디렉터리는 **실제 재귀 크기**와
 * `model.mil`(ML Program 마커) 존재 여부까지 채운다.
 *
 * 과거엔 디렉터리를 `MAX_SAFE_INTEGER`로 센티넬 처리해 `minBytes` 플로어가 무력화됐고,
 * 부분 추출(예: 703MB weight.bin 또는 model.mil 누락)이 무결성 검사를 통과해 CoreML이
 * "functionName must be nil unless ML Program"으로 거부하는 버그가 있었다. 재귀 크기 +
 * model.mil 존재 검증으로 두 손상 형태(잘림/구조 누락)를 모두 잡는다.
 */
async function statModelDir(dir: string): Promise<PresentModelFile[]> {
  const exists = await RNBlobUtil.fs.exists(dir);
  if (!exists) return [];
  const names = await RNBlobUtil.fs.ls(dir);
  const out: PresentModelFile[] = [];
  for (const name of names) {
    const p = `${dir}/${name}`;
    try {
      const stat = await RNBlobUtil.fs.stat(p);
      if (stat.type === 'directory') {
        const bytes = await dirSizeRecursive(p);
        // .mlmodelc 번들은 ML Program이어야 functionName(infer/prefill) 로드가 가능 → model.mil 필수.
        const hasModelMil = name.endsWith('.mlmodelc')
          ? await RNBlobUtil.fs.exists(`${p}/model.mil`)
          : undefined;
        out.push({ name, bytes, hasModelMil });
      } else {
        const bytes = Number(stat.size);
        out.push({ name, bytes: Number.isFinite(bytes) ? bytes : 0 });
      }
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

/**
 * 모델 디렉터리가 없거나 불완전하면 (현재) 명확한 에러로 안내, 완전하면 경로 반환.
 * ZIP URL이 설정되면 다운로드+해제를 수행하도록 확장(react-native-zip-archive).
 *
 * @param onProgress 0~100 (다운로드/해제 진행률) — side-load 경로에선 100 한 번.
 */
export async function ensureModel(
  onProgress?: (percentage: number) => void,
): Promise<string> {
  const dir = modelDirPath();
  const present = await statModelDir(dir);
  const check = checkModelDir(present, ANEMLL_KANANA_FILES);
  devLog('anemll.ensure.start', {
    dir,
    complete: check.complete,
    missing: check.missing,
    undersized: check.undersized,
    // corrupt = 존재하지만 model.mil 누락(ML Program 깨짐) → 부분 추출 자가 치유(재다운로드) 트리거.
    corrupt: check.corrupt,
  });

  if (check.complete) {
    onProgress?.(100);
    return dir;
  }

  if (!ANEMLL_MODEL_ZIP_URL || ANEMLL_MODEL_ZIP_URL.includes('__HF_REPO__')) {
    throw new Error(
      `[anemll] model not provisioned at ${dir} ` +
        `(missing: ${check.missing.join(', ') || 'none'}; ` +
        `undersized: ${check.undersized.join(', ') || 'none'}; ` +
        `corrupt: ${check.corrupt.join(', ') || 'none'}). ` +
        `ANEMLL_MODEL_ZIP_URL not configured.`,
    );
  }

  // 불완전 → zip 다운로드 + 해제 + 무결성 검사 후 원자적 배치.
  const tmpZip = `${ANEMLL_MODELS_ROOT}/_download.zip`;
  const tmpExtract = `${ANEMLL_MODELS_ROOT}/_extract`;
  await RNBlobUtil.fs.unlink(tmpZip).catch(() => {});
  await RNBlobUtil.fs.unlink(tmpExtract).catch(() => {});
  await RNBlobUtil.fs.mkdir(ANEMLL_MODELS_ROOT).catch(() => {});

  // 1) 다운로드 — 진행률 0~80% (나머지 20%는 해제). HF resolve→LFS-CDN 302는 blob-util이 따라감.
  devLog('anemll.download.start', { url: ANEMLL_MODEL_ZIP_URL });
  const dlStart = Date.now();
  const res = await RNBlobUtil.config({ path: tmpZip, fileCache: true })
    .fetch('GET', ANEMLL_MODEL_ZIP_URL)
    .progress({ interval: 250 }, (received, total) => {
      const t = Number(total);
      onProgress?.(t > 0 ? Math.round((Number(received) / t) * 80) : 0);
    });
  const status = res.info().status;
  if (status < 200 || status >= 300) {
    await RNBlobUtil.fs.unlink(tmpZip).catch(() => {});
    throw new Error(`[anemll] download failed (HTTP ${status})`);
  }

  // 2) 크기 검증 — 부분 다운로드(중단) 탐지.
  const zipBytes = Number((await RNBlobUtil.fs.stat(tmpZip)).size);
  devLog('anemll.download.done', {
    zipBytes,
    expected: ANEMLL_MODEL_ZIP_SIZE_BYTES,
    ms: Date.now() - dlStart,
  });
  if (zipBytes < ANEMLL_MODEL_ZIP_SIZE_BYTES) {
    await RNBlobUtil.fs.unlink(tmpZip).catch(() => {});
    throw new Error(
      `[anemll] partial download (${zipBytes}/${ANEMLL_MODEL_ZIP_SIZE_BYTES} bytes) — retry`,
    );
  }

  // 3) 해제 — 진행률 80~99%.
  const unzipSub = subscribeUnzip(({ progress }) => {
    onProgress?.(80 + Math.round(progress * 19));
  });
  try {
    await unzip(tmpZip, tmpExtract);
  } finally {
    unzipSub.remove();
  }
  await RNBlobUtil.fs.unlink(tmpZip).catch(() => {});

  // 4) 해제물 무결성 재검사 — root에 7개 필수 파일이 flat하게 풀리고, 각 .mlmodelc가
  //    재귀 크기 플로어 + model.mil(ML Program)을 만족해야 atomic move를 진행한다.
  //    (손상된 추출물이 자리잡는 것을 move 전에 차단 — CoreML functionName 거부 방지.)
  const extractedCheck = checkModelDir(await statModelDir(tmpExtract), ANEMLL_KANANA_FILES);
  if (!extractedCheck.complete) {
    await RNBlobUtil.fs.unlink(tmpExtract).catch(() => {});
    throw new Error(
      `[anemll] extracted model incomplete (missing: ${extractedCheck.missing.join(', ') || 'none'}; ` +
        `undersized: ${extractedCheck.undersized.join(', ') || 'none'}; ` +
        `corrupt: ${extractedCheck.corrupt.join(', ') || 'none'})`,
    );
  }

  // 5) 원자적 배치 — 기존 dir 제거 후 이동.
  await RNBlobUtil.fs.unlink(dir).catch(() => {});
  await RNBlobUtil.fs.mv(tmpExtract, dir);
  onProgress?.(100);
  devLog('anemll.ensure.ready', { dir, totalMs: Date.now() - dlStart });
  return dir;
}

// ──────────────────────────────────────────────────────────────
// 모델 초기화 (네이티브 prepare)
// ──────────────────────────────────────────────────────────────

/** 초기화된 Anemll 모델에 대한 경량 핸들(네이티브는 단일 인스턴스를 보유). */
export interface AnemllModelHandle {
  readonly modelDir: string;
}

/**
 * 모델 디렉터리를 받아 네이티브 AnemllCore를 ANE로 로드(첫 로드 시 ~135s 컴파일).
 * onLoadProgress 이벤트를 onProgress로 포워딩한다.
 */
export async function initModel(
  modelDir: string,
  onProgress?: (pct: number) => void,
): Promise<AnemllModelHandle> {
  devLog('anemll.init.start', { modelDir });
  const t0 = Date.now();

  const sub = Anemll.addListener('onLoadProgress', (e) => {
    onProgress?.(Math.round(e.percentage * 100));
  });
  try {
    await Anemll.prepareModel(modelDir);
  } finally {
    sub.remove();
  }
  devLog('anemll.init.prepared', { ms: Date.now() - t0 });
  return { modelDir };
}

// ──────────────────────────────────────────────────────────────
// 스트리밍 생성 seam
// ──────────────────────────────────────────────────────────────

let reqCounter = 0;

/** StreamChatFn 팩토리 — local-llm.ts.makeStreamChatFn의 ANE 버전. */
export function makeStreamChatFn(_handle: AnemllModelHandle): StreamChatFn {
  return async (messages, onToken, options): Promise<GenerateResult> => {
    const opts = resolveGenerateOptions(options, DEFAULT_ANEMLL_OPTIONS);
    const signal = options?.signal;
    reqCounter += 1;
    const requestId = `r${reqCounter}`;

    const sub = Anemll.addListener('onToken', (e) => {
      if (e.requestId !== requestId) return;
      if (signal?.aborted) return;
      onToken(e.token);
    });

    const onAbort = () => {
      Anemll.stop(requestId).catch(() => {});
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    const messagePayload: AnemllChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const native = await Anemll.generate(requestId, messagePayload, {
        nPredict: opts.nPredict,
        temperature: opts.temperature,
      });
      // tokPerSec는 네이티브가 decode-rate로 계산해 전달하지만, 공유 헬퍼로 형태를 통일.
      return buildGenerateResult({
        text: native.text,
        inputTokens: native.inputTokens,
        outputTokens: native.outputTokens,
        firstTokenMs: native.firstTokenMs,
        elapsedSec: native.tokPerSec > 0 ? native.outputTokens / native.tokPerSec : 0,
      });
    } finally {
      sub.remove();
      signal?.removeEventListener('abort', onAbort);
    }
  };
}

// ──────────────────────────────────────────────────────────────
// 메모리 해제
// ──────────────────────────────────────────────────────────────

/** 네이티브 모델 + 상주 메모리(~1.9GB) 해제. */
export async function releaseModel(_handle: AnemllModelHandle): Promise<void> {
  await Anemll.unloadModel();
}
