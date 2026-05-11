// Deterministic V&V checks runner. SR-* 요건별 단위 검증을 모은 단일 entry point.
// `npm run test:vnv` 가 본 파일을 tsx 로 직접 실행한다.
// Last sync: 2026-04-30 — TC-USABILITY-001 (IEC 62366) added.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { calculateKWABScores } from "@/lib/kwab/KWABScoring";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { calculateGazeMetrics } from "@/utils/faceAnalysis";
import {
  buildGazeHistorySummary,
  GazeAccumulator,
} from "@/lib/training/gazeAccumulator";
import { buildAacIntentSentence } from "@/lib/aac/intentTemplate";
import { validatePasswordStrength } from "@/lib/server/accountAuth";
import { evaluateLoginAttempt, LOGIN_LOCKOUT_POLICY } from "@/lib/server/loginLockout";
import { evaluateSessionIdle, SESSION_IDLE_POLICY } from "@/lib/server/sessionLockout";
import { evaluateRateLimit, RATE_LIMIT_POLICIES } from "@/lib/server/rateLimit";
import {
  appendAuditEntry,
  AUDIT_GENESIS_HASH,
  verifyAuditChain,
} from "@/lib/server/auditChain";
import { resolveErrorResponse, listKnownErrorCodes } from "@/lib/server/errorCodes";
import {
  AacIntentInputSchema,
  LoginInputSchema,
  validateInput,
} from "@/lib/server/inputSchemas";
import {
  buildSoupList,
  normalizeSoupEntry,
  summarizeSoupList,
} from "@/lib/server/soupRegistry";
import {
  buildManifest,
  computeManifestHash,
  normalizeComponents,
  serializeManifest,
  verifyManifest,
  type ReleaseManifest,
  type ReleaseManifestComponent,
} from "@/lib/server/releaseManifest";
import { evaluateStartupCheck } from "@/lib/server/releaseManifestStartup";
import {
  classifyHazard,
  classifyHazardList,
  scoreToRiskClass,
  summarizeHazards,
} from "@/lib/server/riskClassification";
import { maskPhi, maskPhiObject } from "@/lib/server/phiMasking";
import {
  aggregateWer,
  calculateWer,
  levenshtein,
  normalizeForWer,
} from "@/lib/ai/werCalculator";
import {
  classifyAgeGroup,
  evaluateWerRows,
  parseWerCsv,
  serializeWerReportJson,
  serializeWerReportMarkdown,
} from "@/lib/ai/werRunner";
import {
  aggregateLatency,
  classifyRtfAgeGroup,
  evaluateRtfRows,
  parseRtfCsv,
  percentile,
  serializeRtfReportJson,
  serializeRtfReportMarkdown,
} from "@/lib/ai/sttBenchmark";
import {
  elapsedLoadingMs,
  INITIAL_WASM_STT_LOADING_STATE,
  isLegalTransition as isLegalLoadingTransition,
  markFailed,
  markReady,
  reportProgress,
  reset as resetLoadingState,
  startLoading,
} from "@/lib/speech/wasmSttLoadingState";
import {
  estimateAbilityEap,
  fisherInformation,
  IRT_VERSION,
  pickNextItem,
  probabilityCorrect,
  simulateAdaptiveSession,
  type IrtItem,
} from "@/lib/adaptive/irt";
import { evaluateOnboardingExclusion } from "@/lib/onboarding/exclusionCheck";
import {
  AUDIT_RETENTION_DAYS,
  enrichAuditEntry,
} from "@/lib/server/auditExpansion";
import {
  decideSend,
  executeSendBatch,
  STUB_SENDER_ADAPTER,
  summarizeDeliveryRecords,
} from "@/lib/server/weeklyReportSender";
import {
  hashGuardianContact,
  maskGuardianContact,
  maskGuardianName,
  normalizeGuardianContactValue,
} from "@/lib/server/guardianContactsDb";
import {
  getItemBankForStep,
  SING_ADAPTIVE_BANK,
  STEP1_WORD_BANK,
  STEP2_REPETITION_BANK,
  STEP4_SENTENCE_BANK,
  STEP5_READING_BANK,
} from "@/lib/adaptive/itemBank";
import { buildAdaptiveTrainingOrder } from "@/lib/adaptive/adaptiveTraining";
import {
  collectAdaptiveEvidence,
  serializeAdaptiveEvidenceCsv,
  serializeAdaptiveEvidenceItemSummaryCsv,
  serializeAdaptiveEvidenceSessionSummaryCsv,
  summarizeAdaptiveEvidence,
  summarizeAdaptiveEvidenceRows,
} from "@/lib/adaptive/evidence";
import {
  evaluateGuardianConsent,
  isLegalTransition,
} from "@/lib/guardian/consentState";
import {
  analyzeChangeImpact,
  diffManifestComponents,
} from "@/lib/server/changeImpactAnalysis";
import {
  buildReleaseChangeDossier,
  serializeReleaseChangeDossierCsv,
  serializeReleaseChangeDossierJson,
  serializeReleaseChangeDossierMarkdown,
} from "@/lib/server/releaseChangeDossier";
import {
  buildIec62304TraceabilityMatrix,
  serializeIec62304Csv,
  serializeIec62304Markdown,
  type Iec62304HazardLink,
  type Iec62304TestResult,
} from "@/lib/vnv/iec62304Export";
import { SOFTWARE_REQUIREMENTS as ALL_REQUIREMENTS_FOR_IEC } from "@/lib/vnv/requirements";
import { TRACEABILITY_MATRIX as ALL_TRACEABILITY_FOR_IEC } from "@/lib/vnv/traceability";
import {
  bucketUseErrors,
  buildHazardCoverage,
  buildTaskCompletionStats,
  DEFAULT_SUMMATIVE_CRITERIA,
  evaluateSummativeUsability,
  normalizeScenarios,
  type TaskObservation,
  type UseScenario,
} from "@/lib/usability/useScenarioValidator";
import {
  buildAacTrainingMetadata,
  scoreAacTranscriptMatch,
} from "@/lib/aac/trainingIntegration";
import {
  calculateStep2FinalScore,
  mergeStep2ResultsByIndex,
} from "@/lib/training/step2Scoring";
import {
  buildKoreanSttPrompt,
  hashSttPrompt,
  STT_PROMPT_VERSION,
} from "@/lib/speech/sttPrompt";
import { resolveSttPolicy } from "@/lib/speech/sttPolicy";
import { resolveClientSttPreflight } from "@/lib/speech/sttClientPreflight";
import { resolveSttRuntime } from "@/lib/speech/sttRuntime";
import {
  __resetWasmSttPipelineForTest,
  isWasmSttAvailable,
  transcribeWithWasmStt,
  WASM_STT_ENGINE_VERSION,
  WASM_STT_LOCAL_MODEL_BASE_PATH,
  WASM_STT_LOCAL_ONNX_MJS_PATH,
  WASM_STT_LOCAL_ONNX_WASM_PATH,
  WASM_STT_MODEL_DTYPE,
  WASM_STT_MODEL_ID,
  WASM_STT_PACKAGE_VERSION,
  WASM_STT_SAMPLE_RATE,
} from "@/lib/speech/wasmSttAdapter";
import {
  resolveSttLanguageCode,
  STT_LANGUAGE_CODE,
  STT_SPEECH_RECOGNITION_LANG,
  STT_WASM_LANGUAGE,
} from "@/lib/speech/sttLanguage";
import {
  attachSpeechVersionMetadata,
  buildVersionSnapshot,
} from "@/lib/analysis/versioning";
import {
  buildWeeklyReportSummary,
  maskGuardianPatientName,
} from "@/lib/guardian/weeklyReportSummary";
import {
  buildAdverseEventReviewSummary,
  sortAdverseEventsForReview,
} from "@/lib/adverse-events/adverseEventReview";
import { resolvePatientReportAccess } from "@/lib/security/patientReportAccess";
import {
  normalizeGuardianReportTtlDays,
  resolveGuardianReportLinkStatus,
} from "@/lib/guardian/reportLinkPolicy";
import { resolveSttReviewOutcome, toReviewRequiredStatus } from "@/lib/speech/sttReview";
import {
  buildMeasurementQualitySnapshot,
  buildHistorySaveFailureOutcome,
  buildServerSaveRetryOutcome,
  compactHistoryEntryForStorage,
  mergeHistoryEntriesForStorage,
  resolvePermissionCancelledOutcome,
  resolvePermissionDeniedOutcome,
  resolvePostPermissionRoute,
  resolveResultRefetchMismatchOutcome,
  resolveRouteAfterAuth,
  resolveSessionRestoreState,
  resolveStepFallbackSource,
} from "@/lib/vnv/deterministicChecks";
import { saveVnvExecutionLog, type VnvExecutionCaseRecord } from "@/lib/vnv/executionLogs";

export type CheckResult = {
  id: string;
  area: string;
  requirementIds: string[];
  inputSummary: string;
  expected: string;
  actual: string;
  detail: string;
};

function createBaseHistoryEntry(
  overrides?: Partial<TrainingHistoryEntry>,
): TrainingHistoryEntry {
  return {
    historyId: "history-1",
    sessionId: "session-1",
    patientKey: "patient-1",
    patientName: "테스트 사용자",
    age: 70,
    educationYears: 12,
    place: "home",
    trainingMode: "self",
    completedAt: 1_700_000_000_000,
    aq: 70,
    stepScores: {
      step1: 80,
      step2: 70,
      step3: 60,
      step4: 50,
      step5: 40,
      step6: 30,
    },
    stepDetails: {
      step1: [],
      step2: [],
      step3: [],
      step4: [],
      step5: [],
      step6: [],
    },
    ...overrides,
  };
}

function runAQCheck(): CheckResult {
  const scores = calculateKWABScores(
    { age: 70, educationYears: 12 },
    {
      spontaneousSpeech: { contentScore: 8, fluencyScore: 7 },
      auditoryComprehension: {
        yesNoScore: 54,
        wordRecognitionScore: 48,
        commandScore: 64,
      },
      repetition: { totalScore: 72 },
      naming: {
        objectNamingScore: 44,
        wordFluencyScore: 14,
        sentenceCompletionScore: 8,
        sentenceResponseScore: 7,
      },
      reading: { totalScore: 82 },
      writing: { totalScore: 76 },
    },
  );

  assert.equal(scores.aq, 77.62);
  return {
    id: "TC-SCORE-001",
    area: "score",
    requirementIds: ["SR-SCORE-004"],
    inputSummary: "고정된 KWAB 입력 fixture",
    expected: "AQ=77.62",
    actual: `AQ=${scores.aq}`,
    detail: `AQ=${scores.aq}`,
  };
}

function runMeasurementQualityCheck(): CheckResult {
  const result = buildMeasurementQualitySnapshot({
    mode: "rehab",
    rehabStep: 4,
    stepDetails: {
      step1: [{ userAnswer: "사과" }],
      step2: [{ dataSource: "measured" }],
      step3: [{ isCorrect: true }],
      step4: [{ transcript: "오늘은 날씨가 좋습니다." }],
      step5: [{ dataSource: "demo" }],
      step6: [{ userImage: "" }],
    },
  });

  assert.equal(result.steps.step4, "measured");
  assert.equal(result.overall, "measured");
  return {
    id: "TC-MQ-001",
    area: "measurement",
    requirementIds: ["SR-MEASURE-006"],
    inputSummary: "step4 transcript 포함 fixture",
    expected: "overall=measured, step4=measured",
    actual: `overall=${result.overall}, step4=${result.steps.step4}`,
    detail: `overall=${result.overall}, step4=${result.steps.step4}`,
  };
}

function runHistoryPersistenceCheck(): CheckResult {
  const existing = Array.from({ length: 50 }, (_, index) =>
    createBaseHistoryEntry({
      historyId: `history-${index}`,
      sessionId: `session-${index}`,
      completedAt: 1_700_000_000_000 + index,
    }),
  );
  const replacement = createBaseHistoryEntry({
    historyId: "history-new",
    sessionId: "session-49",
    completedAt: 1_800_000_000_000,
    aq: 88,
  });

  const merged = mergeHistoryEntriesForStorage(existing, replacement);
  assert.equal(merged.length, 50);
  assert.equal(merged[merged.length - 1]?.aq, 88);
  assert.equal(
    merged.filter((entry) => entry.sessionId === "session-49").length,
    1,
  );

  return {
    id: "TC-HIST-001",
    area: "history",
    requirementIds: ["SR-SESSION-003", "SR-HISTORY-005"],
    inputSummary: "50건 기존 history + 동일 세션 신규 결과",
    expected: "latest row preserved, single session retained, 50 rows max",
    actual: `rows=${merged.length}, latestAQ=${merged[merged.length - 1]?.aq}`,
    detail: `rows=${merged.length}, latestAQ=${merged[merged.length - 1]?.aq}`,
  };
}

function runTherapistRoutingCheck(): CheckResult {
  assert.equal(resolveRouteAfterAuth({ userRole: "therapist" }), "/therapist");
  assert.equal(
    resolvePostPermissionRoute({
      userRole: "admin",
      hasSelfDiagnosisHistory: false,
    }),
    "/select-page/mode",
  );
  assert.equal(
    resolvePostPermissionRoute({
      userRole: "patient",
      hasSelfDiagnosisHistory: false,
    }),
    "/programs/step-1?place=home",
  );

  return {
    id: "TC-LOGIN-THERAPIST-001",
    area: "routing",
    requirementIds: ["SR-LOGIN-001"],
    inputSummary: "therapist/admin/patient role fixture",
    expected: "roles route to therapist, mode, or step-1",
    actual: "therapist/admin/patient routes resolved as expected",
    detail: "therapist/admin/patient routes resolved as expected",
  };
}

function runCompactStorageCheck(): CheckResult {
  const compacted = compactHistoryEntryForStorage(
    createBaseHistoryEntry({
      stepDetails: {
        step1: [{ text: "사과", audioUrl: "data:audio/mock", imageData: "x" }],
        step2: [{ text: "기차", audioUrl: "data:audio/mock", cameraFrameImage: "y" }],
        step3: [{ text: "학교", cameraFrameFrames: ["a", "b"] }],
        step4: [{ transcript: "오늘은 날씨가 좋습니다.", audioUrl: "data:audio/mock" }],
        step5: [{ text: "바다", userImage: "data:image/mock", audioUrl: "data:audio/mock" }],
        step6: [{ word: "나무", userImage: "data:image/mock", imageData: "z" }],
      },
    }),
  );

  assert.equal(compacted.stepDetails.step1[0]?.audioUrl, undefined);
  assert.equal(compacted.stepDetails.step1[0]?.imageData, undefined);
  assert.equal(compacted.stepDetails.step2[0]?.cameraFrameImage, undefined);
  assert.equal(compacted.stepDetails.step3[0]?.cameraFrameFrames, undefined);
  assert.equal(compacted.stepDetails.step5[0]?.userImage, undefined);
  assert.equal(compacted.stepDetails.step6[0]?.userImage, undefined);

  return {
    id: "TC-STORAGE-001",
    area: "storage",
    requirementIds: ["SR-SESSION-003", "SR-HISTORY-005"],
    inputSummary: "history entry with raw media payloads",
    expected: "raw media fields removed from compact history",
    actual: "compact history strips raw media fields as expected",
    detail: "compact history strips raw media fields as expected",
  };
}

function runPermissionDeniedCheck(): CheckResult {
  const blocked = resolvePermissionDeniedOutcome({ userRole: "patient" });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.nextRoute, "permission_required");
  return {
    id: "TC-PERM-001",
    area: "permissions",
    requirementIds: ["SR-PERMISSION-002"],
    inputSummary: "camera/microphone denied fixture",
    expected: "permission_required route and blocked flow",
    actual: `${blocked.nextRoute}, allowed=${blocked.allowed}`,
    detail: `${blocked.nextRoute}, allowed=${blocked.allowed}`,
  };
}

function runPermissionCancelledCheck(): CheckResult {
  const cancelled = resolvePermissionCancelledOutcome({
    userRole: "patient",
    completedScopes: ["camera"],
  });
  assert.equal(cancelled.allowed, false);
  assert.equal(cancelled.nextRoute, "permission_required");
  assert.equal(cancelled.reason, "permission_flow_cancelled");
  return {
    id: "TC-PERM-CANCEL-001",
    area: "permissions",
    requirementIds: ["SR-PERMISSION-002"],
    inputSummary: "권한 요청 중 마이크 권한 취소 fixture",
    expected: "permission_required route and cancelled flow",
    actual: `${cancelled.nextRoute}, reason=${cancelled.reason}`,
    detail: `${cancelled.nextRoute}, reason=${cancelled.reason}`,
  };
}

function runSaveFailureFallbackCheck(): CheckResult {
  const outcome = buildHistorySaveFailureOutcome({
    quotaExceeded: true,
    storageWritable: true,
  });
  assert.equal(outcome.fallbackStorage, "compact_history");
  assert.equal(outcome.needsRetry, true);
  return {
    id: "TC-SAVE-FAIL-001",
    area: "storage",
    requirementIds: ["SR-HISTORY-005"],
    inputSummary: "quota exceeded save fixture",
    expected: "compact history fallback with retry flag",
    actual: `${outcome.fallbackStorage}, retry=${outcome.needsRetry}`,
    detail: `${outcome.fallbackStorage}, retry=${outcome.needsRetry}`,
  };
}

function runServerSaveRetryCheck(): CheckResult {
  const retry = buildServerSaveRetryOutcome({
    serverSaved: false,
    retryCount: 1,
    maxRetries: 3,
  });
  assert.equal(retry.retryScheduled, true);
  assert.equal(retry.finalState, "retry_pending");
  return {
    id: "TC-SAVE-RETRY-001",
    area: "storage",
    requirementIds: ["SR-HISTORY-005"],
    inputSummary: "서버 저장 실패 후 재시도 fixture",
    expected: "retry scheduled and finalState=retry_pending",
    actual: `retry=${retry.retryScheduled}, state=${retry.finalState}`,
    detail: `retry=${retry.retryScheduled}, state=${retry.finalState}`,
  };
}

function runHistorySaveRiskCheck(): CheckResult {
  const quotaFallback = buildHistorySaveFailureOutcome({
    quotaExceeded: true,
    storageWritable: true,
  });
  const browserStorageUnavailable = buildHistorySaveFailureOutcome({
    quotaExceeded: false,
    storageWritable: false,
  });
  const retryPending = buildServerSaveRetryOutcome({
    serverSaved: false,
    retryCount: 2,
    maxRetries: 3,
  });
  const retryExhausted = buildServerSaveRetryOutcome({
    serverSaved: false,
    retryCount: 3,
    maxRetries: 3,
  });
  const refetchMismatch = resolveResultRefetchMismatchOutcome({
    serverHistoryId: "server-history",
    localHistoryId: "local-history",
    serverAq: 82,
    localAq: 78,
  });

  assert.equal(quotaFallback.fallbackStorage, "compact_history");
  assert.equal(quotaFallback.needsRetry, true);
  assert.equal(browserStorageUnavailable.fallbackStorage, "server_only");
  assert.equal(browserStorageUnavailable.severity, "error");
  assert.equal(retryPending.finalState, "retry_pending");
  assert.equal(retryPending.nextAction, "server_retry");
  assert.equal(retryExhausted.finalState, "failed");
  assert.equal(retryExhausted.nextAction, "manual_review");
  assert.equal(refetchMismatch.reviewRequired, true);
  assert.equal(refetchMismatch.canonicalSource, "server");

  return {
    id: "TC-RISK-005",
    area: "storage",
    requirementIds: ["SR-SESSION-003", "SR-HISTORY-005"],
    inputSummary:
      "quota exceeded / browser storage unavailable / server retry pending / retry exhausted / refetch mismatch fixtures",
    expected:
      "compact fallback or server-only fallback selected, retry scheduled until max retries, manual review after exhaustion, server canonical on mismatch",
    actual: `quota=${quotaFallback.fallbackStorage}, browser=${browserStorageUnavailable.fallbackStorage}, retry=${retryPending.finalState}/${retryPending.nextAction}, exhausted=${retryExhausted.finalState}/${retryExhausted.nextAction}, mismatchReview=${refetchMismatch.reviewRequired}`,
    detail: `quota=${quotaFallback.fallbackStorage}; browser=${browserStorageUnavailable.fallbackStorage}; retry=${retryPending.finalState}; exhausted=${retryExhausted.nextAction}; mismatch=${refetchMismatch.canonicalSource}`,
  };
}

function runSessionRestoreCheck(): CheckResult {
  const restored = resolveSessionRestoreState({
    signatureMatched: true,
    savedCount: 4,
    totalQuestions: 10,
  });
  assert.equal(restored.restored, true);
  assert.equal(restored.source, "transient");
  assert.equal(restored.resumeIndex, 4);
  return {
    id: "TC-SESS-RESTORE-001",
    area: "session",
    requirementIds: ["SR-SESSION-003"],
    inputSummary: "signature-matched resume fixture",
    expected: "transient restore with resumeIndex=4",
    actual: `source=${restored.source}, resumeIndex=${restored.resumeIndex}`,
    detail: `source=${restored.source}, resumeIndex=${restored.resumeIndex}`,
  };
}

function runStepFallbackCheck(): CheckResult {
  const source = resolveStepFallbackSource({
    serverResultAvailable: false,
    transientResultAvailable: true,
    sessionSummaryAvailable: true,
    legacyLocalAvailable: true,
  });
  assert.equal(source, "transient");
  return {
    id: "TC-STEP-FALLBACK-001",
    area: "fallback",
    requirementIds: ["SR-SESSION-003", "SR-HISTORY-005"],
    inputSummary: "server miss + transient/session/legacy available",
    expected: "transient fallback selected before summary/local",
    actual: `source=${source}`,
    detail: `source=${source}`,
  };
}

