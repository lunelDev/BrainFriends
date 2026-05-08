// src/lib/xr/hangulJamo.ts
//
// XR VR 투어 화면 (R&D Preview) 의 자음/모음 정확도 계산 헬퍼.
//
// 정책:
//   - 정식 SaMD 임상 평가에는 사용하지 않는다 — 어디까지나 사용자 피드백
//     수치 표시 용도. 본 페이지는 임상 데이터 채널과 분리되어 있다.
//   - 임상용 발화 정확도/조음 평가는 voice-analysis-service + K-WAB 보조
//     채점 파이프라인에서 별도로 산출된다.
//
// 산출 방법:
//   1) 기대 텍스트(expected)와 인식 텍스트(recognized)에서 모든 한글 음절을
//      초성/중성/종성으로 분해해 자모 시퀀스를 만든다.
//   2) 자음 시퀀스(초성+종성)와 모음 시퀀스(중성)를 각각 추출한다.
//   3) Levenshtein 거리로 정렬 후 매치율을 계산해 정확도(0~1)를 반환한다.
//
// 참고:
//   - Hangul Syllable Block: U+AC00 ~ U+D7A3 (총 11,172자)
//     code = 44032 + (cho * 588) + (jung * 28) + jong
//     → cho = (code - 44032) / 588
//     → jung = ((code - 44032) % 588) / 28
//     → jong = (code - 44032) % 28  (0 이면 종성 없음)
//
//   - 한글이 아닌 문자(공백·숫자·영문 등)는 비교 대상에서 제외한다.

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

/** 분해된 자모. 종성이 없는 경우 final 은 null. */
export type HangulJamo = {
  initial: number; // 초성 index (0~18)
  medial: number; // 중성 index (0~20)
  final: number | null; // 종성 index (0~27), 0 은 "종성 없음"이지만 null 로 통일
};

/** 한 음절을 초성/중성/종성으로 분해한다. 한글이 아니면 null. */
export function decomposeSyllable(ch: string): HangulJamo | null {
  if (!ch) return null;
  const code = ch.codePointAt(0);
  if (code === undefined || code < HANGUL_BASE || code > HANGUL_LAST) return null;
  const offset = code - HANGUL_BASE;
  const initial = Math.floor(offset / 588);
  const medial = Math.floor((offset % 588) / 28);
  const final = offset % 28;
  return {
    initial,
    medial,
    final: final === 0 ? null : final,
  };
}

/** 문자열을 음절 단위로 순회하며 자음·모음 시퀀스로 분해한다. */
export function extractJamoSequences(text: string): {
  consonants: number[]; // 초성 + 종성 (있을 때만)
  vowels: number[]; // 중성
} {
  const consonants: number[] = [];
  const vowels: number[] = [];
  for (const ch of text) {
    const j = decomposeSyllable(ch);
    if (!j) continue;
    consonants.push(j.initial);
    vowels.push(j.medial);
    if (j.final !== null) consonants.push(j.final + 100); // 초성 index 와 충돌 방지
  }
  return { consonants, vowels };
}

/** Levenshtein distance — O(n*m) 동적 계획법. */
function levenshtein(a: number[], b: number[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  // 1 차원 DP — 메모리 O(min(n,m)).
  const prev = new Array<number>(m + 1);
  const curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j += 1) prev[j] = j;
  for (let i = 1; i <= n; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= m; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    for (let j = 0; j <= m; j += 1) prev[j] = curr[j];
  }
  return prev[m];
}

/**
 * 두 자모 시퀀스를 비교해 0~1 매치율 반환.
 * - reference 길이 0 이면 0 반환 (의미 없는 비교).
 * - 1 - (편집거리 / max(ref, hyp)) 로 계산해 빠뜨림/잘못 인식 모두 페널티.
 */
function jamoAccuracy(ref: number[], hyp: number[]): number {
  if (ref.length === 0) return 0;
  if (hyp.length === 0) return 0;
  const dist = levenshtein(ref, hyp);
  const denom = Math.max(ref.length, hyp.length);
  if (denom === 0) return 0;
  const acc = 1 - dist / denom;
  return Math.max(0, Math.min(1, acc));
}

export type JamoAccuracyResult = {
  /** 자음 (초성+종성) 매치율 0~1 */
  consonantAccuracy: number;
  /** 모음 (중성) 매치율 0~1 */
  vowelAccuracy: number;
  /** 정규화된 평균 0~1 */
  overall: number;
  /** 원본 자모 시퀀스 길이 — 디버그/표시용 */
  refConsonantCount: number;
  refVowelCount: number;
};

/**
 * expected 와 recognized 를 비교해 자음/모음 정확도를 산출.
 * - 공백·구두점은 무시 (한글 음절만 비교).
 * - recognized 가 비어있어도 객체는 0 으로 채워서 반환 — UI 가 항상 그릴 수 있음.
 */
export function computeJamoAccuracy(
  expected: string,
  recognized: string,
): JamoAccuracyResult {
  const ref = extractJamoSequences(expected || "");
  const hyp = extractJamoSequences(recognized || "");
  const consonantAccuracy = jamoAccuracy(ref.consonants, hyp.consonants);
  const vowelAccuracy = jamoAccuracy(ref.vowels, hyp.vowels);
  const overall =
    ref.consonants.length + ref.vowels.length === 0
      ? 0
      : (consonantAccuracy * ref.consonants.length +
          vowelAccuracy * ref.vowels.length) /
        (ref.consonants.length + ref.vowels.length);
  return {
    consonantAccuracy,
    vowelAccuracy,
    overall,
    refConsonantCount: ref.consonants.length,
    refVowelCount: ref.vowels.length,
  };
}

/**
 * 후보 여러 개와 비교해 가장 잘 맞는 것을 고른다 — 시나리오 한 단계에서
 * 사용자가 4개 키워드 중 하나를 말했을 때 어떤 걸 의도했는지 추정.
 */
export function pickBestMatch(
  recognized: string,
  candidates: { id: string; phrase: string }[],
): {
  matched: { id: string; phrase: string } | null;
  result: JamoAccuracyResult;
} {
  if (!recognized || candidates.length === 0) {
    return {
      matched: null,
      result: {
        consonantAccuracy: 0,
        vowelAccuracy: 0,
        overall: 0,
        refConsonantCount: 0,
        refVowelCount: 0,
      },
    };
  }
  let best: { id: string; phrase: string } | null = null;
  let bestResult: JamoAccuracyResult = {
    consonantAccuracy: 0,
    vowelAccuracy: 0,
    overall: 0,
    refConsonantCount: 0,
    refVowelCount: 0,
  };
  for (const c of candidates) {
    const r = computeJamoAccuracy(c.phrase, recognized);
    if (r.overall > bestResult.overall) {
      best = c;
      bestResult = r;
    }
  }
  return { matched: best, result: bestResult };
}
