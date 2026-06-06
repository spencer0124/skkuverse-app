/**
 * Pure model-directory integrity check for the Anemll multi-file CoreML model.
 * Unlike the single-file GGUF, the ANE model is a directory of `.mlmodelc` bundles +
 * tokenizer + meta.yaml, so we verify three things per required entry:
 *   1. presence       — absent/zero-byte → `missing`
 *   2. size floor      — recursive bytes below `minBytes` → `undersized` (partial extract)
 *   3. ML-Program marker — a `.mlmodelc` flagged `requireMlProgram` must contain `model.mil`;
 *                          present-but-no-mil → `corrupt`.
 *
 * Why (3): a partial on-device unzip can leave a `.mlmodelc` dir whose huge `weights/weight.bin`
 * is intact (so the size floor passes) but whose small `model.mil` (1 KB–1 MB) was dropped/truncated.
 * CoreML then no longer recognizes the bundle as an ML Program and rejects `MLModelConfiguration
 * .functionName` ("must be nil unless model type is ML Program"). Size alone can't see this — only an
 * explicit `model.mil` assertion does. The `hasModelMil` flag is filled by the device-side stat
 * (`statModelDir` in local-llm-anemll.ts); this module stays pure / vitest-testable.
 */
export interface RequiredModelFile {
  name: string;
  /** Minimum byte size; entries below this are treated as partial/corrupt. */
  minBytes?: number;
  /** `.mlmodelc` bundles that must be ML Programs (contain `model.mil`) to load with a `functionName`. */
  requireMlProgram?: boolean;
}

export interface PresentModelFile {
  name: string;
  /** For `.mlmodelc` directories this is the recursive total size (NOT a sentinel). */
  bytes: number;
  /** For `.mlmodelc` dirs: whether `model.mil` (the ML-Program spec) is present. Undefined for plain files. */
  hasModelMil?: boolean;
}

export interface ModelDirCheck {
  complete: boolean;
  missing: string[];
  undersized: string[];
  /** Present + big enough, but not a valid ML Program (missing `model.mil`) — partial/corrupt extract. */
  corrupt: string[];
}

/**
 * Compare what's on disk against the required manifest.
 * A zero-byte (or absent) required entry counts as `missing`; a present entry below its `minBytes`
 * counts as `undersized`; a `requireMlProgram` entry without `model.mil` counts as `corrupt`.
 * Extra files on disk are ignored.
 */
export function checkModelDir(
  present: PresentModelFile[],
  required: RequiredModelFile[],
): ModelDirCheck {
  const byName = new Map(present.map((f) => [f.name, f]));
  const missing: string[] = [];
  const undersized: string[] = [];
  const corrupt: string[] = [];

  for (const req of required) {
    const found = byName.get(req.name);
    if (found === undefined || found.bytes <= 0) {
      missing.push(req.name);
      continue;
    }
    if (req.minBytes !== undefined && found.bytes < req.minBytes) {
      undersized.push(req.name);
      continue;
    }
    if (req.requireMlProgram && found.hasModelMil !== true) {
      corrupt.push(req.name);
    }
  }

  return {
    complete: missing.length === 0 && undersized.length === 0 && corrupt.length === 0,
    missing,
    undersized,
    corrupt,
  };
}

/**
 * The 7 artifacts produced by Anemll conversion of Kanana 1.5 2.1B (LUT6, ctx1024,
 * 2 chunks). `.mlmodelc` are directories — `bytes` is the recursive size. `minBytes`
 * floors are conservative partial-extract guards (well below real sizes: embeddings
 * ~438 MB, lm_head ~166 MB, each FFN chunk ~672 MB). `requireMlProgram` asserts the
 * `model.mil` ML-Program spec survived extraction (see module header).
 */
export const ANEMLL_KANANA_FILES: RequiredModelFile[] = [
  { name: 'meta.yaml' },
  { name: 'tokenizer.json', minBytes: 1_000_000 },
  { name: 'tokenizer_config.json' },
  { name: 'llama_embeddings.mlmodelc', minBytes: 100_000_000, requireMlProgram: true },
  { name: 'llama_lm_head_lut6.mlmodelc', minBytes: 50_000_000, requireMlProgram: true },
  { name: 'llama_FFN_PF_lut6_chunk_01of02.mlmodelc', minBytes: 100_000_000, requireMlProgram: true },
  { name: 'llama_FFN_PF_lut6_chunk_02of02.mlmodelc', minBytes: 100_000_000, requireMlProgram: true },
];
