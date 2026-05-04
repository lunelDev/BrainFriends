// src/lib/server/sessionLockout.ts
//
// UC-03: 세션 idle timeout (자동 잠금).
// 식약처 디지털의료기기 사이버보안 가이드라인 UC-03 대응. SR-SEC-UC03.
//
// 정책:
//   - 마지막 활동 후 30분 (1,800,000 ms) idle 경과 시 세션 만료.
//   - 만료 후 재활동은 재인증 필요 (기존 세션 무효).
//   - 활동마다 lastActivityAt 갱신.
//
// 본 모듈은 결정성 함수만 제공한다. 실제 cookie 만료 / DB 갱신은 호출부 (accountAuth) 에서 수행한다.

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface SessionIdleInput {
  /** 세션의 마지막 활동 시각 (epoch ms). 새 세션이면 발급 시각. */
  lastActivityAt: number;
  /** 현재 시각 (epoch ms). 결정성 검증을 위해 외부 주입. */
  nowMs: number;
}

export interface SessionIdleDecision {
  /** 세션이 만료되었는지. */
  isExpired: boolean;
  /** 만료까지 남은 시간 (ms). 만료된 경우 0. */
  remainingMs: number;
  /** 사용자에게 재인증을 요구해야 하는지. */
  shouldReauth: boolean;
  /** 만료가 임박한 경우 (5분 이내) 알림 필요 여부. */
  warnImminent: boolean;
}

export function evaluateSessionIdle(input: SessionIdleInput): SessionIdleDecision {
  const elapsed = Math.max(0, input.nowMs - input.lastActivityAt);
  const remaining = IDLE_TIMEOUT_MS - elapsed;
  const isExpired = remaining <= 0;
  return {
    isExpired,
    remainingMs: isExpired ? 0 : remaining,
    shouldReauth: isExpired,
    warnImminent: !isExpired && remaining <= 5 * 60 * 1000,
  };
}

export const SESSION_IDLE_POLICY = {
  idleTimeoutMs: IDLE_TIMEOUT_MS,
  warnThresholdMs: 5 * 60 * 1000,
} as const;
