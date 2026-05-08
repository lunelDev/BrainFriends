/**
 * 식약처 의료기기 사이버보안 허가·심사 가이드라인 (가이드라인 C) — 표 2 / 표 3 35항목 코드화.
 *
 * 가이드라인 원문: 「의료기기의 사이버보안 허가·심사 가이드라인 (민원인 안내서)」
 * 해석 문서: docs/regulatory/guidelines-2026-05/03-cybersecurity-35.md
 * 체크리스트: submission/guidelines-2026-05/cybersecurity-35-checklist.md
 *
 * 본 모듈은 메타만 export 한다. 실제 보안 구현은 src/lib/security/*, src/lib/server/*,
 * src/proxy.ts 등에서 분산 담당하며, 본 모듈은 그 매핑 인덱스 역할만 한다.
 *
 * SaMD 특례 (가이드라인 p.57): 하드웨어로만 구현 가능한 보안 요구사항은 미적용 가능.
 *   - 본 제품 미적용 후보: SI-10 (물리적 변조 방지), SI-11 (부트 프로세스 무결성).
 *   - 미적용 사유는 위험관리문서에 기재 — docs/regulatory/risk-management-file.md.
 */

/** 가이드라인 C 표 2 — 6개 카테고리 */
export type SecurityCategory =
  | "IA" // Identification and Authentication
  | "UC" // Use Control
  | "SI" // System Integrity
  | "DC" // Data Confidentiality
  | "TRE" // Timely Response to Events
  | "RA"; // Resource Availability

/** 항목 적용 상태 */
export type ItemApplicability =
  | "applied" // 적용 + 검증 자료 명확
  | "partial" // 적용 + 검증 자료 보강 필요
  | "not-applicable"; // SaMD 특례 등 미적용

/** 표 2 / 표 3 한 행 */
export interface SecurityRequirement {
  /** ID — 예: IA-01 */
  id: string;
  /** 카테고리 */
  category: SecurityCategory;
  /** 명칭 (가이드라인 원문 명칭) */
  name: string;
  /** 본 제품 적용 상태 */
  applicability: ItemApplicability;
  /**
   * 적합성 입증 방법 / 검증 자료 위치.
   * 미적용 항목은 사유를 같은 필드에 기재 (가이드라인 p.57).
   */
  justification: string;
}

/**
 * 가이드라인 C 표 2 — 35항목 전체.
 * 카테고리 합계: IA(8) + UC(7) + SI(11) + DC(3) + TRE(1) + RA(5) = 35
 */
