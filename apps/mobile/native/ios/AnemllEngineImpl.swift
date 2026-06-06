import Foundation
import AnemllCore
import Anemll

/**
 * Concrete AnemllEngine implementation — compiled into the **app target** (where the
 * AnemllCore SwiftPM package + its 16-package dependency graph build cleanly, proven by
 * the simulator link build). Added to the app target via the withAnemllAppTarget config
 * plugin; resolved at runtime by the Anemll pod's AnemllModule via NSClassFromString.
 *
 * Mirrors the canonical AnemllCore usage in anemll-swift-cli's anemllcli.swift.
 */
@objc(AnemllEngineImpl)
public final class AnemllEngineImpl: NSObject, AnemllEngine {
  private var tokenizer: Tokenizer?
  private var inference: InferenceManager?
  private var config: YAMLConfig?
  private var busy = false

  public var isReady: Bool { inference != nil }
  public var isBusy: Bool { busy || (inference?.isBusy() ?? false) }

  public func prepare(
    modelDir: String,
    onProgress: @escaping (Double, String, String?) -> Void
  ) async throws {
    let metaPath = (modelDir as NSString).appendingPathComponent("meta.yaml")
    let cfg = try YAMLConfig.load(from: metaPath)
    self.config = cfg

    // Kanana is a Llama-3 family model → llama chat template.
    let tok = try await Tokenizer(
      modelPath: cfg.tokenizerModel,
      template: "llama",
      debugLevel: 0
    )

    let progress = ProgressForwarder(onProgress)
    let loader = ModelLoader(progressDelegate: progress)
    let models = try await loader.loadModel(from: cfg)

    let mgr = try InferenceManager(
      models: models,
      contextLength: cfg.contextLength,
      batchSize: cfg.batchSize,
      splitLMHead: cfg.splitLMHead,
      debugLevel: 0,
      v110: cfg.configVersion == "0.1.1",
      argmaxInModel: cfg.argmaxInModel,
      slidingWindow: cfg.slidingWindow,
      updateMaskPrefill: cfg.updateMaskPrefill,
      prefillDynamicSlice: cfg.prefillDynamicSlice,
      modelPrefix: cfg.modelPrefix,
      vocabSize: cfg.vocabSize,
      lmHeadChunkSizes: cfg.lmHeadChunkSizes
    )

    self.tokenizer = tok
    self.inference = mgr
  }

  public func generate(
    messages: [[String: String]],
    temperature: Float,
    maxTokens: Int,
    onToken: @escaping (String) -> Void
  ) async throws -> [String: Any] {
    guard let tok = tokenizer, let mgr = inference else {
      throw EngineError.notLoaded
    }
    busy = true
    defer { busy = false }

    // Fit the prompt inside the model's fixed ANE context window. contextLength is baked
    // into the .mlmodelc (e.g. 1024) — runPrefill writes one KV-cache slot per input token,
    // so prefilling more tokens than contextLength overflows the cache and throws (which
    // surfaced to users as a generic "no content" error on long pages). Reserve maxTokens for
    // the generation, then trim the largest message's content head-first: the page body rides
    // in a system message whose instruction prefix sits at the head, so head-keep preserves
    // the instructions and drops only the least-important page tail.
    let contextLength = config?.contextLength ?? 1024
    let budget = max(1, contextLength - maxTokens - 16)
    let fittedMessages = AnemllEngineImpl.fitMessages(messages, budget: budget, tokenizer: tok)

    let chat = AnemllEngineImpl.buildChat(from: fittedMessages)
    let initialTokens = tok.applyChatTemplate(input: chat, addGenerationPrompt: true)
    let inputTokens = initialTokens.count

    // Incremental decode-delta (handles multi-token Korean glyphs correctly).
    var genTokens: [Int] = []
    var emitted = 0 // characters already streamed
    let startTime = CFAbsoluteTimeGetCurrent()
    var firstTokenMs: Double = 0

    let (generatedTokens, prefillTime, stopReason) = try await mgr.generateResponse(
      initialTokens: initialTokens,
      temperature: temperature,
      maxTokens: maxTokens,
      eosTokens: tok.eosTokenIds,
      tokenizer: tok,
      onToken: { tokenId in
        if firstTokenMs == 0 {
          firstTokenMs = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
        }
        genTokens.append(tokenId)
        let full = tok.decode(tokens: genTokens, skipSpecialTokens: true)
        // Byte-level BPE can split a UTF-8 char (e.g. a Korean syllable) across tokens, so a
        // partial buffer decodes with a trailing U+FFFD. Hold until it completes (HF TextStreamer
        // pattern): the already-complete prefix is stable (decode is append-only there); only the
        // tail is unstable. Emit only the newly-stable suffix beyond what we've already streamed.
        if full.hasSuffix("\u{FFFD}") { return }
        let chars = Array(full)
        if chars.count > emitted {
          let delta = String(chars[emitted...])
          emitted = chars.count
          onToken(delta)
        }
      }
    )

    let text = tok.decode(tokens: generatedTokens, skipSpecialTokens: true)
    let totalSec = CFAbsoluteTimeGetCurrent() - startTime
    let decodeSec = max(0, totalSec - prefillTime)
    let outputTokens = generatedTokens.count
    let tokPerSec = decodeSec > 0 ? Double(outputTokens) / decodeSec : 0

    return [
      "text": text,
      "inputTokens": inputTokens,
      "outputTokens": outputTokens,
      "firstTokenMs": firstTokenMs > 0 ? firstTokenMs : prefillTime * 1000.0,
      "tokPerSec": tokPerSec,
      "stopReason": stopReason,
    ]
  }

