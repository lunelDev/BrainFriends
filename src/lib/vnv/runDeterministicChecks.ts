// Deterministic V&V checks runner. SR-* 요건별 단위 검증을 모은 단일 entry point.
// `npm run test:vnv` 가 본 파일을 tsx 로 직접 실행한다.
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
import {
  buildAacTrainingMetadata,
  scoreAacTranscriptMatch,
} from "@/lib/aac/trainingIntegration";
import {
  buildKoreanSttPrompt,
  hashSttPrompt,
  STT_PROMPT_VERSION,
} from "@/lib/speech/sttPrompt";
import { resolveSttPolicy } from "@/lib/speech/sttPolicy";
import { resolveClientSttPreflight } from "@/lib/speech/sttClientPreflight";
import { resolveSttRuntime } from "@/lib/speech/sttRuntime";
import { isWasmSttAvailable } from "@/lib/speech/wasmSttAdapter";
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
  assert.equal(blocked.engine, "disabled");
  assert.equal(blocked.rawAudioLeavesDevice, false);

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

  const wasm = resolveSttPolicy({
    useCase: "daily_training",
    wasmAvailable: true,
    allowTrainingServerFallback: false,
  });
  assert.equal(wasm.engine, "wasm_whisper");
  assert.equal(wasm.rawAudioLeavesDevice, false);

  const prompt = buildKoreanSttPrompt("바다 가족");
  assert.equal(prompt.includes("바다"), true);
  assert.equal(prompt.includes("가족"), true);

  return {
    id: "TC-STT-001",
    area: "stt",
    requirementIds: ["SR-STT-009"],
    inputSummary:
      "daily/weekly/fallback/wasm STT policy fixture + Korean prompt fixture",
    expected:
      "dev mock, daily blocked, weekly server, training fallback server, wasm local, prompt includes target terms",
    actual: `mock=${mock.engine}, daily=${blocked.engine}, weekly=${evaluation.engine}, fallback=${temporaryFallback.engine}, wasm=${wasm.engine}, promptHasTarget=${prompt.includes("바다")}`,
    detail: `mock=${mock.engine}; daily=${blocked.engine}; weekly=${evaluation.engine}; fallback=${temporaryFallback.engine}; wasm=${wasm.engine}`,
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
  const wasm = resolveSttRuntime({
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
  assert.equal(blocked.engine, "disabled");
  assert.equal(blocked.canUploadToServer, false);
  assert.equal(wasm.engine, "wasm_whisper");
  assert.equal(wasm.rawAudioLeavesDevice, false);
  assert.equal(server.engine, "server_whisper");
  assert.equal(server.canUploadToServer, true);

  return {
    id: "TC-STT-003",
    area: "stt",
    requirementIds: ["SR-STT-009"],
    inputSummary:
      "mock / blocked / wasm / server STT runtime fixture + adapter availability",
    expected:
      "runtime separates mock, blocked, wasm, and server states; default WASM adapter is unavailable",
    actual: `mock=${mock.engine}, blocked=${blocked.engine}, wasm=${wasm.engine}, server=${server.engine}, adapter=${isWasmSttAvailable()}`,
    detail: `mock=${mock.engine}; blocked=${blocked.engine}; wasm=${wasm.engine}; server=${server.engine}; adapter=${isWasmSttAvailable()}`,
  };
}

function runSttClientPreflightCheck(): CheckResult {
  const gameBlocked = resolveClientSttPreflight({
    useCase: "game_training",
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });
  const gameFallback = resolveClientSttPreflight({
    useCase: "game_training",
    wasmAvailable: false,
    allowTrainingServerFallback: true,
  });
  const weekly = resolveClientSttPreflight({
    useCase: "weekly_kwab",
    wasmAvailable: false,
    allowTrainingServerFallback: false,
  });

  assert.equal(gameBlocked.canUploadToServer, false);
  assert.equal(gameBlocked.rawAudioLeavesDevice, false);
  assert.equal(gameBlocked.reason, "wasm_unavailable_server_blocked");
  assert.equal(gameFallback.canUploadToServer, true);
  assert.equal(gameFallback.rawAudioLeavesDevice, true);
  assert.equal(weekly.canUploadToServer, true);
  assert.equal(weekly.reason, "server_allowed_for_evaluation");

  return {
    id: "TC-STT-002",
    area: "stt",
    requirementIds: ["SR-STT-009"],
    inputSummary:
      "game_training client preflight without WASM/fallback + fallback enabled + weekly_kwab fixture",
    expected:
      "game training blocks server upload unless explicit fallback; weekly evaluation can upload",
    actual: `game=${gameBlocked.canUploadToServer}/${gameBlocked.reason}, fallback=${gameFallback.canUploadToServer}, weekly=${weekly.canUploadToServer}/${weekly.reason}`,
    detail: `gameUpload=${gameBlocked.canUploadToServer}; rawLeaves=${gameBlocked.rawAudioLeavesDevice}; weekly=${weekly.canUploadToServer}`,
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
    runHistorySaveRiskCheck(),
    runSessionRestoreCheck(),
    runStepFallbackCheck(),
    runResultRefetchMismatchCheck(),
    runGazeMetricsCheck(),
    runGazeAccumulatorCheck(),
    runGazeHistorySummaryCheck(),
    runAacIntentTemplateCheck(),
    runAacTrainingIntegrationCheck(),
    runSttPolicyCheck(),
    runSttClientPreflightCheck(),
    runSttRuntimeResolutionCheck(),
    runSttReviewRequiredCheck(),
    runGuardianWeeklyReportCheck(),
    runGuardianReportLinkPolicyCheck(),
    runAdverseEventReviewCheck(),
    runPatientReportAccessCheck(),
    runAiSttVersionMetadataCheck(),
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
