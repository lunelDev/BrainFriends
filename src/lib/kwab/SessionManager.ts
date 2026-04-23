// src/lib/kwab/SessionManager.ts
/**
 * 학습 세션 관리 시스템
 * - 각 Step의 결과를 누적
 * - 실시간 언어 점수 계산
 * - localStorage 기반 영속성
 */

import {
  calculateKWABScores,
  KWABScores,
  PatientProfile,
  SpontaneousSpeechResult,
  AuditoryComprehensionResult,
  RepetitionResult,
  NamingResult,
  ReadingResult,
  WritingResult,
} from "./KWABScoring";
import { localStoreAdapter } from "@/lib/storage/adapters";
import type { VersionSnapshot } from "@/lib/analysis/versioning";
import {
  appendClientClinicalAuditLog,
  buildClientStepAuditLog,
} from "@/lib/audit/clientAuditTrail";
import type { RequirementId } from "@/lib/vnv/requirements";
import {
  buildRequirementTraceabilitySummary,
  type RequirementTraceabilitySummary,
  type RuntimeValidationRecord,
} from "@/lib/vnv/traceability";
import {
  buildMeasurementQualitySnapshot,
  compactHistoryEntryForStorage,
  mergeHistoryEntriesForStorage,
} from "@/lib/vnv/deterministicChecks";
// ============================================================================
// 1. Step별 결과 타입
// ============================================================================

export interface Step1Result {
  versionSnapshot?: VersionSnapshot;
  // 청각 이해 (O/X 문제)
  correctAnswers: number;
  totalQuestions: number;
  averageResponseTime: number; // ms
  score?: number; // 0-100 종합점수 (정확도 80 + 속도 20)
  accuracyScore?: number; // 0-100
  speedBonusScore?: number; // 0-100
  fastCorrectCount?: number; // 기준 시간 내 정답 수
  timestamp: number;
  items: Array<{
    question: string;
    userAnswer: boolean | null;
    correctAnswer: boolean;
    isCorrect: boolean;
    responseTime: number;
  }>;
}

// ──────── Parselmouth 음향 분석 결과 (REQ-ACOUSTIC-001~004) ────────
// /api/proxy/voice-analysis 응답 shape 과 1:1 대응. step-2/4/5 와 sing-training
// 에서 공통 사용. 산출 정의: docs/remediation/01-sw-vnv/parselmouth-requirements.md
export interface AcousticSnapshot {
  duration_sec: number | null;
  f0: {
    mean_hz: number | null;
    std_hz: number | null;
    min_hz: number | null;
    max_hz: number | null;
  };
  intensity: {
    mean_db: number | null;
    max_db: number | null;
  };
  voicing_ratio: number | null;
  measurement_quality: "measured" | "degraded" | "failed";
  version_snapshot?: {
    parselmouth: string;
    praat_version_date: string;
    python: string;
    numpy: string;
  } | null;
  fallback?: boolean;
  reason?: string;
}

export interface Step2Result {
  versionSnapshot?: VersionSnapshot;
  // 복창 훈련
  items: Array<{
    text: string;
    transcript?: string;
    isCorrect?: boolean;
    symmetryScore: number; // 0-100
    pronunciationScore: number; // 0-100
    consonantAccuracy?: number; // 0-100
    vowelAccuracy?: number; // 0-100
    consonantDetail?: {
      closureRatePct: number; // 폐쇄율 (%): 녹음 구간에서 mouthOpening이 임계값 이하였던 프레임 비율
      closureHoldMs: number; // 폐쇄 유지시간 (ms)
      lipSymmetryPct: number; // 좌우 대칭 (%)
      openingSpeedMs: number; // 개방 속도 (ms)
    };
    vowelDetail?: {
      mouthOpeningPct: number; // 입벌림 (%)
      mouthWidthPct: number; // 입술 너비 (%)
      roundingPct: number; // 둥글림 (%)
      patternMatchPct: number; // 목표 패턴 일치도 (%)
    };
    dataSource?: "measured" | "demo";
    audioLevel: number; // dB
    // Parselmouth 음향 분석 (REQ-ACOUSTIC-001~004). 실패 시 measurement_quality="failed".
    acoustic?: AcousticSnapshot | null;
  }>;
  averageSymmetry: number;
  averagePronunciation: number;
  averageConsonantAccuracy?: number;
  averageVowelAccuracy?: number;
  timestamp: number;
}

export interface Step3Result {
  versionSnapshot?: VersionSnapshot;
  items: any[]; // 상세 데이터 보존용
  score: number; // 0-100 점수
  correctCount: number; // 맞은 개수 (기존 correctAnswers 대신 사용)
  totalCount: number; // 전체 개수 (기존 totalQuestions 대신 사용)
  accuracyScore?: number; // 0-100
  speedBonusScore?: number; // 0-100
  fastCorrectCount?: number; // 기준 시간 내 정답 수
  averageConsonantAccuracy?: number;
  averageVowelAccuracy?: number;
  timestamp: number;
}

export interface Step4Result {
  versionSnapshot?: VersionSnapshot;
  // 유창성 학습 (자발화 유창성 평가)
  items: Array<{
    situation: string;
    prompt: string;
    transcript?: string;
    isCorrect?: boolean;
    contentComponentScore?: number; // 0~100
    fluencyComponentScore?: number; // 0~100
    clarityComponentScore?: number; // 0~100
    responseStartComponentScore?: number; // 0~100
    responseStartMs?: number | null;
    responseTime?: number | null; // 공통 반응시간 필드 호환
    finalScore?: number; // 0~100
    fluencyScore?: number; // 0~10 (기존 호환)
    speechDuration: number;
    silenceRatio: number;
    averageAmplitude: number;
    peakCount: number;
    kwabScore: number; // 0~10점
    rawScore: number; // 원점수 0~100
    consonantAccuracy?: number;
    vowelAccuracy?: number;
    articulationWritingConsistency?: number;
    consonantDetail?: {
      closureRatePct: number; // 폐쇄율 (%): 녹음 구간에서 mouthOpening이 임계값 이하였던 프레임 비율
      closureHoldMs: number; // 폐쇄 유지시간 (ms)
      lipSymmetryPct: number; // 좌우 대칭 (%)
      openingSpeedMs: number; // 개방 속도 (ms)
    };
    vowelDetail?: {
      mouthOpeningPct: number; // 입벌림 (%)
      mouthWidthPct: number; // 입술 너비 (%)
      roundingPct: number; // 둥글림 (%)
      patternMatchPct: number; // 목표 패턴 일치도 (%)
    };
    // Parselmouth 음향 분석 (REQ-ACOUSTIC-001~004). 실패 시 measurement_quality="failed".
    acoustic?: AcousticSnapshot | null;
  }>;
  averageKwabScore: number;
  totalScenarios: number;
  score: number; // Result 페이지용
  correctCount: number; // 5점 이상 통과 개수
  totalCount: number;
  averageArticulationWritingConsistency?: number;
  timestamp: number;
}