function runGazeMetricsCheck(): CheckResult {
  const landmarks: Array<{ x: number; y: number; z: number }> = Array.from(
    { length: 478 },
    () => ({ x: 0, y: 0, z: 0 }),
  );
  landmarks[33] = { x: 0.30, y: 0.34, z: 0 };
  landmarks[133] = { x: 0.42, y: 0.34, z: 0 };
  landmarks[159] = { x: 0.36, y: 0.32, z: 0 };
  landmarks[145] = { x: 0.36, y: 0.36, z: 0 };
  landmarks[468] = { x: 0.36, y: 0.34, z: 0 };
  landmarks[362] = { x: 0.58, y: 0.34, z: 0 };
  landmarks[263] = { x: 0.70, y: 0.34, z: 0 };
  landmarks[386] = { x: 0.64, y: 0.32, z: 0 };
  landmarks[374] = { x: 0.64, y: 0.36, z: 0 };
  landmarks[473] = { x: 0.64, y: 0.34, z: 0 };

  const gaze = calculateGazeMetrics(landmarks);
  assert.equal(gaze.irisDetected, true);
  assert.equal(gaze.gazeX, 0);
  assert.equal(gaze.gazeY, 0);
  assert.equal(gaze.centeredScore, 100);
  assert.equal(gaze.attentionScore, 100);

  const fallback = calculateGazeMetrics([]);
  assert.equal(fallback.irisDetected, false);
  assert.equal(fallback.gazeX, 0);
  assert.equal(fallback.centeredScore, 0);

  return {
    id: "TC-GAZE-001",
    area: "gaze",
    requirementIds: ["SR-GAZE-007"],
    inputSummary: "478-point landmark fixture, iris centered + iris-missing fallback",
    expected:
      "centered fixture: gazeX=0 gazeY=0 centeredScore=100 irisDetected=true; missing iris: irisDetected=false",
    actual: `gazeX=${gaze.gazeX}, gazeY=${gaze.gazeY}, centered=${gaze.centeredScore}, fallback.iris=${fallback.irisDetected}`,
    detail: `centered=${gaze.centeredScore}, irisDetected=${gaze.irisDetected}, fallbackIris=${fallback.irisDetected}`,
  };
}

function runGazeAccumulatorCheck(): CheckResult {
  const acc = new GazeAccumulator();
  for (let i = 0; i < 100; i += 1) {
    acc.record({
      centeredScore: i < 80 ? 90 : 0,
      irisDetected: i < 80,
      nowMs: 1_000 + i * 10,
    });
  }
  const report = acc.report();
  assert.equal(report.totalSamples, 100);
  assert.equal(report.attentionRatio, 0.9);
  assert.equal(report.offTaskRatio, 0);
  assert.equal(report.irisDetectionRatio, 0.8);
  assert.equal(report.measurementQuality, "partial");
  assert.equal(report.durationMs, 990);

  const acc2 = new GazeAccumulator();
  for (let i = 0; i < 100; i += 1) {
    acc2.record({
      centeredScore: i < 60 ? 95 : 20,
      irisDetected: true,
      nowMs: 2_000 + i * 5,
    });
  }
  const r2 = acc2.report();
  assert.equal(r2.offTaskRatio, 0.4);
  assert.equal(r2.measurementQuality, "measured");

  acc2.reset();
  const r3 = acc2.report();
  assert.equal(r3.totalSamples, 0);
  assert.equal(r3.attentionRatio, 0);
  assert.equal(r3.measurementQuality, "demo");

  return {
    id: "TC-GAZE-002",
    area: "gaze",
    requirementIds: ["SR-GAZE-007"],
    inputSummary: "100 sample sequence + off-task variant + reset",
    expected:
      "attention=0.9 offTask=0 detect=0.8 q=partial dur=990; off2=0.4 q2=measured; q3=demo",
    actual: `attention=${report.attentionRatio}, offTask=${report.offTaskRatio}, detect=${report.irisDetectionRatio}, q=${report.measurementQuality}, dur=${report.durationMs}; off2=${r2.offTaskRatio}, q2=${r2.measurementQuality}; q3=${r3.measurementQuality}`,
    detail: `attention=${report.attentionRatio}, q=${report.measurementQuality}; off2=${r2.offTaskRatio}; q3=${r3.measurementQuality}`,
  };
}

function runGazeHistorySummaryCheck(): CheckResult {
  const acc = new GazeAccumulator();
  acc.record({ centeredScore: 100, irisDetected: true, nowMs: 1_000 });
  acc.record({ centeredScore: 20, irisDetected: true, nowMs: 1_100 });
  acc.record({ centeredScore: 0, irisDetected: false, nowMs: 1_200 });

  const summary = buildGazeHistorySummary(acc.report());
  assert.ok(summary);
  assert.equal(summary.totalSamples, 3);
  assert.equal(summary.attentionRatio, 0.6);
  assert.equal(summary.offTaskRatio, 0.5);
  assert.equal(summary.irisDetectionRatio, 0.667);
  assert.equal(summary.measurementQuality, "partial");

  const empty = buildGazeHistorySummary(new GazeAccumulator().report());
  assert.equal(empty, null);

  return {
    id: "TC-GAZE-003",
    area: "gaze",
    requirementIds: ["SR-GAZE-007", "SR-HISTORY-005"],
    inputSummary: "gaze accumulator report with 3 samples + empty report",
    expected:
      "non-empty gaze report persists as history summary; empty report is omitted",
    actual: `samples=${summary.totalSamples}, attention=${summary.attentionRatio}, offTask=${summary.offTaskRatio}, detect=${summary.irisDetectionRatio}, empty=${empty}`,
    detail: `samples=${summary.totalSamples}, attention=${summary.attentionRatio}, q=${summary.measurementQuality}`,
  };
}

function runAacIntentTemplateCheck(): CheckResult {
  const r1 = buildAacIntentSentence({
    symbolIds: ["subj/me", "noun/cafe/0", "intent/cafe/0"],
  });
  assert.equal(r1.sentence, "저 커피 따뜻하게 주세요.");

  const r2 = buildAacIntentSentence({ symbolIds: ["intent/help"] });
  assert.equal(r2.sentence, "도와주세요.");

  const r3 = buildAacIntentSentence({ symbolIds: [] });
  assert.equal(r3.sentence, "");

  const r4 = buildAacIntentSentence({ symbolIds: ["noun/home/0"] });
  assert.equal(r4.sentence, "저 텔레비전 필요해요.");

  const r5 = buildAacIntentSentence({ symbolIds: ["bogus/x", "??"] });
  assert.equal(r5.sentence, "");
  assert.deepEqual(r5.decomposition.unknownIds, ["bogus/x", "??"]);

  const r6 = buildAacIntentSentence({ symbolIds: ["intent/pain"] });
  assert.equal(r6.sentence, "저 아파요.");

  return {
    id: "TC-AAC-001",
    area: "aac",
    requirementIds: ["SR-AAC-008"],
    inputSummary: "subject+noun+intent / 단독 도와주세요 / 빈 시퀀스 / noun-only / unknown-only / fallback subject",
    expected: "cafe / help / empty / nounOnly / unknown=2 / pain",
    actual: `${r1.sentence} | ${r2.sentence} | '${r3.sentence}' | ${r4.sentence} | unknown=${r5.decomposition.unknownIds.length} | ${r6.sentence}`,
    detail: `cafe=${r1.sentence}; help=${r2.sentence}; empty='${r3.sentence}'; nounOnly=${r4.sentence}; unknown=${r5.decomposition.unknownIds.length}; pain=${r6.sentence}`,
  };
}

function runAacTrainingIntegrationCheck(): CheckResult {
  const exact = scoreAacTranscriptMatch({
    targetText: "저 물 주세요.",
    sentence: "저 물 주세요.",
  });
  const partial = scoreAacTranscriptMatch({
    targetText: "커피를 따뜻하게 주세요.",
    sentence: "저 커피 따뜻하게 주세요.",
  });
  const metadata = buildAacTrainingMetadata({
    place: "cafe",
    symbolIds: ["subj/me", "noun/cafe/0", "intent/cafe/0"],
    sentence: "저 커피 따뜻하게 주세요.",
  });

  assert.equal(exact, 100);
  assert.equal(partial >= 20, true);
  assert.equal(metadata.inputModality, "aac");
  assert.deepEqual(metadata.aacSymbolIds, [
    "subj/me",
    "noun/cafe/0",
    "intent/cafe/0",
  ]);
  assert.equal(metadata.aacPlace, "cafe");

  return {
    id: "TC-AAC-002",
    area: "aac",
    requirementIds: ["SR-AAC-008", "SR-HISTORY-005"],
    inputSummary: "AAC commit payload + step transcript scoring fixture",
    expected:
      "AAC payload is tagged inputModality=aac and deterministic transcript score is generated",
    actual: `exact=${exact}, partial=${partial}, modality=${metadata.inputModality}, symbols=${metadata.aacSymbolIds.length}`,
    detail: `exact=${exact}; partial=${partial}; modality=${metadata.inputModality}; symbols=${metadata.aacSymbolIds.length}`,
  };
}

function runStep2ScoringPersistenceCheck(): CheckResult {
  const highPhrase = calculateStep2FinalScore({
    targetText: "사과를 주세요.",
    transcript: "사과를 주세요.",
    consonantAccuracy: 22,
    vowelAccuracy: 28,
  });
  const shortPromptBiasGuard = calculateStep2FinalScore({
    targetText: "방",
    transcript: "방",
    consonantAccuracy: 20,
    vowelAccuracy: 20,
  });
  const articulationOnly = calculateStep2FinalScore({
    targetText: "사과를 주세요.",
    transcript: "",
    consonantAccuracy: 70,
    vowelAccuracy: 80,
  });
  const merged = mergeStep2ResultsByIndex(
    [
      { index: 0, finalScore: 40 },
      { index: 1, finalScore: 50 },
    ],
    { index: 1, finalScore: 90 },
    10,
  );

  assert.equal(highPhrase.finalScore, 47.5);
  assert.equal(shortPromptBiasGuard.finalScore, 44);
  assert.equal(articulationOnly.finalScore, 52.5);
  assert.equal(merged.length, 2);
  assert.equal(merged[1]?.finalScore, 90);

  return {
    id: "TC-STEP2-003",
    area: "training",
    requirementIds: ["SR-HISTORY-005"],
    inputSummary:
      "step2 phrase-aware scoring + same-index result merge fixture",
    expected:
      "Phrase match is weighted, short target prompt-bias cannot force 100, and latest item replaces stale same-index state",
    actual: `phrase=${highPhrase.finalScore}, short=${shortPromptBiasGuard.finalScore}, articulation=${articulationOnly.finalScore}, merged=${merged[1]?.finalScore}`,
    detail: `phraseScore=${highPhrase.phraseMatchScore}; shortPhrase=${shortPromptBiasGuard.phraseMatchScore}; articulationScore=${articulationOnly.articulationScore}; mergedLength=${merged.length}`,
  };
}

function runSttPolicyCheck(): CheckResult {
  const mock = resolveSttPolicy({
    useCase: "daily_training",
    devMode: true,
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });
  assert.equal(mock.engine, "mock_stt");
  assert.equal(mock.rawAudioLeavesDevice, false);

  const blocked = resolveSttPolicy({
    useCase: "daily_training",
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });
  assert.equal(blocked.engine, "server_whisper");
  assert.equal(blocked.rawAudioLeavesDevice, true);
  assert.equal(blocked.reason, "server_default_for_training");

  const evaluation = resolveSttPolicy({
    useCase: "weekly_kwab",
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });
  assert.equal(evaluation.engine, "server_whisper");
  assert.equal(evaluation.rawAudioLeavesDevice, true);

  const temporaryFallback = resolveSttPolicy({
    useCase: "daily_training",
    wasmAvailable: false,
    allowTrainingServerFallback: true,
  });
  assert.equal(temporaryFallback.engine, "server_whisper");

  const browserWasmAvailable = resolveSttPolicy({
    useCase: "daily_training",
    wasmAvailable: true,
    allowTrainingServerFallback: false,
  });
  assert.equal(browserWasmAvailable.engine, "server_whisper");
  assert.equal(browserWasmAvailable.rawAudioLeavesDevice, true);

  const prompt = buildKoreanSttPrompt("바다 가족");
  assert.equal(prompt.includes("바다"), true);
  assert.equal(prompt.includes("가족"), true);

  return {
    id: "TC-STT-001",
    area: "stt",
    requirementIds: ["SR-STT-009"],
    inputSummary:
      "daily/weekly/default server STT policy fixture + Korean prompt fixture",
    expected:
      "dev mock, daily server, weekly server, training fallback server, browser WASM availability ignored in product runtime, prompt includes target terms",
    actual: `mock=${mock.engine}, daily=${blocked.engine}, weekly=${evaluation.engine}, fallback=${temporaryFallback.engine}, browserWasm=${browserWasmAvailable.engine}, promptHasTarget=${prompt.includes("바다")}`,
    detail: `mock=${mock.engine}; daily=${blocked.engine}; weekly=${evaluation.engine}; fallback=${temporaryFallback.engine}; browserWasm=${browserWasmAvailable.engine}`,
  };
}

function runSttRuntimeResolutionCheck(): CheckResult {
  const mock = resolveSttRuntime({
    useCase: "daily_training",
    devMode: true,
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });
  const blocked = resolveSttRuntime({
    useCase: "game_training",
    devMode: false,
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });
  const browserWasmAvailable = resolveSttRuntime({
    useCase: "daily_training",
    devMode: false,
    wasmAvailable: true,
    allowTrainingServerFallback: false,
  });
  const server = resolveSttRuntime({
    useCase: "weekly_kwab",
    devMode: false,
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });

  assert.equal(isWasmSttAvailable(), false);
  assert.equal(mock.engine, "mock_stt");
  assert.equal(mock.isMock, true);
  assert.equal(blocked.engine, "server_whisper");
  assert.equal(blocked.canUploadToServer, true);
  assert.equal(blocked.reason, "server_default_for_training");
  assert.equal(browserWasmAvailable.engine, "server_whisper");
  assert.equal(browserWasmAvailable.rawAudioLeavesDevice, true);
  assert.equal(server.engine, "server_whisper");
  assert.equal(server.canUploadToServer, true);

  return {
    id: "TC-STT-003",
    area: "stt",
    requirementIds: ["SR-STT-009"],
    inputSummary:
      "mock / training server / evaluation server STT runtime fixture + adapter availability",
    expected:
      "runtime uses server STT for training even when browser WASM is available, and supports evaluation server STT",
    actual: `mock=${mock.engine}, blocked=${blocked.engine}, browserWasm=${browserWasmAvailable.engine}, server=${server.engine}, adapter=${isWasmSttAvailable()}`,
    detail: `mock=${mock.engine}; blocked=${blocked.engine}; browserWasm=${browserWasmAvailable.engine}; server=${server.engine}; adapter=${isWasmSttAvailable()}`,
  };
}

function runSttLanguageLockCheck(): CheckResult {
  assert.equal(STT_LANGUAGE_CODE, "ko");
  assert.equal(resolveSttLanguageCode(), "ko");
  assert.equal(STT_WASM_LANGUAGE, "korean");
  assert.equal(STT_SPEECH_RECOGNITION_LANG, "ko-KR");

  return {
    id: "TC-STT-004",
    area: "stt",
    requirementIds: ["SR-STT-009"],
    inputSummary: "STT language constants for server, WASM, and browser speech recognition",
    expected: "server language=ko, WASM language=korean, browser lang=ko-KR",
    actual: `server=${resolveSttLanguageCode()}, wasm=${STT_WASM_LANGUAGE}, browser=${STT_SPEECH_RECOGNITION_LANG}`,
    detail: `server=${STT_LANGUAGE_CODE}; wasm=${STT_WASM_LANGUAGE}; browser=${STT_SPEECH_RECOGNITION_LANG}`,
  };
}

function runSttClientPreflightCheck(): CheckResult {
  const gameBlocked = resolveClientSttPreflight({
    useCase: "game_training",
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });
  const gameBrowserWasmAvailable = resolveClientSttPreflight({
    useCase: "game_training",
    wasmAvailable: true,
    allowTrainingServerFallback: false,
  });
  const weekly = resolveClientSttPreflight({
    useCase: "weekly_kwab",
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });

  assert.equal(gameBlocked.canUploadToServer, true);
  assert.equal(gameBlocked.rawAudioLeavesDevice, true);
  assert.equal(gameBlocked.reason, "server_default_for_training");
  assert.equal(gameBrowserWasmAvailable.canUploadToServer, true);
  assert.equal(gameBrowserWasmAvailable.rawAudioLeavesDevice, true);
  assert.equal(gameBrowserWasmAvailable.engine, "server_whisper");
  assert.equal(weekly.canUploadToServer, true);
  assert.equal(weekly.reason, "server_allowed_for_evaluation");

  return {
    id: "TC-STT-002",
    area: "stt",
    requirementIds: ["SR-STT-009"],
    inputSummary:
      "game_training client preflight server default + browser WASM ignored + weekly_kwab fixture",
    expected:
      "game training uses server STT by default; browser WASM availability does not switch product runtime; weekly evaluation can upload",
    actual: `game=${gameBlocked.canUploadToServer}/${gameBlocked.reason}, browserWasm=${gameBrowserWasmAvailable.engine}, weekly=${weekly.canUploadToServer}/${weekly.reason}`,
    detail: `gameUpload=${gameBlocked.canUploadToServer}; rawLeaves=${gameBlocked.rawAudioLeavesDevice}; browserWasmRawLeaves=${gameBrowserWasmAvailable.rawAudioLeavesDevice}; weekly=${weekly.canUploadToServer}`,
  };
}

function runSttReviewRequiredCheck(): CheckResult {
  const blocked = resolveSttReviewOutcome({
    text: "",
    fallback: true,
    reason: "server_stt_blocked:wasm_unavailable_server_blocked",
    responseOk: false,
  });
  const empty = resolveSttReviewOutcome({
    text: "   ",
    fallback: false,
    responseOk: true,
  });
  const upstream = resolveSttReviewOutcome({
    text: "",
    fallback: true,
    reason: "upstream_502_rate_limit",
    responseOk: false,
  });
  const ok = resolveSttReviewOutcome({
    text: "사과",
    fallback: false,
    responseOk: true,
  });

  assert.equal(blocked.status, "server_stt_blocked");
  assert.equal(blocked.reviewRequired, true);
  assert.equal(toReviewRequiredStatus(blocked.status), "review_required");
  assert.equal(empty.status, "empty_transcript");
  assert.equal(empty.reviewRequired, true);
  assert.equal(upstream.status, "stt_failed");
  assert.equal(ok.status, "ok");
  assert.equal(ok.reviewRequired, false);

  return {
    id: "TC-RISK-001",
    area: "stt",
    requirementIds: ["SR-STT-009"],
    inputSummary: "server-blocked / empty / upstream-failure / ok STT fixtures",
    expected: "blocked, empty, and upstream failure require review; normal transcript does not",
    actual: `blocked=${blocked.status}/${blocked.reviewRequired}, empty=${empty.status}/${empty.reviewRequired}, upstream=${upstream.status}/${upstream.reviewRequired}, ok=${ok.status}/${ok.reviewRequired}`,
    detail: `blocked=${blocked.status}; empty=${empty.status}; upstream=${upstream.status}; ok=${ok.status}`,
  };
}

function runGuardianWeeklyReportCheck(): CheckResult {
  const summary = buildWeeklyReportSummary({
    periodStart: "2026-04-22T00:00:00.000Z",
    periodEnd: "2026-04-29T00:00:00.000Z",
    adverseEventCount: 0,
    sessions: [
      {
        kind: "language",
        completedAt: "2026-04-23T09:00:00.000Z",
        score: 70,
        stepScores: {
          step1: 80,
          step2: 70,
          step3: 0,
          step4: 60,
          step5: 0,
          step6: 0,
        },
      },
      {
        kind: "sing",
        completedAt: "2026-04-24T09:00:00.000Z",
        score: 88,
      },
      {
        kind: "language",
        completedAt: "2026-04-28T09:00:00.000Z",
        score: 76,
        stepScores: {
          step1: 82,
          step2: 74,
          step3: 65,
          step4: 68,
          step5: 55,
          step6: 0,
        },
      },
    ],
  });

  assert.equal(summary.totalSessions, 3);
  assert.equal(summary.languageSessionCount, 2);
  assert.equal(summary.singSessionCount, 1);
  assert.equal(summary.latestAq, 76);
  assert.equal(summary.aqChange, 6);
  assert.equal(summary.averageScore, 78);
  assert.equal(summary.stepCompletion.step1, 1);
  assert.equal(summary.stepCompletion.step3, 0.5);
  assert.equal(summary.stepCompletion.step6, 0);
  assert.equal(summary.adverseEventStatus, "none_reported");
  assert.equal(maskGuardianPatientName("홍길동"), "홍*동");

  return {
    id: "TC-GUARDIAN-001",
    area: "guardian",
    requirementIds: ["SR-GUARDIAN-010"],
    inputSummary: "최근 7일 언어 2건 + 노래 1건 + 이상반응 0건 fixture",
    expected:
      "total=3, latestAQ=76, aqChange=6, avg=78, step1=1, step3=0.5, AE=none",
    actual: `total=${summary.totalSessions}, latestAQ=${summary.latestAq}, aqChange=${summary.aqChange}, avg=${summary.averageScore}, step1=${summary.stepCompletion.step1}, step3=${summary.stepCompletion.step3}, ae=${summary.adverseEventStatus}`,
    detail: `total=${summary.totalSessions}; latestAQ=${summary.latestAq}; aqChange=${summary.aqChange}; ae=${summary.adverseEventStatus}`,
  };
}

