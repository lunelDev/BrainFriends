export type AdminDocumentGroup = {
  slug: "summary" | "sw-vnv" | "cyber-ai";
  label: string;
  path: string;
  items: string[];
  description: string;
  highlights: string[];
  nextSteps: string[];
};

export const ADMIN_DOCUMENT_GROUPS: AdminDocumentGroup[] = [
  {
    slug: "summary",
    label: "제품 정의 / 전체 요약",
    path: "docs/remediation/00-summary",
    items: [
      "brainfriends-product-definition-one-pager.md",
      "submission-readiness-summary.md",
      "test-lab-inquiry-one-pager.md",
      "samd-gap-checklist.md",
    ],
    description:
      "브레인프렌즈 제품 정의, SaMD 준비 상태, 시험기관 문의용 요약과 부족 항목을 한 번에 보는 묶음입니다.",
    highlights: [
      "사용목적 문구와 제품 범위를 기준 문서로 정리했습니다.",
      "현재 내부 준비 완료 범위와 외부 대응 필요 범위를 구분했습니다.",
      "시험기관 문의 전에 전달할 핵심 요약본을 포함합니다.",
    ],
    nextSteps: [
      "시험기관 사전 문의",
      "품목 및 등급 확인",
      "필요 성적서 종류 확정",
    ],
  },
  {
    slug: "sw-vnv",
    label: "SW V&V",
    path: "docs/remediation/01-sw-vnv",
    items: [
      "sw-vnv-submission-outline.md",
      "sw-vnv-current-test-report.md",
      "sw-vnv-defect-retest-log.md",
    ],
    description:
      "요구사항-시험-결과 추적성, deterministic check, 실행 증적, 재시험 기록을 정리한 SW V&V 제출 묶음입니다.",
    highlights: [
      "12개 deterministic check를 기반으로 실행 증적을 남기고 있습니다.",
      "요구사항-시험케이스-결과 연결 구조를 문서와 export로 확인할 수 있습니다.",
      "현재 결과서와 결함/재시험 기록서를 별도 문서로 관리합니다.",
    ],
    nextSteps: [
      "릴리즈 기준 test:vnv:record 실행 로그 누적",
      "시험기관 양식에 맞춘 결과서 편집",
      "예외 시나리오 추가 점검",
    ],
  },
  {
    slug: "cyber-ai",
    label: "사이버보안 / AI",
    path: "docs/remediation/02-cybersecurity, 03-ai-evaluation",
    items: [
      "cybersecurity-final-readiness-report.md",
      "ai-evaluation-current-report.md",
      "ai-evaluation-dataset-definition.md",
    ],
    description:
      "사이버보안 저장 정책과 measured-only AI 성능평가 구조를 제출형 기준으로 정리한 묶음입니다.",
    highlights: [
      "브라우저 저장 최소화와 민감정보 분류 기준을 문서화했습니다.",
      "measured-only 평가셋 분리, DB 저장, 버전 비교 구조를 반영했습니다.",
      "보안 이벤트와 AI 평가 export를 운영 화면에서 바로 확인할 수 있습니다.",
    ],
    nextSteps: [
      "GMP 제출 문서 묶음 보강",
      "사용적합성 자료 정리",
      "AI 라벨/프로토콜 외부 심사 수준 검토",
    ],
  },
];

export function getAdminDocumentGroup(slug: string) {
  return ADMIN_DOCUMENT_GROUPS.find((item) => item.slug === slug) ?? null;
}