export interface Step5Result {
  versionSnapshot?: VersionSnapshot;
  // 읽기 훈련
  correctAnswers: number;
  totalQuestions: number;
  averageConsonantAccuracy?: number;
  averageVowelAccuracy?: number;
  averageArticulationWritingConsistency?: number;
  timestamp: number;
  items: Array<{
    text: string;
    transcript?: string;
    isCorrect?: boolean;
    audioUrl?: string;
    readingScore?: number;
    consonantAccuracy?: number;
    vowelAccuracy?: number;
    articulationWritingConsistency?: number;
    consonantDetail?: {
      closureRatePct: number; // 폐쇄율 (%): 녹음 구간에서 mouthOpening이 임계값 이하였던 프레임 비율
      closureHoldMs: number; // 폐쇄 유지시간 (ms)
      lipSymmetryPct: number; // 좌우 대칭 (%)
      openingSpeedMs: number; // 개방 속도 (ms)
    };
    vowelDetail?: {
      mouthOpeningPct: number; // 입벌림 (%)
      mouthWidthPct: number; // 입술 너비 (%)
      roundingPct: number; // 둥글림 (%)
      patternMatchPct: number; // 목표 패턴 일치도 (%)
    };
    dataSource?: "measured" | "demo";
    totalTime?: number;
    wordsPerMinute?: number;
    // Parselmouth 음향 분석 (REQ-ACOUSTIC-001~004). 실패 시 measurement_quality="failed".
    acoustic?: AcousticSnapshot | null;
  }>;
}
export interface Step6Result {
  versionSnapshot?: VersionSnapshot;
  //쓰기학습
  completedTasks: number;
  totalTasks: number;
  accuracy: number;
  timestamp: number;
  items: Array<{
    word: string;
    expectedStrokes: number;
    userStrokes?: number;
    isCorrect?: boolean;
    shapeSimilarityPct?: number;
    writingScore?: number;
    userImage: string;
    articulationWritingConsistency?: number;
  }>;
}

// ============================================================================
// 2. 전체 세션 데이터
// ============================================================================

export interface TrainingSession {
  sessionId: string;
  patient: PatientProfile;
  place: string; // "공원", "마트" 등
  patientKey: string;
  startedAt: number;
  completedAt?: number;

  // Step별 결과
  step1?: Step1Result;
  step2?: Step2Result;
  step3?: Step3Result;
  step4?: Step4Result;
  step5?: Step5Result;
  step6?: Step6Result;

  // 언어 점수 (실시간 계산)
  kwabScores?: KWABScores;
  vnvRuntimeChecks?: RuntimeValidationRecord[];
}

// ============================================================================
// 3. SessionManager 클래스
// ============================================================================

const SESSION_STORAGE_PREFIX = "kwab_training_session";
const HISTORY_STORAGE_PREFIX = "kwab_training_history";
const ENABLE_LOCAL_HISTORY_CACHE = false;
export type TrainingMode = "self" | "rehab" | "sing";
export type MeasurementQualityLevel = "measured" | "partial" | "demo";

export interface MeasurementQualitySnapshot {
  overall: MeasurementQualityLevel;
  steps: {
    step1: MeasurementQualityLevel;
    step2: MeasurementQualityLevel;
    step3: MeasurementQualityLevel;
    step4: MeasurementQualityLevel;
    step5: MeasurementQualityLevel;
    step6: MeasurementQualityLevel;
  };
  notes: string[];
}

export interface VnvSnapshot {
  summary: RequirementTraceabilitySummary;
  runtimeChecks: RuntimeValidationRecord[];
  generatedAt: string;
}

export interface SingHistoryResult {
  versionSnapshot?: VersionSnapshot;
  song: string;
  score: number;
  finalJitter: string;
  finalSi: string;
  facialResponseDelta?: string;
  rtLatency: string;
  finalConsonant?: string;
  finalVowel?: string;
  lyricAccuracy?: string;
  transcript?: string;
  reviewAudioUrl?: string;
  measurementReason?: string | null;
  reviewKeyFrames?: Array<{
    dataUrl: string;
    capturedAt: string;
    label: string;
    mediaId?: string | null;
    objectKey?: string | null;
  }>;
  comment: string;
  governance?: {
    catalogVersion: string;
    analysisVersion: string;
    requirementIds: string[];
    failureModes: string[];
  };
  rankings: Array<{
    name: string;
    score: number;
    region: string;
    me?: boolean;
  }>;
}

export interface TrainingHistoryEntry {
  historyId: string;
  sessionId: string;
  patientKey: string;
  patientName: string;
  birthDate?: string;
  age: number;
  educationYears: number;
  place: string;
  trainingMode?: TrainingMode;
  rehabStep?: number;
  completedAt: number;
  aq: number;
  singResult?: SingHistoryResult;
  stepScores: {
    step1: number; // 0~100
    step2: number; // 0~100
    step3: number; // 0~100
    step4: number; // 0~100
    step5: number; // 0~100
    step6: number; // 0~100
  };
  stepDetails: {
    step1: any[];
    step2: any[];
    step3: any[];
    step4: any[];
    step5: any[];
    step6: any[];
  };
  articulationScores?: {
    step2: {
      averageConsonantAccuracy: number;
      averageVowelAccuracy: number;
    };
    step3: {
      averageConsonantAccuracy: number;
      averageVowelAccuracy: number;
    };
    step4?: {
      averageConsonantAccuracy: number;
      averageVowelAccuracy: number;
    };
    step5: {
      averageConsonantAccuracy: number;
      averageVowelAccuracy: number;
    };
    articulationWritingConsistency?: {
      step4: number;
      step5: number;
      step6: number;
    };
  };
  facialAnalysisSnapshot?: {
    asymmetryRisk: number;
    articulationGap: number;
    overallConsonant: number;
    overallVowel: number;
    articulationFaceMatchSummary: string;
    timelineCurrentAsymmetry: number;
    trackingQuality?: number;
    baseline?: {
      oralCommissureAsymmetry: number;
      lipClosureAsymmetry: number;
      vowelArticulationVariance: number;
    };
    sessionAverage?: {
      oralCommissureAsymmetry: number;
      lipClosureAsymmetry: number;
      vowelArticulationVariance: number;
    };
    delta?: {
      oralCommissureAsymmetry: number;
      lipClosureAsymmetry: number;
      vowelArticulationVariance: number;
    };
    longitudinalDelta?: {
      oralCommissureAsymmetry: number | null;
      lipClosureAsymmetry: number | null;
      vowelArticulationVariance: number | null;
      asymmetryRisk: number | null;
    };
  };
  stepVersionSnapshots?: {
    step1?: VersionSnapshot;
    step2?: VersionSnapshot;
    step3?: VersionSnapshot;
    step4?: VersionSnapshot;
    step5?: VersionSnapshot;
    step6?: VersionSnapshot;
  };
  measurementQuality?: MeasurementQualitySnapshot;
  vnv?: VnvSnapshot;
}

export class SessionManager {
  private session: TrainingSession;
  private storageKey: string;

  constructor(patient: PatientProfile, place: string) {
    this.storageKey = SessionManager.getStorageKey(patient, place);

    // 기존 세션 로드 또는 새로 생성
    const existing = this.loadSession(this.storageKey);
    if (existing) {
      this.session = existing;
    } else {
      this.session = {
        sessionId: `session_${Date.now()}`,
        patient,
        place,
        patientKey: SessionManager.getPatientKey(patient),
        startedAt: Date.now(),
        vnvRuntimeChecks: [],
      };
      this.saveSession();
    }
  }

  private recordVnvCheckpoint(
    requirementIds: RequirementId[],
    checkpoint: string,
    passed: boolean,
    detail: string,
  ) {
    const record: RuntimeValidationRecord = {
      requirementIds,
      checkpoint,
      status: passed ? "pass" : "warn",
      detail,
      recordedAt: new Date().toISOString(),
    };

    this.session.vnvRuntimeChecks = [
      ...(this.session.vnvRuntimeChecks ?? []),
      record,
    ].slice(-100);
  }

  private buildVnvSnapshot(requirementIds: RequirementId[]): VnvSnapshot {
    return {
      summary: buildRequirementTraceabilitySummary(requirementIds),
      runtimeChecks: (this.session.vnvRuntimeChecks ?? []).filter((record) =>
        record.requirementIds.some((id) => requirementIds.includes(id)),
      ),
      generatedAt: new Date().toISOString(),
    };
  }

