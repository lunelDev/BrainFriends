export type RequirementId =
  | "SR-LOGIN-001"
  | "SR-PERMISSION-002"
  | "SR-SESSION-003"
  | "SR-SCORE-004"
  | "SR-HISTORY-005"
  | "SR-MEASURE-006";

export type VerificationMethod = "unit" | "integration" | "system" | "review";

export interface SoftwareRequirement {
  id: RequirementId;
  title: string;
  description: string;
  verificationMethod: VerificationMethod;
  acceptanceCriteria: string;
}

export const SOFTWARE_REQUIREMENTS: SoftwareRequirement[] = [
  {
    id: "SR-LOGIN-001",
    title: "로그인 성공 후 환자 세션 진입",
    description:
      "유효한 계정으로 로그인하면 환자 세션이 생성되고 다음 화면으로 이동해야 한다.",
    verificationMethod: "integration",
    acceptanceCriteria: "인증 성공 후 세션 API에서 patient 정보가 반환된다.",
  },
  {
    id: "SR-PERMISSION-002",
    title: "카메라 및 마이크 권한 없으면 진입 차단",
    description:
      "권한이 거부된 경우 훈련 또는 진단 흐름으로 진행되면 안 된다.",
    verificationMethod: "system",
    acceptanceCriteria: "권한 거부 시 오류 메시지가 표시되고 다음 화면 진입이 차단된다.",
  },
  {
    id: "SR-SESSION-003",
    title: "Step 결과 저장 및 복원",
    description:
      "각 step 결과가 저장되고 동일 사용자 흐름에서 다시 복원 가능해야 한다.",
    verificationMethod: "integration",
    acceptanceCriteria: "중간 저장 후 다시 진입해도 세션 진행 상태가 유지된다.",
  },
  {
    id: "SR-SCORE-004",
    title: "AQ 점수 자동 계산",
    description: "Step 결과를 기반으로 AQ 점수가 자동 계산되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria: "동일 입력에 대해 동일 AQ 결과가 계산된다.",
  },
  {
    id: "SR-HISTORY-005",
    title: "결과 리포트 저장 및 재조회",
    description:
      "세션 종료 후 history entry가 생성되고 결과를 다시 조회할 수 있어야 한다.",
    verificationMethod: "integration",
    acceptanceCriteria: "세션 종료 후 history entry가 생성되고 결과 화면에서 조회된다.",
  },
  {
    id: "SR-MEASURE-006",
    title: "measured / partial / demo 구분 반영",
    description:
      "측정 상태가 measured, partial, demo로 정확히 분류되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "입력 상태에 따라 measurementQuality.overall 값이 정확히 계산된다.",
  },
];

export function getRequirementById(requirementId: RequirementId) {
  return SOFTWARE_REQUIREMENTS.find((requirement) => requirement.id === requirementId) ?? null;
}