  /// Builds AnemllCore ChatMessages from the JS role/content dictionaries.
  private static func buildChat(from messages: [[String: String]]) -> [Tokenizer.ChatMessage] {
    var chat: [Tokenizer.ChatMessage] = []
    for m in messages {
      let content = m["content"] ?? ""
      switch m["role"] {
      case "system": chat.append(.system(content))
      case "assistant": chat.append(.assistant(content))
      default: chat.append(.user(content))
      }
    }
    return chat
  }

  /// Returns messages whose chat-template token count fits within `budget`, trimming the
  /// longest message's content from the tail (head-keep). The loop is bounded and convergent:
  /// a detokenize→re-tokenize round-trip can drift a few tokens, so we re-measure each pass and
  /// pad the cut by 8 tokens. The on-device tokenizer makes this exact — no char heuristic.
  private static func fitMessages(
    _ messages: [[String: String]],
    budget: Int,
    tokenizer tok: Tokenizer
  ) -> [[String: String]] {
    func templateCount(_ msgs: [[String: String]]) -> Int {
      tok.applyChatTemplate(input: buildChat(from: msgs), addGenerationPrompt: true).count
    }

    var msgs = messages
    var total = templateCount(msgs)
    if total <= budget { return msgs }

    for _ in 0..<8 {
      // Trim the message carrying the most content tokens — for summary that's the system
      // message holding the page body.
      var idx = 0
      var maxCount = -1
      for (i, m) in msgs.enumerated() {
        let n = tok.tokenize(m["content"] ?? "").count
        if n > maxCount { maxCount = n; idx = i }
      }
      let contentTokens = tok.tokenize(msgs[idx]["content"] ?? "")
      let overflow = total - budget
      let keep = max(0, contentTokens.count - overflow - 8)  // pad for re-tokenization drift
      if keep >= contentTokens.count { break }  // nothing left to cut from this message
      msgs[idx]["content"] = keep == 0 ? "" : tok.detokenize(Array(contentTokens.prefix(keep)))
      total = templateCount(msgs)
      if total <= budget { break }
    }
    return msgs
  }

  public func stop() {
    inference?.AbortGeneration(Code: 1)
  }

  public func unload() {
    inference?.unload()
    inference = nil
    tokenizer = nil
    config = nil
  }

  enum EngineError: Error { case notLoaded }
}

/// Forwards AnemllCore load progress to the engine's onProgress closure.
private final class ProgressForwarder: ModelLoadingProgressDelegate {
  private let onProgress: (Double, String, String?) -> Void
  init(_ onProgress: @escaping (Double, String, String?) -> Void) {
    self.onProgress = onProgress
  }
  func loadingProgress(percentage: Double, stage: String, detail: String?) {
    onProgress(percentage, stage, detail)
  }
  func loadingCancelled() {}
  func loadingCompleted(models: LoadedModels) {}
  func loadingFailed(error: Error) {}
}