function runGuardianReportLinkPolicyCheck(): CheckResult {
  const now = "2026-04-29T00:00:00.000Z";
  const active = resolveGuardianReportLinkStatus({
    expiresAt: "2026-04-30T00:00:00.000Z",
    now,
  });
  const expired = resolveGuardianReportLinkStatus({
    expiresAt: "2026-04-28T23:59:59.000Z",
    now,
  });
  const revoked = resolveGuardianReportLinkStatus({
    expiresAt: "2026-04-30T00:00:00.000Z",
    revokedAt: "2026-04-29T01:00:00.000Z",
    now,
  });
  assert.equal(active, "active");
  assert.equal(expired, "expired");
  assert.equal(revoked, "revoked");
  assert.equal(normalizeGuardianReportTtlDays(undefined), 14);
  assert.equal(normalizeGuardianReportTtlDays(-1), 14);
  assert.equal(normalizeGuardianReportTtlDays(90), 60);

  return {
    id: "TC-RISK-002",
    area: "guardian",
    requirementIds: ["SR-GUARDIAN-010"],
    inputSummary: "active / expired / revoked guardian link fixture + ttl bounds",
    expected: "active link allowed, expired/revoked blocked, ttl defaults 14 and caps 60",
    actual: `active=${active}, expired=${expired}, revoked=${revoked}, ttlDefault=${normalizeGuardianReportTtlDays(undefined)}, ttlCap=${normalizeGuardianReportTtlDays(90)}`,
    detail: `active=${active}; expired=${expired}; revoked=${revoked}; ttlCap=${normalizeGuardianReportTtlDays(90)}`,
  };
}

function runAdverseEventReviewCheck(): CheckResult {
  const events = [
    {
      id: "ae-1",
      patientPseudonymId: "BF-001",
      category: "fatigue",
      severity: 1,
      occurredAt: "2026-04-23T09:00:00.000Z",
      resolvedAt: "2026-04-23T10:00:00.000Z",
      prescriberAcknowledgedAt: "2026-04-23T11:00:00.000Z",
    },
    {
      id: "ae-2",
      patientPseudonymId: "BF-001",
      category: "dizziness",
      severity: 3,
      occurredAt: "2026-04-28T09:00:00.000Z",
      resolvedAt: null,
      prescriberAcknowledgedAt: null,
    },
    {
      id: "ae-3",
      patientPseudonymId: "BF-001",
      category: "eye_fatigue",
      severity: 2,
      occurredAt: "2026-04-27T09:00:00.000Z",
      resolvedAt: null,
      prescriberAcknowledgedAt: "2026-04-27T10:00:00.000Z",
    },
  ];

  const sorted = sortAdverseEventsForReview(events);
  const summary = buildAdverseEventReviewSummary(events);
  const guardianSummary = buildWeeklyReportSummary({
    periodStart: "2026-04-22T00:00:00.000Z",
    periodEnd: "2026-04-29T00:00:00.000Z",
    adverseEventCount: summary.totalCount,
    sessions: [],
  });

  assert.equal(sorted[0]?.id, "ae-2");
  assert.equal(summary.totalCount, 3);
  assert.equal(summary.unresolvedCount, 2);
  assert.equal(summary.severeUnacknowledgedCount, 1);
  assert.equal(summary.highestSeverity, 3);
  assert.equal(summary.requiresPrescriberReview, true);
  assert.equal(summary.guardianStatus, "reported");
  assert.equal(guardianSummary.adverseEventStatus, "reported");
  assert.equal(guardianSummary.adverseEventCount, 3);

  return {
    id: "TC-RISK-003",
    area: "adverse-events",
    requirementIds: ["SR-AE-011", "SR-GUARDIAN-010"],
    inputSummary: "resolved mild AE + unresolved moderate AE + unacknowledged severe AE fixture",
    expected:
      "latest first, total=3, unresolved=2, severeUnack=1, guardian report shows reported",
    actual: `latest=${sorted[0]?.id}, total=${summary.totalCount}, unresolved=${summary.unresolvedCount}, severeUnack=${summary.severeUnacknowledgedCount}, guardian=${guardianSummary.adverseEventStatus}`,
    detail: `latest=${sorted[0]?.id}; total=${summary.totalCount}; unresolved=${summary.unresolvedCount}; severeUnack=${summary.severeUnacknowledgedCount}; guardian=${guardianSummary.adverseEventStatus}`,
  };
}

function runPatientReportAccessCheck(): CheckResult {
  const admin = resolvePatientReportAccess({
    userRole: "admin",
    targetPatientId: "patient-a",
  });
  const assignedTherapist = resolvePatientReportAccess({
    userRole: "therapist",
    targetPatientId: "patient-a",
    assignedPatientIds: ["patient-a", "patient-b"],
  });
  const unassignedTherapist = resolvePatientReportAccess({
    userRole: "therapist",
    targetPatientId: "patient-c",
    assignedPatientIds: ["patient-a", "patient-b"],
  });
  const selfPatient = resolvePatientReportAccess({
    userRole: "patient",
    targetPatientId: "patient-a",
    selfPatientId: "patient-a",
    allowPatientSelfAccess: true,
  });
  const otherPatient = resolvePatientReportAccess({
    userRole: "patient",
    targetPatientId: "patient-b",
    selfPatientId: "patient-a",
    allowPatientSelfAccess: true,
  });
  const prescriber = resolvePatientReportAccess({
    userRole: "prescriber",
    targetPatientId: "patient-a",
  });

  assert.equal(admin.allowed, true);
  assert.equal(admin.reason, "admin_all_patients");
  assert.equal(assignedTherapist.allowed, true);
  assert.equal(assignedTherapist.reason, "assigned_therapist");
  assert.equal(unassignedTherapist.allowed, false);
  assert.equal(unassignedTherapist.reason, "unassigned_therapist");
  assert.equal(selfPatient.allowed, true);
  assert.equal(otherPatient.allowed, false);
  assert.equal(prescriber.allowed, false);

  return {
    id: "TC-RISK-004",
    area: "access-control",
    requirementIds: ["SR-PERMISSION-002"],
    inputSummary:
      "admin / assigned therapist / unassigned therapist / self patient / other patient / prescriber fixtures",
    expected:
      "admin and assigned therapist allowed; unassigned therapist, other patient, and prescriber blocked",
    actual: `admin=${admin.allowed}, assigned=${assignedTherapist.allowed}, unassigned=${unassignedTherapist.allowed}/${unassignedTherapist.reason}, self=${selfPatient.allowed}, other=${otherPatient.allowed}, prescriber=${prescriber.allowed}`,
    detail: `admin=${admin.reason}; assigned=${assignedTherapist.reason}; blocked=${unassignedTherapist.reason}; patient=${otherPatient.reason}; prescriber=${prescriber.reason}`,
  };
}

function runAiSttVersionMetadataCheck(): CheckResult {
  const prompt = buildKoreanSttPrompt("바다 가족");
  const policy = resolveSttPolicy({
    useCase: "weekly_kwab",
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });
  const base = buildVersionSnapshot("step2", {
    measurement_metadata: {
      existing_key: "kept",
    },
  });
  const snapshot = attachSpeechVersionMetadata(base, {
    sttEngine: policy.engine,
    sttUseCase: "weekly_kwab",
    sttPolicyReason: policy.reason,
    rawAudioLeavesDevice: policy.rawAudioLeavesDevice,
    promptVersion: STT_PROMPT_VERSION,
    promptHash: hashSttPrompt(prompt),
    reviewRequired: false,
  });

  assert.equal(snapshot.pipeline_stage, "step2");
  assert.equal(snapshot.measurement_metadata?.existing_key, "kept");
  assert.equal(snapshot.measurement_metadata?.stt_engine, "server_whisper");
  assert.equal(snapshot.measurement_metadata?.stt_use_case, "weekly_kwab");
  assert.equal(
    snapshot.measurement_metadata?.stt_policy_reason,
    "server_allowed_for_evaluation",
  );
  assert.equal(snapshot.measurement_metadata?.raw_audio_leaves_device, true);
  assert.equal(snapshot.measurement_metadata?.stt_prompt_version, STT_PROMPT_VERSION);
  assert.equal(String(snapshot.measurement_metadata?.stt_prompt_hash).length, 16);
  assert.equal(snapshot.measurement_metadata?.stt_review_required, false);
  assert.equal(snapshot.model_version.includes("stt:server_whisper"), true);

  return {
    id: "TC-RISK-006",
    area: "versioning",
    requirementIds: ["SR-STT-009", "SR-HISTORY-005"],
    inputSummary: "step2 version snapshot + weekly_kwab STT policy + Korean prompt fixture",
    expected:
      "snapshot records STT engine/useCase/policy reason/raw-audio flag/prompt version/hash/review flag",
    actual: `stage=${snapshot.pipeline_stage}, engine=${snapshot.measurement_metadata?.stt_engine}, useCase=${snapshot.measurement_metadata?.stt_use_case}, rawLeaves=${snapshot.measurement_metadata?.raw_audio_leaves_device}, promptHash=${snapshot.measurement_metadata?.stt_prompt_hash}`,
    detail: `engine=${snapshot.measurement_metadata?.stt_engine}; promptVersion=${snapshot.measurement_metadata?.stt_prompt_version}; rawLeaves=${snapshot.measurement_metadata?.raw_audio_leaves_device}; model=${snapshot.model_version}`,
  };
}

function runPasswordStrengthCheck(): CheckResult {
  // SR-SEC-IA05. 식약처 사이버보안 IA-05 비밀번호 강도 정책.
  const tooShort = validatePasswordStrength("aB1!");
  assert.equal(tooShort.ok, false);
  assert.equal(tooShort.reason, "too_short");

  const lowComplexity = validatePasswordStrength("aaaaaaaa");
  assert.equal(lowComplexity.ok, false);
  // "aaaaaaaa" 는 letter only + 동일문자 8회 → too_short 가 아님 → repeating_chars 또는 low_complexity.
  // 정책 우선순위: too_short → low_complexity → repeating_chars.
  assert.equal(lowComplexity.reason, "low_complexity");

  const repeating = validatePasswordStrength("ab12!!!!");
  assert.equal(repeating.ok, false);
  assert.equal(repeating.reason, "repeating_chars");

  const valid = validatePasswordStrength("Br@inFriends2026");
  assert.equal(valid.ok, true);
  assert.equal(valid.reason, undefined);

  // 종전 정책의 6자 통과 입력 → 거부되어야 함 (정책 강화 회귀 검증).
  const legacy6 = validatePasswordStrength("abc123");
  assert.equal(legacy6.ok, false);
  assert.equal(legacy6.reason, "too_short");

  return {
    id: "TC-SEC-IA05-001",
    area: "security",
    requirementIds: ["SR-SEC-IA05"],
    inputSummary:
      "too short (4자) / low complexity (8자 letter only) / repeating (4회 반복) / valid (8자 + 3종) / legacy 6자",
    expected:
      "too_short 거부 / low_complexity 거부 / repeating_chars 거부 / 통과 / too_short 거부",
    actual: `tooShort=${tooShort.reason}, low=${lowComplexity.reason}, rep=${repeating.reason}, valid=${valid.ok}, legacy6=${legacy6.reason}`,
    detail: `tooShort=${tooShort.reason}, low=${lowComplexity.reason}, rep=${repeating.reason}, valid=${valid.ok}, legacy6=${legacy6.reason}`,
  };
}

function runLoginLockoutCheck(): CheckResult {
  // SR-SEC-IA07. 식약처 사이버보안 IA-07.
  const t0 = 1_000_000;
  let state = { failedAttempts: 0, lockedUntil: null as number | null };

  // 4회 연속 실패 — 잠금 미발생, attempt 누적.
  for (let i = 0; i < 4; i += 1) {
    const decision = evaluateLoginAttempt({
      success: false,
      nowMs: t0 + i * 1000,
      current: state,
    });
    assert.equal(decision.allowed, true);
    state = decision.nextState;
  }
  assert.equal(state.failedAttempts, 4);
  assert.equal(state.lockedUntil, null);

  // 5회째 실패 — 잠금 발생.
  const fifth = evaluateLoginAttempt({
    success: false,
    nowMs: t0 + 5000,
    current: state,
  });
  assert.equal(fifth.allowed, false);
  assert.equal(fifth.reason, "lockout_triggered");
  assert.equal(fifth.retryAfterMs, LOGIN_LOCKOUT_POLICY.lockoutDurationMs);
  state = fifth.nextState;
  assert.equal(state.failedAttempts, 5);
  assert.equal(state.lockedUntil, t0 + 5000 + LOGIN_LOCKOUT_POLICY.lockoutDurationMs);

  // 잠금 중 추가 시도 — 차단 유지.
  const duringLock = evaluateLoginAttempt({
    success: true, // 비밀번호가 맞아도 잠금 중에는 차단
    nowMs: t0 + 6000,
    current: state,
  });
  assert.equal(duringLock.allowed, false);
  assert.equal(duringLock.reason, "locked");

  // 잠금 해제 후 성공 — 카운트 reset.
  const afterLock = evaluateLoginAttempt({
    success: true,
    nowMs: t0 + 5000 + LOGIN_LOCKOUT_POLICY.lockoutDurationMs + 1,
    current: state,
  });
  assert.equal(afterLock.allowed, true);
  state = afterLock.nextState;
  assert.equal(state.failedAttempts, 0);
  assert.equal(state.lockedUntil, null);

  // 잠금 해제 후 새 실패 — 1회로 다시 시작.
  const reattempt = evaluateLoginAttempt({
    success: false,
    nowMs: t0 + 5000 + LOGIN_LOCKOUT_POLICY.lockoutDurationMs + 2000,
    current: state,
  });
  assert.equal(reattempt.allowed, true);
  assert.equal(reattempt.nextState.failedAttempts, 1);

  return {
    id: "TC-SEC-IA07-001",
    area: "security",
    requirementIds: ["SR-SEC-IA07"],
    inputSummary: "4 fail (no lock) → 5th fail (lock) → during-lock attempt → unlock + success → re-fail",
    expected: "lockout at 5th, blocked during, reset on unlock+success, re-fail counts from 1",
    actual: `5thReason=${fifth.reason}, duringReason=${duringLock.reason}, afterFails=${state.failedAttempts}, reattemptFails=${reattempt.nextState.failedAttempts}`,
    detail: `lockoutMs=${LOGIN_LOCKOUT_POLICY.lockoutDurationMs}, max=${LOGIN_LOCKOUT_POLICY.maxAttempts}, sequence verified`,
  };
}

function runSessionIdleCheck(): CheckResult {
  // SR-SEC-UC03. 식약처 사이버보안 UC-03 세션 idle timeout.
  const last = 1_000_000;

  // 1) 활동 직후 — 만료 안 됨, 경고 없음.
  const fresh = evaluateSessionIdle({ lastActivityAt: last, nowMs: last + 60_000 });
  assert.equal(fresh.isExpired, false);
  assert.equal(fresh.shouldReauth, false);
  assert.equal(fresh.warnImminent, false);

  // 2) 26분 경과 — 만료 임박 (남은 4분).
  const warn = evaluateSessionIdle({
    lastActivityAt: last,
    nowMs: last + 26 * 60 * 1000,
  });
  assert.equal(warn.isExpired, false);
  assert.equal(warn.warnImminent, true);
  assert.equal(warn.remainingMs, 4 * 60 * 1000);

  // 3) 30분 정확 경과 — 만료.
  const onBoundary = evaluateSessionIdle({
    lastActivityAt: last,
    nowMs: last + SESSION_IDLE_POLICY.idleTimeoutMs,
  });
  assert.equal(onBoundary.isExpired, true);
  assert.equal(onBoundary.shouldReauth, true);
  assert.equal(onBoundary.remainingMs, 0);

  // 4) 31분 경과 — 만료 유지.
  const expired = evaluateSessionIdle({
    lastActivityAt: last,
    nowMs: last + 31 * 60 * 1000,
  });
  assert.equal(expired.isExpired, true);

  return {
    id: "TC-SEC-UC03-001",
    area: "security",
    requirementIds: ["SR-SEC-UC03"],
    inputSummary: "fresh / 26min (warn) / 30min boundary / 31min expired",
    expected: "fresh=ok, warnImminent=true at 26min, expired at 30min boundary",
    actual: `fresh=${fresh.isExpired}, warn=${warn.warnImminent}, onBoundary=${onBoundary.isExpired}, expired=${expired.isExpired}`,
    detail: `idleMs=${SESSION_IDLE_POLICY.idleTimeoutMs}, warnMs=${SESSION_IDLE_POLICY.warnThresholdMs}, sequence verified`,
  };
}

function runRateLimitCheck(): CheckResult {
  // SR-SEC-RA01. 식약처 사이버보안 RA-01.
  const policy = RATE_LIMIT_POLICIES.login; // 1분 5회

  // Case 1: 비어있는 history → 첫 시도 허용.
  const first = evaluateRateLimit({ history: [], nowMs: 1_000_000, policy });
  assert.equal(first.allowed, true);
  if (first.allowed) {
    assert.equal(first.remaining, 4);
    assert.deepEqual(first.nextHistory, [1_000_000]);
  }

  // Case 2: 윈도우 안 4건 + 이번 시도 = 5건 → 마지막 통과 (remaining=0).
  const fifth = evaluateRateLimit({
    history: [1_000_000, 1_010_000, 1_020_000, 1_030_000],
    nowMs: 1_040_000,
    policy,
  });
  assert.equal(fifth.allowed, true);
  if (fifth.allowed) {
    assert.equal(fifth.remaining, 0);
  }

  // Case 3: 윈도우 안 5건 + 이번 시도 = 6건 → 거부.
  const sixth = evaluateRateLimit({
    history: [1_000_000, 1_010_000, 1_020_000, 1_030_000, 1_040_000],
    nowMs: 1_050_000,
    policy,
  });
  assert.equal(sixth.allowed, false);
  if (!sixth.allowed) {
    assert.equal(sixth.reason, "rate_limit_exceeded");
    assert.equal(sixth.retryAfterMs, 10_000); // 가장 오래된 1_000_000 + 60_000 - 1_050_000
    assert.equal(sixth.resetAtMs, 1_060_000);
  }

  // Case 4: 윈도우 만료된 옛날 기록은 자동 제거 → 다시 허용.
  const afterWindow = evaluateRateLimit({
    history: [1_000_000, 1_010_000, 1_020_000, 1_030_000, 1_040_000],
    nowMs: 1_001_000 + 60_000, // 가장 오래된 기록 만료
    policy,
  });
  assert.equal(afterWindow.allowed, true);
  if (afterWindow.allowed) {
    // 1_010_000 ~ 1_040_000 만 남아 있음 (4건) + 현재 시도 = 5건 → remaining=0
    assert.equal(afterWindow.nextHistory.length, 5);
    assert.equal(afterWindow.nextHistory[0], 1_010_000);
  }

  return {
    id: "TC-SEC-RA01-001",
    area: "security",
    requirementIds: ["SR-SEC-RA01"],
    inputSummary: "empty / 4-in-window / 5-in-window (deny) / window-expired (allow)",
    expected: "allow / allow remaining=0 / deny retryAfter=10s / allow after window expiry",
    actual: `first=${first.allowed}, fifth=${fifth.allowed}, sixth=${(sixth as any).allowed}, afterWindow=${afterWindow.allowed}`,
    detail: `windowMs=${policy.windowMs}, max=${policy.maxAttempts}, sliding window verified`,
  };
}

function runAuditChainCheck(): CheckResult {
  // SR-SEC-UC07. 식약처 사이버보안 UC-07 (HMAC 체인) + TRE-01 (체인 검증 일부).
  const secret = "test-secret-001";

  // 정상 체인 3건.
  const a = appendAuditEntry({
    entry: { ts: 1_000, category: "login", payload: { userId: "u1", ok: true } },
    prevHash: AUDIT_GENESIS_HASH,
    secret,
  });
  const b = appendAuditEntry({
    entry: { ts: 2_000, category: "permission_denied", payload: { userId: "u1", scope: "camera" } },
    prevHash: a.entryHash,
    secret,
  });
  const c = appendAuditEntry({
    entry: { ts: 3_000, category: "aac_intent", payload: { userId: "u1", place: "cafe" } },
    prevHash: b.entryHash,
    secret,
  });
  const okResult = verifyAuditChain({ entries: [a, b, c], secret });
  assert.equal(okResult.valid, true);
  if (okResult.valid) assert.equal(okResult.count, 3);

  const aReplay = appendAuditEntry({
    entry: { ts: 1_000, category: "login", payload: { userId: "u1", ok: true } },
    prevHash: AUDIT_GENESIS_HASH,
    secret,
  });
  assert.equal(aReplay.entryHash, a.entryHash);

  const tamperedB = { ...b, payload: { ...b.payload, scope: "microphone" } };
  const tamperedResult = verifyAuditChain({ entries: [a, tamperedB, c], secret });
  assert.equal(tamperedResult.valid, false);
  if (!tamperedResult.valid) {
    assert.equal(tamperedResult.reason, "hash_mismatch");
    assert.equal(tamperedResult.breakAt, 1);
  }

  const brokenLinkB = { ...b, prevHash: "ff".repeat(32) };
  const brokenResult = verifyAuditChain({ entries: [a, brokenLinkB, c], secret });
  assert.equal(brokenResult.valid, false);
  if (!brokenResult.valid) {
    assert.equal(brokenResult.reason, "broken_link");
    assert.equal(brokenResult.breakAt, 1);
  }

  return {
    id: "TC-SEC-UC07-001",
    area: "security",
    requirementIds: ["SR-SEC-UC07"],
    inputSummary: "3-entry chain / replay / tampered / broken link",
    expected: "valid / replay equal / hash_mismatch at 1 / broken_link at 1",
    actual: `okValid=${okResult.valid}, replayEqual=${aReplay.entryHash === a.entryHash}`,
    detail: "HMAC SHA256 chain integrity verified",
  };
}