  private appendStepAuditLog(
    pipelineStage: "step1" | "step2" | "step3" | "step4" | "step5" | "step6",
    versionSnapshot: VersionSnapshot | undefined,
    finalScore: number | null,
    featureValues: Record<string, number | string | boolean | null>,
    inputKind: "voice" | "writing" | "choice" | "multimodal" | "unknown",
  ) {
    appendClientClinicalAuditLog(
      buildClientStepAuditLog({
        patientPseudonymId: this.session.patientKey,
        sessionId: this.session.sessionId,
        pipelineStage,
        place: this.session.place,
        inputKind,
        finalScore,
        featureValues,
        versionSnapshot,
      }),
    );
  }

  // ========================================================================
  // Step별 결과 저장
  // ========================================================================

  saveStep1Result(result: Step1Result) {
    this.session.step1 = result;
    this.updateKWABScores();
    this.recordVnvCheckpoint(
      ["SR-SESSION-003", "SR-SCORE-004"],
      "step1_result_saved",
      result.totalQuestions > 0,
      `step1 correct=${result.correctAnswers}/${result.totalQuestions}`,
    );
    this.saveSession();
    this.appendStepAuditLog(
      "step1",
      result.versionSnapshot,
      result.score ?? null,
      {
        correct_answers: result.correctAnswers,
        total_questions: result.totalQuestions,
        average_response_time_ms: result.averageResponseTime,
        fast_correct_count: result.fastCorrectCount ?? null,
      },
      "choice",
    );
  }

  saveStep2Result(result: Step2Result) {
    this.session.step2 = result;
    this.updateKWABScores();
    this.recordVnvCheckpoint(
      ["SR-SESSION-003"],
      "step2_result_saved",
      result.items.length > 0,
      `step2 items=${result.items.length} pronunciation=${result.averagePronunciation}`,
    );
    this.saveSession();
    this.appendStepAuditLog(
      "step2",
      result.versionSnapshot,
      result.averagePronunciation ?? null,
      {
        average_symmetry: result.averageSymmetry,
        average_pronunciation: result.averagePronunciation,
        average_consonant_accuracy: result.averageConsonantAccuracy ?? null,
        average_vowel_accuracy: result.averageVowelAccuracy ?? null,
      },
      "multimodal",
    );
  }

  saveStep3Result(result: Step3Result) {
    this.session.step3 = result;
    this.updateKWABScores();
    this.recordVnvCheckpoint(
      ["SR-SESSION-003", "SR-SCORE-004"],
      "step3_result_saved",
      result.totalCount > 0,
      `step3 correct=${result.correctCount}/${result.totalCount}`,
    );
    this.saveSession();
    this.appendStepAuditLog(
      "step3",
      result.versionSnapshot,
      result.score ?? null,
      {
        correct_count: result.correctCount,
        total_count: result.totalCount,
        average_consonant_accuracy: result.averageConsonantAccuracy ?? null,
        average_vowel_accuracy: result.averageVowelAccuracy ?? null,
      },
      "choice",
    );
  }

  saveStep4Result(result: Step4Result) {
    this.session.step4 = result;
    this.updateKWABScores();
    this.recordVnvCheckpoint(
      ["SR-SESSION-003", "SR-MEASURE-006"],
      "step4_result_saved",
      result.totalScenarios > 0,
      `step4 scenarios=${result.totalScenarios} score=${result.score}`,
    );
    this.saveSession();
    this.appendStepAuditLog(
      "step4",
      result.versionSnapshot,
      result.score ?? null,
      {
        average_kwab_score: result.averageKwabScore,
        total_scenarios: result.totalScenarios,
        average_articulation_writing_consistency:
          result.averageArticulationWritingConsistency ?? null,
      },
      "multimodal",
    );
  }

  saveStep5Result(result: Step5Result) {
    this.session.step5 = result;
    this.updateKWABScores();
    this.recordVnvCheckpoint(
      ["SR-SESSION-003", "SR-MEASURE-006"],
      "step5_result_saved",
      result.totalQuestions > 0,
      `step5 correct=${result.correctAnswers}/${result.totalQuestions}`,
    );
    this.saveSession();
    this.appendStepAuditLog(
      "step5",
      result.versionSnapshot,
      result.correctAnswers,
      {
        correct_answers: result.correctAnswers,
        total_questions: result.totalQuestions,
        average_consonant_accuracy: result.averageConsonantAccuracy ?? null,
        average_vowel_accuracy: result.averageVowelAccuracy ?? null,
        average_articulation_writing_consistency:
          result.averageArticulationWritingConsistency ?? null,
      },
      "multimodal",
    );
  }

  saveStep6Result(result: Step6Result, mode: TrainingMode = "self") {
    this.session.step6 = result;
    this.session.completedAt = Date.now();
    this.updateKWABScores();
    this.recordVnvCheckpoint(
      ["SR-SESSION-003", "SR-HISTORY-005"],
      "step6_result_saved",
      result.totalTasks > 0,
      `step6 completed=${result.completedTasks}/${result.totalTasks}`,
    );
    this.saveSession();
    this.appendStepAuditLog(
      "step6",
      result.versionSnapshot,
      result.accuracy ?? null,
      {
        completed_tasks: result.completedTasks,
        total_tasks: result.totalTasks,
        accuracy: result.accuracy,
      },
      "writing",
    );
    this.saveHistoryEntry(mode);
  }

  finalizeSessionAndSaveHistory(mode: TrainingMode = "self", rehabStep?: number) {
    // 재활 결과는 매 회차를 독립 기록으로 남기기 위해 완료 시각/세션 ID를 갱신한다.
    this.session.completedAt = Date.now();
    if (mode === "rehab") {
      this.session.sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }
    this.updateKWABScores();
    this.recordVnvCheckpoint(
      ["SR-HISTORY-005"],
      "session_finalized",
      true,
      `mode=${mode}${rehabStep ? ` rehabStep=${rehabStep}` : ""}`,
    );
    this.saveSession();
    this.saveHistoryEntry(mode, rehabStep);
  }

  // ========================================================================
  // 언어 점수 계산
  // ========================================================================

  private updateKWABScores() {
    // Step별 결과를 내부 점수 형식으로 변환
    const spontaneousSpeech = this.convertToSpontaneousSpeech();
    const auditoryComprehension = this.convertToAuditoryComprehension();
    const repetition = this.convertToRepetition();
    const naming = this.convertToNaming();
    const reading = this.convertToReading();
    const writing = this.convertToWriting();

    // 점수 계산
    this.session.kwabScores = calculateKWABScores(this.session.patient, {
      spontaneousSpeech,
      auditoryComprehension,
      repetition,
      naming,
      reading,
      writing,
    });
    this.recordVnvCheckpoint(
      ["SR-SCORE-004"],
      "aq_recalculated",
      Number.isFinite(Number(this.session.kwabScores?.aq ?? NaN)),
      `aq=${Number(this.session.kwabScores?.aq ?? 0).toFixed(1)}`,
    );
  }

