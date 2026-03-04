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

// ============================================================================
// 1. Step별 결과 타입
// ============================================================================

export interface Step1Result {
  // 청각 이해 (O/X 문제)
  correctAnswers: number;
  totalQuestions: number;
  averageResponseTime: number; // ms
  timestamp: number;
  items: Array<{
    question: string;
    userAnswer: boolean | null;
    correctAnswer: boolean;
    isCorrect: boolean;
    responseTime: number;
  }>;
}

export interface Step2Result {
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
  }>;
  averageSymmetry: number;
  averagePronunciation: number;
  averageConsonantAccuracy?: number;
  averageVowelAccuracy?: number;
  timestamp: number;
}

export interface Step3Result {
  items: any[]; // 상세 데이터 보존용
  score: number; // 0-100 점수
  correctCount: number; // 맞은 개수 (기존 correctAnswers 대신 사용)
  totalCount: number; // 전체 개수 (기존 totalQuestions 대신 사용)
  averageConsonantAccuracy?: number;
  averageVowelAccuracy?: number;
  timestamp: number;
}

export interface Step4Result {
  // 유창성 학습 (자발화 유창성 평가)
  items: Array<{
    situation: string;
    prompt: string;
    transcript?: string;
    isCorrect?: boolean;
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
  }>;
}
export interface Step6Result {
  //쓰기학습
  completedTasks: number;
  totalTasks: number;
  accuracy: number;
  timestamp: number;
  items: Array<{
    word: string;
    expectedStrokes: number;
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
}

// ============================================================================
// 3. SessionManager 클래스
// ============================================================================

const SESSION_STORAGE_PREFIX = "kwab_training_session";
const HISTORY_STORAGE_PREFIX = "kwab_training_history";
export type TrainingMode = "self" | "rehab";

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
  completedAt: number;
  aq: number;
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
  };
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
      };
      this.saveSession();
    }
  }

  // ========================================================================
  // Step별 결과 저장
  // ========================================================================

  saveStep1Result(result: Step1Result) {
    this.session.step1 = result;
    this.updateKWABScores();
    this.saveSession();
  }

  saveStep2Result(result: Step2Result) {
    this.session.step2 = result;
    this.updateKWABScores();
    this.saveSession();
  }

  saveStep3Result(result: Step3Result) {
    this.session.step3 = result;
    this.updateKWABScores();
    this.saveSession();
  }

  saveStep4Result(result: Step4Result) {
    this.session.step4 = result;
    this.updateKWABScores();
    this.saveSession();
  }

  saveStep5Result(result: Step5Result) {
    this.session.step5 = result;
    this.updateKWABScores();
    this.saveSession();
  }

  saveStep6Result(result: Step6Result, mode: TrainingMode = "self") {
    this.session.step6 = result;
    this.session.completedAt = Date.now();
    this.updateKWABScores();
    this.saveSession();
    this.saveHistoryEntry(mode);
  }

  finalizeSessionAndSaveHistory(mode: TrainingMode = "self") {
    if (!this.session.completedAt) {
      this.session.completedAt = Date.now();
    }
    this.updateKWABScores();
    this.saveSession();
    this.saveHistoryEntry(mode);
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

    // 발음 정확도 평균을 100점 만점으로 변환
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

    const totalScore = Math.round(
      (step5.correctAnswers / step5.totalQuestions) * 100,
    );
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
      localStoreAdapter.setItem(this.storageKey, JSON.stringify(this.session));
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
      ? Math.round(
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
      ? Math.round(
          (this.session.step5.correctAnswers / this.session.step5.totalQuestions) *
            100,
        )
      : 0;
    const step6 = this.session.step6 ? Math.round(this.session.step6.accuracy) : 0;
    return { step1, step2, step3, step4, step5, step6 };
  }

  private saveHistoryEntry(mode: TrainingMode = "self") {
    if (typeof window === "undefined") return;
    const aq = this.session.kwabScores?.aq;
    if (aq === undefined || aq === null) return;

    const historyKey = this.getHistoryStorageKey();
    let existing: TrainingHistoryEntry[] = [];
    try {
      const raw = localStoreAdapter.getItem(historyKey);
      existing = raw ? (JSON.parse(raw) as TrainingHistoryEntry[]) : [];
      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }

    const readArray = (key: string) => {
      try {
        const raw = localStoreAdapter.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const step1Rows = readArray("step1_data");
    const step2Rows = readArray("step2_recorded_audios");
    const step3Rows = readArray("step3_data");
    const step4Rows = readArray("step4_recorded_audios");
    const step5Rows = readArray("step5_recorded_data");
    const step6Rows = readArray("step6_recorded_data");

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const avgByKey = (rows: any[], key: string) => {
      const vals = rows
        .map((r) => Number((r as any)?.[key]))
        .filter((v) => Number.isFinite(v) && v > 0);
      return avg(vals);
    };
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
    const asymmetryRisk = avg(
      toNums(step2Rows, "symmetryScore").map((v) =>
        Math.max(0, Math.min(100, 100 - v)),
      ),
    );
    const articulationGap = Math.abs(overallConsonant - overallVowel);
    const articulationFaceMatchSummary =
      asymmetryRisk >= 45 && articulationGap >= 18
        ? "비대칭 및 자모음 편차가 동반되어 협응 훈련 권고"
        : asymmetryRisk >= 35
          ? "비대칭 신호 관찰, 좌우 협응 훈련 권고"
          : articulationGap >= 15
            ? "자모음 편차 관찰, 약한 영역 집중 권고"
            : "음성-안면 매칭 안정 범위";

    const p = this.session.patient as any;
    const entry: TrainingHistoryEntry = {
      historyId: `history_${Date.now()}`,
      sessionId: this.session.sessionId,
      patientKey: this.session.patientKey,
      patientName: String(p.name ?? ""),
      birthDate: p.birthDate ? String(p.birthDate) : undefined,
      age: Number(this.session.patient.age ?? 0),
      educationYears: Number(this.session.patient.educationYears ?? 0),
      place: this.session.place,
      trainingMode: mode,
      completedAt: this.session.completedAt ?? Date.now(),
      aq: Number(aq),
      stepScores: this.getStepScoresForHistory(),
      stepDetails: {
        step1: step1Rows,
        step2: step2Rows,
        step3: step3Rows,
        step4: step4Rows,
        step5: step5Rows,
        step6: step6Rows,
      },
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
      facialAnalysisSnapshot: {
        asymmetryRisk: Number(asymmetryRisk.toFixed(1)),
        articulationGap: Number(articulationGap.toFixed(1)),
        overallConsonant: Number(overallConsonant.toFixed(1)),
        overallVowel: Number(overallVowel.toFixed(1)),
        articulationFaceMatchSummary,
        timelineCurrentAsymmetry: Number(asymmetryRisk.toFixed(1)),
      },
    };

    const withoutSameSession = existing.filter((e) => e.sessionId !== entry.sessionId);
    const next = [...withoutSameSession, entry]
      .sort((a, b) => a.completedAt - b.completedAt)
      .slice(-50);
    localStoreAdapter.setItem(historyKey, JSON.stringify(next));
  }

  static getHistoryFor(patient: PatientProfile): TrainingHistoryEntry[] {
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
          Math.round(
            (session.step5.correctAnswers / session.step5.totalQuestions) * 100,
          ),
        )
      : "0";
    const step6 = String(session.step6?.accuracy ?? 0);

    return { step1, step2, step3, step4, step5, step6 };
  }

  static getResumePath(patient: PatientProfile, place: string): string {
    if (typeof window === "undefined") {
      return `/step-1?place=${encodeURIComponent(place)}`;
    }

    const key = SessionManager.getStorageKey(patient, place);
    const raw = localStoreAdapter.getItem(key);
    if (!raw) return `/step-1?place=${encodeURIComponent(place)}`;

    try {
      const session = JSON.parse(raw) as TrainingSession;
      const s = SessionManager.buildProgressParams(session);
      const p = encodeURIComponent(place);

      if (!session.step1) return `/step-1?place=${p}`;
      if (!session.step2) return `/step-2?place=${p}&step1=${s.step1}`;
      if (!session.step3)
        return `/step-3?place=${p}&step1=${s.step1}&step2=${s.step2}`;
      if (!session.step4)
        return `/step-4?place=${p}&step1=${s.step1}&step2=${s.step2}&step3=${s.step3}`;
      if (!session.step5)
        return `/step-5?place=${p}&step3=${s.step3}&step4=${s.step4}`;
      if (!session.step6)
        return `/step-6?place=${p}&step1=${s.step1}&step2=${s.step2}&step3=${s.step3}&step4=${s.step4}&step5=${s.step5}`;

      return `/result?place=${p}&step1=${s.step1}&step2=${s.step2}&step3=${s.step3}&step4=${s.step4}&step5=${s.step5}&step6=${s.step6}`;
    } catch {
      return `/step-1?place=${encodeURIComponent(place)}`;
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
