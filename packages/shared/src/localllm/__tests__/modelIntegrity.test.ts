import { describe, it, expect } from 'vitest';
import { checkModelDir, ANEMLL_KANANA_FILES } from '../modelIntegrity';

const required = [
  { name: 'meta.yaml' },
  { name: 'tokenizer.json', minBytes: 100 },
  { name: 'llama_embeddings.mlmodelc' },
];

describe('checkModelDir', () => {
  it('reports complete when all required files present and big enough', () => {
    const r = checkModelDir(
      [
        { name: 'meta.yaml', bytes: 800 },
        { name: 'tokenizer.json', bytes: 9_000_000 },
        { name: 'llama_embeddings.mlmodelc', bytes: 459_000_000 },
        { name: 'extra.txt', bytes: 1 },
      ],
      required,
    );
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.undersized).toEqual([]);
  });

  it('flags missing required files', () => {
    const r = checkModelDir([{ name: 'meta.yaml', bytes: 800 }], required);
    expect(r.complete).toBe(false);
    expect(r.missing).toContain('tokenizer.json');
    expect(r.missing).toContain('llama_embeddings.mlmodelc');
  });

  it('flags undersized files (partial/corrupt download)', () => {
    const r = checkModelDir(
      [
        { name: 'meta.yaml', bytes: 800 },
        { name: 'tokenizer.json', bytes: 10 }, // below minBytes 100
        { name: 'llama_embeddings.mlmodelc', bytes: 459_000_000 },
      ],
      required,
    );
    expect(r.complete).toBe(false);
    expect(r.undersized).toEqual(['tokenizer.json']);
    expect(r.missing).toEqual([]);
  });

  it('treats zero-byte present file as undersized when minBytes set, missing when 0', () => {
    const r = checkModelDir(
      [
        { name: 'meta.yaml', bytes: 0 },
        { name: 'tokenizer.json', bytes: 200 },
        { name: 'llama_embeddings.mlmodelc', bytes: 1 },
      ],
      required,
    );
    // meta.yaml has no minBytes -> any presence (bytes>=0) counts as present but
    // a 0-byte file is treated as missing/corrupt.
    expect(r.complete).toBe(false);
    expect(r.missing).toContain('meta.yaml');
  });

  describe('requireMlProgram (model.mil structural marker)', () => {
    const ffn = [
      { name: 'llama_FFN_PF_lut6_chunk_02of02.mlmodelc', minBytes: 100, requireMlProgram: true },
    ];

    it('flags present + big-enough bundle missing model.mil as corrupt (partial extract)', () => {
      // The exact bug: weight.bin intact (bytes way over floor) but model.mil dropped →
      // CoreML rejects functionName. Size alone would pass; the marker catches it.
      const r = checkModelDir(
        [{ name: 'llama_FFN_PF_lut6_chunk_02of02.mlmodelc', bytes: 700_000_000, hasModelMil: false }],
        ffn,
      );
      expect(r.complete).toBe(false);
      expect(r.corrupt).toEqual(['llama_FFN_PF_lut6_chunk_02of02.mlmodelc']);
      expect(r.undersized).toEqual([]);
      expect(r.missing).toEqual([]);
    });

    it('treats absent hasModelMil flag as corrupt when requireMlProgram', () => {
      const r = checkModelDir(
        [{ name: 'llama_FFN_PF_lut6_chunk_02of02.mlmodelc', bytes: 700_000_000 }],
        ffn,
      );
      expect(r.complete).toBe(false);
      expect(r.corrupt).toContain('llama_FFN_PF_lut6_chunk_02of02.mlmodelc');
    });

    it('passes a valid ML Program bundle (model.mil present, over floor)', () => {
      const r = checkModelDir(
        [{ name: 'llama_FFN_PF_lut6_chunk_02of02.mlmodelc', bytes: 700_000_000, hasModelMil: true }],
        ffn,
      );
      expect(r.complete).toBe(true);
      expect(r.corrupt).toEqual([]);
    });

    it('an undersized bundle is undersized (not corrupt) even when model.mil missing', () => {
      // Truncated weight.bin trips the size floor first — undersized takes precedence.
      const r = checkModelDir(
        [{ name: 'llama_FFN_PF_lut6_chunk_02of02.mlmodelc', bytes: 50, hasModelMil: false }],
        ffn,
      );
      expect(r.undersized).toEqual(['llama_FFN_PF_lut6_chunk_02of02.mlmodelc']);
      expect(r.corrupt).toEqual([]);
    });
  });
});

describe('ANEMLL_KANANA_FILES manifest', () => {
  it('lists the 7 expected artifacts incl. both FFN chunks', () => {
    const names = ANEMLL_KANANA_FILES.map((f) => f.name);
    expect(names).toContain('meta.yaml');
    expect(names).toContain('tokenizer.json');
    expect(names).toContain('tokenizer_config.json');
    expect(names).toContain('llama_embeddings.mlmodelc');
    expect(names).toContain('llama_lm_head_lut6.mlmodelc');
    expect(names).toContain('llama_FFN_PF_lut6_chunk_01of02.mlmodelc');
    expect(names).toContain('llama_FFN_PF_lut6_chunk_02of02.mlmodelc');
    expect(names).toHaveLength(7);
  });

  it('requires ML Program (model.mil) for all 4 .mlmodelc bundles', () => {
    const mlmodelc = ANEMLL_KANANA_FILES.filter((f) => f.name.endsWith('.mlmodelc'));
    expect(mlmodelc).toHaveLength(4);
    expect(mlmodelc.every((f) => f.requireMlProgram === true)).toBe(true);
    // every .mlmodelc carries a size floor (partial-extract guard)
    expect(mlmodelc.every((f) => (f.minBytes ?? 0) > 0)).toBe(true);
  });
});