  private buildSessionStorageSnapshot(): TrainingSession {
    const sanitizeStep1 = (step: Step1Result | undefined) =>
      step
        ? {
            ...step,
            items: (step.items ?? []).map((item) => ({
              question: item.question,
              userAnswer: item.userAnswer,
              correctAnswer: item.correctAnswer,
              isCorrect: item.isCorrect,
              responseTime: item.responseTime,
            })),
          }
        : undefined;

    const sanitizeStep2 = (step: Step2Result | undefined) =>
      step
        ? {
            ...step,
            items: (step.items ?? []).map((item) => ({
              text: item.text,
              isCorrect: item.isCorrect,
              symmetryScore: item.symmetryScore,
              pronunciationScore: item.pronunciationScore,
              consonantAccuracy: item.consonantAccuracy,
              vowelAccuracy: item.vowelAccuracy,
              dataSource: item.dataSource,
              audioLevel: item.audioLevel,
              // Parselmouth 음향 측정값(REQ-ACOUSTIC-001~004): 결과 페이지 → DB 저장
              // 까지 살아남으려면 localStorage 라운드트립에서 보존돼야 한다.
              acoustic: item.acoustic ?? null,
            })),
          }
        : undefined;

    const sanitizeStep3 = (step: Step3Result | undefined) =>
      step
        ? {
            ...step,
            items: (step.items ?? []).map((item: any) => ({
              text: item?.text ?? null,
              isCorrect: item?.isCorrect ?? null,
            })),
          }
        : undefined;

    const sanitizeStep4 = (step: Step4Result | undefined) =>
      step
        ? {
            ...step,
            items: (step.items ?? []).map((item) => ({
              situation: item.situation,
              prompt: item.prompt,
              transcript: item.transcript,
              isCorrect: item.isCorrect,
              contentComponentScore: item.contentComponentScore,
              fluencyComponentScore: item.fluencyComponentScore,
              clarityComponentScore: item.clarityComponentScore,
              responseStartComponentScore: item.responseStartComponentScore,
              responseStartMs: item.responseStartMs,
              speechDuration: item.speechDuration,
              silenceRatio: item.silenceRatio,
              averageAmplitude: item.averageAmplitude,
              peakCount: item.peakCount,
              kwabScore: item.kwabScore,
              rawScore: item.rawScore,
              consonantAccuracy: item.consonantAccuracy,
              vowelAccuracy: item.vowelAccuracy,
              // Parselmouth 음향 측정값(REQ-ACOUSTIC-001~004): 결과 페이지 → DB 저장
              // 까지 살아남으려면 localStorage 라운드트립에서 보존돼야 한다.
              acoustic: item.acoustic ?? null,
            })),
          }
        : undefined;

    const sanitizeStep5 = (step: Step5Result | undefined) =>
      step
        ? {
            ...step,
            items: (step.items ?? []).map((item) => ({
              text: item.text,
              isCorrect: item.isCorrect,
              readingScore: item.readingScore,
              consonantAccuracy: item.consonantAccuracy,
              vowelAccuracy: item.vowelAccuracy,
              dataSource: item.dataSource,
              totalTime: item.totalTime,
              wordsPerMinute: item.wordsPerMinute,
              // Parselmouth 음향 측정값(REQ-ACOUSTIC-001~004): 결과 페이지 → DB 저장
              // 까지 살아남으려면 localStorage 라운드트립에서 보존돼야 한다.
              acoustic: item.acoustic ?? null,
            })),
          }
        : undefined;

    const sanitizeStep6 = (step: Step6Result | undefined) =>
      step
        ? {
            ...step,
            items: (step.items ?? []).map((item) => ({
              word: item.word,
              expectedStrokes: item.expectedStrokes,
              userStrokes: item.userStrokes,
              isCorrect: item.isCorrect,
              shapeSimilarityPct: item.shapeSimilarityPct,
              writingScore: item.writingScore,
              userImage: "",
              articulationWritingConsistency: item.articulationWritingConsistency,
            })),
          }
        : undefined;

    return {
      ...this.session,
      step1: sanitizeStep1(this.session.step1),
      step2: sanitizeStep2(this.session.step2),
      step3: sanitizeStep3(this.session.step3),
      step4: sanitizeStep4(this.session.step4),
      step5: sanitizeStep5(this.session.step5),
      step6: sanitizeStep6(this.session.step6),
    };
  }

  // ========================================================================
  // Step 결과 → 내부 점수 형식 변환
  // ========================================================================

  private convertToSpontaneousSpeech(): SpontaneousSpeechResult {
    // Step 4의 유창성 데이터를 활용
    const step4 = this.session.step4;
    if (!step4) {
      return { contentScore: 0, fluencyScore: 0 };
    }

    // 유창성 점수: 0~10점을 직접 사용
    const fluencyScore = step4.averageKwabScore;

    // 내용 점수: 5점 이상을 통과로 간주 (총 10점 만점)
    const passedCount = step4.items.filter(
      (item) => item.kwabScore >= 5,
    ).length;
    const contentScore = Math.round((passedCount / step4.totalScenarios) * 10);

    return { contentScore, fluencyScore };
  }

  private convertToAuditoryComprehension(): AuditoryComprehensionResult {
    const step1 = this.session.step1;
    const step3 = this.session.step3;

    const yesNoScore = step1
      ? Math.min((step1.correctAnswers / step1.totalQuestions) * 60, 60)
      : 0;

    // Step 3 데이터를 청각적 낱말인지 점수(60점 만점)로 변환
    const wordRecognitionScore = step3
      ? Math.min((step3.correctCount / step3.totalCount) * 60, 60)
      : 0;

    const commandScore = 40; // 미구현 항목 기본값

    return { yesNoScore, wordRecognitionScore, commandScore };
  }

  private convertToRepetition(): RepetitionResult {
    const step2 = this.session.step2;
    if (!step2) {
      return { totalScore: 0 };
    }

    // Step2 종합점수(finalScore) 평균을 100점 만점으로 사용
    const totalScore = Math.round(step2.averagePronunciation);
    return { totalScore: Math.min(totalScore, 100) };
  }

  private convertToNaming(): NamingResult {
    // 현재는 기본값 (추후 Step 확장 시 구현)
    return {
      objectNamingScore: 40, // 평균값
      wordFluencyScore: 10,
      sentenceCompletionScore: 6,
      sentenceResponseScore: 6,
    };
  }

  private convertToReading(): ReadingResult {
    const step5 = this.session.step5;
    if (!step5) {
      return { totalScore: 0 };
    }

    const itemScores = (step5.items || [])
      .map((item: any) => Number(item?.readingScore))
      .filter((v: number) => Number.isFinite(v));
    const totalScore = itemScores.length
      ? Math.round(
          itemScores.reduce((sum: number, v: number) => sum + v, 0) /
            itemScores.length,
        )
      : Math.round((step5.correctAnswers / step5.totalQuestions) * 100);
    return { totalScore: Math.min(totalScore, 100) };
  }

  private convertToWriting(): WritingResult {
    const step6 = this.session.step6;
    if (!step6) {
      return { totalScore: 0 };
    }

    const totalScore = Math.round(step6.accuracy);
    return { totalScore: Math.min(totalScore, 100) };
  }

  // ========================================================================
  // Storage 관리
  // ========================================================================

  private saveSession() {
    if (typeof window !== "undefined") {
      localStoreAdapter.setItem(
        this.storageKey,
        JSON.stringify(this.buildSessionStorageSnapshot()),
      );
    }
  }

