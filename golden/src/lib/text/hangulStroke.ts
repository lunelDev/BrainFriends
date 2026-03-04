const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

// Choseong (19): ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ
// User-provided standard stroke counts are applied.
const CHOSEONG_STROKES = [
  1, // ㄱ
  2, // ㄲ
  1, // ㄴ
  2, // ㄷ
  4, // ㄸ
  3, // ㄹ
  3, // ㅁ
  4, // ㅂ
  8, // ㅃ
  2, // ㅅ
  4, // ㅆ
  1, // ㅇ
  3, // ㅈ
  6, // ㅉ
  4, // ㅊ
  2, // ㅋ
  3, // ㅌ
  4, // ㅍ
  3, // ㅎ
];

// Jungseong (21): ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ
const JUNGSEONG_STROKES = [
  2, // ㅏ
  3, // ㅐ
  3, // ㅑ
  4, // ㅒ
  2, // ㅓ
  3, // ㅔ
  3, // ㅕ
  4, // ㅖ
  2, // ㅗ
  4, // ㅘ
  5, // ㅙ
  3, // ㅚ
  3, // ㅛ
  2, // ㅜ
  4, // ㅝ
  5, // ㅞ
  3, // ㅟ
  3, // ㅠ
  1, // ㅡ
  2, // ㅢ
  1, // ㅣ
];

// Jongseong (28, index 0 is none): "", ㄱ ㄲ ㄳ ㄴ ㄵ ㄶ ㄷ ㄹ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅁ ㅂ ㅄ ㅅ ㅆ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ
const JONGSEONG_STROKES = [
  0, // 없음
  1, // ㄱ
  2, // ㄲ
  3, // ㄳ
  1, // ㄴ
  4, // ㄵ
  4, // ㄶ
  2, // ㄷ
  3, // ㄹ
  4, // ㄺ
  6, // ㄻ
  7, // ㄼ
  5, // ㄽ
  6, // ㄾ
  7, // ㄿ
  6, // ㅀ
  3, // ㅁ
  4, // ㅂ
  6, // ㅄ
  2, // ㅅ
  4, // ㅆ
  1, // ㅇ
  3, // ㅈ
  4, // ㅊ
  2, // ㅋ
  3, // ㅌ
  4, // ㅍ
  3, // ㅎ
];

export function calculateHangulStrokeCount(text: string): number {
  let total = 0;

  for (const ch of text || "") {
    const code = ch.charCodeAt(0);
    if (code < HANGUL_BASE || code > HANGUL_END) continue;

    const offset = code - HANGUL_BASE;
    const cho = Math.floor(offset / 588);
    const jung = Math.floor((offset % 588) / 28);
    const jong = offset % 28;

    total += CHOSEONG_STROKES[cho] || 0;
    total += JUNGSEONG_STROKES[jung] || 0;
    total += JONGSEONG_STROKES[jong] || 0;
  }

  return total;
}