export const CYBERSECURITY_35: readonly SecurityRequirement[] = [
  // IA — Identification and Authentication (8)
  { id: "IA-01", category: "IA", name: "사용자 식별 및 인증", applicability: "applied",
    justification: "src/lib/server/accountAuth.ts, src/app/api/auth/* — V&V 결정성 체크(로그인) 통과." },
  { id: "IA-02", category: "IA", name: "계정 관리", applicability: "applied",
    justification: "admin/therapist/patient 분리. 계정 생성·비활성화 흐름." },
  { id: "IA-03", category: "IA", name: "식별정보 관리", applicability: "applied",
    justification: "src/lib/server/newSchema/usersDb.ts, clinicalPatientProfilesDb.ts." },
  { id: "IA-04", category: "IA", name: "인증정보 관리", applicability: "applied",
    justification: "비밀번호 해시 + TOTP 2FA." },
  { id: "IA-05", category: "IA", name: "비밀번호 강도 설정", applicability: "partial",
    justification: "TODO — 강도 정책 명세 필요. 현재 기본값 의존." },
  { id: "IA-06", category: "IA", name: "인증정보에 대한 피드백", applicability: "partial",
    justification: "TODO — 로그인 실패 메시지 일반화 정책 확인." },
  { id: "IA-07", category: "IA", name: "연속 로그인 시도 실패 시 제한", applicability: "partial",
    justification: "TODO — 시도 횟수·잠금 정책 명세 필요." },
  { id: "IA-08", category: "IA", name: "시스템 사용 알림 메시지", applicability: "partial",
    justification: "TODO — 마지막 접속 안내 등." },

  // UC — Use Control (7)
  { id: "UC-01", category: "UC", name: "권한 부여", applicability: "applied",
    justification: "RBAC: admin/therapist/patient/guardian. src/proxy.ts 보호 라우팅." },
  { id: "UC-02", category: "UC", name: "모바일 코드 사용 통제", applicability: "partial",
    justification: "모바일 웹/PWA 환경 정책 정의 필요." },
  { id: "UC-03", category: "UC", name: "세션 잠금", applicability: "partial",
    justification: "세션 타임아웃·비활성 자동 로그아웃 정책 확인 필요." },
  { id: "UC-04", category: "UC", name: "감사기록 생성", applicability: "applied",
    justification: "src/lib/security/auditLogger.ts, src/lib/server/securityAuditDb.ts." },
  { id: "UC-05", category: "UC", name: "감사 처리 실패 대응", applicability: "applied",
    justification: "runDeterministicChecks.ts 의 save failure fallback 검증." },
  { id: "UC-06", category: "UC", name: "타임스탬프", applicability: "applied",
    justification: "모든 감사로그 ISO 8601 UTC." },
  { id: "UC-07", category: "UC", name: "부인 방지", applicability: "applied",
    justification: "genesis hash 체인. runDeterministicChecks.ts 에서 검증." },

  // SI — System Integrity (11)
  { id: "SI-01", category: "SI", name: "통신에 대한 무결성 보장", applicability: "applied",
    justification: "HTTPS, 도메인 host 프록시 (Nginx)." },
  { id: "SI-02", category: "SI", name: "악성코드로부터 보호", applicability: "applied",
    justification: "입력 sanitization, 의존성 SBOM (npm run security:all)." },
  { id: "SI-03", category: "SI", name: "보안 기능 검증", applicability: "applied",
    justification: "npm run test:vnv (결정성 보안 체크)." },
  { id: "SI-04", category: "SI", name: "소프트웨어 및 정보에 대한 무결성 점검", applicability: "applied",
    justification: "릴리스 매니페스트, 해시 검증." },
  { id: "SI-05", category: "SI", name: "입력값 검증", applicability: "applied",
    justification: "로그인/AAC/검색 입력 검증. runDeterministicChecks.ts." },
  { id: "SI-06", category: "SI", name: "오류 시 사전 결정된 상태로 출력", applicability: "applied",
    justification: "결과 페이지 server-first, 저장 실패 시 fallback." },
  { id: "SI-07", category: "SI", name: "오류 처리", applicability: "applied",
    justification: "Next.js error boundary + API 표준 에러 응답." },
  { id: "SI-08", category: "SI", name: "업데이트", applicability: "applied",
    justification: "배포 절차 (docs/regulatory/change-approval-sop.md)." },
  { id: "SI-09", category: "SI", name: "업데이트에 대한 진본성 및 무결성 검증", applicability: "applied",
    justification: "매니페스트 서명/해시." },
  { id: "SI-10", category: "SI", name: "물리적 변조 방지", applicability: "not-applicable",
    justification: "SaMD 특례 (가이드라인 p.57) — 물리 변조 대상 없음. 단말 OS 보안기능 의존. 위험관리문서 사유 기재." },
  { id: "SI-11", category: "SI", name: "부트 프로세스 무결성 검증", applicability: "not-applicable",
    justification: "SaMD 특례 — 앱 단독 검증 불가, OS 의존. 위험관리문서 사유 기재." },

  // DC — Data Confidentiality (3)
  { id: "DC-01", category: "DC", name: "정보에 대한 기밀성 보장", applicability: "applied",
    justification: "TLS, DB 접근 제어." },
  { id: "DC-02", category: "DC", name: "보건의료정보 비식별화", applicability: "applied",
    justification: "src/lib/server/evaluationSamplesDb.ts pseudonym 해싱, src/lib/security/patientRedaction.ts." },
  { id: "DC-03", category: "DC", name: "안전한 암호화 사용", applicability: "partial",
    justification: "TODO — 암호화 알고리즘·키 관리 정책 명세 필요." },

  // TRE — Timely Response to Events (1)
  { id: "TRE-01", category: "TRE", name: "감사로그에 대한 비인가된 접근 제한", applicability: "applied",
    justification: "감사로그 권한 분리, admin 전용 export (/api/therapist/system/...)." },

  // RA — Resource Availability (5)
  { id: "RA-01", category: "RA", name: "서비스 거부(DoS) 방지", applicability: "partial",
    justification: "레이트 리미트 정책 + 프록시 설정 확인 필요." },
  { id: "RA-02", category: "RA", name: "의료기기 백업", applicability: "applied",
    justification: "DB 백업 (brainfriends-backup.sql), Object Storage 백업." },
  { id: "RA-03", category: "RA", name: "의료기기 복구 및 재구성", applicability: "partial",
    justification: "복구 절차 문서화 필요." },
  { id: "RA-04", category: "RA", name: "네트워크 및 보안 구성 설정", applicability: "applied",
    justification: "Nginx/SSL/도메인 설정 (개발내용.md 2026-03-16)." },
  { id: "RA-05", category: "RA", name: "불필요한 기능 비활성화", applicability: "applied",
    justification: "production 빌드에서 dev 라우트 차단 (NODE_ENV !== 'development')." },
];

/** 표 2 카테고리 풀네임 — 가이드라인 원문 영문 명칭 */
export const SECURITY_CATEGORY_NAMES: Record<SecurityCategory, string> = {
  IA: "Identification and Authentication",
  UC: "Use Control",
  SI: "System Integrity",
  DC: "Data Confidentiality",
  TRE: "Timely Response to Events",
  RA: "Resource Availability",
};

/** 카테고리별 항목 수 검증용 — 합계 35 */
export const SECURITY_CATEGORY_COUNTS: Record<SecurityCategory, number> = {
  IA: 8,
  UC: 7,
  SI: 11,
  DC: 3,
  TRE: 1,
  RA: 5,
};

/** 적용 상태 요약을 만드는 헬퍼 (순수 함수, 부수효과 없음) */
export function summarizeApplicability(
  items: readonly SecurityRequirement[] = CYBERSECURITY_35,
): Record<ItemApplicability, number> {
  const summary: Record<ItemApplicability, number> = {
    applied: 0,
    partial: 0,
    "not-applicable": 0,
  };
  for (const item of items) {
    summary[item.applicability] += 1;
  }
  return summary;
}

/**
 * 인허가 시점에 제출하는 자료 인덱스 — 가이드라인 p.53.
 * GMP 시점에서 별도로 요구되는 SBOM/취약점/침투시험은 본 가이드라인 범위 외.
 */
export const SUBMISSION_ARTIFACTS = [
  "사이버보안 요구사항 체크리스트 (표 3 양식) — submission/guidelines-2026-05/cybersecurity-35-checklist.md",
  "사이버보안 위험관리문서 — docs/regulatory/risk-management-file.md",
  "소프트웨어 V&V 자료 — npm run test:vnv 결과 + submission/ktl-pre-inquiry-2026-04/04-sw-vnv-current-report.md",
  "성능시험성적서 — V&V 보고서 안에 통합",
  "(옵션) KISA IoT 보안인증 — 외부 인증 활용 시",
] as const;
