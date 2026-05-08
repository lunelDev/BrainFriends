// SR-IRT-018 item bank — step-1 ~ step-5 의 IRT calibrated 단어/문항 풀 (v0.1).
//
// 본 v0.1 의 a/b parameter 는 임상가 1차 추정 (1~5 등급 → b 매핑) + 균일 a=1.0.
// 실제 a/b 는 임상 calibration (응답 누적 후 EM 알고리즘) 으로 갱신 — 이후 v0.2+.

import type { IrtItem } from "./irt";

export const STEP1_WORD_BANK: readonly IrtItem[] = [
  { id: "step1-사과", a: 1.0, b: -1.5, metadata: { step: 1, kind: "noun-easy" } },
  { id: "step1-학교", a: 1.0, b: -1.0, metadata: { step: 1, kind: "noun-easy" } },
  { id: "step1-바나나", a: 1.0, b: -1.0, metadata: { step: 1, kind: "noun-easy" } },
  { id: "step1-우산", a: 1.0, b: -0.5, metadata: { step: 1, kind: "noun-easy" } },
  { id: "step1-시계", a: 1.0, b: -0.5, metadata: { step: 1, kind: "noun-easy" } },
  { id: "step1-안경", a: 1.0, b: 0, metadata: { step: 1, kind: "noun-medium" } },
  { id: "step1-자전거", a: 1.1, b: 0.5, metadata: { step: 1, kind: "noun-medium" } },
  { id: "step1-도서관", a: 1.1, b: 1.0, metadata: { step: 1, kind: "noun-hard" } },
  { id: "step1-텔레비전", a: 1.1, b: 1.5, metadata: { step: 1, kind: "noun-hard" } },
  { id: "step1-비행기", a: 1.1, b: 2.0, metadata: { step: 1, kind: "noun-hard" } },
] as const;

export const STEP2_REPETITION_BANK: readonly IrtItem[] = [
  { id: "step2-안녕하세요", a: 1.0, b: -1.5, metadata: { step: 2, kind: "phrase-easy" } },
  { id: "step2-감사합니다", a: 1.0, b: -1.0, metadata: { step: 2, kind: "phrase-easy" } },
  { id: "step2-도와주세요", a: 1.0, b: -0.5, metadata: { step: 2, kind: "phrase-medium" } },
  { id: "step2-배가-고파요", a: 1.0, b: 0, metadata: { step: 2, kind: "phrase-medium" } },
  { id: "step2-화장실-가요", a: 1.0, b: 0.5, metadata: { step: 2, kind: "phrase-medium" } },
  { id: "step2-잠깐-쉬고-싶어요", a: 1.1, b: 1.0, metadata: { step: 2, kind: "phrase-hard" } },
  { id: "step2-너무-힘들어요", a: 1.1, b: 1.5, metadata: { step: 2, kind: "phrase-hard" } },
] as const;

export const STEP4_SENTENCE_BANK: readonly IrtItem[] = [
  { id: "step4-오늘-기분", a: 1.0, b: -1.0, metadata: { step: 4, kind: "sentence-easy" } },
  { id: "step4-점심-식사", a: 1.0, b: 0, metadata: { step: 4, kind: "sentence-medium" } },
  { id: "step4-약속-시간", a: 1.1, b: 0.5, metadata: { step: 4, kind: "sentence-medium" } },
  { id: "step4-날씨-감상", a: 1.1, b: 1.0, metadata: { step: 4, kind: "sentence-hard" } },
  { id: "step4-가족-만남", a: 1.1, b: 1.5, metadata: { step: 4, kind: "sentence-hard" } },
] as const;

export const STEP5_READING_BANK: readonly IrtItem[] = [
  { id: "step5-home-1", a: 1.0, b: -0.4, metadata: { step: 5, place: "home", kind: "reading-medium" } },
  { id: "step5-home-2", a: 1.0, b: -0.1, metadata: { step: 5, place: "home", kind: "reading-medium" } },
  { id: "step5-home-3", a: 1.1, b: 0.2, metadata: { step: 5, place: "home", kind: "reading-medium" } },
  { id: "step5-hospital-1", a: 1.0, b: -0.1, metadata: { step: 5, place: "hospital", kind: "reading-medium" } },
  { id: "step5-hospital-2", a: 1.1, b: 0.4, metadata: { step: 5, place: "hospital", kind: "reading-hard" } },
  { id: "step5-hospital-3", a: 1.0, b: 0.1, metadata: { step: 5, place: "hospital", kind: "reading-medium" } },
  { id: "step5-cafe-1", a: 1.0, b: -0.2, metadata: { step: 5, place: "cafe", kind: "reading-medium" } },
  { id: "step5-cafe-2", a: 1.0, b: 0.1, metadata: { step: 5, place: "cafe", kind: "reading-medium" } },
  { id: "step5-cafe-3", a: 1.0, b: -0.1, metadata: { step: 5, place: "cafe", kind: "reading-medium" } },
  { id: "step5-bank-1", a: 1.0, b: 0.1, metadata: { step: 5, place: "bank", kind: "reading-medium" } },
  { id: "step5-bank-2", a: 1.1, b: 0.3, metadata: { step: 5, place: "bank", kind: "reading-hard" } },
  { id: "step5-bank-3", a: 1.0, b: -0.1, metadata: { step: 5, place: "bank", kind: "reading-medium" } },
  { id: "step5-park-1", a: 1.0, b: 0.1, metadata: { step: 5, place: "park", kind: "reading-medium" } },
  { id: "step5-park-2", a: 1.1, b: 0.4, metadata: { step: 5, place: "park", kind: "reading-hard" } },
  { id: "step5-park-3", a: 1.1, b: 0.5, metadata: { step: 5, place: "park", kind: "reading-hard" } },
  { id: "step5-mart-1", a: 1.0, b: -0.2, metadata: { step: 5, place: "mart", kind: "reading-medium" } },
  { id: "step5-mart-2", a: 1.1, b: 0.3, metadata: { step: 5, place: "mart", kind: "reading-hard" } },
  { id: "step5-mart-3", a: 1.0, b: -0.1, metadata: { step: 5, place: "mart", kind: "reading-medium" } },
] as const;

export const SING_ADAPTIVE_BANK: readonly IrtItem[] = [
  { id: "sing-나비야", a: 1.0, b: -1.2, metadata: { step: "sing", kind: "song-easy" } },
  { id: "sing-아리랑", a: 1.0, b: -0.2, metadata: { step: "sing", kind: "song-medium" } },
  { id: "sing-군밤타령", a: 1.0, b: 0.1, metadata: { step: "sing", kind: "song-medium" } },
  { id: "sing-둥글게-둥글게", a: 1.1, b: 0.8, metadata: { step: "sing", kind: "song-hard" } },
  { id: "sing-도라지-타령", a: 1.1, b: 1.0, metadata: { step: "sing", kind: "song-hard" } },
  { id: "sing-밀양-아리랑", a: 1.1, b: 1.2, metadata: { step: "sing", kind: "song-hard" } },
] as const;

export const ALL_BANKS = {
  1: STEP1_WORD_BANK,
  2: STEP2_REPETITION_BANK,
  4: STEP4_SENTENCE_BANK,
  5: STEP5_READING_BANK,
} as const;

/** 결정성 — 동일 step 입력 → 동일 bank 반환. */
export function getItemBankForStep(step: 1 | 2 | 4 | 5): readonly IrtItem[] {
  return ALL_BANKS[step];
}
