export type RequirementId =
  | "SR-LOGIN-001"
  | "SR-PERMISSION-002"
  | "SR-SESSION-003"
  | "SR-SCORE-004"
  | "SR-HISTORY-005"
  | "SR-MEASURE-006"
  | "SR-GAZE-007"
  | "SR-AAC-008"
  | "SR-STT-009"
  | "SR-GUARDIAN-010"
  | "SR-AE-011";

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
    acceptanceCriteria:
      "권한 거부 시 오류 메시지가 표시되고 다음 화면 진입이 차단된다. 환자 리포트 접근은 admin 또는 담당 치료사로 제한되며 비담당 치료사와 타 환자 접근은 차단된다.",
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
    acceptanceCriteria:
      "세션 종료 후 history entry가 생성되고 결과 화면에서 조회된다. 저장 실패 시 compact/server-only fallback 과 재시도 또는 수동 검토 상태가 결정적으로 산출된다.",
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
  {
    id: "SR-GAZE-007",
    title: "시선(보조 채널) 결정성 산출",
    description:
      "MediaPipe iris 랜드마크가 들어오면 동일한 입력에 대해 동일한 gazeX / gazeY / centeredScore 가 산출되고, 세션 종료 시 치료사 검토용 history summary 로 보존되어야 한다. 제품제안서 p.7 5채널 중 4번 보조 채널 요건.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "고정 랜드마크 fixture 입력에 대해 gazeX=0, gazeY=0, centeredScore=100, irisDetected=true 가 결정적으로 산출되고, 비어 있지 않은 gaze report 는 history summary 로 유지된다.",
  },
  {
    id: "SR-AAC-008",
    title: "AAC 의도 템플릿 결정성",
    description:
      "AAC 보드에서 환자가 commit 한 심볼 시퀀스는 동일 입력에 대해 동일한 한국어 문장이 생성되고, 주요 훈련 흐름에서는 inputModality=aac 로 추적되어야 한다. 제품제안서 p.7 5채널 중 5번 보조 채널 (AAC) 요건.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "고정 심볼 시퀀스 입력 fixture 에 대해 buildAacIntentSentence 가 동일한 sentence 를 산출하고, 알 수 없는 id 는 unknownIds 에 누적된다. 훈련 통합 payload 는 inputModality=aac 와 symbolIds 를 보존한다.",
  },
  {
    id: "SR-STT-009",
    title: "훈련 STT 서버 송신 정책 분리",
    description:
      "일상 훈련과 게임 훈련 STT 는 mock, WASM 온디바이스, 서버 Whisper, 차단 상태가 구분되어야 한다. WASM 이 없을 때 서버 Whisper 송신은 명시 플래그 없이는 차단되어야 한다. 주간 K-WAB 및 임상 평가 STT 는 별도 useCase 로 추적되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "DEV_MODE 는 mock_stt, daily_training/game_training 은 WASM 미가용 + fallback false 에서 서버 업로드 전 client preflight 로 차단되고, weekly_kwab 은 server_whisper, daily_training + fallback true 는 server_whisper 로 결정된다. STT 실패, 서버 송신 차단, 빈 전사는 reviewRequired=true 로 분류된다. 결과 버전 스냅샷에는 STT 엔진, useCase, 정책 사유, prompt 버전, prompt hash, 원본 음성 외부 전송 여부가 기록된다.",
  },
  {
    id: "SR-GUARDIAN-010",
    title: "보호자 주간 리포트 결정성 요약",
    description:
      "보호자에게 공유되는 주간 리포트는 최근 7일 훈련 기록과 이상반응 건수를 동일 입력에서 동일하게 요약해야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "고정 세션 fixture 에 대해 총 훈련 수, 최신 AQ, AQ 변화, 단계별 완료율, 이상반응 상태가 결정적으로 산출된다.",
  },
  {
    id: "SR-AE-011",
    title: "이상반응 신고 조회 및 중증 미확인 분류",
    description:
      "환자 또는 처방자가 등록한 이상반응은 최신순으로 조회 가능해야 하며, 미해결 건과 미확인 중증 건이 검토 필요 상태로 분류되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "고정 이상반응 fixture 에 대해 최신순 정렬, total/unresolved/severeUnacknowledged 집계, 보호자 리포트 reported 상태가 결정적으로 산출된다.",
  },
];

export function getRequirementById(requirementId: RequirementId) {
  return SOFTWARE_REQUIREMENTS.find((requirement) => requirement.id === requirementId) ?? null;
}