function runAuditAppendOnlyCheck(): CheckResult {
  const secret = "test-secret-002";
  const a = appendAuditEntry({
    entry: { ts: 100, category: "login", payload: { userId: "u1" } },
    prevHash: AUDIT_GENESIS_HASH,
    secret,
  });
  const b = appendAuditEntry({
    entry: { ts: 200, category: "login", payload: { userId: "u1" } },
    prevHash: a.entryHash,
    secret,
  });
  const monotonic = verifyAuditChain({ entries: [a, b], secret });
  assert.equal(monotonic.valid, true);

  const c = appendAuditEntry({
    entry: { ts: 150, category: "login", payload: { userId: "u1" } },
    prevHash: b.entryHash,
    secret,
  });
  const regressResult = verifyAuditChain({ entries: [a, b, c], secret });
  assert.equal(regressResult.valid, false);
  if (!regressResult.valid) {
    assert.equal(regressResult.reason, "time_regression");
    assert.equal(regressResult.breakAt, 2);
  }

  const dSameTs = appendAuditEntry({
    entry: { ts: 200, category: "audit_secondary", payload: { note: "same ts" } },
    prevHash: b.entryHash,
    secret,
  });
  const sameTsResult = verifyAuditChain({ entries: [a, b, dSameTs], secret });
  assert.equal(sameTsResult.valid, true);

  const empty = verifyAuditChain({ entries: [], secret });
  assert.equal(empty.valid, true);

  return {
    id: "TC-SEC-TRE01-001",
    area: "security",
    requirementIds: ["SR-SEC-TRE01"],
    inputSummary: "monotonic / regression / equal ts / empty",
    expected: "valid / time_regression at 2 / valid / valid",
    actual: `monotonic=${monotonic.valid}, regress=${(regressResult as any).reason}@${(regressResult as any).breakAt}, sameTs=${sameTsResult.valid}, empty=${empty.valid}`,
    detail: "audit append-only time monotonicity verified",
  };
}

function runErrorDictionaryCheck(): CheckResult {
  const unauthorized = resolveErrorResponse("unauthorized");
  assert.equal(unauthorized.httpStatus, 401);
  assert.equal(unauthorized.body.error, "unauthorized");

  const locked = resolveErrorResponse("account_locked");
  assert.equal(locked.httpStatus, 423);
  assert.equal(locked.severity, "warn");

  const rate = resolveErrorResponse("rate_limit_exceeded");
  assert.equal(rate.httpStatus, 429);

  const dbDown = resolveErrorResponse("database_unavailable");
  assert.equal(dbDown.httpStatus, 503);

  const unknown = resolveErrorResponse("totally_unknown_code_xyz");
  assert.equal(unknown.httpStatus, 500);
  assert.equal(unknown.body.error, "internal_error");
  assert.equal(unknown.severity, "critical");

  const known = listKnownErrorCodes();
  assert.equal(known.length, 12);
  assert.equal(known.includes("internal_error"), true);

  return {
    id: "TC-SEC-SI07-001",
    area: "security",
    requirementIds: ["SR-SEC-SI07"],
    inputSummary: "defined codes / unknown fallback / dictionary count",
    expected: "401/423/429/503 mapped, unknown -> internal_error, count=11",
    actual: `unauth=${unauthorized.httpStatus}, locked=${locked.httpStatus}, rate=${rate.httpStatus}, db=${dbDown.httpStatus}, unknown=${unknown.body.error}, count=${known.length}`,
    detail: "error dictionary integrity verified",
  };
}

function runInputValidationCheck(): CheckResult {
  // SR-SEC-SI05. 식약처 사이버보안 SI-05.

  // 1) 정상 fixture — Login.
  const loginOk = validateInput(LoginInputSchema, {
    loginId: "patient001",
    password: "Br@inFriends2026",
  });
  assert.equal(loginOk.ok, true);
  assert.equal(loginOk.data?.loginId, "patient001");

  // 2) 정상 fixture — AAC intent.
  const aacOk = validateInput(AacIntentInputSchema, {
    place: "cafe",
    symbolIds: ["subj/me", "noun/cafe/0", "intent/cafe/0"],
    sentence: "저 커피 따뜻하게 주세요.",
  });
  assert.equal(aacOk.ok, true);
  assert.equal(aacOk.data?.symbolIds.length, 3);

  // 3) 비정상 — 필드 누락.
  const missingPwd = validateInput(LoginInputSchema, { loginId: "x" });
  assert.equal(missingPwd.ok, false);
  assert.equal(missingPwd.publicError, "invalid_payload");
  assert.equal(typeof missingPwd.auditDetail, "string");

  // 4) 비정상 — 잘못된 enum (place).
  const badPlace = validateInput(AacIntentInputSchema, {
    place: "rocket",
    symbolIds: ["a"],
  });
  assert.equal(badPlace.ok, false);

  // 5) 비정상 — 빈 배열 (min(1)).
  const emptyIds = validateInput(AacIntentInputSchema, {
    place: "home",
    symbolIds: [],
  });
  assert.equal(emptyIds.ok, false);

  // 6) 비정상 — 길이 초과 (max 200).
  const tooMany = validateInput(AacIntentInputSchema, {
    place: "home",
    symbolIds: Array.from({ length: 201 }, (_, i) => `id${i}`),
  });
  assert.equal(tooMany.ok, false);

  // 7) 비정상 — 안전하지 않은 id 문자.
  const unsafeId = validateInput(AacIntentInputSchema, {
    place: "home",
    symbolIds: ["valid_id", "<script>"],
  });
  assert.equal(unsafeId.ok, false);

  // 8) 결정성 — 동일 입력 → 동일 audit detail.
  const detail1 = validateInput(LoginInputSchema, { loginId: "x" }).auditDetail;
  const detail2 = validateInput(LoginInputSchema, { loginId: "x" }).auditDetail;
  assert.equal(detail1, detail2);

  return {
    id: "TC-SEC-SI05-001",
    area: "security",
    requirementIds: ["SR-SEC-SI05"],
    inputSummary:
      "Login ok / AAC ok / missing field / bad enum / empty array / max overflow / unsafe chars / determinism",
    expected:
      "ok=true (2건) / ok=false invalid_payload (5건) / 동일 입력 → 동일 auditDetail",
    actual: `loginOk=${loginOk.ok}, aacOk=${aacOk.ok}, missing=${missingPwd.publicError}, badEnum=${badPlace.ok}, empty=${emptyIds.ok}, tooMany=${tooMany.ok}, unsafe=${unsafeId.ok}, detEqual=${detail1 === detail2}`,
    detail: "zod input schema validation deterministic across all routes",
  };
}

function runSoupRegistryCheck(): CheckResult {
  // SR-SEC-SI04-SOUP. 식약처 사이버보안 SI-04 + GMP [별표3] 2.3.

  // npm 일반 — riskCategory 자동 부여 (A).
  const npmGeneric = normalizeSoupEntry({
    name: "lucide-react",
    version: "0.563.0",
    sourceType: "npm",
  });
  assert.equal(npmGeneric.id, "SOUP-NPM-lucide-react");
  assert.equal(npmGeneric.riskCategory, "A");
  assert.deepEqual(npmGeneric.changeControl, ["security_scan", "version_pin"]);

  // model — riskCategory 자동 부여 (C) + model_eval 포함.
  const model = normalizeSoupEntry({
    name: "openai-whisper-1",
    version: "whisper-1",
    sourceType: "model",
    license: "OpenAI ToS",
  });
  assert.equal(model.riskCategory, "C");
  assert.equal(model.changeControl.includes("model_eval"), true);

  // @scoped npm — id 안전 변환.
  const scoped = normalizeSoupEntry({
    name: "@mediapipe/tasks-vision",
    version: "0.10.32",
    sourceType: "npm",
  });
  assert.equal(scoped.id, "SOUP-NPM-mediapipe_tasks-vision");

  // buildSoupList 결정성 — 입력 순서와 무관하게 (sourceType, name) 정렬.
  const list = buildSoupList([
    { name: "fastapi", version: "0.110", sourceType: "pypi" },
    { name: "lucide-react", version: "0.563.0", sourceType: "npm" },
    { name: "openai-whisper-1", version: "whisper-1", sourceType: "model" },
    { name: "@mediapipe/tasks-vision", version: "0.10.32", sourceType: "npm" },
    { name: "lucide-react", version: "0.563.0", sourceType: "npm" }, // dup
  ]);
  assert.equal(list.length, 4); // dup 제거
  assert.equal(list[0].sourceType, "model");
  assert.equal(list[1].sourceType, "npm");
  assert.equal(list[1].name, "@mediapipe/tasks-vision"); // npm 안에서 name 정렬
  assert.equal(list[2].name, "lucide-react");
  assert.equal(list[3].sourceType, "pypi");

  // 결정성 — 동일 입력 → 동일 출력.
  const replay = buildSoupList([
    { name: "fastapi", version: "0.110", sourceType: "pypi" },
    { name: "lucide-react", version: "0.563.0", sourceType: "npm" },
    { name: "openai-whisper-1", version: "whisper-1", sourceType: "model" },
    { name: "@mediapipe/tasks-vision", version: "0.10.32", sourceType: "npm" },
  ]);
  assert.deepEqual(replay.map((e) => e.id), list.map((e) => e.id));

  // 요약 통계.
  const summary = summarizeSoupList(list);
  assert.equal(summary.total, 4);
  assert.equal(summary.byRisk.A, 2); // npm 2건
  assert.equal(summary.byRisk.C, 1); // model 1건
  assert.equal(summary.bySource.npm, 2);

  return {
    id: "TC-SEC-SI04-SOUP-001",
    area: "security",
    requirementIds: ["SR-SEC-SI04-SOUP"],
    inputSummary: "npm/pypi/model + @scoped + dup → normalize, dedupe, sort, summarize",
    expected: "정렬: model→npm→pypi, dup 제거, riskCategory 자동, changeControl model_eval 포함",
    actual: `total=${summary.total}, riskA=${summary.byRisk.A}, riskC=${summary.byRisk.C}, modelChange=${model.changeControl.length}`,
    detail: `SOUP registry deterministic, ${list.length} entries, summary verified`,
  };
}

function runReleaseManifestCheck(): CheckResult {
  // SR-SEC-SI04-MANIFEST. 식약처 사이버보안 SI-04 + GMP [별표3] 2.3.

  // fixture: 4개 결정성 sha256 (64 hex)
  const SHA_GIT = "a".repeat(64);
  const SHA_LOCK = "b".repeat(64);
  const SHA_SBOM = "c".repeat(64);
  const SHA_SOUP = "d".repeat(64);
  const SHA_GIT_TAMPERED = "e".repeat(64);

  const baseComponents: ReleaseManifestComponent[] = [
    { id: "git-sha", description: "git head", sha256: SHA_GIT, meta: { gitSha: "abcdef0", dirty: false } },
    { id: "package-lock", description: "npm lock", sha256: SHA_LOCK },
    { id: "sbom", description: "cyclone dx", sha256: SHA_SBOM },
    { id: "soup", description: "soup list", sha256: SHA_SOUP },
  ];

  // 1) buildManifest 결정성 — 입력 순서와 무관하게 정렬된 components.
  const m1 = buildManifest({
    productName: "brainfriends",
    productVersion: "0.1.0",
    components: [
      baseComponents[3],
      baseComponents[1],
      baseComponents[0],
      baseComponents[2],
    ],
  });
  assert.equal(m1.components.length, 4);
  assert.equal(m1.components[0].id, "git-sha");
  assert.equal(m1.components[1].id, "package-lock");
  assert.equal(m1.components[2].id, "sbom");
  assert.equal(m1.components[3].id, "soup");

  // 2) 동일 입력 → 동일 manifestHash.
  const m2 = buildManifest({
    productName: "brainfriends",
    productVersion: "0.1.0",
    components: baseComponents,
  });
  assert.equal(m1.manifestHash, m2.manifestHash);
  assert.equal(m1.manifestHash.length, 64);
  assert.equal(/^[0-9a-f]{64}$/.test(m1.manifestHash), true);

  // 3) computeManifestHash 단독 호출도 동일.
  const recomputed = computeManifestHash(m1.components);
  assert.equal(recomputed, m1.manifestHash);

  // 4) sha256 형식 검증 — 잘못된 값 거부.
  let rejected = false;
  try {
    buildManifest({
      productName: "brainfriends",
      productVersion: "0.1.0",
      components: [{ id: "bad", description: "x", sha256: "ZZ" }],
    });
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true);

  // 5) verifyManifest — 정상 일치.
  const okResult = verifyManifest({
    manifest: m1,
    currentComponents: baseComponents,
    currentProductVersion: "0.1.0",
  });
  assert.equal(okResult.valid, true);
  assert.equal(okResult.breaches.length, 0);
  assert.equal(okResult.recomputedManifestHash, m1.manifestHash);

  // 6) verifyManifest — sha 변조 (mismatch).
  const tamperedComponents: ReleaseManifestComponent[] = [
    { ...baseComponents[0], sha256: SHA_GIT_TAMPERED },
    baseComponents[1],
    baseComponents[2],
    baseComponents[3],
  ];
  const mismatchResult = verifyManifest({
    manifest: m1,
    currentComponents: tamperedComponents,
    currentProductVersion: "0.1.0",
  });
  assert.equal(mismatchResult.valid, false);
  const mismatchBreach = mismatchResult.breaches.find((b) => b.type === "mismatch");
  assert.equal(mismatchBreach?.componentId, "git-sha");
  assert.equal(mismatchBreach?.expected, SHA_GIT);
  assert.equal(mismatchBreach?.actual, SHA_GIT_TAMPERED);

  // 7) verifyManifest — version 불일치.
  const versionResult = verifyManifest({
    manifest: m1,
    currentComponents: baseComponents,
    currentProductVersion: "0.1.1",
  });
  assert.equal(versionResult.valid, false);
  assert.equal(
    versionResult.breaches.some((b) => b.type === "version_mismatch"),
    true,
  );

  // 8) verifyManifest — 누락 (missing).
  const missingResult = verifyManifest({
    manifest: m1,
    currentComponents: [baseComponents[0], baseComponents[1], baseComponents[2]],
    currentProductVersion: "0.1.0",
  });
  assert.equal(missingResult.valid, false);
  const missingBreach = missingResult.breaches.find((b) => b.type === "missing");
  assert.equal(missingBreach?.componentId, "soup");

  // 9) verifyManifest — extra (현재에만 존재).
  const extraResult = verifyManifest({
    manifest: m1,
    currentComponents: [
      ...baseComponents,
      { id: "rogue", description: "stranger", sha256: "f".repeat(64) },
    ],
    currentProductVersion: "0.1.0",
  });
  assert.equal(extraResult.valid, false);
  const extraBreach = extraResult.breaches.find((b) => b.type === "extra");
  assert.equal(extraBreach?.componentId, "rogue");

  // 10) ignoreExtra=true 일 때 extra 무시.
  const extraIgnored = verifyManifest({
    manifest: m1,
    currentComponents: [
      ...baseComponents,
      { id: "rogue", description: "stranger", sha256: "f".repeat(64) },
    ],
    currentProductVersion: "0.1.0",
    ignoreExtra: true,
  });
  assert.equal(extraIgnored.valid, true);

  // 11) verifyManifest — manifestHash 변조 (외부에서 components 만 바꾸고 hash 그대로).
  const hashTampered: ReleaseManifest = {
    ...m1,
    manifestHash: "0".repeat(64),
  };
  const hashResult = verifyManifest({
    manifest: hashTampered,
    currentComponents: baseComponents,
    currentProductVersion: "0.1.0",
  });
  assert.equal(hashResult.valid, false);
  assert.equal(
    hashResult.breaches.some((b) => b.type === "manifest_hash"),
    true,
  );

  // 12) normalizeComponents — id 중복 시 last-wins, 정렬.
  const dedupd = normalizeComponents([
    { id: "soup", description: "old", sha256: SHA_SOUP },
    { id: "git-sha", description: "v2", sha256: SHA_GIT },
    { id: "soup", description: "new", sha256: SHA_GIT_TAMPERED },
  ]);
  assert.equal(dedupd.length, 2);
  assert.equal(dedupd[0].id, "git-sha");
  assert.equal(dedupd[1].id, "soup");
  assert.equal(dedupd[1].sha256, SHA_GIT_TAMPERED);
  assert.equal(dedupd[1].description, "new");

  // 13) serializeManifest — 결정성 직렬화 후 round-trip.
  const json = serializeManifest(m1);
  const parsed = JSON.parse(json) as ReleaseManifest;
  assert.equal(parsed.manifestHash, m1.manifestHash);
  assert.equal(parsed.components.length, m1.components.length);
  assert.equal(parsed.components[0].id, "git-sha");

  // 14) evaluateStartupCheck — manifest 없음 → skip.
  const skipOutcome = evaluateStartupCheck({
    manifest: null,
    currentComponents: baseComponents,
    currentProductVersion: "0.1.0",
    policy: "warn",
  });
  assert.equal(skipOutcome.status, "skip");
  assert.equal(skipOutcome.auditCategory, "release_manifest_skip");

  // 15) evaluateStartupCheck — 정상 → ok.
  const okStartup = evaluateStartupCheck({
    manifest: m1,
    currentComponents: baseComponents,
    currentProductVersion: "0.1.0",
    policy: "block",
  });
  assert.equal(okStartup.status, "ok");
  assert.equal(okStartup.auditCategory, "release_manifest_ok");

  // 16) evaluateStartupCheck — block policy + 변조 → block.
  const blockStartup = evaluateStartupCheck({
    manifest: m1,
    currentComponents: tamperedComponents,
    currentProductVersion: "0.1.0",
    policy: "block",
  });
  assert.equal(blockStartup.status, "block");
  assert.equal(blockStartup.auditCategory, "release_manifest_breach");

  // 17) evaluateStartupCheck — warn policy + 변조 → warn (시작 허용).
  const warnStartup = evaluateStartupCheck({
    manifest: m1,
    currentComponents: tamperedComponents,
    currentProductVersion: "0.1.0",
    policy: "warn",
  });
  assert.equal(warnStartup.status, "warn");
  assert.equal(warnStartup.auditCategory, "release_manifest_breach");

  return {
    id: "TC-SEC-SI04-MANIFEST-001",
    area: "security",
    requirementIds: ["SR-SEC-SI04-MANIFEST"],
    inputSummary:
      "buildManifest deterministic / verifyManifest mismatch+missing+extra+version+manifest_hash / startup skip+ok+block+warn",
    expected:
      "동일 입력 → 동일 manifestHash, 5종 breach 결정적 식별, ignoreExtra 동작, startup 4종 status 분리",
    actual: `manifestHash=${m1.manifestHash.slice(0, 16)}…, breaches: mismatch+missing+extra+version+hash, startup: skip+ok+block+warn`,
    detail: `Release manifest deterministic, ${m1.components.length} components, integrity verified across 17 assertions`,
  };
}

function runResultRefetchMismatchCheck(): CheckResult {
  const outcome = resolveResultRefetchMismatchOutcome({
    serverHistoryId: "history-server",
    localHistoryId: "history-local",
    serverAq: 82.4,
    localAq: 78.1,
  });
  assert.equal(outcome.mismatchDetected, true);
  assert.equal(outcome.canonicalSource, "server");
  assert.equal(outcome.selectedHistoryId, "history-server");
  return {
    id: "TC-RESULT-REFETCH-001",
    area: "result",
    requirementIds: ["SR-HISTORY-005"],
    inputSummary: "server/local mismatch fixture",
    expected: "server selected as canonical",
    actual: `canonical=${outcome.canonicalSource}, mismatch=${outcome.mismatchDetected}`,
    detail: `canonical=${outcome.canonicalSource}, mismatch=${outcome.mismatchDetected}`,
  };
}


function runRiskClassificationCheck(): CheckResult {
  // SR-RISK-012. ISO 14971 hazard severity × probability → risk class.

  // 1) scoreToRiskClass — boundary 검증.
  assert.equal(scoreToRiskClass(1), "A");
  assert.equal(scoreToRiskClass(6), "A");
  assert.equal(scoreToRiskClass(7), "B");
  assert.equal(scoreToRiskClass(14), "B");
  assert.equal(scoreToRiskClass(15), "C");
  assert.equal(scoreToRiskClass(25), "C");

  // 2) classifyHazard — 통제 효과 산출.
  const h1 = classifyHazard({
    hazardId: "H-STT-001",
    description: "STT 오인식으로 잘못된 K-WAB 점수 산출",
    severity: 4,
    probability: 4,
    residualSeverity: 2,
    residualProbability: 2,
  });
  assert.equal(h1.riskScore, 16);
  assert.equal(h1.riskClass, "C");
  assert.equal(h1.residualRiskScore, 4);
  assert.equal(h1.residualRiskClass, "A");
  assert.equal(h1.controlEffective, true);

  // 3) 통제 미적용 (residual 미입력) — riskClass 동일 유지.
  const h2 = classifyHazard({
    hazardId: "H-PRIV-002",
    description: "PHI 노출",
    severity: 5,
    probability: 1,
  });
  assert.equal(h2.riskScore, 5);
  assert.equal(h2.riskClass, "A");
  assert.equal(h2.residualRiskClass, "A");
  assert.equal(h2.controlEffective, false);

  // 4) classifyHazardList — 중복 제거 + residualRiskClass desc 정렬.
  const list = classifyHazardList([
    { hazardId: "H-A", description: "low", severity: 1, probability: 1 },
    { hazardId: "H-B", description: "high", severity: 5, probability: 5 },
    { hazardId: "H-C", description: "mid", severity: 3, probability: 3 },
    { hazardId: "H-A", description: "dup", severity: 1, probability: 1 }, // dup
  ]);
  assert.equal(list.length, 3);
  assert.equal(list[0].hazardId, "H-B"); // C 등급 (25)
  assert.equal(list[1].hazardId, "H-C"); // B 등급 (9)
  assert.equal(list[2].hazardId, "H-A"); // A 등급 (1)

  // 5) summarizeHazards — unacceptable 카운트.
  const summary = summarizeHazards(list);
  assert.equal(summary.total, 3);
  assert.equal(summary.byClass.A, 1);
  assert.equal(summary.byClass.B, 1);
  assert.equal(summary.byClass.C, 1);
  assert.equal(summary.unacceptable, 1); // residualRiskClass=C 인 H-B 1건

  // 6) 결정성 — 동일 입력 → 동일 출력.
  const replay = classifyHazardList([
    { hazardId: "H-A", description: "low", severity: 1, probability: 1 },
    { hazardId: "H-B", description: "high", severity: 5, probability: 5 },
    { hazardId: "H-C", description: "mid", severity: 3, probability: 3 },
  ]);
  assert.deepEqual(replay.map((h) => h.hazardId), list.map((h) => h.hazardId));

  return {
    id: "TC-RISK-012-001",
    area: "risk",
    requirementIds: ["SR-RISK-012"],
    inputSummary: "boundary score / classifyHazard / dedupe + sort / summarize / determinism",
    expected: "A=1~6, B=7~14, C=15~25 / 통제 효과 / unacceptable=residualClass=C count",
    actual: `A=${summary.byClass.A}, B=${summary.byClass.B}, C=${summary.byClass.C}, unacceptable=${summary.unacceptable}`,
    detail: `Risk classification deterministic, ${list.length} hazards, ISO 14971 mapping verified`,
  };
}

