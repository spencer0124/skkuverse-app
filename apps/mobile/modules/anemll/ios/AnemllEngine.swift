import Foundation

/**
 * Engine protocol + registry — the "split bridge" seam.
 *
 * Why split: AnemllCore is an SPM-only Swift package with a 16-package dependency
 * graph (swift-transformers/nio/crypto/...). It builds cleanly only on the **app
 * target** (CocoaPods can't build SPM products for a pod target). But the Expo
 * module provider lives in the Pods target and can only register **pod** classes.
 *
 * Resolution: the Expo module (AnemllModule, this pod) talks to AnemllCore only
 * through this protocol. The concrete implementation (AnemllEngineImpl) lives in the
 * **app target** where `import AnemllCore` works, and registers itself here. The app
 * target imports this pod (valid direction), so both sides share the protocol type.
 */
public protocol AnemllEngine: AnyObject {
  var isReady: Bool { get }
  var isBusy: Bool { get }

  func prepare(
    modelDir: String,
    onProgress: @escaping (Double, String, String?) -> Void
  ) async throws

  /// Returns the GenerateResult fields as a dictionary (text/inputTokens/outputTokens/
  /// firstTokenMs/tokPerSec/stopReason). onToken streams decoded string deltas.
  func generate(
    messages: [[String: String]],
    temperature: Float,
    maxTokens: Int,
    onToken: @escaping (String) -> Void
  ) async throws -> [String: Any]

  func stop()
  func unload()
}

/// Set by AnemllEngineImpl (app target). Read by AnemllModule (pod).
public enum AnemllRegistry {
  public static var engine: AnemllEngine?
}
