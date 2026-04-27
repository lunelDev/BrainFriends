import { createHash } from "crypto";
import { appendFile, mkdir } from "fs/promises";
import path from "path";
import type { PatientProfile } from "@/lib/patientStorage";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import type { VersionSnapshot } from "@/lib/analysis/versioning";
import { buildPatientPseudonymId } from "@/lib/server/patientIdentityDb";

export type AuditEventStatus = "success" | "failed" | "skipped" | "rejected";
export type OperatorUserRole =
  | "patient"
  | "therapist"
  | "admin"
  | "prescriber"
  | "anonymous"
  | "system";
export type AuditAlgorithmVersions =
  | VersionSnapshot
  | Record<string, VersionSnapshot | null | undefined>
  | null;

export type AuditDeviceInfo = {
  userAgent: string | null;
  platform: string | null;
  acceptLanguage: string | null;
  ipAddress: string | null;
};

export type AuditRawInputMetadata = {
  inputKind: "voice" | "multimodal" | "writing" | "choice" | "unknown";
  audioDurationSec?: number | null;
  audioEncoding?: string | null;
  audioSampleRateHz?: number | null;
  reviewAudioAttached?: boolean;
  songKey?: string | null;
  trainingMode?: string | null;
  rehabStep?: number | null;
};

export type AuditThresholdDecision = {
  ruleName: string;
  threshold: number | null;
  comparator: ">=" | ">" | "<=" | "<" | "unknown";
  observedValue: number | null;
  passed: boolean | null;
};

export type AuditFeatureValues = Record<string, number | string | boolean | null>;

export type ClinicalAuditLogEntry = {
  audit_event_id: string;
  event_type: string;
  status: AuditEventStatus;
  timestamp: string;
  patient_pseudonym_id: string | null;
  session_id: string | null;
  operator_user_role: OperatorUserRole;
  pipeline_stage: string;
  device_info: AuditDeviceInfo;
  raw_input_metadata: AuditRawInputMetadata;
  preprocessing_version: string | null;
  feature_values: AuditFeatureValues;
  final_scores: Record<string, number | string | null>;
  threshold_decision: AuditThresholdDecision | null;
  algorithm_versions: AuditAlgorithmVersions;
  failure_reason: string | null;
  storage_targets: string[];
};

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildAuditDeviceInfo(request: Request): AuditDeviceInfo {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return {
    userAgent: request.headers.get("user-agent"),
    platform: request.headers.get("sec-ch-ua-platform"),
    acceptLanguage: request.headers.get("accept-language"),
    ipAddress: forwardedFor ? forwardedFor.split(",")[0].trim() : null,
  };
}

function buildAuditEventId(prefix: string, seed: string) {
  return `${prefix}_${hashValue(seed).slice(0, 20)}`;
}