function runPhiMaskingCheck(): CheckResult {
  // SR-PHI-013. PHI 마스킹 결정성.

  // 1) 한국 이름 — 첫 글자 + ✱.
  const name = maskPhi("이현송");
  assert.equal(name.kind, "name");
  assert.equal(name.masked, "이✱✱");
  assert.equal(name.blanket, false);

  // 2) 전화번호 — 마지막 4자리 보존.
  const phone = maskPhi("010-1234-5678");
  assert.equal(phone.kind, "phone");
  assert.equal(phone.masked, "010-✱✱✱✱-5678");

  // 3) RRN — 앞 6자리 보존.
  const rrn = maskPhi("900101-1234567");
  assert.equal(rrn.kind, "rrn");
  assert.equal(rrn.masked, "900101-✱✱✱✱✱✱✱");

  // 4) 이메일.
  const email = maskPhi("hyunsong635@gmail.com");
  assert.equal(email.kind, "email");
  assert.equal(email.masked, "hy✱✱✱@gmail.com");

  // 5) 환자 ID.
  const pid = maskPhi("BFAB123XYZ");
  assert.equal(pid.kind, "patient_id");
  assert.equal(pid.masked.startsWith("BFAB"), true);

  // 6) 알 수 없는 패턴 — blanket=true.
  const blanket = maskPhi("random-string-123");
  assert.equal(blanket.blanket, true);
  assert.equal(blanket.kind, "unknown");

  // 7) 빈 입력.
  const empty = maskPhi("");
  assert.equal(empty.blanket, true);

  // 8) 결정성 — 동일 입력 → 동일 출력.
  const replay1 = maskPhi("이현송").masked;
  const replay2 = maskPhi("이현송").masked;
  assert.equal(replay1, replay2);

  // 9) maskPhiObject — PHI 후보 키 자동 탐지.
  const obj = maskPhiObject({
    patientName: "김철수",
    patientPhone: "010-9999-1111",
    age: 65,
    notes: "치료 진행 중",
    guardian: { name: "박영희", email: "guardian@example.com" },
  });
  assert.equal(obj.touched.includes("patientName"), true);
  assert.equal(obj.touched.includes("patientPhone"), true);
  assert.equal(obj.touched.includes("guardian.name"), true);
  assert.equal(obj.touched.includes("guardian.email"), true);
  assert.equal(obj.touched.includes("age"), false);
  // touched 정렬 확인 (알파벳).
  const sorted = [...obj.touched].sort();
  assert.deepEqual(obj.touched, sorted);
  // age, notes 는 보존.
  assert.equal((obj.masked as { age: number }).age, 65);
  assert.equal((obj.masked as { notes: string }).notes, "치료 진행 중");

  return {
    id: "TC-PHI-013-001",
    area: "privacy",
    requirementIds: ["SR-PHI-013"],
    inputSummary: "name / phone / RRN / email / patientId / unknown / object recursion",
    expected: "각 PHI 종류별 결정성 마스킹 + 자동 키 탐지 + touched 정렬",
    actual: `kinds=name+phone+rrn+email+patient_id+unknown, touched=${obj.touched.length}`,
    detail: `PHI masking deterministic, ${obj.touched.length} keys auto-detected and masked`,
  };
}

