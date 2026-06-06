/**
 * Engine identity for the on-device LLM seam.
 *
 * Historically this held the llama|anemll A/B selection policy (resolveEngine +
 * device gate). The GGUF/llama engine has been removed — anemll (CoreML/ANE) is the
 * only engine — so only the seam's id type remains. Kept as a (currently single-member)
 * union so the `LocalLlmEngine` seam stays generic and can re-widen if a second engine
 * is ever added.
 */
export type LlmEngineId = 'anemll';
