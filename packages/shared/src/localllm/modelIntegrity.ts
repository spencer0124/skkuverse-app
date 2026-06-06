/**
 * Pure model-directory integrity check for the Anemll multi-file CoreML model.
 * Unlike the single-file GGUF (size-equality self-heal in local-llm.ts), the ANE
 * model is a directory of `.mlmodelc` bundles + tokenizer + meta.yaml, so we verify
 * presence + a minimum-size floor per required entry. No native deps — vitest-testable.
 */
export interface RequiredModelFile {
  name: string;
  /** Minimum byte size; entries below this are treated as partial/corrupt. */
  minBytes?: number;
}

export interface PresentModelFile {
  name: string;
  /** For `.mlmodelc` directories this is the recursive total size. */
  bytes: number;
}

export interface ModelDirCheck {
  complete: boolean;
  missing: string[];
  undersized: string[];
}

/**
 * Compare what's on disk against the required manifest.
 * A zero-byte (or absent) required entry counts as `missing`; a present entry below
 * its `minBytes` counts as `undersized`. Extra files on disk are ignored.
 */
export function checkModelDir(
  present: PresentModelFile[],
  required: RequiredModelFile[],
): ModelDirCheck {
  const byName = new Map(present.map((f) => [f.name, f.bytes]));
  const missing: string[] = [];
  const undersized: string[] = [];

  for (const req of required) {
    const bytes = byName.get(req.name);
    if (bytes === undefined || bytes <= 0) {
      missing.push(req.name);
      continue;
    }
    if (req.minBytes !== undefined && bytes < req.minBytes) {
      undersized.push(req.name);
    }
  }

  return {
    complete: missing.length === 0 && undersized.length === 0,
    missing,
    undersized,
  };
}

/**
 * The 7 artifacts produced by Anemll conversion of Kanana 1.5 2.1B (LUT6, ctx1024,
 * 2 chunks). `.mlmodelc` are directories — `bytes` is recursive size. minBytes floors
 * are conservative partial-download guards, not exact sizes.
 */
export const ANEMLL_KANANA_FILES: RequiredModelFile[] = [
  { name: 'meta.yaml' },
  { name: 'tokenizer.json', minBytes: 1_000_000 },
  { name: 'tokenizer_config.json' },
  { name: 'llama_embeddings.mlmodelc', minBytes: 100_000_000 },
  { name: 'llama_lm_head_lut6.mlmodelc', minBytes: 50_000_000 },
  { name: 'llama_FFN_PF_lut6_chunk_01of02.mlmodelc', minBytes: 100_000_000 },
  { name: 'llama_FFN_PF_lut6_chunk_02of02.mlmodelc', minBytes: 100_000_000 },
];