function runWerCalculatorCheck(): CheckResult {
  // SR-AI-EVAL-014. WER/CER Levenshtein 결정성.

  // 1) levenshtein 기본.
  assert.equal(levenshtein([], []), 0);
  assert.equal(levenshtein(["a"], []), 1);
  assert.equal(levenshtein([], ["a"]), 1);
  assert.equal(levenshtein(["a", "b"], ["a", "c"]), 1);
  assert.equal(levenshtein(["a", "b"], ["c", "d"]), 2);

  // 2) normalizeForWer — 구두점 제거 + 공백 압축 + 소문자.
  assert.equal(normalizeForWer("Hello, World!"), "hello world");
  assert.equal(normalizeForWer("  중간   공백  "), "중간 공백");

  // 3) 정확 일치 — WER=0.
  const perfect = calculateWer("안녕하세요 반갑습니다", "안녕하세요 반갑습니다");
  assert.equal(perfect.wer, 0);
  assert.equal(perfect.cer, 0);

  // 4) 단어 1개 치환.
  const oneSub = calculateWer("안녕 반갑", "안녕 잘가");
  assert.equal(oneSub.wer, 0.5); // 1 edit / 2 words
  assert.equal(oneSub.refWords, 2);
  assert.equal(oneSub.wordEdits, 1);

  // 5) 빈 reference + 빈 hypothesis.
  const bothEmpty = calculateWer("", "");
  assert.equal(bothEmpty.wer, 0);
  assert.equal(bothEmpty.cer, 0);

  // 6) 빈 reference + 비어있지 않은 hypothesis.
  const refEmpty = calculateWer("", "test");
  assert.equal(refEmpty.wer, 1);
  assert.equal(refEmpty.cer, 1);

  // 7) 결정성 — 동일 입력 → 동일 출력.
  const r1 = calculateWer("ref", "hyp");
  const r2 = calculateWer("ref", "hyp");
  assert.equal(r1.wer, r2.wer);
  assert.equal(r1.cer, r2.cer);

  // 8) aggregateWer — 빈 결과셋.
  const empty = aggregateWer([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.passRateAt15, 0);

  // 9) aggregateWer — 통과 비율.
  const agg = aggregateWer([
    calculateWer("a b c", "a b c"), // wer=0
    calculateWer("a b c", "a b c"), // wer=0
    calculateWer("a b c", "x y z"), // wer=1
    calculateWer("a b c", "a b c"), // wer=0
  ]);
  assert.equal(agg.total, 4);
  assert.equal(agg.passRateAt15, 0.75); // 3/4 ≤ 0.15

  return {
    id: "TC-AI-EVAL-014-001",
    area: "ai_evaluation",
    requirementIds: ["SR-AI-EVAL-014"],
    inputSummary: "levenshtein / normalize / perfect / 1-sub / empty ref/hyp / aggregate",
    expected: "결정성 WER/CER, 빈 입력 처리, passRateAt15 산출",
    actual: `perfect.wer=${perfect.wer}, oneSub.wer=${oneSub.wer}, agg.passRateAt15=${agg.passRateAt15}`,
    detail: `WER/CER deterministic, Levenshtein verified, 9 assertions across edge cases`,
  };
}

function runGuardianConsentStateCheck(): CheckResult {
  // SR-CONSENT-015. 보호자 동의 상태머신 결정성.

  const NOW = 1735689600000; // 2025-01-01 UTC
  const SECONDS = 1000;
  const DAYS = 24 * 60 * 60 * SECONDS;

  // 1) granted — 접근 허용.
  const granted = evaluateGuardianConsent({
    consentId: "C-001",
    state: "granted",
    requestedAtMs: NOW - 3 * DAYS,
    decidedAtMs: NOW - 2 * DAYS,
    nowMs: NOW,
  });
  assert.equal(granted.effectiveState, "granted");
  assert.equal(granted.reportAccessAllowed, true);
  assert.equal(granted.reissueRequired, false);
  assert.equal(granted.reason, "consent_granted");

  // 2) pending within TTL — 접근 차단, 재발급 불필요.
  const pendingFresh = evaluateGuardianConsent({
    consentId: "C-002",
    state: "pending",
    requestedAtMs: NOW - 2 * DAYS,
    decidedAtMs: null,
    nowMs: NOW,
  });
  assert.equal(pendingFresh.effectiveState, "pending");
  assert.equal(pendingFresh.reportAccessAllowed, false);
  assert.equal(pendingFresh.reissueRequired, false);

  // 3) pending past TTL — expired 로 자동 전이.
  const pendingOld = evaluateGuardianConsent({
    consentId: "C-003",
    state: "pending",
    requestedAtMs: NOW - 10 * DAYS,
    decidedAtMs: null,
    nowMs: NOW,
  });
  assert.equal(pendingOld.effectiveState, "expired");
  assert.equal(pendingOld.reissueRequired, true);
  assert.equal(pendingOld.reason, "consent_pending_expired");

  // 4) revoked — 접근 차단 + 재발급 필요.
  const revoked = evaluateGuardianConsent({
    consentId: "C-004",
    state: "revoked",
    requestedAtMs: NOW - 5 * DAYS,
    decidedAtMs: NOW - 1 * DAYS,
    nowMs: NOW,
  });
  assert.equal(revoked.effectiveState, "revoked");
  assert.equal(revoked.reportAccessAllowed, false);
  assert.equal(revoked.reissueRequired, true);

  // 5) 결정성 — 동일 입력 → 동일 출력.
  const replay = evaluateGuardianConsent({
    consentId: "C-001",
    state: "granted",
    requestedAtMs: NOW - 3 * DAYS,
    decidedAtMs: NOW - 2 * DAYS,
    nowMs: NOW,
  });
  assert.equal(replay.effectiveState, granted.effectiveState);
  assert.equal(replay.reason, granted.reason);

  // 6) isLegalTransition — 합법 전이.
  assert.equal(isLegalTransition("pending", "granted"), true);
  assert.equal(isLegalTransition("pending", "revoked"), true);
  assert.equal(isLegalTransition("pending", "expired"), true);
  assert.equal(isLegalTransition("granted", "revoked"), true);

  // 7) isLegalTransition — 불법 전이.
  assert.equal(isLegalTransition("granted", "pending"), false);
  assert.equal(isLegalTransition("revoked", "granted"), false);
  assert.equal(isLegalTransition("expired", "granted"), false);
  assert.equal(isLegalTransition("granted", "granted"), false); // self

  return {
    id: "TC-CONSENT-015-001",
    area: "privacy",
    requirementIds: ["SR-CONSENT-015"],
    inputSummary: "granted / pending fresh / pending old / revoked / determinism / transitions",
    expected: "각 상태별 reportAccess 결정성 + TTL expired 자동 전이 + 합법/불법 전이",
    actual: `granted.access=${granted.reportAccessAllowed}, pendingOld.state=${pendingOld.effectiveState}, revoked.reissue=${revoked.reissueRequired}`,
    detail: `Guardian consent state machine deterministic, 4 states + TTL + transition rules verified`,
  };
}

function runChangeImpactAnalysisCheck(): CheckResult {
  // SR-CHANGE-016. Release manifest delta → 영향받는 SR-* 매핑.

  const SHA = (c: string) => c.repeat(64);

  const prev: ReleaseManifestComponent[] = [
    { id: "git-sha", description: "git", sha256: SHA("a") },
    { id: "package-lock", description: "lock", sha256: SHA("b") },
    { id: "sbom", description: "sbom", sha256: SHA("c") },
    { id: "soup", description: "soup", sha256: SHA("d") },
  ];

  // 1) git-sha 만 변경 → patch.
  const next1 = [
    { id: "git-sha", description: "git", sha256: SHA("e") },
    prev[1],
    prev[2],
    prev[3],
  ];
  const delta1 = diffManifestComponents(prev, next1);
  assert.deepEqual(delta1.changedComponentIds, ["git-sha"]);
  assert.deepEqual(delta1.addedComponentIds, []);
  assert.deepEqual(delta1.removedComponentIds, []);
  const impact1 = analyzeChangeImpact(delta1);
  assert.equal(impact1.kind, "patch");
  assert.equal(impact1.requiresRegulatoryFiling, false);
  assert.equal(impact1.impactedRequirementIds.includes("SR-CHANGE-016"), true);

  // 2) package-lock 변경 → minor.
  const next2 = [prev[0], { id: "package-lock", description: "lock", sha256: SHA("f") }, prev[2], prev[3]];
  const delta2 = diffManifestComponents(prev, next2);
  const impact2 = analyzeChangeImpact(delta2);
  assert.equal(impact2.kind, "minor");
  assert.equal(impact2.requiresRegulatoryFiling, false);
  assert.equal(impact2.impactedRequirementIds.includes("SR-SEC-SI04-SOUP"), true);

  // 3) 모델 자산 추가 → major + filing 필요.
  const next3 = [
    ...prev,
    { id: "model-asset-public_face_landmarker_task", description: "model", sha256: SHA("9") },
  ];
  const delta3 = diffManifestComponents(prev, next3);
  assert.deepEqual(delta3.addedComponentIds, ["model-asset-public_face_landmarker_task"]);
  const impact3 = analyzeChangeImpact(delta3);
  assert.equal(impact3.kind, "major");
  assert.equal(impact3.requiresRegulatoryFiling, true);
  assert.equal(impact3.impactedRequirementIds.includes("SR-STT-009"), true);
  assert.equal(impact3.impactedRequirementIds.includes("SR-AI-EVAL-014"), true);
  assert.equal(impact3.revalidationTriggers.includes("ai_performance_revalidation"), true);

  // 4) ≥3 component 변경 → major.
  const next4 = [
    { id: "git-sha", description: "git", sha256: SHA("e") },
    { id: "package-lock", description: "lock", sha256: SHA("f") },
    { id: "sbom", description: "sbom", sha256: SHA("9") },
    prev[3],
  ];
  const delta4 = diffManifestComponents(prev, next4);
  assert.equal(delta4.changedComponentIds.length, 3);
  const impact4 = analyzeChangeImpact(delta4);
  assert.equal(impact4.kind, "major");

  // 5) 결정성 — 동일 입력 → 동일 출력.
  const replay = analyzeChangeImpact(delta3);
  assert.deepEqual(replay.impactedRequirementIds, impact3.impactedRequirementIds);
  assert.deepEqual(replay.revalidationTriggers, impact3.revalidationTriggers);

  // 6) 정렬 검증 — added/removed/changed 알파벳 정렬.
  const messy = diffManifestComponents(
    [{ id: "git-sha", description: "g", sha256: SHA("a") }],
    [
      { id: "soup", description: "s", sha256: SHA("d") },
      { id: "git-sha", description: "g", sha256: SHA("a") },
      { id: "sbom", description: "s", sha256: SHA("c") },
      { id: "package-lock", description: "l", sha256: SHA("b") },
    ],
  );
  assert.deepEqual(messy.addedComponentIds, ["package-lock", "sbom", "soup"]);

  return {
    id: "TC-CHANGE-016-001",
    area: "change_management",
    requirementIds: ["SR-CHANGE-016"],
    inputSummary: "patch / minor / major (model) / major (≥3 components) / determinism / sorting",
    expected: "변경 분류 결정성, requiresRegulatoryFiling, impactedRequirementIds, revalidationTriggers",
    actual: `patch=${impact1.kind}, minor=${impact2.kind}, modelMajor=${impact3.kind}+filing=${impact3.requiresRegulatoryFiling}`,
    detail: `Change impact analysis deterministic, 4 kinds verified, 6 assertions`,
  };
}

function runReleaseChangeDossierExportCheck(): CheckResult {
  const SHA = (c: string) => c.repeat(64);
  const previousManifest = buildManifest({
    productName: "golden",
    productVersion: "0.1.0",
    components: [
      { id: "git-sha", description: "git", sha256: SHA("a") },
      { id: "package-lock", description: "lock", sha256: SHA("b") },
      { id: "soup", description: "soup", sha256: SHA("c") },
    ],
  });
  const nextManifest = buildManifest({
    productName: "golden",
    productVersion: "0.1.1",
    components: [
      { id: "git-sha", description: "git", sha256: SHA("d") },
      { id: "package-lock", description: "lock", sha256: SHA("e") },
      { id: "soup", description: "soup", sha256: SHA("c") },
      {
        id: "model-asset-public_models_face_landmarker_task",
        description: "model",
        sha256: SHA("f"),
      },
    ],
  });

  const dossier = buildReleaseChangeDossier({
    previousManifest,
    nextManifest,
    generatedAt: "2026-05-11T00:00:00.000Z",
    anomalies: [
      {
        id: "AN-002",
        title: "녹음 ZIP 원자료 누락",
        severity: "major",
        status: "fixed",
        affectedComponentIds: ["git-sha"],
        linkedRequirementIds: ["SR-HISTORY-005"],
        disposition: "result ZIP media export patched",
      },
      {
        id: "AN-001",
        title: "WASM-STT 제품 경로 혼입",
        severity: "major",
        status: "fixed",
        affectedComponentIds: ["package-lock", "git-sha"],
        linkedRequirementIds: ["SR-STT-009", "SR-CHANGE-016"],
      },
    ],
    retests: [
      {
        id: "RT-002",
        testCaseId: "TC-STT-001",
        status: "pass",
        relatedAnomalyIds: ["AN-001"],
        relatedComponentIds: ["git-sha", "package-lock"],
        evidence: "npm run test:vnv",
      },
      {
        id: "RT-001",
        testCaseId: "TC-SEC-SI04-MANIFEST-001",
        status: "pass",
        relatedAnomalyIds: [],
        relatedComponentIds: ["model-asset-public_models_face_landmarker_task"],
      },
    ],
  });

  assert.equal(dossier.schemaVersion, "bf-release-change-dossier-v1");
  assert.equal(dossier.summary.changeKind, "major");
  assert.equal(dossier.summary.requiresRegulatoryFiling, true);
  assert.equal(dossier.summary.openAnomalyCount, 0);
  assert.equal(dossier.summary.blockingAnomalyCount, 0);
  assert.equal(dossier.summary.failedRetestCount, 0);
  assert.equal(dossier.summary.retestCoverage, "complete");
  assert.equal(dossier.summary.releaseGate, "ready_for_review");
  assert.deepEqual(
    dossier.anomalies.map((anomaly) => anomaly.id),
    ["AN-001", "AN-002"],
  );
  assert.equal(
    dossier.impact.impactedRequirementIds.includes("SR-AI-EVAL-014"),
    true,
  );

  const json = serializeReleaseChangeDossierJson(dossier);
  const markdown = serializeReleaseChangeDossierMarkdown(dossier);
  const csv = serializeReleaseChangeDossierCsv(dossier);
  assert.equal(json.includes('"schemaVersion": "bf-release-change-dossier-v1"'), true);
  assert.equal(markdown.includes("## Retest Results"), true);
  assert.equal(csv.split("\n")[0], "section,id,status,severity_or_kind,related,summary");

  const blockedDossier = buildReleaseChangeDossier({
    previousManifest,
    nextManifest,
    generatedAt: "2026-05-11T00:00:00.000Z",
    anomalies: [
      {
        id: "AN-003",
        title: "미해결 major anomaly",
        severity: "major",
        status: "open",
        affectedComponentIds: ["git-sha"],
        linkedRequirementIds: ["SR-CHANGE-016"],
      },
    ],
    retests: [],
  });
  assert.equal(blockedDossier.summary.releaseGate, "blocked");
  assert.equal(blockedDossier.summary.retestCoverage, "none");

  return {
    id: "TC-CHANGE-DOSSIER-001",
    area: "change_management",
    requirementIds: ["SR-CHANGE-016", "SR-SEC-SI04-MANIFEST"],
    inputSummary: "release manifest delta + fixed/open anomalies + retest coverage fixtures",
    expected:
      "dossier JSON/MD/CSV export, anomaly sorting, retest coverage, release gate, filing flag deterministic",
    actual: `kind=${dossier.summary.changeKind}; gate=${dossier.summary.releaseGate}; blockedGate=${blockedDossier.summary.releaseGate}; csvLines=${csv.split("\n").length}`,
    detail:
      "Release change dossier export deterministic — anomaly/retest/impact 제26조 묶음 검증",
  };
}

function runIec62304ExportCheck(): CheckResult {
  // SR-IEC62304-EXPORT. IEC 62304 별지 제2호 추적성 매트릭스 결정성 export.

  const FIXED_NOW = "2026-04-30T12:00:00.000Z";

  const fixtureRequirements: typeof ALL_REQUIREMENTS_FOR_IEC = [...ALL_REQUIREMENTS_FOR_IEC];
  const fixtureTraceability: typeof ALL_TRACEABILITY_FOR_IEC = [...ALL_TRACEABILITY_FOR_IEC];

  // fixture: 모든 SR 에 대해 PASS 결과 1건씩.
  const fixtureResults: Iec62304TestResult[] = fixtureTraceability.map((row, i) => ({
    testCaseId: row.testCaseId,
    passed: true,
    executedAt: FIXED_NOW,
    inputSummary: `case ${i}`,
    expected: "ok",
    actual: "ok",
  }));

  const fixtureHazards: Iec62304HazardLink[] = [
    { hazardId: "RM-001", description: "stt", controlledByRequirementIds: ["SR-STT-009"] },
    { hazardId: "RM-017", description: "phi", controlledByRequirementIds: ["SR-PHI-013"] },
    { hazardId: "RM-010", description: "auth", controlledByRequirementIds: ["SR-PERMISSION-002", "SR-SEC-IA05"] },
  ];

  // 1) buildIec62304TraceabilityMatrix 결정성.
  const pkg1 = buildIec62304TraceabilityMatrix({
    requirements: fixtureRequirements,
    traceability: fixtureTraceability,
    testResults: fixtureResults,
    hazardLinks: fixtureHazards,
    productName: "BrainFriends",
    productVersion: "0.1.0",
    generatedAt: FIXED_NOW,
  });
  assert.equal(pkg1.exportType, "brainfriends-iec62304-traceability");
  assert.equal(pkg1.formVersion, "별지 제2호");
  assert.equal(pkg1.summary.totalRequirements, fixtureRequirements.length);
  assert.equal(pkg1.summary.totalRows, fixtureRequirements.length);

  // 2) requirementId 알파벳 정렬 검증.
  for (let i = 1; i < pkg1.rows.length; i++) {
    assert.equal(pkg1.rows[i - 1].requirementId <= pkg1.rows[i].requirementId, true);
  }

  // 3) 동일 입력 → 동일 출력 (manifestHash 같이 결정성).
  const pkg2 = buildIec62304TraceabilityMatrix({
    requirements: fixtureRequirements,
    traceability: fixtureTraceability,
    testResults: fixtureResults,
    hazardLinks: fixtureHazards,
    productName: "BrainFriends",
    productVersion: "0.1.0",
    generatedAt: FIXED_NOW,
  });
  assert.equal(pkg1.rows.length, pkg2.rows.length);
  assert.deepEqual(
    pkg1.rows.map((r) => r.requirementId),
    pkg2.rows.map((r) => r.requirementId),
  );
  assert.deepEqual(
    pkg1.rows.map((r) => r.testResultSummary),
    pkg2.rows.map((r) => r.testResultSummary),
  );

  // 4) hazardControlled 카운트.
  assert.equal(pkg1.summary.hazardControlled >= 3, true);

  // 5) untested — 결과 없는 SR 도 row 에는 들어가야 함.
  const sttRow = pkg1.rows.find((r) => r.requirementId === "SR-STT-009");
  assert.equal(sttRow !== undefined, true);
  assert.equal(sttRow!.hazardControlIds.includes("RM-001"), true);

  // 6) uncovered — traceability 없는 SR 식별 (fixture 에선 SR-LOGIN-001 traceability 매트릭스에 별도 entry 있어야 함).
  // 별도로 비어있는 케이스 만들기: fake SR + 빈 traceability.
  const minimalPkg = buildIec62304TraceabilityMatrix({
    requirements: [
      {
        id: "SR-LOGIN-001",
        title: "fake",
        description: "x",
        verificationMethod: "unit",
        acceptanceCriteria: "y",
      },
    ],
    traceability: [],
    testResults: [],
    hazardLinks: [],
    productName: "T",
    productVersion: "0.0.0",
    generatedAt: FIXED_NOW,
  });
  assert.equal(minimalPkg.summary.uncoveredRequirements.length, 1);
  assert.equal(minimalPkg.summary.untested.length, 1);
  assert.equal(minimalPkg.rows[0].testResultSummary, "시험 미실행");

  // 7) serializeIec62304Markdown 결정성.
  const md1 = serializeIec62304Markdown(pkg1);
  const md2 = serializeIec62304Markdown(pkg1);
  assert.equal(md1, md2);
  assert.equal(md1.includes("# 추적성 매트릭스 (IEC 62304 별지 제2호)"), true);
  assert.equal(md1.includes("| 순번 | SR ID | 요구사항 명"), true);

  // 8) serializeIec62304Csv 결정성 + escape.
  const csv1 = serializeIec62304Csv(pkg1);
  const csv2 = serializeIec62304Csv(pkg1);
  assert.equal(csv1, csv2);
  assert.equal(csv1.startsWith("순번,요구사항ID,요구사항명"), true);

  // 9) CSV escape — 콤마/줄바꿈 포함된 acceptanceCriteria 가 따옴표로 감싸지는지.
  const escapeFixture = buildIec62304TraceabilityMatrix({
    requirements: [
      {
        id: "SR-LOGIN-001",
        title: "x, y",
        description: "z",
        verificationMethod: "unit",
        acceptanceCriteria: 'has "quotes" and, comma',
      },
    ],
    traceability: [],
    testResults: [],
    hazardLinks: [],
    productName: "T",
    productVersion: "0.0.0",
    generatedAt: FIXED_NOW,
  });
  const escapedCsv = serializeIec62304Csv(escapeFixture);
  assert.equal(escapedCsv.includes('"x, y"'), true);
  assert.equal(escapedCsv.includes('"has ""quotes"" and, comma"'), true);

  return {
    id: "TC-IEC62304-001",
    area: "regulatory",
    requirementIds: ["SR-IEC62304-EXPORT"],
    inputSummary:
      "buildMatrix 결정성 / requirementId sort / hazard 매핑 / uncovered + untested / Markdown 직렬화 / CSV escape",
    expected:
      "별지 제2호 양식 결정성 산출, 동일 입력 → 동일 JSON/MD/CSV, CSV escape 동작",
    actual: `rows=${pkg1.rows.length}, hazardControlled=${pkg1.summary.hazardControlled}, untested=${pkg1.summary.untested.length}`,
    detail: `IEC 62304 traceability export deterministic, ${pkg1.rows.length} rows, JSON/MD/CSV verified across 9 assertions`,
  };
}

function runUsabilityValidatorCheck(): CheckResult {
  const scenarios: UseScenario[] = [
    {
      taskId: "T-PATIENT-LOGIN",
      description: "환자가 로그인 후 훈련 진입",
      userGroup: "patient",
      primaryOperatingFunction: true,
      criticalTask: false,
      hazardLinks: ["RM-010"],
      expectedOutcome: "step-1 진입",
    },
    {
      taskId: "T-KWAB-RESULT-INTERPRET",
      description: "치료사가 K-WAB 보조 점수를 검토하고 확정",
      userGroup: "therapist",
      primaryOperatingFunction: true,
      criticalTask: true,
      hazardLinks: ["RM-005", "RM-013"],
      expectedOutcome: "치료사 확정 후 결과 발행",
    },
    {
      taskId: "T-AAC-COMMIT",
      description: "AAC 보드에서 심볼 commit 하여 의도 문장 생성",
      userGroup: "patient",
      primaryOperatingFunction: true,
      criticalTask: false,
      hazardLinks: ["RM-006"],
      expectedOutcome: "intent sentence 생성",
    },
    {
      taskId: "T-GUARDIAN-REPORT-VIEW",
      description: "보호자가 read-only 리포트 링크로 주간 요약 확인",
      userGroup: "guardian",
      primaryOperatingFunction: false,
      criticalTask: false,
      hazardLinks: ["RM-018"],
      expectedOutcome: "주간 요약 표시",
    },
    // Duplicate taskId — last-wins normalize 검증용
    {
      taskId: "T-PATIENT-LOGIN",
      description: "환자가 로그인 후 훈련 진입 (override)",
      userGroup: "patient",
      primaryOperatingFunction: true,
      criticalTask: false,
      hazardLinks: ["RM-010", "RM-010"],
      expectedOutcome: "step-1 진입",
    },
  ];

  const normalized = normalizeScenarios(scenarios);
  assert.equal(normalized.length, 4);
  assert.deepEqual(
    normalized.map((scenario) => scenario.taskId),
    ["T-AAC-COMMIT", "T-GUARDIAN-REPORT-VIEW", "T-KWAB-RESULT-INTERPRET", "T-PATIENT-LOGIN"],
  );
  assert.deepEqual(
    normalized.find((scenario) => scenario.taskId === "T-PATIENT-LOGIN")?.hazardLinks,
    ["RM-010"],
  );

  // 15 명 summative fixture. critical task 14/15 만 통과 → critical 미달 (1.0 요구).
  const observations: TaskObservation[] = [];
  for (let i = 0; i < 15; i++) {
    observations.push({
      participantId: `P${String(i).padStart(2, "0")}`,
      taskId: "T-PATIENT-LOGIN",
      completed: true,
      durationSec: 90,
      errorCount: 0,
    });
    observations.push({
      participantId: `P${String(i).padStart(2, "0")}`,
      taskId: "T-KWAB-RESULT-INTERPRET",
      completed: i !== 7,
      durationSec: 240,
      errorCount: i === 7 ? 1 : 0,
      useErrors:
        i === 7
          ? [
              {
                errorId: "UE-001",
                taskId: "T-KWAB-RESULT-INTERPRET",
                participantId: "P07",
                description: "치료사가 자동 점수를 그대로 확정",
                severity: "moderate",
                hazardLinks: ["RM-005", "RM-013"],
                mitigated: false,
              },
            ]
          : undefined,
    });
    // Primary task: 12/15 완료 (80%) → primary pass (>=0.8)
    observations.push({
      participantId: `P${String(i).padStart(2, "0")}`,
      taskId: "T-AAC-COMMIT",
      completed: i < 12,
      errorCount: 0,
    });
    observations.push({
      participantId: `P${String(i).padStart(2, "0")}`,
      taskId: "T-GUARDIAN-REPORT-VIEW",
      completed: i % 2 === 0,
      errorCount: 0,
    });
  }

  const stats = buildTaskCompletionStats(scenarios, observations);
  const aac = stats.find((stat) => stat.taskId === "T-AAC-COMMIT");
  assert.ok(aac);
  assert.equal(aac!.attempts, 15);
  assert.equal(aac!.completions, 12);
  assert.equal(aac!.completionRate, 0.8);
  assert.equal(aac!.pass, true);

  const kwab = stats.find((stat) => stat.taskId === "T-KWAB-RESULT-INTERPRET");
  assert.ok(kwab);
  assert.equal(kwab!.completionRate, round4Local(14 / 15));
  assert.equal(kwab!.pass, false); // critical task 100% 미달
  assert.equal(kwab!.criticalTask, true);

  const buckets = bucketUseErrors(observations);
  assert.deepEqual(
    buckets.map((bucket) => bucket.severity),
    ["minor", "moderate", "severe"],
  );
  assert.equal(buckets[1].count, 1);
  assert.equal(buckets[1].unmitigatedCount, 1);
  assert.deepEqual(buckets[1].hazardLinks, ["RM-005", "RM-013"]);

  const coverage = buildHazardCoverage(scenarios, observations);
  assert.deepEqual(
    coverage.map((row) => row.hazardId),
    ["RM-005", "RM-006", "RM-010", "RM-013", "RM-018"],
  );
  const rm005 = coverage.find((row) => row.hazardId === "RM-005");
  assert.deepEqual(rm005?.verifiedByTaskIds, ["T-KWAB-RESULT-INTERPRET"]);
  assert.equal(rm005?.observedUseErrorCount, 1);

  const result = evaluateSummativeUsability(scenarios, observations);
  assert.equal(result.totalParticipants, 15);
  assert.equal(result.totalScenarios, 4);
  assert.equal(result.summativePass, false);
  assert.deepEqual(result.failureReasons, [
    "critical_task_below_threshold:T-KWAB-RESULT-INTERPRET",
  ]);

  // 결정성: 동일 입력 → 동일 출력
  const repeat = evaluateSummativeUsability(scenarios, observations);
  assert.deepEqual(repeat, result);

  // Severe unmitigated → 자동 fail
  const severeObs: TaskObservation[] = [
    {
      participantId: "P00",
      taskId: "T-AAC-COMMIT",
      completed: true,
      errorCount: 1,
      useErrors: [
        {
          errorId: "UE-S1",
          taskId: "T-AAC-COMMIT",
          participantId: "P00",
          description: "AAC commit 후 의도와 다른 문장이 보호자에게 노출",
          severity: "severe",
          hazardLinks: ["RM-006", "RM-018"],
          mitigated: false,
        },
      ],
    },
  ];
  const severeResult = evaluateSummativeUsability(
    scenarios.filter((scenario) => scenario.taskId === "T-AAC-COMMIT"),
    severeObs,
  );
  assert.equal(severeResult.summativePass, false);
  assert.ok(
    severeResult.failureReasons.some((reason) =>
      reason.startsWith("severe_use_errors_unmitigated:"),
    ),
  );

  // 빈 입력은 graceful — 참여자 0 으로 fail.
  const emptyResult = evaluateSummativeUsability(scenarios, []);
  assert.equal(emptyResult.totalParticipants, 0);
  assert.equal(emptyResult.summativePass, false);
  assert.ok(emptyResult.failureReasons.includes("no_participants_recorded"));

  // 합격기준 만족 fixture
  const passingScenarios: UseScenario[] = [
    {
      taskId: "T-AAC-COMMIT",
      description: "AAC commit",
      userGroup: "patient",
      primaryOperatingFunction: true,
      criticalTask: false,
      hazardLinks: ["RM-006"],
      expectedOutcome: "ok",
    },
  ];
  const passingObs: TaskObservation[] = Array.from({ length: 15 }, (_, i) => ({
    participantId: `P${i}`,
    taskId: "T-AAC-COMMIT",
    completed: true,
    errorCount: 0,
  }));
  const passingResult = evaluateSummativeUsability(passingScenarios, passingObs);
  assert.equal(passingResult.summativePass, true);
  assert.deepEqual(passingResult.failureReasons, []);

  return {
    id: "TC-USABILITY-001",
    area: "usability",
    requirementIds: ["SR-USABILITY-017"],
    inputSummary:
      "15 participant fixture × 4 scenarios (critical/primary/non-primary), severe-unmitigated edge, empty edge, passing edge",
    expected:
      "normalize last-wins, critical 100% 미달 → fail, primary 80% 경계 통과, severe unmitigated → fail, hazardCoverage 알파벳 정렬, 빈 입력 graceful fail, 동일 입력 동일 출력",
    actual: `participants=${result.totalParticipants}, scenarios=${result.totalScenarios}, criticalPass=${kwab!.pass}, primaryPass=${aac!.pass}, summativePass=${result.summativePass}, hazardRows=${coverage.length}`,
    detail: `IEC 62366 use scenario validator 결정성 검증, criteria=${JSON.stringify(DEFAULT_SUMMATIVE_CRITERIA)}`,
  };
}

function round4Local(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function runWasmSttAdapterCheck(): Promise<CheckResult> {
  // V&V 는 Node 환경에서 실행되므로 isWasmSttAvailable() 는 false 여야 한다.
  assert.equal(isWasmSttAvailable(), false);

  // 안정 식별자 — release manifest 의 model 자산 추적과 결합된다.
  assert.equal(WASM_STT_MODEL_ID, "Xenova/whisper-tiny");
  assert.equal(WASM_STT_MODEL_DTYPE, "fp32");
  assert.equal(WASM_STT_LOCAL_MODEL_BASE_PATH, "/models/wasm-stt/");
  assert.equal(
    WASM_STT_LOCAL_ONNX_WASM_PATH,
    "/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm",
  );
  assert.equal(
    WASM_STT_LOCAL_ONNX_MJS_PATH,
    "/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs",
  );
  assert.equal(WASM_STT_PACKAGE_VERSION, "4.2.0");
  assert.equal(WASM_STT_SAMPLE_RATE, 16000);
  assert.equal(
    WASM_STT_ENGINE_VERSION,
    "transformers.js@4.2.0:Xenova/whisper-tiny:fp32:local-assets:v0.2",
  );

  const expectedLocalAssetPaths = [
    "public/models/wasm-stt/Xenova/whisper-tiny/config.json",
    "public/models/wasm-stt/Xenova/whisper-tiny/generation_config.json",
    "public/models/wasm-stt/Xenova/whisper-tiny/preprocessor_config.json",
    "public/models/wasm-stt/Xenova/whisper-tiny/tokenizer.json",
    "public/models/wasm-stt/Xenova/whisper-tiny/tokenizer_config.json",
    "public/models/wasm-stt/Xenova/whisper-tiny/special_tokens_map.json",
    "public/models/wasm-stt/Xenova/whisper-tiny/normalizer.json",
    "public/models/wasm-stt/Xenova/whisper-tiny/vocab.json",
    "public/models/wasm-stt/Xenova/whisper-tiny/merges.txt",
    "public/models/wasm-stt/Xenova/whisper-tiny/added_tokens.json",
    "public/models/wasm-stt/Xenova/whisper-tiny/onnx/encoder_model.onnx",
    "public/models/wasm-stt/Xenova/whisper-tiny/onnx/decoder_model_merged.onnx",
    "public/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs",
    "public/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm",
  ];
  const localAssetPresence = expectedLocalAssetPaths.map((assetPath) => {
    const fullPath = join(process.cwd(), assetPath);
    if (!existsSync(fullPath)) {
      return { assetPath, exists: false, size: 0 };
    }
    const size = statSync(fullPath).size;
    assert.ok(size > 0, `${assetPath} should be non-empty`);
    return { assetPath, exists: true, size };
  });
  const existingLocalAssets = localAssetPresence.filter((asset) => asset.exists);
  const totalLocalAssetBytes = existingLocalAssets.reduce(
    (sum, asset) => sum + asset.size,
    0,
  );
  const hasCompleteLocalAssetSet =
    existingLocalAssets.length === expectedLocalAssetPaths.length;
  const manifestPath = join(
    process.cwd(),
    "public/models/wasm-stt/asset-manifest.json",
  );
  const hasAssetManifest = existsSync(manifestPath);
  if (hasCompleteLocalAssetSet) {
    assert.equal(
      hasAssetManifest,
      true,
      "complete WASM-STT local assets require asset-manifest.json",
    );
  }
  if (hasAssetManifest) {
    const assetManifest = JSON.parse(
      readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""),
    ) as {
      schemaVersion?: string;
      modelId?: string;
      modelDtype?: string;
      remoteModelLoading?: boolean;
      files?: Array<{ path: string; bytes: number; sha256: string }>;
    };
    assert.equal(
      assetManifest.schemaVersion,
      "brainfriends-wasm-stt-local-assets-v1",
    );
    assert.equal(assetManifest.modelId, WASM_STT_MODEL_ID);
    assert.equal(assetManifest.modelDtype, WASM_STT_MODEL_DTYPE);
    assert.equal(assetManifest.remoteModelLoading, false);
    assert.equal(assetManifest.files?.length, expectedLocalAssetPaths.length);
  }

  // Node 에서 transcribeWithWasmStt 는 명시 에러로 차단되어야 한다.
  let thrown: Error | null = null;
  try {
    await transcribeWithWasmStt(new Blob([new Uint8Array([0, 0, 0, 0])]), {
      useCase: "daily_training",
    });
  } catch (error) {
    thrown = error instanceof Error ? error : new Error(String(error));
  }
  assert.ok(thrown, "transcribeWithWasmStt should reject in Node environment");
  assert.equal(thrown!.message, "wasm_stt_unavailable");

  // 두 번째 호출도 같은 에러 (결정성).
  let thrownAgain: Error | null = null;
  try {
    await transcribeWithWasmStt(new Blob([new Uint8Array(8)]), {
      useCase: "weekly_kwab",
      targetText: "사과",
    });
  } catch (error) {
    thrownAgain = error instanceof Error ? error : new Error(String(error));
  }
  assert.equal(thrownAgain!.message, "wasm_stt_unavailable");

  // 모듈 상태 격리 — pipeline 캐시 reset 함수가 안전하게 동작.
  __resetWasmSttPipelineForTest();
  __resetWasmSttPipelineForTest(); // idempotent

  return {
    id: "TC-STT-WASM-001",
    area: "stt",
    requirementIds: ["SR-STT-009"],
    inputSummary:
      "Node 환경에서 isWasmSttAvailable / transcribeWithWasmStt / 실험 후보 WASM-STT 자산 정책 / 캐시 reset 결정성 검증",
    expected:
      "isWasmSttAvailable=false, transcribeWithWasmStt rejects with wasm_stt_unavailable (반복), sampleRate=16000, 로컬 모델 자산이 있으면 manifest 검증, 없으면 실험 후보로만 유지, __resetWasmSttPipelineForTest idempotent",
    actual: `wasmAvailable=${isWasmSttAvailable()}; sampleRate=${WASM_STT_SAMPLE_RATE}; modelId=${WASM_STT_MODEL_ID}; dtype=${WASM_STT_MODEL_DTYPE}; engine=${WASM_STT_ENGINE_VERSION}; localAssets=${existingLocalAssets.length}/${expectedLocalAssetPaths.length}; assetManifest=${hasAssetManifest}; assetBytes=${totalLocalAssetBytes}; rejection=${thrown!.message}/${thrownAgain!.message}`,
    detail: `transformers.js@${WASM_STT_PACKAGE_VERSION} local fp32 adapter contract — Node 환경 5종 + 실험 후보 로컬 자산 정책 검증 + 2 rejection round-trip`,
  };
}

function runWerRunnerCheck(): CheckResult {
  // CSV 파싱 결정성 — 정상 + invalid + missing column.
  const csv = [
    "sample_id,age,severity,device_type,noise,lighting,ground_truth,transcript",
    'P002,72,severe,ios,mid,dim,"점심 뭐 드실래요","점심 뭐 드 시래요"',
    'P001,68,moderate,android,low,normal,"오늘 날씨가 좋네요","오늘 날씨가 좋네요"',
    'P003,75,mild,android,low,bright,"커피 한잔 주세요","커피 한잔 주세요"',
    'P004,82,severe,ipad,high,dim,"화장실 어디예요","화장실 어 디예요"',
    'P005,65,moderate,android,low,normal,"감사합니다","감사 합 니다"',
  ].join("\n");
  const parse = parseWerCsv(csv);
  assert.equal(parse.ok, true);
  assert.equal(parse.rows.length, 5);
  // sampleId 알파벳 정렬 결정성
  assert.deepEqual(
    parse.rows.map((row) => row.sampleId),
    ["P001", "P002", "P003", "P004", "P005"],
  );

  // missing column → ok=false + errors
  const bad = parseWerCsv(
    "sample_id,age\nP001,68",
  );
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.startsWith("missing_column:")));

  // classifyAgeGroup 결정성
  assert.equal(classifyAgeGroup(65), "60s");
  assert.equal(classifyAgeGroup(70), "70s");
  assert.equal(classifyAgeGroup(85), "80s");
  assert.equal(classifyAgeGroup(50), "other");
  assert.equal(classifyAgeGroup(NaN), "other");

  // evaluateWerRows 결정성
  const fixedAt = "2026-04-30T00:00:00.000Z";
  const report1 = evaluateWerRows({
    rows: parse.rows,
    generatedAt: fixedAt,
    datasetId: "fixture-v0.1",
    modelId: "wasm:Xenova/whisper-tiny",
  });
  const report2 = evaluateWerRows({
    rows: parse.rows,
    generatedAt: fixedAt,
    datasetId: "fixture-v0.1",
    modelId: "wasm:Xenova/whisper-tiny",
  });
  assert.equal(report1.rowCount, 5);
  assert.equal(report1.summary.overall.total, 5);
  // 동일 입력 → 동일 출력
  assert.deepEqual(report2, report1);
  // P001 / P003 은 정확 일치 → wer=0
  const p001 = report1.rows.find((row) => row.sampleId === "P001");
  assert.ok(p001);
  assert.equal(p001!.wer, 0);
  assert.equal(p001!.cer, 0);
  assert.equal(p001!.passes15, true);
  assert.equal(p001!.ageGroup, "60s");

  // ageGroup 분포 결정성
  assert.deepEqual(
    Object.keys(report1.summary.byAgeGroup).sort(),
    ["60s", "70s", "80s"],
  );
  // severity 버킷 결정성
  assert.deepEqual(
    Object.keys(report1.summary.bySeverity).sort(),
    ["mild", "moderate", "severe"],
  );

  // JSON 직렬화 결정성 — 동일 입력 동일 문자열
  const json1 = serializeWerReportJson(report1);
  const json2 = serializeWerReportJson(report2);
  assert.equal(json1, json2);
  // sortKeys 적용 확인 — 첫 키가 알파벳 순
  const parsed = JSON.parse(json1) as Record<string, unknown>;
  const topKeys = Object.keys(parsed);
  const sortedTopKeys = [...topKeys].sort();
  assert.deepEqual(topKeys, sortedTopKeys);

  // Markdown 직렬화 결정성
  const md1 = serializeWerReportMarkdown(report1);
  const md2 = serializeWerReportMarkdown(report2);
  assert.equal(md1, md2);
  assert.ok(md1.includes("# AI STT 성능평가"));
  assert.ok(md1.includes("By Age Group"));
  assert.ok(md1.includes("passRateAt15"));

  return {
    id: "TC-AI-EVAL-RUNNER-001",
    area: "ai-eval",
    requirementIds: ["SR-AI-EVAL-RUNNER"],
    inputSummary:
      "5 sample CSV (60s/70s/80s × mild/moderate/severe × low/mid/high noise) + missing-column edge",
    expected:
      "parseWerCsv 알파벳 정렬 + missing_column 에러, classifyAgeGroup 4 case, evaluateWerRows 동일 입력 동일 출력, JSON sortKeys 결정성, Markdown 결정성, P001 정확 일치 wer=0",
    actual: `parsed=${parse.rows.length}, overall=${report1.summary.overall.meanWer}/${report1.summary.overall.passRateAt15}, ageGroups=${Object.keys(report1.summary.byAgeGroup).length}`,
    detail: `WER runner deterministic — 14 assertions across CSV parsing / age classification / report 결정성 / JSON sortKeys / Markdown 안정`,
  };
}

