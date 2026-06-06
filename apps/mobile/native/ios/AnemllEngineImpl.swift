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

    var chat: [Tokenizer.ChatMessage] = []
    for m in messages {
      let content = m["content"] ?? ""
      switch m["role"] {
      case "system": chat.append(.system(content))
      case "assistant": chat.append(.assistant(content))
      default: chat.append(.user(content))
      }
    }

    let initialTokens = tok.applyChatTemplate(input: chat, addGenerationPrompt: true)
    let inputTokens = initialTokens.count

    // Incremental decode-delta (handles multi-token Korean glyphs correctly).
    var genTokens: [Int] = []
    var prevText = ""
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
        if full.count >= prevText.count, full.hasPrefix(prevText) {
          let delta = String(full.dropFirst(prevText.count))
          prevText = full
          if !delta.isEmpty { onToken(delta) }
        } else {
          prevText = full
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