  private loadSession(storageKey: string): TrainingSession | null {
    if (typeof window !== "undefined") {
      const data = localStoreAdapter.getItem(storageKey);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  // ========================================================================
  // Getter
  // ========================================================================

  getSession(): TrainingSession {
    return this.session;
  }

  getKWABScores(): KWABScores | undefined {
    return this.session.kwabScores;
  }

  getCompletionRate(): number {
    const completed = [
      this.session.step1,
      this.session.step2,
      this.session.step3,
      this.session.step4,
      this.session.step5,
      this.session.step6,
    ].filter((s) => s !== undefined).length;

    return (completed / 6) * 100;
  }

  // ========================================================================
  // 세션 초기화
  // ========================================================================

  private static getPatientKey(patient: PatientProfile): string {
    const normalize = (v: unknown) =>
      String(v ?? "")
        .trim()
        .toLowerCase();

    const p = patient as any;
    return [
      normalize(p.name),
      normalize(p.birthDate),
      normalize(patient.age),
      normalize(patient.educationYears),
    ].join("|");
  }

  private getHistoryStorageKey(): string {
    return `${HISTORY_STORAGE_PREFIX}:${this.session.patientKey}`;
  }

  private getStepScoresForHistory() {
    const step1 = this.session.step1
      ? Number.isFinite(Number(this.session.step1.score))
        ? Math.round(Number(this.session.step1.score))
        : Math.round(
            (this.session.step1.correctAnswers / this.session.step1.totalQuestions) *
              100,
          )
      : 0;
    const step2 = this.session.step2
      ? Math.round(this.session.step2.averagePronunciation)
      : 0;
    const step3 = this.session.step3 ? Math.round(this.session.step3.score) : 0;
    const step4 = this.session.step4
      ? Math.round(this.session.step4.score * 10)
      : 0;
    const step5 = this.session.step5
      ? (() => {
          const itemScores = (this.session.step5?.items || [])
            .map((item: any) => Number(item?.readingScore))
            .filter((v: number) => Number.isFinite(v));
          if (itemScores.length) {
            return Math.round(
              itemScores.reduce((sum: number, v: number) => sum + v, 0) /
                itemScores.length,
            );
          }
          return Math.round(
            (this.session.step5.correctAnswers / this.session.step5.totalQuestions) *
              100,
          );
        })()
      : 0;
    const step6 = this.session.step6 ? Math.round(this.session.step6.accuracy) : 0;
    return { step1, step2, step3, step4, step5, step6 };
  }

  buildHistoryEntry(
    mode: TrainingMode = "self",
    rehabStep?: number,
  ): TrainingHistoryEntry | null {
    if (typeof window === "undefined") return null;
    const aq = this.session.kwabScores?.aq;
    if (aq === undefined || aq === null) return null;

    const step1Rows = Array.isArray(this.session.step1?.items)
      ? this.session.step1.items
      : [];
    const step2Rows = Array.isArray(this.session.step2?.items)
      ? this.session.step2.items
      : [];
    const step3Rows = Array.isArray(this.session.step3?.items)
      ? this.session.step3.items
      : [];
    const step4Rows = Array.isArray(this.session.step4?.items)
      ? this.session.step4.items
      : [];
    const step5Rows = Array.isArray(this.session.step5?.items)
      ? this.session.step5.items
      : [];
    const step6Rows = Array.isArray(this.session.step6?.items)
      ? this.session.step6.items
      : [];

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const avgByKey = (rows: any[], key: string) => {
      const vals = rows
        .map((r) => Number((r as any)?.[key]))
        .filter((v) => Number.isFinite(v) && v > 0);
      return avg(vals);
    };
    const averageSlice = (values: number[], ratio: number) => {
      if (!values.length) return 0;
      const count = Math.max(1, Math.ceil(values.length * ratio));
      return avg(values.slice(0, count));
    };
    const normalizedInverse = (values: number[]) =>
      values
        .map((v) => Math.max(0, Math.min(100, 100 - v)))
        .filter((v) => Number.isFinite(v));
    const toNums = (rows: any[], key: string) =>
      rows
        .map((r) => Number((r as any)?.[key]))
        .filter((v) => Number.isFinite(v));

    // 카메라 기반 단계만 집계 (Step2, Step4, Step5)
    const step4Consonant = Number(this.session.step4?.items?.length
      ? avgByKey(this.session.step4.items as any[], "consonantAccuracy")
      : 0);
    const step4Vowel = Number(this.session.step4?.items?.length
      ? avgByKey(this.session.step4.items as any[], "vowelAccuracy")
      : 0);

    const overallConsonant = avg([
      Number(this.session.step2?.averageConsonantAccuracy ?? 0),
      step4Consonant,
      Number(this.session.step5?.averageConsonantAccuracy ?? 0),
    ].filter((v) => v > 0));
    const overallVowel = avg([
      Number(this.session.step2?.averageVowelAccuracy ?? 0),
      step4Vowel,
      Number(this.session.step5?.averageVowelAccuracy ?? 0),
    ].filter((v) => v > 0));
    const step2SymmetryInverse = normalizedInverse(toNums(step2Rows, "symmetryScore"));
    const step2ClosureInverse = normalizedInverse(
      step2Rows
        .map((row) => Number((row as any)?.consonantDetail?.lipSymmetryPct))
        .filter((v) => Number.isFinite(v)),
    );
    const step4ClosureInverse = normalizedInverse(
      step4Rows
        .map((row) => Number((row as any)?.consonantDetail?.lipSymmetryPct))
        .filter((v) => Number.isFinite(v)),
    );
    const step5ClosureInverse = normalizedInverse(
      step5Rows
        .map((row) => Number((row as any)?.consonantDetail?.lipSymmetryPct))
        .filter((v) => Number.isFinite(v)),
    );
    const oralCommissureBaseline = averageSlice(step2SymmetryInverse, 0.35);
    const oralCommissureCurrent = avg(step2SymmetryInverse);
    const lipClosureBaseline = averageSlice(
      [...step2ClosureInverse, ...step4ClosureInverse, ...step5ClosureInverse],
      0.35,
    );
    const lipClosureCurrent = avg([
      avg(step2ClosureInverse),
      avg(step4ClosureInverse),
      avg(step5ClosureInverse),
    ].filter((v) => v > 0));
    const vowelVarianceBaseline = Number(
      Math.abs(
        averageSlice(
          step2Rows
            .map((row) => Number((row as any)?.vowelAccuracy))
            .filter((v) => Number.isFinite(v)),
          0.35,
        ) -
          averageSlice(
            step5Rows
              .map((row) => Number((row as any)?.vowelAccuracy))
              .filter((v) => Number.isFinite(v)),
            0.35,
          ),
      ).toFixed(1),
    );
    const vowelVarianceCurrent = Number(Math.abs(overallConsonant - overallVowel).toFixed(1));
    const asymmetryRisk = avg(
      [oralCommissureCurrent, lipClosureCurrent, vowelVarianceCurrent].filter((v) => v > 0),
    );
    const articulationGap = Math.abs(overallConsonant - overallVowel);
    const trackingQuality = avg(
      [
        avgByKey(step2Rows, "trackingQualityPct"),
        avgByKey(step4Rows, "trackingQualityPct"),
        avgByKey(step5Rows, "trackingQualityPct"),
      ].filter((v) => v > 0),
    );
    const articulationFaceMatchSummary =
      asymmetryRisk >= 45 && articulationGap >= 18
        ? "비대칭 및 자모음 편차가 동반되어 협응 훈련 권고"
        : asymmetryRisk >= 35
          ? "비대칭 신호 관찰, 좌우 협응 훈련 권고"
          : articulationGap >= 15
            ? "자모음 편차 관찰, 약한 영역 집중 권고"
            : "음성-안면 매칭 안정 범위";

    const p = this.session.patient as any;
    const normalizedRehabStep =
      mode === "rehab" && Number.isFinite(Number(rehabStep))
        ? Math.max(1, Math.min(6, Number(rehabStep)))
        : undefined;
    const stepScores = this.getStepScoresForHistory();
    const stepDetails = {
      step1: step1Rows,
      step2: step2Rows,
      step3: step3Rows,
      step4: step4Rows,
      step5: step5Rows,
      step6: step6Rows,
    };
    if (mode === "rehab" && normalizedRehabStep) {
      const onlyKey = `step${normalizedRehabStep}` as keyof typeof stepScores;
      (Object.keys(stepScores) as Array<keyof typeof stepScores>).forEach((key) => {
        if (key !== onlyKey) stepScores[key] = 0;
      });
      (Object.keys(stepDetails) as Array<keyof typeof stepDetails>).forEach((key) => {
        if (key !== onlyKey) stepDetails[key] = [];
      });
    }

    const fullStepVersionSnapshots: NonNullable<TrainingHistoryEntry["stepVersionSnapshots"]> = {
      step1: this.session.step1?.versionSnapshot,
      step2: this.session.step2?.versionSnapshot,
      step3: this.session.step3?.versionSnapshot,
      step4: this.session.step4?.versionSnapshot,
      step5: this.session.step5?.versionSnapshot,
      step6: this.session.step6?.versionSnapshot,
    };
    const stepVersionSnapshots =
      mode === "rehab" && normalizedRehabStep
        ? (() => {
            const rehabKey = `step${normalizedRehabStep}` as keyof typeof fullStepVersionSnapshots;
            return {
              [rehabKey]: fullStepVersionSnapshots[rehabKey],
            };
          })()
        : fullStepVersionSnapshots;

    const deriveStepQuality = (
      stepNo: 1 | 2 | 3 | 4 | 5 | 6,
    ): MeasurementQualityLevel => {
      const rows = stepDetails[`step${stepNo}` as keyof typeof stepDetails] as any[];
      if (!Array.isArray(rows) || rows.length === 0) {
        return "demo";
      }

      if (stepNo === 2 || stepNo === 5) {
        const measuredCount = rows.filter((row) => row?.dataSource === "measured").length;
        const demoCount = rows.filter((row) => row?.dataSource === "demo").length;
        if (measuredCount === rows.length) return "measured";
        if (demoCount === rows.length) return "demo";
        return measuredCount > 0 ? "partial" : "demo";
      }

      if (stepNo === 4) {
        const transcriptCount = rows.filter(
          (row) =>
            String(row?.transcript ?? "").trim().length > 0 &&
            String(row?.transcript ?? "").trim() !== "시연용 더미 응답입니다.",
        ).length;
        if (transcriptCount > 0) return "measured";
        return "demo";
      }

      if (stepNo === 6) {
        const imageCount = rows.filter(
          (row) => String(row?.userImage ?? "").trim().length > 0,
        ).length;
        if (imageCount > 0) return "measured";
        return "demo";
      }

      if (stepNo === 1) {
        const answeredCount = rows.filter((row) => row?.userAnswer !== null && row?.userAnswer !== undefined).length;
        if (answeredCount === rows.length) return "measured";
        if (answeredCount > 0) return "partial";
        return "demo";
      }

      if (stepNo === 3) {
        const evaluatedCount = rows.filter((row) => row?.isCorrect !== undefined).length;
        if (evaluatedCount === rows.length) return "measured";
        if (evaluatedCount > 0) return "partial";
        return "demo";
      }

      return "demo";
    };

    const measurementQuality = buildMeasurementQualitySnapshot({
      stepDetails,
      mode,
      rehabStep: normalizedRehabStep,
    });
    const historyRequirementIds: RequirementId[] = [
      "SR-SESSION-003",
      "SR-SCORE-004",
      "SR-HISTORY-005",
      "SR-MEASURE-006",
    ];
    this.recordVnvCheckpoint(
      ["SR-MEASURE-006"],
      "measurement_quality_evaluated",
      measurementQuality.overall !== "demo",
      `overall=${measurementQuality.overall}`,
    );
    const previousComparableEntry = SessionManager.getHistoryFor(this.session.patient as any)
      .sort((a, b) => b.completedAt - a.completedAt)
      .find((row) => {
        if (mode === "rehab") {
          return (
            row.trainingMode === "rehab" &&
            Number(row.rehabStep ?? 0) === Number(normalizedRehabStep ?? 0)
          );
        }
        return (row.trainingMode ?? "self") === mode;
      });
    const previousFacialSnapshot = previousComparableEntry?.facialAnalysisSnapshot;
    const longitudinalDelta = {
      oralCommissureAsymmetry:
        previousFacialSnapshot?.sessionAverage?.oralCommissureAsymmetry != null
          ? Number(
              (
                oralCommissureCurrent -
                Number(previousFacialSnapshot.sessionAverage.oralCommissureAsymmetry)
              ).toFixed(1),
            )
          : null,
      lipClosureAsymmetry:
        previousFacialSnapshot?.sessionAverage?.lipClosureAsymmetry != null
          ? Number(
              (
                lipClosureCurrent -
                Number(previousFacialSnapshot.sessionAverage.lipClosureAsymmetry)
              ).toFixed(1),
            )
          : null,
      vowelArticulationVariance:
        previousFacialSnapshot?.sessionAverage?.vowelArticulationVariance != null
          ? Number(
              (
                vowelVarianceCurrent -
                Number(previousFacialSnapshot.sessionAverage.vowelArticulationVariance)
              ).toFixed(1),
            )
          : null,
      asymmetryRisk:
        previousFacialSnapshot?.asymmetryRisk != null
          ? Number((asymmetryRisk - Number(previousFacialSnapshot.asymmetryRisk)).toFixed(1))
          : null,
    };

    return {
      historyId: `history_${Date.now()}`,
      sessionId: this.session.sessionId,
      patientKey: this.session.patientKey,
      patientName: String(p.name ?? ""),
      birthDate: p.birthDate ? String(p.birthDate) : undefined,
      age: Number(this.session.patient.age ?? 0),
      educationYears: Number(this.session.patient.educationYears ?? 0),
      place: this.session.place,
      trainingMode: mode,
      rehabStep: normalizedRehabStep,
      completedAt: this.session.completedAt ?? Date.now(),
      aq: Number(aq),
      stepScores,
      stepDetails,
      articulationScores: {
        step2: {
          averageConsonantAccuracy: Number(
            this.session.step2?.averageConsonantAccuracy ?? 0,
          ),
          averageVowelAccuracy: Number(
            this.session.step2?.averageVowelAccuracy ?? 0,
          ),
        },
        step3: {
          averageConsonantAccuracy: Number(
            this.session.step3?.averageConsonantAccuracy ?? 0,
          ),
          averageVowelAccuracy: Number(
            this.session.step3?.averageVowelAccuracy ?? 0,
          ),
        },
        step4: {
          averageConsonantAccuracy: Number(step4Consonant ?? 0),
          averageVowelAccuracy: Number(step4Vowel ?? 0),
        },
        step5: {
          averageConsonantAccuracy: Number(
            this.session.step5?.averageConsonantAccuracy ?? 0,
          ),
          averageVowelAccuracy: Number(
            this.session.step5?.averageVowelAccuracy ?? 0,
          ),
        },
        articulationWritingConsistency: {
          step4: Number(
            this.session.step4?.averageArticulationWritingConsistency ?? 0,
          ),
          step5: Number(
            this.session.step5?.averageArticulationWritingConsistency ?? 0,
          ),
          step6: Number(
            this.session.step6?.items?.length
              ? this.session.step6.items.reduce(
                  (sum, row) => sum + Number((row as any)?.articulationWritingConsistency ?? 0),
                  0,
                ) / this.session.step6.items.length
              : 0,
          ),
        },
      },
      stepVersionSnapshots,
      facialAnalysisSnapshot: {
        asymmetryRisk: Number(asymmetryRisk.toFixed(1)),
        articulationGap: Number(articulationGap.toFixed(1)),
        overallConsonant: Number(overallConsonant.toFixed(1)),
        overallVowel: Number(overallVowel.toFixed(1)),
        articulationFaceMatchSummary,
        timelineCurrentAsymmetry: Number(asymmetryRisk.toFixed(1)),
        trackingQuality: Number(trackingQuality.toFixed(1)),
        baseline: {
          oralCommissureAsymmetry: Number(oralCommissureBaseline.toFixed(1)),
          lipClosureAsymmetry: Number(lipClosureBaseline.toFixed(1)),
          vowelArticulationVariance: vowelVarianceBaseline,
        },
        sessionAverage: {
          oralCommissureAsymmetry: Number(oralCommissureCurrent.toFixed(1)),
          lipClosureAsymmetry: Number(lipClosureCurrent.toFixed(1)),
          vowelArticulationVariance: vowelVarianceCurrent,
        },
        delta: {
          oralCommissureAsymmetry: Number(
            (oralCommissureCurrent - oralCommissureBaseline).toFixed(1),
          ),
          lipClosureAsymmetry: Number(
            (lipClosureCurrent - lipClosureBaseline).toFixed(1),
          ),
          vowelArticulationVariance: Number(
            (vowelVarianceCurrent - vowelVarianceBaseline).toFixed(1),
          ),
        },
        longitudinalDelta,
      },
      measurementQuality,
      vnv: this.buildVnvSnapshot(historyRequirementIds),
    };
  }

  private saveHistoryEntry(mode: TrainingMode = "self", rehabStep?: number) {
    if (typeof window === "undefined") return;
    if (!ENABLE_LOCAL_HISTORY_CACHE) return;

    const entry = this.buildHistoryEntry(mode, rehabStep);
    if (!entry) return;

    const historyKey = this.getHistoryStorageKey();
    let existing: TrainingHistoryEntry[] = [];
    try {
      const raw = localStoreAdapter.getItem(historyKey);
      existing = raw ? (JSON.parse(raw) as TrainingHistoryEntry[]) : [];
      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }

    const next = mergeHistoryEntriesForStorage(existing, entry);

    const isQuotaExceededError = (error: unknown) => {
      if (error instanceof DOMException) {
        return error.name === "QuotaExceededError" || error.code === 22;
      }
      if (typeof error === "object" && error !== null && "name" in error) {
        return (error as { name?: string }).name === "QuotaExceededError";
      }
      return false;
    };

    try {
      localStoreAdapter.setItem(historyKey, JSON.stringify(next));
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        console.warn("[SessionManager] history save failed", error);
        return;
      }
      const compacted = next.map((row) => compactHistoryEntryForStorage(row)).slice(-20);
      try {
        localStoreAdapter.setItem(historyKey, JSON.stringify(compacted));
      } catch (retryError) {
        if (!isQuotaExceededError(retryError)) {
          console.warn("[SessionManager] compact history save failed", retryError);
          return;
        }
        const minimal = compacted.slice(-8).map((row) => ({
          ...row,
          stepDetails: {
            step1: [],
            step2: [],
            step3: [],
            step4: [],
            step5: [],
            step6: [],
          },
        }));
        try {
          localStoreAdapter.setItem(historyKey, JSON.stringify(minimal));
        } catch (finalError) {
          console.warn("[SessionManager] minimal history save failed", finalError);
          // 마지막 방어: 히스토리 저장 실패를 앱 흐름 오류로 전파하지 않음
        }
      }
    }
  }

  static getHistoryFor(patient: PatientProfile): TrainingHistoryEntry[] {
    if (!ENABLE_LOCAL_HISTORY_CACHE) return [];
    if (typeof window === "undefined") return [];
    const patientKey = SessionManager.getPatientKey(patient);
    const key = `${HISTORY_STORAGE_PREFIX}:${patientKey}`;
    try {
      const raw = localStoreAdapter.getItem(key);
      const rows = raw ? (JSON.parse(raw) as TrainingHistoryEntry[]) : [];
      if (!Array.isArray(rows)) return [];
      return rows.sort((a, b) => a.completedAt - b.completedAt);
    } catch {
      return [];
    }
  }

  static saveSingHistory(
    patient: PatientProfile,
    result: SingHistoryResult,
    completedAt: number = Date.now(),
  ) {
    if (!ENABLE_LOCAL_HISTORY_CACHE) {
      const p = patient as any;
      return {
        historyId: `history_sing_${completedAt}`,
        sessionId: `sing_${completedAt}`,
        patientKey: SessionManager.getPatientKey(patient),
        patientName: String(p.name ?? ""),
        birthDate: p.birthDate ? String(p.birthDate) : undefined,
        age: Number(patient.age ?? 0),
        educationYears: Number(patient.educationYears ?? 0),
        place: "brain-sing",
        trainingMode: "sing" as TrainingMode,
        completedAt,
        aq: Number(result.score ?? 0),
        singResult: result,
        stepScores: {
          step1: 0,
          step2: 0,
          step3: 0,
          step4: 0,
          step5: 0,
          step6: 0,
        },
        stepDetails: {
          step1: [],
          step2: [],
          step3: [],
          step4: [],
          step5: [],
          step6: [],
        },
      } satisfies TrainingHistoryEntry;
    }
    if (typeof window === "undefined") return null;
    const patientKey = SessionManager.getPatientKey(patient);
    const key = `${HISTORY_STORAGE_PREFIX}:${patientKey}`;
    let rows: TrainingHistoryEntry[] = [];
    try {
      const raw = localStoreAdapter.getItem(key);
      rows = raw ? (JSON.parse(raw) as TrainingHistoryEntry[]) : [];
      if (!Array.isArray(rows)) rows = [];
    } catch {
      rows = [];
    }

    const duplicated = rows.find(
      (row) =>
        row.trainingMode === "sing" &&
        row.completedAt === completedAt &&
        row.singResult?.song === result.song &&
        Number(row.singResult?.score ?? row.aq ?? 0) === Number(result.score),
    );
    if (duplicated) return duplicated;

    const p = patient as any;
    const entry: TrainingHistoryEntry = {
      historyId: `history_sing_${completedAt}`,
      sessionId: `sing_${completedAt}`,
      patientKey,
      patientName: String(p.name ?? ""),
      birthDate: p.birthDate ? String(p.birthDate) : undefined,
      age: Number(patient.age ?? 0),
      educationYears: Number(patient.educationYears ?? 0),
      place: "brain-sing",
      trainingMode: "sing",
      completedAt,
      aq: Number(result.score ?? 0),
      singResult: result,
      stepScores: {
        step1: 0,
        step2: 0,
        step3: 0,
        step4: 0,
        step5: 0,
        step6: 0,
      },
      stepDetails: {
        step1: [],
        step2: [],
        step3: [],
        step4: [],
        step5: [],
        step6: [],
      },
    };

    const next = [...rows, entry]
      .filter(
        (row, i, arr) =>
          arr.findIndex(
            (x) => x.historyId === row.historyId || x.sessionId === row.sessionId,
          ) === i,
      )
      .sort((a, b) => a.completedAt - b.completedAt)
      .slice(-50);

    localStoreAdapter.setItem(key, JSON.stringify(next));
    return entry;
  }

  static deleteHistoryEntries(
    patient: PatientProfile,
    historyIds: string[],
  ): number {
    if (!ENABLE_LOCAL_HISTORY_CACHE) return 0;
    if (typeof window === "undefined" || !Array.isArray(historyIds) || historyIds.length === 0) {
      return 0;
    }
    const patientKey = SessionManager.getPatientKey(patient);
    const key = `${HISTORY_STORAGE_PREFIX}:${patientKey}`;
    const target = new Set(historyIds.map((id) => String(id)));
    try {
      const raw = localStoreAdapter.getItem(key);
      const rows = raw ? (JSON.parse(raw) as TrainingHistoryEntry[]) : [];
      if (!Array.isArray(rows)) return 0;
      const next = rows.filter((row) => !target.has(String(row.historyId)));
      localStoreAdapter.setItem(key, JSON.stringify(next));
      return Math.max(0, rows.length - next.length);
    } catch {
      return 0;
    }
  }

  static getAQTrendFor(patient: PatientProfile, place?: string) {
    const rows = SessionManager.getHistoryFor(patient).filter(
      (r) => !place || r.place === place,
    );
    const latest = rows.length ? rows[rows.length - 1] : null;
    const previous = rows.length > 1 ? rows[rows.length - 2] : null;
    const delta = latest && previous ? Number((latest.aq - previous.aq).toFixed(1)) : null;
    return { latest, previous, delta, count: rows.length };
  }

  static seedMockHistoryFor(
    patient: PatientProfile,
    place: string,
    count: number = 5,
  ): number {
    if (!ENABLE_LOCAL_HISTORY_CACHE) return 0;
    if (typeof window === "undefined" || count <= 0) return 0;
    const patientKey = SessionManager.getPatientKey(patient);
    const key = `${HISTORY_STORAGE_PREFIX}:${patientKey}`;

    let existing: TrainingHistoryEntry[] = [];
    try {
      const raw = localStoreAdapter.getItem(key);
      existing = raw ? (JSON.parse(raw) as TrainingHistoryEntry[]) : [];
      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }

    const now = Date.now();
    const baseAQ = 58;
    const mockRows: TrainingHistoryEntry[] = Array.from({ length: count }).map(
      (_, idx) => {
        const aq = Number((baseAQ + idx * 2.3).toFixed(1));
        const dt = now - (count - idx) * 1000 * 60 * 60 * 24 * 7;
        const mk = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
        return {
          historyId: `mock_${dt}_${idx}`,
          sessionId: `mock_session_${dt}_${idx}`,
          patientKey,
          patientName: String((patient as any).name ?? ""),
          birthDate: (patient as any).birthDate || undefined,
          age: Number(patient.age ?? 0),
          educationYears: Number(patient.educationYears ?? 0),
          place,
          trainingMode: "self",
          completedAt: dt,
          aq,
          stepScores: {
            step1: mk(50 + idx * 4),
            step2: mk(54 + idx * 4),
            step3: mk(58 + idx * 4),
            step4: mk(52 + idx * 3),
            step5: mk(60 + idx * 4),
            step6: mk(56 + idx * 5),
          },
          stepDetails: {
            step1: [
              {
                text: "예시 청각 이해 문항",
                isCorrect: true,
              },
            ],
            step2: [
              {
                text: "예시 따라말하기 문장",
                isCorrect: true,
              },
            ],
            step3: [
              {
                text: "예시 단어 명명 정답",
                isCorrect: true,
              },
            ],
            step4: [
              {
                text: "예시 유창성 발화",
                isCorrect: idx % 2 === 0,
              },
            ],
            step5: [
              {
                text: "예시 읽기 문장",
                isCorrect: true,
              },
            ],
            step6: [
              {
                text: "예시 쓰기 단어",
                isCorrect: true,
              },
            ],
          },
        };
      },
    );

    const deduped = [...existing, ...mockRows]
      .filter(
        (row, i, arr) =>
          arr.findIndex(
            (x) => x.sessionId === row.sessionId || x.historyId === row.historyId,
          ) === i,
      )
      .sort((a, b) => a.completedAt - b.completedAt)
      .slice(-50);

    localStoreAdapter.setItem(key, JSON.stringify(deduped));
    return mockRows.length;
  }

  private static getStorageKey(patient: PatientProfile, place: string): string {
    return `${SESSION_STORAGE_PREFIX}:${SessionManager.getPatientKey(patient)}:${place}`;
  }

  private static buildProgressParams(session: TrainingSession) {
    const step1 = String(session.step1?.correctAnswers ?? 0);
    const step2 = String(Math.round(session.step2?.averagePronunciation ?? 0));
    const step3 = String(session.step3?.score ?? 0);
    const step4 = String(session.step4?.score ?? 0);
    const step5 = session.step5
      ? String(
          (() => {
            const itemScores = (session.step5?.items || [])
              .map((item: any) => Number(item?.readingScore))
              .filter((v: number) => Number.isFinite(v));
            if (itemScores.length) {
              return Math.round(
                itemScores.reduce((sum: number, v: number) => sum + v, 0) /
                  itemScores.length,
              );
            }
            return Math.round(
              (session.step5.correctAnswers / session.step5.totalQuestions) * 100,
            );
          })(),
        )
      : "0";
    const step6 = String(session.step6?.accuracy ?? 0);

    return { step1, step2, step3, step4, step5, step6 };
  }

  static getResumePath(patient: PatientProfile, place: string): string {
    if (typeof window === "undefined") {
      return `/programs/step-1?place=${encodeURIComponent(place)}`;
    }

    const key = SessionManager.getStorageKey(patient, place);
    const raw = localStoreAdapter.getItem(key);
    if (!raw) return `/programs/step-1?place=${encodeURIComponent(place)}`;

    try {
      const session = JSON.parse(raw) as TrainingSession;
      const s = SessionManager.buildProgressParams(session);
      const p = encodeURIComponent(place);

      if (!session.step1) return `/programs/step-1?place=${p}`;
      if (!session.step2) return `/programs/step-2?place=${p}&step1=${s.step1}`;
      if (!session.step3)
        return `/programs/step-3?place=${p}&step1=${s.step1}&step2=${s.step2}`;
      if (!session.step4)
        return `/programs/step-4?place=${p}&step1=${s.step1}&step2=${s.step2}&step3=${s.step3}`;
      if (!session.step5)
        return `/programs/step-5?place=${p}&step3=${s.step3}&step4=${s.step4}`;
      if (!session.step6)
        return `/programs/step-6?place=${p}&step1=${s.step1}&step2=${s.step2}&step3=${s.step3}&step4=${s.step4}&step5=${s.step5}`;

      return `/result-page/self-assessment?place=${p}&step1=${s.step1}&step2=${s.step2}&step3=${s.step3}&step4=${s.step4}&step5=${s.step5}&step6=${s.step6}`;
    } catch {
      return `/programs/step-1?place=${encodeURIComponent(place)}`;
    }
  }

  static clearSession() {
    if (typeof window !== "undefined") {
      const keysToRemove = localStoreAdapter.keys().filter((k) =>
        k.startsWith(`${SESSION_STORAGE_PREFIX}:`),
      );
      keysToRemove.forEach((k) => localStoreAdapter.removeItem(k));
    }
  }

  static clearSessionFor(patient: PatientProfile, place: string) {
    if (typeof window === "undefined") return;
    const key = SessionManager.getStorageKey(patient, place);
    localStoreAdapter.removeItem(key);
  }

  static hasActiveSession(): boolean {
    if (typeof window !== "undefined") {
      return localStoreAdapter.keys().some((k) =>
        k.startsWith(`${SESSION_STORAGE_PREFIX}:`),
      );
    }
    return false;
  }
}

// ============================================================================
// 4. React Hook으로 래핑
// ============================================================================

export function useSessionManager(patient: PatientProfile, place: string) {
  const manager = new SessionManager(patient, place);

  return {
    session: manager.getSession(),
    kwabScores: manager.getKWABScores(),
    completionRate: manager.getCompletionRate(),
    saveStep1: (result: Step1Result) => manager.saveStep1Result(result),
    saveStep2: (result: Step2Result) => manager.saveStep2Result(result),
    saveStep3: (result: Step3Result) => manager.saveStep3Result(result),
    saveStep4: (result: Step4Result) => manager.saveStep4Result(result),
    saveStep5: (result: Step5Result) => manager.saveStep5Result(result),
    saveStep6: (result: Step6Result) => manager.saveStep6Result(result),
  };
}