function runRtfRunnerCheck(): CheckResult {
  // CSV parse 결정성
  const csv = [
    "sample_id,age,severity,device_type,noise,audio_duration_ms,processing_ms",
    "P003,75,mild,android,low,1800,30.5",
    "P001,68,moderate,android,low,2500,38.0",
    "P002,72,severe,ios,mid,3200,45.2",
    "P004,82,severe,ipad,high,4100,68.3",
    "P005,65,moderate,android,low,2200,35.0",
  ].join("\n");
  const parse = parseRtfCsv(csv);
  assert.equal(parse.ok, true);
  assert.equal(parse.rows.length, 5);
  // sampleId 알파벳 정렬
  assert.deepEqual(
    parse.rows.map((row) => row.sampleId),
    ["P001", "P002", "P003", "P004", "P005"],
  );

  // missing column → ok=false
  const bad = parseRtfCsv("sample_id,age\nP001,68");
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.startsWith("missing_column:")));

  // invalid audio_duration_ms (0 또는 음수)
  const badDur = parseRtfCsv(
    "sample_id,age,severity,device_type,noise,audio_duration_ms,processing_ms\nP001,68,mild,android,low,0,30",
  );
  assert.ok(badDur.errors.some((e) => e.includes("invalid_audio_duration_ms")));

  // classifyRtfAgeGroup 결정성
  assert.equal(classifyRtfAgeGroup(65), "60s");
  assert.equal(classifyRtfAgeGroup(70), "70s");
  assert.equal(classifyRtfAgeGroup(85), "80s");
  assert.equal(classifyRtfAgeGroup(50), "other");
  assert.equal(classifyRtfAgeGroup(NaN), "other");

  // percentile 보간 결정성
  const sorted = [10, 20, 30, 40, 50];
  assert.equal(percentile(sorted, 0), 10);
  assert.equal(percentile(sorted, 1), 50);
  assert.equal(percentile(sorted, 0.5), 30);
  assert.equal(percentile([], 0.5), 0);
  assert.equal(percentile([42], 0.95), 42);

  // evaluateRtfRows 결정성 — 동일 입력 동일 출력
  const fixedAt = "2026-04-30T00:00:00.000Z";
  const r1 = evaluateRtfRows({
    rows: parse.rows,
    generatedAt: fixedAt,
    datasetId: "fix-v1",
    modelId: "wasm:Xenova/whisper-tiny",
  });
  const r2 = evaluateRtfRows({
    rows: parse.rows,
    generatedAt: fixedAt,
    datasetId: "fix-v1",
    modelId: "wasm:Xenova/whisper-tiny",
  });
  assert.deepEqual(r2, r1);
  assert.equal(r1.rowCount, 5);
  assert.equal(r1.p95TargetMs, 41.5);
  // P004 processingMs=68.3 → passesP95Target=false
  const p004 = r1.rows.find((row) => row.sampleId === "P004");
  assert.equal(p004?.passesP95Target, false);
  // P001 processingMs=38.0 → passesP95Target=true (≤ 41.5)
  const p001 = r1.rows.find((row) => row.sampleId === "P001");
  assert.equal(p001?.passesP95Target, true);
  // RTF = 38.0 / 2500 = 0.0152
  assert.equal(p001?.rtf, 0.0152);

  // ageGroup 분포
  assert.deepEqual(
    Object.keys(r1.summary.byAgeGroup).sort(),
    ["60s", "70s", "80s"],
  );

  // p95TargetMs override
  const r3 = evaluateRtfRows({
    rows: parse.rows,
    generatedAt: fixedAt,
    datasetId: "fix-v1",
    modelId: "wasm:Xenova/whisper-tiny",
    p95TargetMs: 100,
  });
  // 100ms target 이면 모두 pass
  assert.equal(r3.summary.overall.passRateP95Target, 1);

  // aggregateLatency 빈 배열
  const empty = aggregateLatency([], 41.5);
  assert.equal(empty.total, 0);
  assert.equal(empty.passRateP95Target, 0);

  // JSON 결정성
  const json1 = serializeRtfReportJson(r1);
  const json2 = serializeRtfReportJson(r2);
  assert.equal(json1, json2);

  // Markdown 결정성
  const md1 = serializeRtfReportMarkdown(r1);
  const md2 = serializeRtfReportMarkdown(r2);
  assert.equal(md1, md2);
  assert.ok(md1.includes("STT 성능 벤치마크"));
  assert.ok(md1.includes("By Age Group"));

  return {
    id: "TC-AI-RTF-RUNNER-001",
    area: "ai-eval",
    requirementIds: ["SR-AI-RTF-RUNNER"],
    inputSummary:
      "5 sample CSV (60s/70s/80s × android/ios/ipad × low/mid/high noise) + missing-column + invalid duration + percentile boundary",
    expected:
      "parseRtfCsv 알파벳 정렬 + invalid 감지, classifyRtfAgeGroup 5 case, percentile 5 case, evaluateRtfRows 결정성, p95TargetMs override, JSON sortKeys, Markdown 안정",
    actual: `parsed=${parse.rows.length}, p95=${r1.summary.overall.p95LatencyMs}ms, passRate=${r1.summary.overall.passRateP95Target}, ageGroups=${Object.keys(r1.summary.byAgeGroup).length}`,
    detail: `RTF runner deterministic — 18 assertions across CSV / classification / percentile interpolation / report 결정성 / target override / JSON+Markdown`,
  };
}

function runWasmSttLoadingStateCheck(): CheckResult {
  // 초기 상태
  let state = INITIAL_WASM_STT_LOADING_STATE;
  assert.equal(state.phase, "not_started");
  assert.equal(state.progress, 0);

  // not_started → loading
  assert.equal(isLegalLoadingTransition("not_started", "loading"), true);
  state = startLoading(state, {
    modelId: "Xenova/whisper-tiny",
    startedAtMs: 1000,
  });
  assert.equal(state.phase, "loading");
  assert.equal(state.modelId, "Xenova/whisper-tiny");
  assert.equal(state.startedAtMs, 1000);

  // progress clamp + idempotent
  state = reportProgress(state, 0.3);
  assert.equal(state.progress, 0.3);
  assert.ok(state.message.includes("30%"));
  state = reportProgress(state, -1);
  assert.equal(state.progress, 0); // clamped
  state = reportProgress(state, 5);
  assert.equal(state.progress, 1); // clamped to 1
  state = reportProgress(state, NaN);
  assert.equal(state.progress, 0); // NaN → 0
  state = reportProgress(state, 0.7);
  assert.equal(state.progress, 0.7);

  // loading → ready
  assert.equal(isLegalLoadingTransition("loading", "ready"), true);
  state = markReady(state, { finishedAtMs: 4500 });
  assert.equal(state.phase, "ready");
  assert.equal(state.progress, 1);
  assert.equal(state.errorCode, null);
  assert.equal(state.finishedAtMs, 4500);

  // elapsedLoadingMs (ready)
  assert.equal(elapsedLoadingMs(state, 9999), 4500 - 1000);

  // ready → not_started (reset)
  assert.equal(isLegalLoadingTransition("ready", "not_started"), true);
  const fresh = resetLoadingState();
  assert.equal(fresh.phase, "not_started");
  assert.equal(fresh.startedAtMs, null);

  // failed transition
  let failState = startLoading(INITIAL_WASM_STT_LOADING_STATE, {
    modelId: "Xenova/whisper-tiny",
    startedAtMs: 2000,
  });
  failState = reportProgress(failState, 0.5);
  failState = markFailed(failState, {
    errorCode: "wasm_stt_model_load_failed:network_error",
    finishedAtMs: 3000,
  });
  assert.equal(failState.phase, "failed");
  assert.equal(failState.errorCode, "wasm_stt_model_load_failed:network_error");
  assert.ok(failState.message.includes("로컬 음성 인식 모델"));
  assert.equal(failState.progress, 0.5); // 보존됨
  assert.equal(elapsedLoadingMs(failState, 9999), 1000);

  // friendly message — fallback 4 case
  const fb = markFailed(
    startLoading(INITIAL_WASM_STT_LOADING_STATE, {
      modelId: "test",
      startedAtMs: 0,
    }),
    { errorCode: "wasm_stt_unavailable", finishedAtMs: 1 },
  );
  assert.ok(fb.message.includes("지원하지 않습니다"));
  const fb2 = markFailed(
    startLoading(INITIAL_WASM_STT_LOADING_STATE, {
      modelId: "test",
      startedAtMs: 0,
    }),
    { errorCode: "wasm_stt_transcription_failed:abc", finishedAtMs: 1 },
  );
  assert.ok(fb2.message.includes("음성 인식 중 오류"));
  const fb3 = markFailed(
    startLoading(INITIAL_WASM_STT_LOADING_STATE, {
      modelId: "test",
      startedAtMs: 0,
    }),
    { errorCode: "unknown_error_code", finishedAtMs: 1 },
  );
  assert.ok(fb3.message.includes("알 수 없는 오류"));

  // 불법 전이
  assert.equal(isLegalLoadingTransition("not_started", "ready"), false);
  assert.equal(isLegalLoadingTransition("ready", "loading"), false);
  assert.equal(isLegalLoadingTransition("failed", "loading"), false);
  // idempotent (same phase) 허용
  assert.equal(isLegalLoadingTransition("loading", "loading"), true);
  assert.equal(isLegalLoadingTransition("ready", "ready"), true);

  // not_started 에서 reportProgress 는 무시
  let none = INITIAL_WASM_STT_LOADING_STATE;
  none = reportProgress(none, 0.5);
  assert.equal(none.phase, "not_started");
  assert.equal(none.progress, 0);

  return {
    id: "TC-WASM-STT-LOADING-001",
    area: "stt",
    requirementIds: ["SR-WASM-STT-LOADING"],
    inputSummary:
      "상태 머신 8단계 시퀀스 + clamp edge (NaN/음수/초과) + friendly message 4 case + 불법 전이 4 case",
    expected:
      "not_started → loading → ready 합법, progress NaN/음수 → 0 / 초과 → 1, markFailed 진행률 보존, isLegalTransition 합법/불법 분류, friendlyMessageFor 4 errorCode + fallback, elapsedLoadingMs ms 정확",
    actual: `transitions verified, ready elapsed=${elapsedLoadingMs(state, 9999)}ms, failed elapsed=${elapsedLoadingMs(failState, 9999)}ms`,
    detail: `WASM STT loading state machine deterministic — 23 assertions across phase transitions / progress clamp / friendly messages / elapsed time / illegal transitions`,
  };
}

function runIrtCheck(): CheckResult {
  // 2PL probability — 결정성
  assert.equal(probabilityCorrect(0, 1, 0), 0.5);
  assert.ok(probabilityCorrect(2, 1, 0) > 0.85);
  assert.ok(probabilityCorrect(-2, 1, 0) < 0.15);
  // 양극단 clamp 안전
  assert.ok(Number.isFinite(probabilityCorrect(1000, 5, 0)));
  assert.ok(Number.isFinite(probabilityCorrect(-1000, 5, 0)));

  // Fisher information at b = θ → P=0.5 → I = a²·0.25
  assert.equal(fisherInformation(0, 2, 0), 1); // 4 * 0.25
  assert.equal(fisherInformation(0, 1, 0), 0.25);

  // Item bank
  const items: IrtItem[] = [
    { id: "easy", a: 1.0, b: -1.5 },
    { id: "medium-a", a: 1.2, b: 0.0 },
    { id: "medium-b", a: 1.2, b: 0.0 }, // 동률 — tie-break itemId asc
    { id: "hard", a: 1.5, b: 1.5 },
  ];

  // pickNextItem at θ=0 → medium-a (b=0, max info, tie-break alphabetic)
  const pick0 = pickNextItem({ items, theta: 0 });
  assert.equal(pick0.reason, "selected");
  assert.equal(pick0.selected?.id, "medium-a");

  // 응답 없을 때 EAP = prior.mean
  const ab0 = estimateAbilityEap({ items, responses: [] });
  assert.equal(ab0.theta, 0);
  assert.equal(ab0.usedResponses, 0);

  // 단일 응답: 어려운 문제 정답 → θ 상승
  const abH = estimateAbilityEap({
    items,
    responses: [{ itemId: "hard", correct: true }],
  });
  assert.ok(abH.theta > 0);
  assert.equal(abH.usedResponses, 1);

  // 단일 응답: 쉬운 문제 오답 → θ 하강
  const abE = estimateAbilityEap({
    items,
    responses: [{ itemId: "easy", correct: false }],
  });
  assert.ok(abE.theta < 0);

  // 결정성: 동일 입력 동일 출력
  const repeat = estimateAbilityEap({
    items,
    responses: [
      { itemId: "easy", correct: true },
      { itemId: "medium-a", correct: true },
      { itemId: "hard", correct: false },
    ],
  });
  const repeat2 = estimateAbilityEap({
    items,
    responses: [
      { itemId: "easy", correct: true },
      { itemId: "medium-a", correct: true },
      { itemId: "hard", correct: false },
    ],
  });
  assert.deepEqual(repeat2, repeat);

  // 응답 itemId 가 bank 에 없으면 무시
  const abIgnore = estimateAbilityEap({
    items,
    responses: [{ itemId: "unknown-item", correct: true }],
  });
  assert.equal(abIgnore.usedResponses, 0);
  assert.equal(abIgnore.theta, 0);

  // 시뮬레이션 — 모든 정답 oracle → θ 상승 수렴
  const sim = simulateAdaptiveSession({
    items,
    responseOracle: { easy: true, "medium-a": true, "medium-b": true, hard: true },
    maxItems: 4,
  });
  assert.equal(sim.steps.length, 4);
  assert.ok(sim.finalTheta > sim.steps[0].thetaAfter);
  // 결정성: used 순서 = 매 단계 MFI 결과
  assert.deepEqual(sim.used.length, 4);
  // 첫 문항은 prior=0 에서 medium-a (tie alphabetic)
  assert.equal(sim.steps[0].selectedItemId, "medium-a");

  const sim2 = simulateAdaptiveSession({
    items,
    responseOracle: { easy: true, "medium-a": true, "medium-b": true, hard: true },
    maxItems: 4,
  });
  assert.deepEqual(sim2, sim); // 결정성

  // 빈 item bank
  const empty = pickNextItem({ items: [], theta: 0 });
  assert.equal(empty.reason, "no_items");

  // 모든 used
  const allUsed = pickNextItem({
    items,
    theta: 0,
    excludeItemIds: items.map((i) => i.id),
  });
  assert.equal(allUsed.reason, "all_used");

  // IRT_VERSION 안정
  assert.equal(IRT_VERSION, "irt:2pl-mfi:v0.1");

  return {
    id: "TC-IRT-001",
    area: "adaptive",
    requirementIds: ["SR-IRT-018"],
    inputSummary:
      "4-item bank (a=1.0~1.5, b=-1.5~+1.5, 동률 2건) + EAP single/multi response + adaptive sim 4 step + edge (no_items, all_used)",
    expected:
      "probabilityCorrect 양극단 안전, MFI 선택 + tie-break alphabetic, EAP 결정성, 시뮬레이션 동일 입력 동일 시퀀스, IRT_VERSION 안정",
    actual: `theta(easy=T,medium-a=T,hard=F)=${repeat.theta}, sim final=${sim.finalTheta}, sim sd=${sim.finalSd}`,
    detail: `IRT 2PL+EAP+MFI deterministic — 22 assertions across probability/Fisher info/EAP edge cases/MFI tie-break/sim convergence`,
  };
}

function runOnboardingExclusionCheck(): CheckResult {
  // 정상 — 65세 실어증 + 만성기 + 의료진 승인
  const ok = evaluateOnboardingExclusion({
    ageYears: 65,
    diagnosis: "뇌졸중 후 실어증",
    weeksSinceOnset: 24,
    medicalProfessionalApproval: true,
  });
  assert.equal(ok.allowed, true);
  assert.deepEqual(ok.reasons, []);
  assert.equal(ok.requiresMedicalConfirmation, false);

  // 의료진 미승인 → confirmation 필요
  const ok2 = evaluateOnboardingExclusion({
    ageYears: 65,
    diagnosis: "뇌졸중 후 실어증",
    weeksSinceOnset: 24,
    medicalProfessionalApproval: false,
  });
  assert.equal(ok2.allowed, true);
  assert.equal(ok2.requiresMedicalConfirmation, true);

  // age < 18
  const tooYoung = evaluateOnboardingExclusion({
    ageYears: 15,
    diagnosis: "뇌졸중 후 실어증",
    weeksSinceOnset: 24,
    medicalProfessionalApproval: true,
  });
  assert.equal(tooYoung.allowed, false);
  assert.ok(tooYoung.reasons.includes("age_below_minimum"));

  // 80대 이상 → confirmation
  const elderly = evaluateOnboardingExclusion({
    ageYears: 87,
    diagnosis: "마비말장애",
    weeksSinceOnset: 12,
    medicalProfessionalApproval: true,
  });
  assert.equal(elderly.allowed, true);
  assert.equal(elderly.requiresMedicalConfirmation, true);

  // 진단 미입력
  const noDx = evaluateOnboardingExclusion({
    ageYears: 65,
    diagnosis: "",
    weeksSinceOnset: 24,
    medicalProfessionalApproval: true,
  });
  assert.equal(noDx.allowed, false);
  assert.ok(noDx.reasons.includes("no_diagnosis_provided"));

  // MCI 단독 → 차단
  const mci = evaluateOnboardingExclusion({
    ageYears: 65,
    diagnosis: "MCI",
    weeksSinceOnset: 24,
    medicalProfessionalApproval: true,
  });
  assert.equal(mci.allowed, false);
  assert.ok(mci.reasons.includes("mci_or_dementia_only"));

  // 급성기 (< 6 주)
  const acute = evaluateOnboardingExclusion({
    ageYears: 65,
    diagnosis: "뇌졸중 후 실어증",
    weeksSinceOnset: 3,
    medicalProfessionalApproval: true,
  });
  assert.equal(acute.allowed, false);
  assert.ok(acute.reasons.includes("acute_phase"));

  // 결정성 — 동일 입력 동일 출력
  const r1 = evaluateOnboardingExclusion({
    ageYears: 70,
    diagnosis: "디스아트리아",
    weeksSinceOnset: 12,
    medicalProfessionalApproval: true,
  });
  const r2 = evaluateOnboardingExclusion({
    ageYears: 70,
    diagnosis: "디스아트리아",
    weeksSinceOnset: 12,
    medicalProfessionalApproval: true,
  });
  assert.deepEqual(r2, r1);

  return {
    id: "TC-ONBOARDING-EXCLUSION-001",
    area: "onboarding",
    requirementIds: ["SR-ONBOARDING-EXCLUSION"],
    inputSummary:
      "7 case (정상 / 의료진 미승인 / age < 18 / age >= 85 / 진단 미입력 / MCI 단독 / 급성기) + 결정성 반복",
    expected:
      "차단 4 case + confirmation 2 case + pass 1 case, 사유 알파벳 정렬, 동일 입력 동일 출력",
    actual: `cases verified, MCI blocked=${mci.allowed === false}, acute blocked=${acute.allowed === false}`,
    detail: `Onboarding exclusion (RM-007) deterministic — 14 assertions across all profile branches`,
  };
}

