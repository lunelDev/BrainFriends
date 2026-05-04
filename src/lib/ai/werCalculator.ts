// src/lib/ai/werCalculator.ts
//
// SR-AI-EVAL-014. WER (Word Error Rate) / CER (Character Error Rate) 결정성 계산.
// 식약처 AI 적용 디지털의료기기 가이드라인 PDF #2 §III.2 성능 검증의
// "기계학습 기반 STT 모듈 정확도 산출" 산출물.
//
// 알고리즘: Levenshtein edit distance (단어/글자 단위) ÷ reference 길이.
// 결정성: 동일 (reference, hypothesis) 입력 → 동일 WER/CER.

export interface WerResult {
  reference: string;
  hypothesis: string;
  /** 0.0 (perfect) ~ 1.0 (totally wrong). reference 가 빈 경우 hypothesis 가 비었으면 0, 아니면 1 */
  wer: number;
  /** 글자 단위 동일 척도. 한국어 음절 단위로 적용. */
  cer: number;
  refWords: number;
  hypWords: number;
  refChars: number;
  hypChars: number;
  wordEdits: number;
  charEdits: number;
}

/**
 * Levenshtein distance (insert / delete / substitute 비용 1 각각).
 * 결정성: 동일 입력 → 동일 출력. O(n*m) 시간/공간.
 */
export function levenshtein<T>(a: readonly T[], b: readonly T[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const dp: number[] = new Array(m + 1);
  for (let j = 0; j <= m; j++) dp[j] = j;
  for (let i = 1; i <= n; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= m; j++) {
      const tmp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = tmp;
    }
  }
  return dp[m];
}

/**
 * 한국어 텍스트 정규화: 공백 압축, NFC, 소문자(영문만), 구두점 제거.
 * 결정성: 동일 입력 → 동일 출력.
 */
export function normalizeForWer(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[.,!?…“”"'()\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function tokenizeWords(text: string): string[] {
  const norm = normalizeForWer(text);
  if (!norm) return [];
  return norm.split(" ");
}

export function tokenizeChars(text: string): string[] {
  const norm = normalizeForWer(text).replace(/\s+/g, "");
  if (!norm) return [];
  return Array.from(norm);
}

/**
 * 결정성 WER + CER 계산.
 * reference 가 비어있을 때:
 *   - hypothesis 도 비면 WER=0, CER=0
 *   - hypothesis 가 있으면 WER=1, CER=1 (전부 insert)
 */
export function calculateWer(reference: string, hypothesis: string): WerResult {
  const refWords = tokenizeWords(reference);
  const hypWords = tokenizeWords(hypothesis);
  const refChars = tokenizeChars(reference);
  const hypChars = tokenizeChars(hypothesis);

  const wordEdits = levenshtein(refWords, hypWords);
  const charEdits = levenshtein(refChars, hypChars);

  let wer: number;
  if (refWords.length === 0) {
    wer = hypWords.length === 0 ? 0 : 1;
  } else {
    wer = Math.min(1, wordEdits / refWords.length);
  }

  let cer: number;
  if (refChars.length === 0) {
    cer = hypChars.length === 0 ? 0 : 1;
  } else {
    cer = Math.min(1, charEdits / refChars.length);
  }

  return {
    reference,
    hypothesis,
    wer: round4(wer),
    cer: round4(cer),
    refWords: refWords.length,
    hypWords: hypWords.length,
    refChars: refChars.length,
    hypChars: hypChars.length,
    wordEdits,
    charEdits,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export interface WerAggregate {
  total: number;
  meanWer: number;
  meanCer: number;
  /** WER ≤ 0.15 (제품기획서 목표) 비율 */
  passRateAt15: number;
}

export function aggregateWer(results: WerResult[]): WerAggregate {
  if (results.length === 0) {
    return { total: 0, meanWer: 0, meanCer: 0, passRateAt15: 0 };
  }
  const sumW = results.reduce((s, r) => s + r.wer, 0);
  const sumC = results.reduce((s, r) => s + r.cer, 0);
  const passing = results.filter((r) => r.wer <= 0.15).length;
  return {
    total: results.length,
    meanWer: round4(sumW / results.length),
    meanCer: round4(sumC / results.length),
    passRateAt15: round4(passing / results.length),
  };
}
