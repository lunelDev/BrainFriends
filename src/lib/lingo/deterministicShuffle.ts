/**
 * src/lib/lingo/deterministicShuffle.ts
 *
 * 결정론 셔플 — 같은 시드 → 항상 같은 순서.
 *
 * 의료기기 SW(IEC 62304 / 식약처 AI 성능평가) 결정론 요구사항 충족.
 * 임상 데이터 검증 시 "이 점수는 시드 X 로 재현 가능" 을 증명한다.
 *
 * 알고리즘:
 *   - Fisher-Yates 셔플 + mulberry32 PRNG (32-bit, 빠르고 시드 의존)
 *   - Math.random() 기반 sort 비교자(=비균등 분포 + 비결정론) 대신 사용
 *
 * 사용 예:
 *   const shuffled = deterministicShuffle([1,2,3,4,5], 12345);
 *   // 같은 시드면 항상 같은 결과
 */

/**
 * mulberry32 — 작고 결정론적인 32-bit PRNG.
 * 같은 seed → 같은 [0,1) 시퀀스. 셔플·랜덤 선택에 충분.
 */
export function mulberry32(seed: number): () => number {
  // seed 가 0 또는 음수일 때 안정적으로 동작하도록 양수로 정규화.
  let state = (seed >>> 0) || 1;
  return function rand(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates 결정론 셔플.
 * - 원본 배열을 변형하지 않는다 (immutable).
 * - 균등 분포 보장 (Math.random sort 의 편향 문제 없음).
 */
export function deterministicShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = items.slice();
  const rand = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 시드 1개로부터 N 개의 결정론 셔플 헬퍼를 만든다.
 * 같은 게임 안에서 여러 번 셔플해야 할 때(예: 라운드별 단어 재배치) 사용.
 *
 * 첫 번째 셔플은 seed, 두 번째는 seed+1, ... 순으로 결정론을 유지하면서도
 * 매 셔플마다 다른 결과를 만든다.
 */
export function makeShuffleSequence(baseSeed: number) {
  let counter = 0;
  return function shuffleNext<T>(items: readonly T[]): T[] {
    const out = deterministicShuffle(items, baseSeed + counter);
    counter += 1;
    return out;
  };
}

/**
 * 임의의 문자열(예: 환자 ID + 세션 시작 시각) 을 32-bit 시드로 변환.
 * djb2 해시. 충돌은 셔플 용도엔 무시 가능.
 */
export function deriveSeed(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}