export async function appendClinicalAuditLog(entry: ClinicalAuditLogEntry) {
  const auditDir = path.join(process.cwd(), "data", "audit");
  const logPath = path.join(auditDir, "clinical-events.ndjson");
  await mkdir(auditDir, { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  return logPath;
}

/**
 * 경량 접근 감사 로그.
 *
 * 임상 데이터를 만지는 모든 API 가 호출해야 한다 (read 포함).
 * 식약처 사이버보안 가이드라인 § "접근 제어 및 감사 로그" 충족 목적.
 *
 * 기존 appendClinicalAuditLog (상세 결과용) 와 분리한 이유:
 *   - read 트래픽이 너무 많아 결과 스키마(feature_values, threshold 등) 를
 *     매번 채우는 것은 비현실적.
 *   - 대신 "누가 / 언제 / 어떤 자원에 / 어떤 행위를 / 결과는 무엇" 5W1H 만 기록.
 *   - 같은 디렉토리(data/audit) 의 별도 파일(access-events.ndjson) 에 적재.
 */

export type ClinicalAccessAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "redeem"
  | "revoke"
  | "list"
  | "export";

export type ClinicalAccessAuditEntry = {
  audit_event_id: string;
  event_type: string;
  action: ClinicalAccessAction;
  status: AuditEventStatus;
  timestamp: string;
  operator_user_id: string | null;
  operator_user_role: OperatorUserRole;
  subject_user_id: string | null; // 데이터 대상자(환자) — 없으면 null
  subject_pseudonym_id: string | null;
  resource_type: string; // ex: "prescription", "training_history", "patient_report"
  resource_id: string | null;
  route: string; // request URL pathname
  method: string; // GET/POST/...
  http_status: number | null;
  failure_reason: string | null;
  device_info: AuditDeviceInfo;
};

export type AppendClinicalAccessInput = {
  request: Request;
  action: ClinicalAccessAction;
  status?: AuditEventStatus;
  operatorUserId?: string | null;
  operatorUserRole?: OperatorUserRole;
  subjectUserId?: string | null;
  subjectPseudonymId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  httpStatus?: number | null;
  failureReason?: string | null;
};

export async function appendClinicalAccessAuditLog(
  input: AppendClinicalAccessInput,
): Promise<string> {
  const url = new URL(input.request.url);
  const seed = [
    input.operatorUserId ?? "anon",
    input.action,
    input.resourceType,
    input.resourceId ?? "-",
    new Date().toISOString(),
  ].join("|");

  const entry: ClinicalAccessAuditEntry = {
    audit_event_id: buildAuditEventId("acc", seed),
    event_type: `${input.resourceType}.${input.action}`,
    action: input.action,
    status: input.status ?? "success",
    timestamp: new Date().toISOString(),
    operator_user_id: input.operatorUserId ?? null,
    operator_user_role: input.operatorUserRole ?? "anonymous",
    subject_user_id: input.subjectUserId ?? null,
    subject_pseudonym_id: input.subjectPseudonymId ?? null,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    route: url.pathname,
    method: input.request.method,
    http_status: input.httpStatus ?? null,
    failure_reason: input.failureReason ?? null,
    device_info: buildAuditDeviceInfo(input.request),
  };

  const auditDir = path.join(process.cwd(), "data", "audit");
  const logPath = path.join(auditDir, "access-events.ndjson");
  await mkdir(auditDir, { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  return logPath;
}

/**
 * 절대 throw 하지 않는 안전 래퍼. 라우트 정상 흐름에서 audit 실패가
 * 응답 차단으로 번지지 않도록 사용한다.
 */
export async function safeAppendAccess(
  input: AppendClinicalAccessInput,
): Promise<void> {
  try {
    await appendClinicalAccessAuditLog(input);
  } catch (err) {
    console.error("[audit/access] failed to write entry:", err);
  }
}

export function buildSingTrainingAuditLog(params: {
  request: Request;
  patient: PatientProfile | null;
  sessionId?: string | null;
  status: AuditEventStatus;
  result?: {
    song: string;
    score: number;
    finalJitter: string;
    finalSi: string;
    rtLatency: string;
    reviewAudioUrl?: string | null;
    versionSnapshot?: VersionSnapshot;
  } | null;
  failureReason?: string | null;
  storageTargets?: string[];
}) {
  const {
    request,
    patient,
    sessionId,
    status,
    result,
    failureReason,
    storageTargets = [],
  } = params;

  const finalJitter = result?.finalJitter ? Number(result.finalJitter) : null;
  const finalSi = result?.finalSi ? Number(result.finalSi) : null;
  const latencyMs = result?.rtLatency
    ? Number(String(result.rtLatency).replace(/[^0-9.]/g, ""))
    : null;
  const thresholdDecision: AuditThresholdDecision | null = result
    ? {
        ruleName: "brain-sing-score-pass-threshold",
        threshold: 70,
        comparator: ">=",
        observedValue: result.score,
        passed: result.score >= 70,
      }
    : null;

  const seed = [
    patient?.sessionId ?? "unknown",
    sessionId ?? "unknown",
    result?.song ?? "unknown",
    status,
    result?.versionSnapshot?.generated_at ?? new Date().toISOString(),
  ].join("|");

  return {
    audit_event_id: buildAuditEventId("audit", seed),
    event_type: "sing_training_result_persist",
    status,
    timestamp: new Date().toISOString(),
    patient_pseudonym_id: patient ? buildPatientPseudonymId(patient) : null,
    session_id: sessionId ?? null,
    operator_user_role: "patient",
    pipeline_stage: result?.versionSnapshot?.pipeline_stage ?? "sing",
    device_info: buildAuditDeviceInfo(request),
    raw_input_metadata: {
      inputKind: "multimodal",
      audioEncoding: result?.reviewAudioUrl?.startsWith("data:audio/webm")
        ? "audio/webm"
        : null,
      reviewAudioAttached: Boolean(result?.reviewAudioUrl),
      songKey: result?.song ?? null,
    },
    preprocessing_version: result?.versionSnapshot?.preprocessing_version ?? null,
    feature_values: {
      jitter_percent: Number.isFinite(finalJitter) ? finalJitter : null,
      facial_symmetry_index: Number.isFinite(finalSi) ? finalSi : null,
      reaction_latency_ms: Number.isFinite(latencyMs) ? latencyMs : null,
    },
    final_scores: {
      overall_score: result?.score ?? null,
      jitter_percent: Number.isFinite(finalJitter) ? finalJitter : null,
      facial_symmetry_index: Number.isFinite(finalSi) ? finalSi : null,
    },
    threshold_decision: thresholdDecision,
    algorithm_versions: result?.versionSnapshot ?? null,
    failure_reason: failureReason ?? null,
    storage_targets: storageTargets,
  } satisfies ClinicalAuditLogEntry;
}

export function buildTrainingHistoryAuditLog(params: {
  request: Request;
  patient: PatientProfile | null;
  sessionId?: string | null;
  status: AuditEventStatus;
  historyEntry?: TrainingHistoryEntry | null;
  failureReason?: string | null;
  storageTargets?: string[];
}) {
  const {
    request,
    patient,
    sessionId,
    status,
    historyEntry,
    failureReason,
    storageTargets = [],
  } = params;

  const trainingMode = historyEntry?.trainingMode ?? "self";
  const pipelineStage = historyEntry?.rehabStep
    ? `step${historyEntry.rehabStep}`
    : trainingMode === "rehab"
      ? "rehab"
      : "self-assessment";
  const seed = [
    patient?.sessionId ?? "unknown",
    sessionId ?? historyEntry?.sessionId ?? "unknown",
    historyEntry?.historyId ?? "unknown",
    status,
    String(historyEntry?.completedAt ?? Date.now()),
  ].join("|");
  const stepScores = historyEntry?.stepScores;
  const thresholdObserved = historyEntry?.aq ?? null;

  return {
    audit_event_id: buildAuditEventId("audit", seed),
    event_type: "training_history_persist",
    status,
    timestamp: new Date().toISOString(),
    patient_pseudonym_id: patient ? buildPatientPseudonymId(patient) : null,
    session_id: sessionId ?? historyEntry?.sessionId ?? null,
    operator_user_role: "patient",
    pipeline_stage: pipelineStage,
    device_info: buildAuditDeviceInfo(request),
    raw_input_metadata: {
      inputKind: historyEntry?.rehabStep === 6 ? "writing" : "multimodal",
      trainingMode,
      rehabStep: historyEntry?.rehabStep ?? null,
    },
    preprocessing_version:
      historyEntry?.rehabStep && historyEntry.stepVersionSnapshots
        ? historyEntry.stepVersionSnapshots[
            `step${historyEntry.rehabStep}` as keyof NonNullable<
              TrainingHistoryEntry["stepVersionSnapshots"]
            >
          ]?.preprocessing_version ?? null
        : null,
    feature_values: {
      aq: historyEntry?.aq ?? null,
      step1_score: stepScores?.step1 ?? null,
      step2_score: stepScores?.step2 ?? null,
      step3_score: stepScores?.step3 ?? null,
      step4_score: stepScores?.step4 ?? null,
      step5_score: stepScores?.step5 ?? null,
      step6_score: stepScores?.step6 ?? null,
      asymmetry_risk: historyEntry?.facialAnalysisSnapshot?.asymmetryRisk ?? null,
      articulation_gap: historyEntry?.facialAnalysisSnapshot?.articulationGap ?? null,
      vnv_requirement_count: historyEntry?.vnv?.summary.requirementIds.length ?? null,
      vnv_test_case_count: historyEntry?.vnv?.summary.testCaseIds.length ?? null,
    },
    final_scores: {
      aq: historyEntry?.aq ?? null,
      rehab_step: historyEntry?.rehabStep ?? null,
      step1: stepScores?.step1 ?? null,
      step2: stepScores?.step2 ?? null,
      step3: stepScores?.step3 ?? null,
      step4: stepScores?.step4 ?? null,
      step5: stepScores?.step5 ?? null,
      step6: stepScores?.step6 ?? null,
      measurement_quality: historyEntry?.measurementQuality?.overall ?? null,
    },
    threshold_decision:
      thresholdObserved === null
        ? null
        : {
            ruleName: "aq-monitoring-threshold",
            threshold: 50,
            comparator: ">=",
            observedValue: thresholdObserved,
            passed: thresholdObserved >= 50,
          },
    algorithm_versions: historyEntry?.stepVersionSnapshots ?? null,
    failure_reason: failureReason ?? null,
    storage_targets: storageTargets,
  } satisfies ClinicalAuditLogEntry;
}

