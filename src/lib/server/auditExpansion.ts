// SR-SEC-AUDIT-EXPANSION (RM-016 통제 보강).
//
// 식약처 사이버보안 가이드라인 UC-07 (감사로그) + ISO 27001 A.12.4.
// 기존 auditChain.ts (HMAC 체인) 위에 도메인 별 헬퍼 — guardian 링크 / KWAB 확정 /
// 권한 변경 / 변경허가 신청 / 평가 결과 발행 등 5 카테고리.
//
// 본 모듈은 결정성 분류 + 표준 메시지 포맷만 제공한다.
// 실제 auditChain append 는 기존 appendAuditEntry 호출.

export type AuditCategory =
  | "guardian_link_lifecycle"
  | "kwab_finalization"
  | "permission_change"
  | "regulatory_filing"
  | "evaluation_publication";

export interface AuditEnrichmentInput {
  category: AuditCategory;
  actorId: string;
  /** 영향받는 리소스 ID (환자 / 평가 / 처방 등). */
  resourceId: string;
  /** 추가 metadata. PHI 포함 금지. */
  metadata?: Record<string, string | number | boolean>;
}

export interface AuditEnrichmentOutput {
  category: AuditCategory;
  /** 표준 action verb (audit chain entry 의 action 필드용). */
  action: string;
  /** 사람이 읽는 한국어 요약 (audit log UI 용). */
  summary: string;
  /** PHI 마스킹 적용 여부 강제. */
  requiresPhiMasking: boolean;
  /** 추가 metadata 정렬됨. */
  metadata: Record<string, string | number | boolean>;
}

const ACTION_BY_CATEGORY: Record<AuditCategory, string> = {
  guardian_link_lifecycle: "guardian_link_event",
  kwab_finalization: "kwab_score_finalized",
  permission_change: "permission_grant_or_revoke",
  regulatory_filing: "regulatory_change_filing",
  evaluation_publication: "evaluation_result_published",
};

const SUMMARY_PREFIX_BY_CATEGORY: Record<AuditCategory, string> = {
  guardian_link_lifecycle: "보호자 리포트 링크",
  kwab_finalization: "K-WAB 자동 점수 확정",
  permission_change: "권한 변경",
  regulatory_filing: "규제 변경허가 신청",
  evaluation_publication: "평가 결과 발행",
};

const PHI_REQUIRED_CATEGORIES: ReadonlySet<AuditCategory> = new Set([
  "guardian_link_lifecycle",
  "kwab_finalization",
  "evaluation_publication",
]);

export function enrichAuditEntry(
  input: AuditEnrichmentInput,
): AuditEnrichmentOutput {
  const action = ACTION_BY_CATEGORY[input.category];
  const summary = `${SUMMARY_PREFIX_BY_CATEGORY[input.category]} (actor=${input.actorId}, resource=${input.resourceId})`;

  const md = input.metadata ?? {};
  const sortedMd: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(md).sort()) {
    sortedMd[k] = md[k];
  }

  return {
    category: input.category,
    action,
    summary,
    requiresPhiMasking: PHI_REQUIRED_CATEGORIES.has(input.category),
    metadata: sortedMd,
  };
}

/** 감사로그 카테고리별 보존 기간 (일). 식약처 GMP 5장 기준. */
export const AUDIT_RETENTION_DAYS: Record<AuditCategory, number> = {
  guardian_link_lifecycle: 365 * 5, // 5년
  kwab_finalization: 365 * 7, // 7년 (시판 후 감시)
  permission_change: 365 * 5,
  regulatory_filing: 365 * 10, // 10년 (시판 종료 + 7년)
  evaluation_publication: 365 * 7,
};
