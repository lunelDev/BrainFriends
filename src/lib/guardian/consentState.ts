// src/lib/guardian/consentState.ts
//
// SR-CONSENT-015. 보호자 동의 상태머신 결정성.
// PDF #6 §16 (사용자 적합성), 개인정보보호법, 식약처 디지털의료기기 GMP [별첨5] 보안지침 §3 대응.
//
// 상태: pending → granted → revoked (one-way), 또는 pending → expired (시간 초과).
// 리포트 발송 가능 여부는 (state, ttlMs) 로 결정성 산출.

export type GuardianConsentState = "pending" | "granted" | "revoked" | "expired";

export interface GuardianConsentInput {
  consentId: string;
  /** 현재 저장된 상태 — DB 그대로. */
  state: GuardianConsentState;
  /** 동의 요청 발송 시각 (ISO ms). pending TTL 계산에 사용. */
  requestedAtMs: number;
  /** granted 또는 revoked 시각 (ISO ms). */
  decidedAtMs: number | null;
  /** 평가 시점 (테스트에선 fixture). */
  nowMs: number;
  /** pending 유지 한도. 초과 시 expired. 기본 7일. */
  pendingTtlMs?: number;
}

export interface GuardianConsentOutcome {
  consentId: string;
  effectiveState: GuardianConsentState;
  /** 리포트 발송 / 보호자 페이지 접근 허용 여부. */
  reportAccessAllowed: boolean;
  /** 클라이언트가 다시 동의 요청 보내야 하는지. */
  reissueRequired: boolean;
  /** 사람용 reason 코드 — audit log 매핑. */
  reason:
    | "consent_granted"
    | "consent_pending_within_ttl"
    | "consent_pending_expired"
    | "consent_revoked"
    | "consent_unknown";
}

const DEFAULT_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function evaluateGuardianConsent(input: GuardianConsentInput): GuardianConsentOutcome {
  const ttl = input.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
  if (input.state === "granted") {
    return {
      consentId: input.consentId,
      effectiveState: "granted",
      reportAccessAllowed: true,
      reissueRequired: false,
      reason: "consent_granted",
    };
  }
  if (input.state === "revoked") {
    return {
      consentId: input.consentId,
      effectiveState: "revoked",
      reportAccessAllowed: false,
      reissueRequired: true,
      reason: "consent_revoked",
    };
  }
  if (input.state === "pending") {
    const elapsed = input.nowMs - input.requestedAtMs;
    if (elapsed > ttl) {
      return {
        consentId: input.consentId,
        effectiveState: "expired",
        reportAccessAllowed: false,
        reissueRequired: true,
        reason: "consent_pending_expired",
      };
    }
    return {
      consentId: input.consentId,
      effectiveState: "pending",
      reportAccessAllowed: false,
      reissueRequired: false,
      reason: "consent_pending_within_ttl",
    };
  }
  if (input.state === "expired") {
    return {
      consentId: input.consentId,
      effectiveState: "expired",
      reportAccessAllowed: false,
      reissueRequired: true,
      reason: "consent_pending_expired",
    };
  }
  return {
    consentId: input.consentId,
    effectiveState: input.state,
    reportAccessAllowed: false,
    reissueRequired: true,
    reason: "consent_unknown",
  };
}

/**
 * 상태 전이 합법성 — DB 갱신 시점에 호출. 결정성: 동일 입력 → 동일 출력.
 *
 * 합법:
 *  pending  → granted, revoked, expired
 *  granted  → revoked
 *  revoked  → (terminal)
 *  expired  → (terminal — 새 consent 발급 필요)
 */
export function isLegalTransition(
  from: GuardianConsentState,
  to: GuardianConsentState,
): boolean {
  if (from === to) return false;
  if (from === "pending") return ["granted", "revoked", "expired"].includes(to);
  if (from === "granted") return to === "revoked";
  return false;
}