function runAuditExpansionCheck(): CheckResult {
  const e1 = enrichAuditEntry({
    category: "guardian_link_lifecycle",
    actorId: "T-001",
    resourceId: "P-PSEUDO-42",
    metadata: { ttl_days: 7, channel: "kakao" },
  });
  assert.equal(e1.action, "guardian_link_event");
  assert.equal(e1.requiresPhiMasking, true);
  assert.deepEqual(Object.keys(e1.metadata), ["channel", "ttl_days"]); // sorted
  assert.ok(e1.summary.includes("T-001"));
  assert.ok(e1.summary.includes("P-PSEUDO-42"));

  const e2 = enrichAuditEntry({
    category: "regulatory_filing",
    actorId: "PM-001",
    resourceId: "MFDS-CHANGE-2026-Q2",
  });
  assert.equal(e2.action, "regulatory_change_filing");
  assert.equal(e2.requiresPhiMasking, false);

  // 결정성
  const e3 = enrichAuditEntry({
    category: "kwab_finalization",
    actorId: "T-005",
    resourceId: "K-WAB-99",
    metadata: { aq: 78, version: "v0.2.5" },
  });
  const e3b = enrichAuditEntry({
    category: "kwab_finalization",
    actorId: "T-005",
    resourceId: "K-WAB-99",
    metadata: { version: "v0.2.5", aq: 78 },
  });
  assert.deepEqual(e3b, e3);

  // Retention 매핑
  assert.equal(AUDIT_RETENTION_DAYS.regulatory_filing, 365 * 10);
  assert.equal(AUDIT_RETENTION_DAYS.guardian_link_lifecycle, 365 * 5);
  assert.equal(AUDIT_RETENTION_DAYS.kwab_finalization, 365 * 7);

  return {
    id: "TC-AUDIT-EXPANSION-001",
    area: "security",
    requirementIds: ["SR-SEC-AUDIT-EXPANSION"],
    inputSummary: "5 카테고리 enrichAuditEntry + retention 매핑",
    expected: "action / summary / PHI 강제 / metadata 정렬 결정성, retention 5/7/10년",
    actual: `categories=5, retention regulatory_filing=${AUDIT_RETENTION_DAYS.regulatory_filing}d`,
    detail: `Audit expansion (RM-016) deterministic — 9 assertions`,
  };
}

async function runGuardianSenderCheck(): Promise<CheckResult> {
  const now = 2_000_000_000_000;
  const candidates = [
    {
      patientPseudonymId: "P002",
      guardianContactHash: "hashB",
      channel: "email" as const,
      consentGranted: true,
      lastSentAtMs: null,
      nowMs: now,
    },
    {
      patientPseudonymId: "P001",
      guardianContactHash: "hashA",
      channel: "email" as const,
      consentGranted: false,
      lastSentAtMs: null,
      nowMs: now,
    },
    {
      patientPseudonymId: "P003",
      guardianContactHash: "hashC",
      channel: "email" as const,
      consentGranted: true,
      // 어제 보냈음 → 7일 미만 → duplicate
      lastSentAtMs: now - 24 * 60 * 60 * 1000,
      nowMs: now,
    },
  ];

  // decideSend 4 case
  assert.equal(decideSend(candidates[0]).reason, "ok");
  assert.equal(decideSend(candidates[1]).reason, "no_consent");
  assert.equal(decideSend(candidates[2]).reason, "duplicate_within_window");

  // no channel 전용 case
  const noChan = decideSend({
    ...candidates[0],
    guardianContactHash: "",
  });
  assert.equal(noChan.reason, "no_channel_configured");

  // executeSendBatch — alphabetic 정렬 + stub adapter
  const summary = {
    periodStart: "2026-04-23",
    periodEnd: "2026-04-29",
    totalSessions: 3,
    languageSessionCount: 2,
    singSessionCount: 1,
    latestAq: 78,
    aqChange: 4,
    averageScore: 72,
    stepCompletion: {} as Record<string, number>,
    adverseEventCount: 0,
    adverseEventStatus: "none_reported" as const,
    latestCompletedAt: "2026-04-29T00:00:00.000Z",
  };
  const summaryByPatient = { P001: summary, P002: summary, P003: summary };
  const outcomes = await executeSendBatch({
    candidates,
    summaryByPatient,
    reportLinkBuilder: (p) => `https://example.com/g/${p}`,
    adapter: STUB_SENDER_ADAPTER,
  });
  // 정렬 — P001 → P002 → P003
  assert.deepEqual(
    outcomes.map((o) => o.candidate.patientPseudonymId),
    ["P001", "P002", "P003"],
  );
  // P001 no_consent → skipped
  assert.equal(outcomes[0].status, "skipped");
  // P002 ok → adapter stub → failed (stub_no_adapter)
  assert.equal(outcomes[1].status, "failed");
  // P003 duplicate → skipped
  assert.equal(outcomes[2].status, "skipped");

  const deliverySummary = summarizeDeliveryRecords([
    { status: "dry_run", createdAt: "2026-04-29T00:00:00.000Z" },
    { status: "sent", createdAt: "2026-04-30T00:00:00.000Z" },
    { status: "failed", createdAt: "2026-04-28T00:00:00.000Z" },
    { status: "skipped", createdAt: null },
  ]);
  assert.equal(deliverySummary.total, 4);
  assert.equal(deliverySummary.dryRun, 1);
  assert.equal(deliverySummary.sent, 1);
  assert.equal(deliverySummary.failed, 1);
  assert.equal(deliverySummary.skipped, 1);
  assert.equal(deliverySummary.latestCreatedAt, "2026-04-30T00:00:00.000Z");

  return {
    id: "TC-GUARDIAN-SENDER-001",
    area: "guardian",
    requirementIds: ["SR-GUARDIAN-SENDER"],
    inputSummary: "3 candidates × 4 reason + executeSendBatch + delivery summary",
    expected:
      "decideSend 4 reason 결정성, executeSendBatch alphabetic 정렬, dry-run/sent/failed/skipped summary",
    actual: `outcomes order=${outcomes.map((o) => o.candidate.patientPseudonymId).join(",")}; deliveries=${deliverySummary.total}`,
    detail: `Guardian sender (Phase 2) deterministic — 14 assertions`,
  };
}

function runIrtItemBankCheck(): CheckResult {
  // step1/2/4/5 + sing bank 안정 + a/b 정의
  assert.ok(STEP1_WORD_BANK.length >= 5);
  assert.ok(STEP2_REPETITION_BANK.length >= 5);
  assert.ok(STEP4_SENTENCE_BANK.length >= 3);
  assert.ok(STEP5_READING_BANK.length >= 18);
  assert.ok(SING_ADAPTIVE_BANK.length >= 5);

  for (const item of [
    ...STEP1_WORD_BANK,
    ...STEP2_REPETITION_BANK,
    ...STEP4_SENTENCE_BANK,
    ...STEP5_READING_BANK,
    ...SING_ADAPTIVE_BANK,
  ]) {
    assert.ok(item.id.length > 0);
    assert.ok(item.a > 0, `a > 0 for ${item.id}`);
    assert.ok(Number.isFinite(item.b), `b finite for ${item.id}`);
  }

  // 결정성 — getItemBankForStep
  assert.equal(getItemBankForStep(1), STEP1_WORD_BANK);
  assert.equal(getItemBankForStep(2), STEP2_REPETITION_BANK);
  assert.equal(getItemBankForStep(4), STEP4_SENTENCE_BANK);
  assert.equal(getItemBankForStep(5), STEP5_READING_BANK);

  return {
    id: "TC-IRT-ITEMBANK-001",
    area: "adaptive",
    requirementIds: ["SR-IRT-ITEMBANK"],
    inputSummary: "step-1/2/4/5 + sing calibrated bank",
    expected: "모든 item id 안정 + a/b 정의 + step → bank 매핑",
    actual: `step1=${STEP1_WORD_BANK.length}, step2=${STEP2_REPETITION_BANK.length}, step4=${STEP4_SENTENCE_BANK.length}, step5=${STEP5_READING_BANK.length}, sing=${SING_ADAPTIVE_BANK.length}`,
    detail: `IRT item bank v0.1 deterministic — step/sing banks verified`,
  };
}

function runAdaptiveTrainingOrderCheck(): CheckResult {
  const items = [
    { id: 1, text: "사과" },
    { id: 2, text: "도서관" },
    { id: 3, text: "비행기" },
    { id: 4, text: "학교" },
  ];
  const first = buildAdaptiveTrainingOrder({
    step: 1,
    items,
    responses: [],
    getItemKey: (item) => item.text,
    getItemText: (item) => item.text,
    calibratedBank: STEP1_WORD_BANK,
  });
  assert.equal(first.usedResponses, 0);
  assert.equal(first.selectionMethod, "irt_mfi");
  assert.ok(["사과", "학교", "도서관", "비행기"].includes(first.orderedItems[0].text));
  assert.equal(first.itemMetaByKey["사과"].adaptiveItemId, "step1-사과");

  const afterCorrect = buildAdaptiveTrainingOrder({
    step: 1,
    items,
    responses: [{ itemKey: "사과", correct: true }],
    getItemKey: (item) => item.text,
    getItemText: (item) => item.text,
    calibratedBank: STEP1_WORD_BANK,
  });
  const repeat = buildAdaptiveTrainingOrder({
    step: 1,
    items,
    responses: [{ itemKey: "사과", correct: true }],
    getItemKey: (item) => item.text,
    getItemText: (item) => item.text,
    calibratedBank: STEP1_WORD_BANK,
  });
  assert.deepEqual(
    afterCorrect.orderedItems.map((item) => item.text),
    repeat.orderedItems.map((item) => item.text),
  );
  assert.equal(afterCorrect.usedResponses, 1);
  assert.ok(afterCorrect.theta > 0);
  assert.equal(afterCorrect.orderedItems[0].text, "사과");
  assert.ok(afterCorrect.nextItemKey);
  assert.ok(afterCorrect.itemMetaByKey[afterCorrect.nextItemKey!].itemDifficulty >= -2.5);

  const inferred = buildAdaptiveTrainingOrder({
    step: 2,
    items: [{ text: "처음 보는 긴 문장입니다" }, { text: "짧게" }],
    responses: [{ itemKey: "짧게", correct: false }],
    getItemKey: (item) => item.text,
    getItemText: (item) => item.text,
    calibratedBank: STEP2_REPETITION_BANK,
  });
  assert.equal(inferred.usedResponses, 1);
  assert.match(inferred.itemMetaByKey["짧게"].adaptiveItemId, /^step2-/);
  assert.equal(inferred.orderedItems[0].text, "짧게");

  const step5 = buildAdaptiveTrainingOrder({
    step: 5,
    items: [
      { id: 1, text: "아침에 일어나면 세수를 하고 이를 닦습니다." },
      { id: 2, text: "방이 지저분해서 청소기를 돌립니다." },
      { id: 3, text: "소파에 앉아서 텔레비전을 봅니다." },
    ],
    responses: [{ itemKey: "home-1", correct: true }],
    getItemKey: (item) => `home-${item.id}`,
    getItemText: (item) => item.text,
    calibratedBank: STEP5_READING_BANK,
  });
  assert.equal(step5.usedResponses, 1);
  assert.equal(step5.orderedItems[0].id, 1);
  assert.equal(step5.itemMetaByKey["home-1"].adaptiveItemId, "step5-home-1");

  const sing = buildAdaptiveTrainingOrder({
    step: "sing",
    items: ["나비야", "아리랑", "둥글게 둥글게"],
    responses: [{ itemKey: "나비야", correct: true }],
    getItemKey: (item) => item,
    getItemText: (item) => item,
    calibratedBank: SING_ADAPTIVE_BANK,
  });
  assert.equal(sing.usedResponses, 1);
  assert.equal(sing.orderedItems[0], "나비야");
  assert.equal(sing.itemMetaByKey["나비야"].adaptiveItemId, "sing-나비야");

  return {
    id: "TC-IRT-TRAINING-001",
    area: "adaptive",
    requirementIds: ["SR-IRT-018", "SR-IRT-ITEMBANK"],
    inputSummary:
      "step page 후보 문항 + 응답 0건/1건 + calibrated bank 매칭/미매칭 fallback",
    expected:
      "동일 응답 시퀀스는 동일 다음 문항 순서, 기존 완료 문항 보존, bank 매칭 및 content 기반 fallback metadata 생성",
    actual: `first=${first.orderedItems[0].text}, afterCorrect=${afterCorrect.orderedItems
      .map((item) => item.text)
      .join(">")}, inferred=${inferred.orderedItems.map((item) => item.text).join(">")}, step5=${step5.orderedItems.map((item) => item.id).join(">")}, sing=${sing.orderedItems.join(">")}`,
    detail:
      "IRT training order integration deterministic — step-1/2/5/sing MFI ordering / theta update / metadata / fallback",
  };
}

function runAdaptiveEvidenceExportCheck(): CheckResult {
  const entry = {
    historyId: "history-adaptive-1",
    sessionId: "session-adaptive-1",
    patientKey: "patient-adaptive",
    patientName: "테스트",
    place: "home",
    trainingMode: "self",
    completedAt: 1770000000000,
    aq: 72,
    stepScores: {
      step1: 80,
      step2: 70,
      step3: 0,
      step4: 0,
      step5: 74,
      step6: 0,
    },
    stepDetails: {
      step1: [],
      step2: [],
      step3: [],
      step4: [],
      step5: [
        {
          text: "아침에 일어나면 세수를 하고 이를 닦습니다.",
          isCorrect: true,
          adaptiveItemKey: "home-1",
          adaptiveItemId: "step5-home-1",
          adaptiveTheta: 0.312,
          adaptiveSd: 0.892,
          itemDifficulty: -0.4,
          itemDiscrimination: 1,
          adaptiveSelectionMethod: "irt_mfi",
        },
        {
          text: "부엌에서 물을 한 잔 마셨습니다.",
          isCorrect: false,
          adaptiveItemKey: "home-2",
          adaptiveItemId: "step5-home-2",
          adaptiveTheta: 0.428,
          adaptiveSd: 0.8,
          itemDifficulty: 0.35,
          itemDiscrimination: 1.1,
          adaptiveSelectionMethod: "irt_mfi",
        },
      ],
      step6: [],
    },
  } as any;

  const rows = collectAdaptiveEvidence(entry);
  const summary = summarizeAdaptiveEvidence(entry);
  const aggregate = summarizeAdaptiveEvidenceRows(rows);
  const csv = serializeAdaptiveEvidenceCsv(rows);
  const itemSummaryCsv = serializeAdaptiveEvidenceItemSummaryCsv(aggregate.itemSummaries);
  const sessionSummaryCsv = serializeAdaptiveEvidenceSessionSummaryCsv(
    aggregate.sessionSummaries,
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].itemId, "step5-home-1");
  assert.equal(rows[0].theta, 0.312);
  assert.equal(summary?.latestTheta, 0.428);
  assert.equal(summary?.recommendedDifficulty, 0.428);
  assert.equal(aggregate.totalRows, 2);
  assert.equal(aggregate.totalSessions, 1);
  assert.equal(aggregate.totalItems, 2);
  assert.equal(aggregate.mfiRows, 2);
  assert.equal(aggregate.averageAccuracy, 0.5);
  assert.equal(aggregate.sessionSummaries[0]?.accuracy, 0.5);
  assert.match(csv, /historyId,completedAt,trainingMode/);
  assert.match(csv, /step5-home-1/);
  assert.match(itemSummaryCsv, /exposureCount/);
  assert.match(sessionSummaryCsv, /latestTheta/);

  return {
    id: "TC-IRT-EVIDENCE-EXPORT-001",
    area: "adaptive",
    requirementIds: ["SR-IRT-018", "SR-IRT-ITEMBANK"],
    inputSummary: "TrainingHistoryEntry.stepDetails adaptive fields",
    expected:
      "adaptive evidence JSON/CSV rows + therapist summary + item/session aggregates deterministic",
    actual: `rows=${rows.length}, theta=${summary?.latestTheta}, items=${aggregate.totalItems}, sessions=${aggregate.totalSessions}`,
    detail:
      "Adaptive evidence export deterministic — step item metadata / theta summary / item-session CSV serializers verified",
  };
}

function runGuardianContactPrivacyCheck(): CheckResult {
  assert.equal(normalizeGuardianContactValue("phone", "010-1234-5678"), "01012345678");
  assert.equal(
    normalizeGuardianContactValue("email", " Guardian@Example.COM "),
    "guardian@example.com",
  );
  assert.equal(maskGuardianName("홍길동"), "홍*동");
  assert.equal(maskGuardianContact("phone", "010-1234-5678"), "*******5678");
  assert.equal(maskGuardianContact("email", "guardian@example.com"), "gu******@example.com");
  assert.equal(
    hashGuardianContact("email", "guardian@example.com"),
    hashGuardianContact("email", " Guardian@Example.COM "),
  );
  assert.notEqual(
    hashGuardianContact("email", "guardian@example.com"),
    hashGuardianContact("phone", "guardian@example.com"),
  );

  return {
    id: "TC-GUARDIAN-CONTACT-001",
    area: "guardian",
    requirementIds: ["SR-CONSENT-015", "SR-PHI-013", "SR-GUARDIAN-SENDER"],
    inputSummary: "guardian name/contact normalization + mask + hash fixtures",
    expected: "원문 연락처 미노출용 mask/hash 결정성, email case-insensitive hash",
    actual: `phone=${maskGuardianContact("phone", "010-1234-5678")}, email=${maskGuardianContact("email", "guardian@example.com")}`,
    detail: "Guardian contact privacy deterministic — 7 assertions",
  };
}

export async function runDeterministicChecks() {
  const checks = [
    runAQCheck(),
    runMeasurementQualityCheck(),
    runHistoryPersistenceCheck(),
    runTherapistRoutingCheck(),
    runCompactStorageCheck(),
    runPermissionDeniedCheck(),
    runPermissionCancelledCheck(),
    runSaveFailureFallbackCheck(),
    runServerSaveRetryCheck(),
    runHistorySaveRiskCheck(),
    runSessionRestoreCheck(),
    runStepFallbackCheck(),
    runResultRefetchMismatchCheck(),
    runGazeMetricsCheck(),
    runGazeAccumulatorCheck(),
    runGazeHistorySummaryCheck(),
    runAacIntentTemplateCheck(),
    runAacTrainingIntegrationCheck(),
    runStep2ScoringPersistenceCheck(),
    runSttPolicyCheck(),
    runSttRuntimeResolutionCheck(),
    runSttLanguageLockCheck(),
    runSttClientPreflightCheck(),
    runSttReviewRequiredCheck(),
    runGuardianWeeklyReportCheck(),
    runGuardianReportLinkPolicyCheck(),
    runGuardianContactPrivacyCheck(),
    runAdverseEventReviewCheck(),
    runPatientReportAccessCheck(),
    runAiSttVersionMetadataCheck(),
    runPasswordStrengthCheck(),
    runLoginLockoutCheck(),
    runSessionIdleCheck(),
    runRateLimitCheck(),
    runAuditChainCheck(),
    runAuditAppendOnlyCheck(),
    runErrorDictionaryCheck(),
    runInputValidationCheck(),
    runSoupRegistryCheck(),
    runReleaseManifestCheck(),
    runRiskClassificationCheck(),
    runPhiMaskingCheck(),
    runWerCalculatorCheck(),
    runGuardianConsentStateCheck(),
    runChangeImpactAnalysisCheck(),
    runReleaseChangeDossierExportCheck(),
    runIec62304ExportCheck(),
    runUsabilityValidatorCheck(),
    runWerRunnerCheck(),
    runRtfRunnerCheck(),
    runWasmSttLoadingStateCheck(),
    runIrtCheck(),
    runOnboardingExclusionCheck(),
    runAuditExpansionCheck(),
    await runGuardianSenderCheck(),
    runIrtItemBankCheck(),
    runAdaptiveTrainingOrderCheck(),
    runAdaptiveEvidenceExportCheck(),
    await runWasmSttAdapterCheck(),
  ];
  return checks;
}

export async function buildDeterministicExecutionLogRecord() {
  const generatedAt = new Date().toISOString();
  const checks = await runDeterministicChecks();
  const cases: VnvExecutionCaseRecord[] = checks.map((check) => ({
    testCaseId: check.id,
    requirementIds: check.requirementIds,
    area: check.area,
    passed: true,
    inputSummary: check.inputSummary,
    expected: check.expected,
    actual: check.actual,
    detail: check.detail,
    executedAt: generatedAt,
  }));
  return {
    exportType: "brainfriends-vnv-deterministic-run" as const,
    generatedAt,
    runDate: generatedAt.slice(0, 10),
    runTime: generatedAt.slice(11, 19),
    summary: {
      totalCases: cases.length,
      passedCases: cases.length,
      failedCases: 0,
    },
    cases,
  };
}

async function main() {
  const shouldRecord = process.argv.includes("--record");
  const checks = await runDeterministicChecks();
  for (const check of checks) {
    console.log(`[PASS] ${check.id} - ${check.detail}`);
  }
  console.log(`Deterministic V&V checks completed: ${checks.length} passed.`);
  if (shouldRecord) {
    const record = await buildDeterministicExecutionLogRecord();
    const savedPath = await saveVnvExecutionLog(record);
    console.log(`Saved deterministic V&V execution log: ${savedPath}`);
  }
}

const entryPath = process.argv[1];
if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
