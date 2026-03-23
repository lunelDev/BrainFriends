import { REHAB_STEP_LABELS } from "@/lib/results/rehab/constants";
import { TRAINING_PLACES } from "@/constants/trainingData";
import { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { getSelfItemFeedback as getSelfItemFeedbackFromResult } from "@/features/result/utils/resultHelpers";

export const STEP_META = [
  { key: "step1", label: "1단계 이해" },
  { key: "step2", label: "2단계 따라 말하기" },
  { key: "step3", label: "3단계 매칭" },
  { key: "step4", label: "4단계 유창성" },
  { key: "step5", label: "5단계 읽기" },
  { key: "step6", label: "6단계 쓰기" },
] as const;

export type StepKey = (typeof STEP_META)[number]["key"];

export const STEP_ID_BY_KEY: Record<StepKey, number> = {
  step1: 1,
  step2: 2,
  step3: 3,
  step4: 4,
  step5: 5,
  step6: 6,
};

export const SELF_LABEL_BY_KEY: Record<StepKey, string> = {
  step1: "청각 이해",
  step2: "따라말하기",
  step3: "단어 명명",
  step4: "유창성",
  step5: "읽기",
  step6: "쓰기",
};

export function getStepItems(row: TrainingHistoryEntry, key: StepKey): any[] {
  const raw = row.stepDetails?.[key as keyof typeof row.stepDetails];
  return Array.isArray(raw) ? raw : [];
}

export function getStepScore(row: TrainingHistoryEntry, key: StepKey): number {
  const raw = row.stepScores?.[key as keyof typeof row.stepScores];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getPlaceLabel(place: string): string {
  const key = String(place || "").toLowerCase();
  const found = TRAINING_PLACES.find((p) => p.id === key);
  return found?.title || place || "-";
}

export function getRehabItemLabel(row: TrainingHistoryEntry): string {
  const step = Number(row.rehabStep);
  if (Number.isFinite(step) && step >= 1 && step <= 6) {
    return REHAB_STEP_LABELS[step as 1 | 2 | 3 | 4 | 5 | 6];
  }
  return "반복훈련";
}

export function getRehabRowScore(row: TrainingHistoryEntry): number {
  const step = Number(row.rehabStep);
  if (Number.isFinite(step) && step >= 1 && step <= 6) {
    const key = `step${step}` as StepKey;
    return getStepScore(row, key);
  }
  const scores = Object.values(row.stepScores || {}).map((v) => Number(v) || 0);
  return scores.length ? Math.max(...scores) : 0;
}

export function formatSelfMetricDisplay(key: StepKey, score: number): string {
  const safe = Number(score || 0);
  if (key === "step1" || key === "step3" || key === "step4") {
    return `${(safe / 10).toFixed(1)}/10`;
  }
  return `${safe.toFixed(1)}점`;
}

export function isSyntheticHistoryRow(row: TrainingHistoryEntry): boolean {
  const historyId = String(row.historyId || "");
  const sessionId = String(row.sessionId || "");
  return historyId.startsWith("mock_") || sessionId.startsWith("mock_session_");
}

export function getSelfItemFeedback(stepId: number, item: any) {
  return getSelfItemFeedbackFromResult(stepId, item);
}

export function shouldShowPlayButton(stepId: number, item: any) {
  return (
    [2, 4, 5].includes(stepId) &&
    Boolean(item?.audioUrl || item?.text || item?.transcript || item?.targetText || item?.prompt)
  );
}

function hasMeasuredSpeechTranscript(item: any) {
  const transcript = String(item?.transcript || "").trim();
  if (!transcript || transcript === "시연용 더미 응답입니다.") return false;
  return (
    Number.isFinite(Number(item?.finalScore ?? item?.speechScore ?? item?.readingScore)) ||
    (Number.isFinite(Number(item?.consonantAccuracy)) &&
      Number.isFinite(Number(item?.vowelAccuracy))) ||
    Number.isFinite(
      Number(item?.fluencyComponentScore ?? item?.fluencyScore ?? item?.kwabScore),
    )
  );
}

export function getPlayableText(item: any) {
  return String(
    (hasMeasuredSpeechTranscript(item) ? item?.transcript : null) ||
      item?.text ||
      item?.targetText ||
      item?.targetWord ||
      item?.prompt ||
      "...",
  );
}
