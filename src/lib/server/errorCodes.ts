// src/lib/server/errorCodes.ts
//
// SI-07: 통합 오류 처리 dictionary.
// 식약처 디지털의료기기 사이버보안 가이드라인 SI-07 대응. SR-SEC-SI07.
//
// 정책:
//   - 모든 API 응답 오류는 본 dictionary 의 정의된 코드로 반환.
//   - 코드 → (httpStatus, userMessage, auditCategory, severity) 매핑은 결정성.
//   - 미정의 코드 입력은 internal_error 로 안전 fallback (SI-06 / SI-07 동시 충족).
//   - userMessage 는 한국어 짧은 안내. 내부 디버그 정보 노출 금지 (IA-06 보강).
//
// 호출 패턴 (예):
//   import { resolveErrorResponse } from "@/lib/server/errorCodes";
//   const { httpStatus, body } = resolveErrorResponse("unauthorized");
//   return NextResponse.json(body, { status: httpStatus });

export type ErrorSeverity = "info" | "warn" | "error" | "critical";

export interface ErrorDefinition {
  /** HTTP 응답 코드. */
  httpStatus: number;
  /** 사용자에게 보일 한국어 안내. 디버그 정보 포함 금지. */
  userMessage: string;
  /** audit log 카테고리. UC-04 와 연결됨. */
  auditCategory: string;
  severity: ErrorSeverity;
}

// 코드 → 정의. 알파벳 정렬 유지 (V&V 결정성 + diff 가독성).
const ERROR_DEFINITIONS = {
  // ── 인증 / 권한 ──────────────────────────────────────────────
  account_locked: {
    httpStatus: 423,
    userMessage: "연속 로그인 실패로 계정이 일시 잠겼습니다. 잠시 후 다시 시도해 주세요.",
    auditCategory: "auth_locked",
    severity: "warn",
  },
  forbidden: {
    httpStatus: 403,
    userMessage: "요청한 작업의 권한이 없습니다.",
    auditCategory: "auth_forbidden",
    severity: "warn",
  },
  invalid_credentials: {
    httpStatus: 401,
    userMessage: "아이디 또는 비밀번호가 올바르지 않습니다.",
    auditCategory: "auth_invalid_credentials",
    severity: "info",
  },
  invalid_password_payload: {
    httpStatus: 400,
    userMessage: "비밀번호 형식이 정책을 충족하지 못했습니다.",
    auditCategory: "auth_invalid_password_policy",
    severity: "info",
  },
  session_expired: {
    httpStatus: 401,
    userMessage: "세션이 만료되었습니다. 다시 로그인해 주세요.",
    auditCategory: "auth_session_expired",
    severity: "info",
  },
  unauthorized: {
    httpStatus: 401,
    userMessage: "로그인이 필요합니다.",
    auditCategory: "auth_unauthorized",
    severity: "info",
  },

  // ── 입력 / 자원 ──────────────────────────────────────────────
  invalid_payload: {
    httpStatus: 400,
    userMessage: "요청 데이터 형식이 올바르지 않습니다.",
    auditCategory: "input_invalid",
    severity: "info",
  },
  not_found: {
    httpStatus: 404,
    userMessage: "요청한 자원을 찾을 수 없습니다.",
    auditCategory: "resource_not_found",
    severity: "info",
  },
  rate_limit_exceeded: {
    httpStatus: 429,
    userMessage: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    auditCategory: "rate_limit_exceeded",
    severity: "warn",
  },

  // ── 서버 / 외부 의존 ────────────────────────────────────────
  database_unavailable: {
    httpStatus: 503,
    userMessage: "일시적으로 서비스에 접속할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    auditCategory: "infra_db_unavailable",
    severity: "error",
  },
  external_service_failed: {
    httpStatus: 502,
    userMessage: "외부 서비스 응답이 올바르지 않습니다.",
    auditCategory: "infra_external_failed",
    severity: "error",
  },
  internal_error: {
    httpStatus: 500,
    userMessage: "서비스 처리 중 오류가 발생했습니다.",
    auditCategory: "infra_internal_error",
    severity: "critical",
  },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof ERROR_DEFINITIONS;

export interface ErrorResponseBody {
  ok: false;
  error: ErrorCode;
  message: string;
}

export interface ResolvedErrorResponse {
  httpStatus: number;
  body: ErrorResponseBody;
  auditCategory: string;
  severity: ErrorSeverity;
}

/**
 * 오류 코드를 응답 형태로 변환. 미정의 코드는 internal_error 로 fallback.
 */
export function resolveErrorResponse(code: string): ResolvedErrorResponse {
  const definition =
    (ERROR_DEFINITIONS as Record<string, ErrorDefinition>)[code] ??
    ERROR_DEFINITIONS.internal_error;
  const safeCode = (code in ERROR_DEFINITIONS ? code : "internal_error") as ErrorCode;
  return {
    httpStatus: definition.httpStatus,
    body: { ok: false, error: safeCode, message: definition.userMessage },
    auditCategory: definition.auditCategory,
    severity: definition.severity,
  };
}

export function listKnownErrorCodes(): ErrorCode[] {
  return Object.keys(ERROR_DEFINITIONS).sort() as ErrorCode[];
}
