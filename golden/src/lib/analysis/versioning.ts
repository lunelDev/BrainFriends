export type PipelineStage =
  | "step1"
  | "step2"
  | "step3"
  | "step4"
  | "step5"
  | "step6"
  | "sing";

export type VersionSnapshot = {
  algorithm_version: string;
  feature_schema_version: string;
  scoring_rule_version: string;
  model_version: string;
  release_version: string;
  pipeline_name: string;
  pipeline_stage: PipelineStage;
  generated_at: string;
  requirements: string[];
  config_version?: string;
  preprocessing_version?: string;
  postprocessing_version?: string;
};

type VersionSnapshotTemplate = Omit<VersionSnapshot, "generated_at" | "pipeline_stage">;

const RELEASE_VERSION = "golden-2026.03.13";

const VERSION_SNAPSHOT_TEMPLATES: Record<PipelineStage, VersionSnapshotTemplate> = {
  step1: {
    algorithm_version: "auditory-comprehension-v1",
    feature_schema_version: "auditory-response-schema-v1",
    scoring_rule_version: "auditory-composite-score-v1",
    model_version: "rule-based-none",
    release_version: RELEASE_VERSION,
    pipeline_name: "self-rehab-step1-auditory-comprehension",
    requirements: ["SAMD-AUD-001", "SAMD-TRACE-001"],
    config_version: "auditory-thresholds-v1",
    preprocessing_version: "question-timing-v1",
    postprocessing_version: "auditory-result-envelope-v1",
  },
  step2: {
    algorithm_version: "speech-repetition-analysis-v1",
    feature_schema_version: "speech-face-feature-schema-v1",
    scoring_rule_version: "speech-repetition-score-v1",
    model_version: "whisper-1+mediapipe-face-landmarker@cdn",
    release_version: RELEASE_VERSION,
    pipeline_name: "self-rehab-step2-repetition",
    requirements: ["SAMD-SPECH-002", "SAMD-FACE-001", "SAMD-TRACE-001"],
    config_version: "speech-repetition-thresholds-v1",
    preprocessing_version: "audio-face-preprocessing-v1",
    postprocessing_version: "speech-repetition-envelope-v1",
  },
  step3: {
    algorithm_version: "visual-matching-analysis-v1",
    feature_schema_version: "visual-response-schema-v1",
    scoring_rule_version: "visual-matching-score-v1",
    model_version: "rule-based-none",
    release_version: RELEASE_VERSION,
    pipeline_name: "self-rehab-step3-visual-matching",
    requirements: ["SAMD-VIS-001", "SAMD-TRACE-001"],
    config_version: "visual-matching-thresholds-v1",
    preprocessing_version: "visual-response-preprocessing-v1",
    postprocessing_version: "visual-matching-envelope-v1",
  },
  step4: {
    algorithm_version: "fluency-analysis-v1",
    feature_schema_version: "fluency-feature-schema-v1",
    scoring_rule_version: "fluency-kwab-score-v1",
    model_version: "whisper-1+mediapipe-face-landmarker@cdn",
    release_version: RELEASE_VERSION,
    pipeline_name: "self-rehab-step4-fluency",
    requirements: ["SAMD-FLU-001", "SAMD-FACE-001", "SAMD-TRACE-001"],
    config_version: "fluency-thresholds-v1",
    preprocessing_version: "fluency-audio-face-preprocessing-v1",
    postprocessing_version: "fluency-envelope-v1",
  },
  step5: {
    algorithm_version: "reading-analysis-v1",
    feature_schema_version: "reading-feature-schema-v1",
    scoring_rule_version: "reading-score-v1",
    model_version: "whisper-1+mediapipe-face-landmarker@cdn",
    release_version: RELEASE_VERSION,
    pipeline_name: "self-rehab-step5-reading",
    requirements: ["SAMD-READ-001", "SAMD-FACE-001", "SAMD-TRACE-001"],
    config_version: "reading-thresholds-v1",
    preprocessing_version: "reading-audio-face-preprocessing-v1",
    postprocessing_version: "reading-envelope-v1",
  },
  step6: {
    algorithm_version: "writing-analysis-v1",
    feature_schema_version: "writing-feature-schema-v1",
    scoring_rule_version: "writing-score-v1",
    model_version: "rule-based-writing-v1",
    release_version: RELEASE_VERSION,
    pipeline_name: "self-rehab-step6-writing",
    requirements: ["SAMD-WRITE-001", "SAMD-TRACE-001"],
    config_version: "writing-thresholds-v1",
    preprocessing_version: "writing-image-preprocessing-v1",
    postprocessing_version: "writing-envelope-v1",
  },
  sing: {
    algorithm_version: "brain-sing-analysis-v1",
    feature_schema_version: "brain-sing-feature-schema-v1",
    scoring_rule_version: "brain-sing-score-v1",
    model_version: "brain-sing-sim-v1",
    release_version: RELEASE_VERSION,
    pipeline_name: "brain-karaoke-analysis",
    requirements: ["SAMD-SING-001", "SAMD-FACE-001", "SAMD-TRACE-001"],
    config_version: "brain-sing-thresholds-v1",
    preprocessing_version: "brain-sing-audio-video-preprocessing-v1",
    postprocessing_version: "brain-sing-envelope-v1",
  },
};

export function buildVersionSnapshot(
  pipelineStage: PipelineStage,
  overrides: Partial<Omit<VersionSnapshot, "pipeline_stage" | "generated_at">> = {},
): VersionSnapshot {
  const template = VERSION_SNAPSHOT_TEMPLATES[pipelineStage];

  return {
    ...template,
    ...overrides,
    pipeline_stage: pipelineStage,
    generated_at: new Date().toISOString(),
  };
}
