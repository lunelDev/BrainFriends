import { localStoreAdapter } from "@/lib/storage/adapters";
import type { VersionSnapshot } from "@/lib/analysis/versioning";

export type ClientAuditStatus = "success" | "failed" | "skipped" | "rejected";

export type ClientClinicalAuditEntry = {
  audit_event_id: string;
  event_type: string;
  status: ClientAuditStatus;
  timestamp: string;
  patient_pseudonym_id: string;
  session_id: string;
  operator_user_role: "patient";
  pipeline_stage: string;
  place: string;
  device_info: {
    userAgent: string | null;
    platform: string | null;
    language: string | null;
  };
  raw_input_metadata: {
    inputKind: "voice" | "writing" | "choice" | "multimodal" | "unknown";
  };
  preprocessing_version: string | null;
  feature_values: Record<string, number | string | boolean | null>;
  final_scores: Record<string, number | string | null>;
  threshold_decision: {
    ruleName: string;
    threshold: number | null;
    comparator: ">=" | ">" | "<=" | "<" | "unknown";
    observedValue: number | null;
    passed: boolean | null;
  } | null;
  algorithm_versions: VersionSnapshot | null;
  failure_reason: string | null;
  storage_targets: string[];
};

const CLIENT_AUDIT_TRAIL_KEY = "kwab_clinical_audit_trail";
const MAX_CLIENT_AUDIT_ENTRIES = 500;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function buildAuditEventId(seed: string) {
  return `caudit_${hashString(seed)}_${Date.now()}`;
}

function getDeviceInfo() {
  if (typeof window === "undefined") {
    return {
      userAgent: null,
      platform: null,
      language: null,
    };
  }

  return {
    userAgent: window.navigator.userAgent ?? null,
    platform: window.navigator.platform ?? null,
    language: window.navigator.language ?? null,
  };
}

export function appendClientClinicalAuditLog(entry: ClientClinicalAuditEntry) {
  if (typeof window === "undefined") return;

  const raw = localStoreAdapter.getItem(CLIENT_AUDIT_TRAIL_KEY);
  const parsed = raw ? (JSON.parse(raw) as ClientClinicalAuditEntry[]) : [];
  const next = [...parsed, entry].slice(-MAX_CLIENT_AUDIT_ENTRIES);
  localStoreAdapter.setItem(CLIENT_AUDIT_TRAIL_KEY, JSON.stringify(next));
}

export function buildClientStepAuditLog(params: {
  patientPseudonymId: string;
  sessionId: string;
  pipelineStage: string;
  place: string;
  inputKind: "voice" | "writing" | "choice" | "multimodal" | "unknown";
  finalScore: number | null;
  featureValues: Record<string, number | string | boolean | null>;
  versionSnapshot?: VersionSnapshot;
  status?: ClientAuditStatus;
  failureReason?: string | null;
}) {
  const {
    patientPseudonymId,
    sessionId,
    pipelineStage,
    place,
    inputKind,
    finalScore,
    featureValues,
    versionSnapshot,
    status = "success",
    failureReason = null,
  } = params;

  return {
    audit_event_id: buildAuditEventId(
      [patientPseudonymId, sessionId, pipelineStage, String(finalScore)].join("|"),
    ),
    event_type: "training_step_result_saved",
    status,
    timestamp: new Date().toISOString(),
    patient_pseudonym_id: patientPseudonymId,
    session_id: sessionId,
    operator_user_role: "patient",
    pipeline_stage: pipelineStage,
    place,
    device_info: getDeviceInfo(),
    raw_input_metadata: {
      inputKind,
    },
    preprocessing_version: versionSnapshot?.preprocessing_version ?? null,
    feature_values: featureValues,
    final_scores: {
      overall_score: finalScore,
    },
    threshold_decision:
      finalScore === null
        ? null
        : {
            ruleName: `${pipelineStage}-completion-threshold`,
            threshold: 70,
            comparator: ">=",
            observedValue: finalScore,
            passed: finalScore >= 70,
          },
    algorithm_versions: versionSnapshot ?? null,
    failure_reason: failureReason,
    storage_targets: [
      "localStorage:kwab_training_session",
      `localStorage:${CLIENT_AUDIT_TRAIL_KEY}`,
    ],
  } satisfies ClientClinicalAuditEntry;
}
