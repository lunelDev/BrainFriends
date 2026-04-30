// src/lib/training/gazeAccumulator.ts
//
// 시선(보조 채널) 세션 누적기.
// 제품제안서 p.7 5채널 중 4번 보조 채널(시선)의 세션 단위 요약을 계산한다.
// FaceTracker 가 onMetricsUpdate 로 매 프레임 push 하는 gaze 결과를 받아
// "이번 step / 이번 세션 동안 사용자가 화면을 얼마나 응시했는가" 를 산출한다.
//
// SessionManager 와 직접 결합하지 않고 단일 모듈로 분리하여
//   - V&V 결정성 단위 테스트가 단순해진다 (SR-GAZE-007 의 일부).
//   - 장래 step page / sidebar / 결과 리포트가 동일 인스턴스를 share 하기 쉽다.

const OFF_TASK_THRESHOLD = 0.5; // centeredScore/100 < 0.5 → off-task 로 카운트
const PARTIAL_DETECT_THRESHOLD = 0.5; // iris 검출률 ≥ 0.5 면 partial 이상
const MEASURED_DETECT_THRESHOLD = 0.85; // iris 검출률 ≥ 0.85 면 measured

export interface GazeAccumulatorSnapshot {
  totalSamples: number;
  irisDetectedSamples: number;
  /** 0..100 기준 centeredScore 합계 (iris 검출된 샘플만). */
  centeredScoreSum: number;
  offTaskSamples: number;
  startedAt: number | null;
  lastUpdatedAt: number | null;
}

export interface GazeAccumulatorReport {
  /** 0..1, iris 검출 샘플의 평균 centeredScore. iris 검출이 0이면 0. */
  attentionRatio: number;
  /** 0..1, iris 검출 샘플 중 off-task (centered < 0.5) 비율. */
  offTaskRatio: number;
  /** 0..1, 전체 샘플 중 iris 검출된 샘플 비율. 측정 품질 게이트의 입력. */
  irisDetectionRatio: number;
  /** 누적 기간 (ms). */
  durationMs: number;
  /** 총 record 호출 횟수. */
  totalSamples: number;
  /** SessionManager / measurementQuality 와 동일한 3단계 분류. */
  measurementQuality: "measured" | "partial" | "demo";
}

export function buildGazeHistorySummary(
  report: GazeAccumulatorReport,
): GazeAccumulatorReport | null {
  if (!report || report.totalSamples <= 0) return null;
  return { ...report };
}

const initialState = (): GazeAccumulatorSnapshot => ({
  totalSamples: 0,
  irisDetectedSamples: 0,
  centeredScoreSum: 0,
  offTaskSamples: 0,
  startedAt: null,
  lastUpdatedAt: null,
});

export class GazeAccumulator {
  private state: GazeAccumulatorSnapshot = initialState();

  reset(): void {
    this.state = initialState();
  }

  /**
   * @param centeredScore 0..100 (FaceTracker / faceAnalysis.calculateGazeMetrics 출력 그대로)
   * @param irisDetected  iris 랜드마크 정상 검출 여부
   * @param nowMs         테스트 결정성을 위해 외부 시계 주입 가능
   */
  record(args: {
    centeredScore: number;
    irisDetected: boolean;
    nowMs?: number;
  }): void {
    const now = typeof args.nowMs === "number" ? args.nowMs : Date.now();
    if (this.state.startedAt === null) {
      this.state.startedAt = now;
    }
    this.state.lastUpdatedAt = now;
    this.state.totalSamples += 1;

    if (!args.irisDetected) return;

    this.state.irisDetectedSamples += 1;
    const score = clamp01(Number(args.centeredScore) / 100);
    this.state.centeredScoreSum += score * 100;
    if (score < OFF_TASK_THRESHOLD) {
      this.state.offTaskSamples += 1;
    }
  }

  snapshot(): GazeAccumulatorSnapshot {
    return { ...this.state };
  }

  report(): GazeAccumulatorReport {
    const { totalSamples, irisDetectedSamples, centeredScoreSum, offTaskSamples, startedAt, lastUpdatedAt } =
      this.state;

    const attentionRatio =
      irisDetectedSamples > 0
        ? clamp01(centeredScoreSum / irisDetectedSamples / 100)
        : 0;
    const offTaskRatio =
      irisDetectedSamples > 0
        ? clamp01(offTaskSamples / irisDetectedSamples)
        : 0;
    const irisDetectionRatio =
      totalSamples > 0 ? clamp01(irisDetectedSamples / totalSamples) : 0;

    const durationMs =
      startedAt !== null && lastUpdatedAt !== null
        ? Math.max(0, lastUpdatedAt - startedAt)
        : 0;

    let measurementQuality: GazeAccumulatorReport["measurementQuality"] = "demo";
    if (irisDetectionRatio >= MEASURED_DETECT_THRESHOLD) {
      measurementQuality = "measured";
    } else if (irisDetectionRatio >= PARTIAL_DETECT_THRESHOLD) {
      measurementQuality = "partial";
    }

    return {
      attentionRatio: round3(attentionRatio),
      offTaskRatio: round3(offTaskRatio),
      irisDetectionRatio: round3(irisDetectionRatio),
      durationMs,
      totalSamples,
      measurementQuality,
    };
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * 모듈 단위 싱글톤. layout.tsx 의 onMetricsUpdate 에서 record 하고
 * step page 종료 시 report() 를 읽어 결과 페이로드에 포함시킬 수 있다.
 */
export const gazeAccumulator = new GazeAccumulator();
