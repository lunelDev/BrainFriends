// src/lib/server/loginLockout.ts
//
// IA-07: 연속 로그인 실패 시 잠금.
// 식약처 디지털의료기기 사이버보안 가이드라인 IA-07 대응. SR-SEC-IA07.
//
// 본 모듈은 "현재 잠금 상태 + 시도 결과" → "다음 잠금 상태" 의 결정성 함수만 제공한다.
// DB 컬럼 / SQL 갱신은 호출부 (accountAuth) 에서 수행한다. 분리 이유:
//   - V&V 결정성 단위 테스트가 단순해진다 (외부 시계 / DB 의존 분리).
//   - 향후 redis / postgres / 메모리 등 저장소 변경 시 정책 로직은 불변.

const MAX_ATTEMPTS_BEFORE_LOCK = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LoginLockoutState {
  /** 누적 연속 실패 횟수 (성공 시 0 으로 reset). */
  failedAttempts: number;
  /** 잠금 해제 예정 시각 (epoch ms). null = 잠금 없음. */
  lockedUntil: number | null;
}

export interface LoginAttemptInput {
  /** 직전 시도가 비밀번호 검증 통과 (true) / 실패 (false) 인가. */
  success: boolean;
  /** 현재 시각 (epoch ms). 결정성 검증을 위해 외부 주입. */
  nowMs: number;
  /** 직전 (DB 기록) 잠금 상태. */
  current: LoginLockoutState;
}

export type LoginGateDecision =
  | {
      allowed: true;
      nextState: LoginLockoutState;
      auditReason?: string;
    }
  | {
      allowed: false;
      reason: "locked" | "lockout_triggered";
      nextState: LoginLockoutState;
      retryAfterMs: number;
      auditReason: string;
    };

/**
 * 로그인 시도 시점에 호출. 잠금 중인지 확인하고 다음 상태를 반환한다.
 *
 * 정책:
 *   - lockedUntil > nowMs : 잠금 유지. allowed=false, reason=locked.
 *   - lockedUntil <= nowMs : 잠금 해제. failedAttempts 0 으로 reset.
 *   - 호출 시점에 잠금 해제 후 success=true: failedAttempts 0, lockedUntil null.
 *   - success=false: failedAttempts++. 5회 도달 시 lockedUntil 설정 + lockout_triggered.
 */
export function evaluateLoginAttempt(
  input: LoginAttemptInput,
): LoginGateDecision {
  const { success, nowMs, current } = input;

  // 1) 잠금 중인 경우 — 시도 자체 차단.
  if (current.lockedUntil !== null && current.lockedUntil > nowMs) {
    return {
      allowed: false,
      reason: "locked",
      nextState: current,
      retryAfterMs: current.lockedUntil - nowMs,
      auditReason: "login_locked",
    };
  }

  // 2) 잠금 해제 시점 또는 잠금 없음. 누적 카운트는 reset 후 새로 시작.
  const baseState: LoginLockoutState = {
    failedAttempts:
      current.lockedUntil !== null && current.lockedUntil <= nowMs
        ? 0
        : current.failedAttempts,
    lockedUntil: null,
  };

  if (success) {
    return {
      allowed: true,
      nextState: { failedAttempts: 0, lockedUntil: null },
    };
  }

  const nextAttempts = baseState.failedAttempts + 1;
  if (nextAttempts >= MAX_ATTEMPTS_BEFORE_LOCK) {
    return {
      allowed: false,
      reason: "lockout_triggered",
      nextState: {
        failedAttempts: nextAttempts,
        lockedUntil: nowMs + LOCKOUT_DURATION_MS,
      },
      retryAfterMs: LOCKOUT_DURATION_MS,
      auditReason: "login_lockout_triggered",
    };
  }

  return {
    allowed: true,
    nextState: { failedAttempts: nextAttempts, lockedUntil: null },
    auditReason: "login_failed",
  };
}

export const LOGIN_LOCKOUT_POLICY = {
  maxAttempts: MAX_ATTEMPTS_BEFORE_LOCK,
  lockoutDurationMs: LOCKOUT_DURATION_MS,
} as const;
