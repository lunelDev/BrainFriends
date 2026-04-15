import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { calculateKWABScores } from "@/lib/kwab/KWABScoring";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
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
    inputSummary: "서버/로컬 결과 재조회 불일치 fixture",
    expected: "server selected as canonical result",
    actual: `canonical=${outcome.canonicalSource}, mismatch=${outcome.mismatchDetected}`,
    detail: `canonical=${outcome.canonicalSource}, mismatch=${outcome.mismatchDetected}`,
  };
}

export function runDeterministicChecks() {
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
    runSessionRestoreCheck(),
    runStepFallbackCheck(),
    runResultRefetchMismatchCheck(),
  ];

  return checks;
}

export function buildDeterministicExecutionLogRecord() {
  const generatedAt = new Date().toISOString();
  const checks = runDeterministicChecks();
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
  const checks = runDeterministicChecks();

  for (const check of checks) {
    console.log(`[PASS] ${check.id} - ${check.detail}`);
  }
  console.log(`Deterministic V&V checks completed: ${checks.length} passed.`);
  if (shouldRecord) {
    const record = buildDeterministicExecutionLogRecord();
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
