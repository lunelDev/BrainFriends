// src/lib/server/rateLimit.ts
//
// RA-01: 서비스 거부(DoS) 방지.
// 식약처 디지털의료기기 사이버보안 가이드라인 RA-01 대응. SR-SEC-RA01.
//
// 본 모듈은 sliding window 기반 결정성 함수만 제공한다. 실제 저장소(메모리/Redis/Postgres)
// 는 호출부에서 결정. 분리 이유: V&V 결정성 단위 테스트 단순화 + 저장 백엔드 변경에 무관한 정책.
//
// 라우트별 정책 예 (호출부에서 적용):
//   - 로그인 (/api/auth/login): 1분당 5회 (IP+loginId)
//   - 비밀번호 재설정 (/api/auth/reset-password): 1분당 3회 (IP)
//   - STT 프록시 (/api/proxy/stt): 1분당 30회 (userId)
//   - AAC commit (/api/aac/intent): 1분당 60회 (userId)

export interface RateLimitPolicy {
  /** 윈도우 길이 (ms). 예: 60_000 = 1분. */
  windowMs: number;
  /** 윈도우 내 허용 최대 시도 수. */
  maxAttempts: number;
}

export interface RateLimitInput {
  /** 직전까지의 시도 기록 (epoch ms 오름차순). 호출부 저장소에서 조회해 주입. */
  history: number[];
  /** 현재 시각 (epoch ms). */
  nowMs: number;
  /** 라우트별 정책. */
  policy: RateLimitPolicy;
}

export type RateLimitDecision =
  | {
      allowed: true;
      nextHistory: number[];
      remaining: number;
      resetAtMs: number;
    }
  | {
      allowed: false;
      reason: "rate_limit_exceeded";
      nextHistory: number[];
      retryAfterMs: number;
      resetAtMs: number;
    };

/**
 * Sliding window 정책으로 시도를 평가하고 다음 history 를 반환한다.
 *
 * 동작:
 *   1) history 에서 windowMs 보다 오래된 시도 제거 (사실상 윈도우 밖).
 *   2) 남은 시도 + 1 이 maxAttempts 초과 → 거부.
 *   3) 거부 시 nextHistory 는 현재 윈도우 안의 기록 그대로 (현재 시도는 추가하지 않음).
 *   4) 허용 시 nextHistory 에 nowMs 추가.
 *
 * 결정성: 동일 (history, nowMs, policy) 입력 → 동일 결과.
 */
export function evaluateRateLimit(input: RateLimitInput): RateLimitDecision {
  const { history, nowMs, policy } = input;
  const cutoff = nowMs - policy.windowMs;
  const recent = history.filter((ts) => ts > cutoff);
  recent.sort((a, b) => a - b);

  const oldestInWindow = recent.length > 0 ? recent[0] : nowMs;
  const resetAtMs = oldestInWindow + policy.windowMs;

  if (recent.length >= policy.maxAttempts) {
    return {
      allowed: false,
      reason: "rate_limit_exceeded",
      nextHistory: recent,
      retryAfterMs: Math.max(0, resetAtMs - nowMs),
      resetAtMs,
    };
  }

  const nextHistory = [...recent, nowMs];
  return {
    allowed: true,
    nextHistory,
    remaining: Math.max(0, policy.maxAttempts - nextHistory.length),
    resetAtMs,
  };
}

export const RATE_LIMIT_POLICIES = {
  login: { windowMs: 60_000, maxAttempts: 5 },
  passwordReset: { windowMs: 60_000, maxAttempts: 3 },
  stt: { windowMs: 60_000, maxAttempts: 30 },
  aacCommit: { windowMs: 60_000, maxAttempts: 60 },
} as const;
