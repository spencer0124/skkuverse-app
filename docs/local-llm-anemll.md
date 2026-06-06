# On-device LLM — Anemll CoreML/ANE engine (eval)

Second on-device LLM engine: **Kanana 1.5 2.1B on the Apple Neural Engine** via
[Anemll](https://github.com/Anemll/Anemll) CoreML, alongside the existing **llama.cpp/GGUF
(Metal)** path, behind one `LlmHandle` seam with a runtime A/B toggle (llama is the default).
iOS-only. Branch: `feat/local-llm-eval`.

## Architecture — "split bridge"
- `apps/mobile/vendor/anemll` — git submodule (fork `spencer0124/Anemll` @ `fb42f60` / 0.3.5_beta),
  provides the **`AnemllCore`** Swift package (`anemll-swift-cli/`).
- `apps/mobile/native/ios/AnemllEngineImpl.swift` — compiled into the **app target**; `import AnemllCore`
  + does the real ANE inference (ModelLoader/Tokenizer/InferenceManager).
- `apps/mobile/modules/anemll/` — Expo local module (pod). `AnemllModule.swift` is slim and reaches the
  impl via the `AnemllEngine` protocol + `NSClassFromString` at runtime.
- `plugins/withAnemllAppTarget.js` — attaches `AnemllCore` (local SwiftPM) + `AnemllEngineImpl.swift` to
  the app target (XCLocalSwiftPackageReference + product dep + Frameworks build file + source file).
- JS: `src/services/local-llm-anemll.ts` (adapter), `local-llm-engine.ts` (seam: llama|anemll),
  `local-llm-engine-store.ts` (zustand+MMKV toggle, iOS 18 gate). `local-llm-manager.ts` routes lifecycle
  through the seam. Pure helpers in `packages/shared/src/localllm/` (vitest-tested).

**Why split, not a pod consuming SPM:** `AnemllCore` is an SPM-only package with a 16-pkg graph
(swift-transformers/nio/crypto/…); CocoaPods can't build SPM products for a pod target, and the Expo
module provider (Pods target) can only register pod classes. So the SPM lives on the app target (where
it builds — verified under `use_frameworks! :linkage => :static`) and the pod talks to it via runtime lookup.

## Model hosting + download
- Converted on a Mac host (recipe: `/Volumes/anemll/RECIPE.md`); `prepare_hf.sh --ios` → flat zip.
- Hosted on HuggingFace public repo `spencer0124/kanana-1.5-2.1b-ane-coreml` (single ~1.8 GB zip).
- `ensureModel` (`local-llm-anemll.ts`): download → size-verify (`ANEMLL_MODEL_ZIP_SIZE_BYTES`) →
  unzip (`react-native-zip-archive`) → `checkModelDir` integrity → atomic move. ~135 s cold ANE compile
  on first load (progress 0–80 % download, 80–99 % extract, then compile).

## Gotchas / fixes that bit us (read before touching this)
1. **Converter dep pins** — Anemll's `requirements.txt` floors are unpinned; build needs `numpy<2.4`
   (≥2.4 breaks coremltools `aten::Int`) + `transformers<5` (5.x breaks chat.py). Plus a `head_dim` patch
   (Kanana decouples head_dim=128). See `/Volumes/anemll/RECIPE.md`.
2. **`.easignore` overrides `.gitignore` for EAS builds** — its unanchored `ios/` rule excludes
   hand-written native source under any `ios/` dir → device archive fails "Build input file cannot be
   found". Both `.gitignore` AND `.easignore` carry `!`-negations for `modules/**/ios/` + `native/ios/`.
   Verify before a 45-min build: copy the ignore file to a scratch `.gitignore` and `git check-ignore`.
3. **runtimeVersion ↔ native modules** — adding a native module (here: react-native-zip-archive, the
   Anemll module) **must** bump `app.config.ts` `runtimeVersion`, else an OTA can push JS that hard-imports
   missing native code to older builds on the same runtimeVersion → crash on launch. OTA-safe only when the
   runtimeVersion matches builds that actually contain the native.
4. **Streaming decode (byte-level BPE)** — a UTF-8 char (Korean syllable) can split across tokens, so a
   partial decode buffer ends in U+FFFD. Stream decoding must **hold the incomplete tail** (HF TextStreamer
   pattern: skip emit while `decode(buffer)` ends in `�`, emit only the newly-stable suffix). The llama path
   gets this free (llama.cpp buffers internally); the manual ANE decode (`AnemllEngineImpl.onToken`) must do
   it. `usePageAi` also reconciles to the authoritative `result.text` on completion.
5. **iOS 18 floor** — AnemllCore declares `.iOS(.v18)`, so the app target floor is 18 (drops iOS 15–17).

## A/B eval (Task)
On iPhone 12+/iOS 18+: debug Local LLM screen → toggle **anemll (ANE)** → first load downloads + compiles
→ generate → compare tok/s · TTFT · cold-load · power vs **llama (GGUF)** in the A/B panel.

> Eval scaffolding (`debug-local-llm.tsx`, `local-llm*.ts`) is marked for removal after the eval; keep the
> engine seam if Anemll is promoted.
