export type SttUseCase =
  | "daily_training"
  | "game_training"
  | "weekly_kwab"
  | "clinical_evaluation";

export type SttEngine = "mock_stt" | "wasm_whisper" | "server_whisper" | "disabled";

export type SttPolicyDecision = {
  engine: SttEngine;
  rawAudioLeavesDevice: boolean;
  reason: string;
};

export type SttPolicyInput = {
  useCase: SttUseCase;
  devMode?: boolean;
  wasmAvailable: boolean;
  allowTrainingServerFallback: boolean;
  allowWasmExperiment?: boolean;
};

const TRAINING_USE_CASES = new Set<SttUseCase>([
  "daily_training",
  "game_training",
]);

const SERVER_ALLOWED_USE_CASES = new Set<SttUseCase>([
  "daily_training",
  "game_training",
  "weekly_kwab",
  "clinical_evaluation",
]);

export function isTrainingSttUseCase(useCase: SttUseCase) {
  return TRAINING_USE_CASES.has(useCase);
}

export function parseSttUseCase(value: unknown): SttUseCase {
  if (
    value === "daily_training" ||
    value === "game_training" ||
    value === "weekly_kwab" ||
    value === "clinical_evaluation"
  ) {
    return value;
  }
  return "daily_training";
}

export function parseBooleanFlag(value: unknown, defaultValue = false) {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export function resolveSttPolicy(input: SttPolicyInput): SttPolicyDecision {
  if (input.devMode) {
    return {
      engine: "mock_stt",
      rawAudioLeavesDevice: false,
      reason: "dev_mode_mock",
    };
  }

  if (
    input.allowWasmExperiment &&
    input.wasmAvailable &&
    isTrainingSttUseCase(input.useCase)
  ) {
    return {
      engine: "wasm_whisper",
      rawAudioLeavesDevice: false,
      reason: "wasm_experiment_enabled",
    };
  }

  if (SERVER_ALLOWED_USE_CASES.has(input.useCase)) {
    return {
      engine: "server_whisper",
      rawAudioLeavesDevice: true,
      reason: isTrainingSttUseCase(input.useCase)
        ? "server_default_for_training"
        : "server_allowed_for_evaluation",
    };
  }

  // Backward-compatible no-op path: training server fallback used to gate server STT.
  // Training use cases are now server-default, so this branch is intentionally unreachable.
  if (isTrainingSttUseCase(input.useCase) && input.allowTrainingServerFallback) {
    return {
      engine: "server_whisper",
      rawAudioLeavesDevice: true,
      reason: "training_server_fallback_enabled",
    };
  }

  return {
    engine: "disabled",
    rawAudioLeavesDevice: false,
    reason: "wasm_unavailable_server_blocked",
  };
}
