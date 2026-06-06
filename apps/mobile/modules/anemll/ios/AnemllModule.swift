import ExpoModulesCore
import Foundation

/**
 * Expo native module bridging AnemllCore (Apple-Neural-Engine LLM runtime) to JS.
 *
 * This pod does NOT import AnemllCore (SPM-only, builds on the app target). It talks
 * to the runtime through the `AnemllEngine` protocol; the concrete `AnemllEngineImpl`
 * lives in the app target and is resolved lazily via NSClassFromString. See
 * AnemllEngine.swift for the rationale ("split bridge").
 *
 * Single-instance state mirrors the JS-side singleton manager (local-llm-manager.ts).
 * Token streaming is emitted as `onToken` events keyed by requestId; the JS adapter
 * (local-llm-anemll.ts) reassembles them into a GenerateResult.
 */
public class AnemllModule: Module {
  private var generating = false

  public func definition() -> ModuleDefinition {
    Name("Anemll")

    Events("onToken", "onLoadProgress", "onLoadComplete", "onLoadError")

    AsyncFunction("prepareModel") { (modelDir: String) async throws -> Void in
      let engine = try self.resolveEngine()
      do {
        try await engine.prepare(modelDir: modelDir) { percentage, stage, detail in
          self.sendEvent("onLoadProgress", [
            "percentage": percentage,
            "stage": stage,
            "detail": detail as Any,
          ])
        }
      } catch {
        self.sendEvent("onLoadError", ["error": String(describing: error)])
        throw error
      }
      self.sendEvent("onLoadComplete", [:])
    }

    AsyncFunction("generate") {
      (requestId: String, messages: [[String: String]], options: [String: Any]) async throws -> [String: Any] in
      let engine = try self.resolveEngine()
      if self.generating { throw AnemllModuleError.busy }
      self.generating = true
      defer { self.generating = false }

      let temperature = (options["temperature"] as? Double).map { Float($0) } ?? 0.7
      let maxTokens = (options["nPredict"] as? Int) ?? 512

      return try await engine.generate(
        messages: messages,
        temperature: temperature,
        maxTokens: maxTokens,
        onToken: { delta in
          self.sendEvent("onToken", ["requestId": requestId, "token": delta])
        }
      )
    }

    AsyncFunction("stop") { (_: String) -> Void in
      AnemllRegistry.engine?.stop()
    }

    AsyncFunction("unloadModel") { () -> Void in
      AnemllRegistry.engine?.unload()
    }

    Function("isReady") { () -> Bool in
      return AnemllRegistry.engine?.isReady ?? false
    }

    Function("isBusy") { () -> Bool in
      return self.generating || (AnemllRegistry.engine?.isBusy ?? false)
    }
  }

  /// Lazily resolve the app-target implementation (registers it on first use).
  private func resolveEngine() throws -> AnemllEngine {
    if let e = AnemllRegistry.engine { return e }
    guard
      let cls = NSClassFromString("AnemllEngineImpl") as? NSObject.Type,
      let instance = cls.init() as? AnemllEngine
    else {
      throw AnemllModuleError.engineUnavailable
    }
    AnemllRegistry.engine = instance
    return instance
  }
}

enum AnemllModuleError: Error {
  case engineUnavailable
  case busy
}
