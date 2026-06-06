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

/** 모델 디렉터리의 top-level 엔트리 크기 목록(.mlmodelc 디렉터리는 존재=대용량 sentinel). */
async function statModelDir(dir: string): Promise<PresentModelFile[]> {
  const exists = await RNBlobUtil.fs.exists(dir);
  if (!exists) return [];
  const names = await RNBlobUtil.fs.ls(dir);
  const out: PresentModelFile[] = [];
  for (const name of names) {
    const p = `${dir}/${name}`;
    try {
      const stat = await RNBlobUtil.fs.stat(p);
      // .mlmodelc는 디렉터리 → stat.size가 0일 수 있으므로 존재=충분으로 본다.
      const isDir = stat.type === 'directory';
      const bytes = isDir ? Number.MAX_SAFE_INTEGER : Number(stat.size);
      out.push({ name, bytes: Number.isFinite(bytes) ? bytes : 0 });
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
  });

  if (check.complete) {
    onProgress?.(100);
    return dir;
  }

  if (!ANEMLL_MODEL_ZIP_URL || ANEMLL_MODEL_ZIP_URL.includes('__HF_REPO__')) {
    throw new Error(
      `[anemll] model not provisioned at ${dir} ` +
        `(missing: ${check.missing.join(', ') || 'none'}; ` +
        `undersized: ${check.undersized.join(', ') || 'none'}). ` +
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

  // 4) 해제물 무결성 재검사 (root에 7개 필수 파일이 flat하게 풀려야 함).
  const extractedCheck = checkModelDir(await statModelDir(tmpExtract), ANEMLL_KANANA_FILES);
  if (!extractedCheck.complete) {
    await RNBlobUtil.fs.unlink(tmpExtract).catch(() => {});
    throw new Error(
      `[anemll] extracted model incomplete (missing: ${extractedCheck.missing.join(', ') || 'none'}; ` +
        `undersized: ${extractedCheck.undersized.join(', ') || 'none'})`,
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
