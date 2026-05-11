import type { ExportFile } from "@/features/result/types";

export type ResultDossierMode =
  | "self-assessment"
  | "speech-rehab"
  | "sing-training";

export type ResultMeasurementQuality = {
  level: "measured" | "partial" | "reference_only" | "not_measured";
  reason: string;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasFaceFrames: boolean;
  hasAdaptiveEvidence?: boolean;
};

export type ResultReviewBoundary = {
  reviewRequired: true;
  reviewerRole: "therapist";
  clinicalUse: "therapist_review_support_only";
  claimBoundary: string;
  prohibitedUse: string[];
};

export type ResultDossierIndex = {
  schemaVersion: "bf-result-dossier-v1";
  exportedAt: string;
  mode: ResultDossierMode;
  modeLabel: string;
  patient: unknown;
  resultSummary: {
    primaryScore: number | null;
    scoreLabel: string;
    scoreReason: string;
  };
  taskContext: unknown;
  measurementQuality: ResultMeasurementQuality;
  review: ResultReviewBoundary;
  article24Mapping: {
    purpose: string;
    localEvidenceFiles: string[];
    regulatoryUse: string[];
  };
  claimLock: {
    source: "docs/regulatory/claim-lock.md";
    checkedAt: string;
    appliedClauses: string[];
  };
  traceability: {
    generatedLocally: true;
    serverRequired: false;
    nextServerEvidence: string[];
  };
};

const MODE_LABELS: Record<ResultDossierMode, string> = {
  "self-assessment": "자가점검",
  "speech-rehab": "언어재활",
  "sing-training": "노래훈련",
};

export const RESULT_REVIEW_BOUNDARY: ResultReviewBoundary = {
  reviewRequired: true,
  reviewerRole: "therapist",
  clinicalUse: "therapist_review_support_only",
  claimBoundary:
    "본 결과는 치료사 검토용 보조 지표이며 의학적 진단·처방·치료 결정을 대체하지 않습니다.",
  prohibitedUse: [
    "확정 진단",
    "자동 처방",
    "의료진 없는 치료 결정",
    "치료 효과 입증 자료 단독 사용",
  ],
};

function encodeJson(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}

function encodeText(value: string) {
  return new TextEncoder().encode(value);
}

function fileExists(files: ExportFile[], pattern: RegExp) {
  return files.some((file) => pattern.test(file.name));
}

export function inferMeasurementQuality(files: ExportFile[], fallback?: Partial<ResultMeasurementQuality>): ResultMeasurementQuality {
  const hasAudio = fallback?.hasAudio ?? fileExists(files, /^media\/.+\.(webm|wav|mp3|m4a)$/i);
  const hasFaceFrames =
    fallback?.hasFaceFrames ?? fileExists(files, /^media\/.+\.(jpg|jpeg|png)$/i);
  const hasTranscript = fallback?.hasTranscript ?? false;
  const hasAdaptiveEvidence =
    fallback?.hasAdaptiveEvidence ?? fileExists(files, /^adaptive-evidence\.(json|csv)$/i);

  if (fallback?.level && fallback?.reason) {
    return {
      level: fallback.level,
      reason: fallback.reason,
      hasAudio,
      hasTranscript,
      hasFaceFrames,
      hasAdaptiveEvidence,
    };
  }

  if (hasAudio && (hasTranscript || hasFaceFrames)) {
    return {
      level: "measured",
      reason: "음성 또는 안면 원자료가 ZIP에 포함되어 치료사 검토와 재현 확인이 가능합니다.",
      hasAudio,
      hasTranscript,
      hasFaceFrames,
      hasAdaptiveEvidence,
    };
  }

  if (hasAudio || hasTranscript || hasFaceFrames || hasAdaptiveEvidence) {
    return {
      level: "partial",
      reason: "일부 원자료 또는 산출물만 포함되어 치료사 검토 시 측정 누락 여부 확인이 필요합니다.",
      hasAudio,
      hasTranscript,
      hasFaceFrames,
      hasAdaptiveEvidence,
    };
  }

  return {
    level: "reference_only",
    reason: "원자료가 포함되지 않아 화면 결과와 저장 스냅샷을 참고 지표로만 해석해야 합니다.",
    hasAudio,
    hasTranscript,
    hasFaceFrames,
    hasAdaptiveEvidence,
  };
}

export function buildResultDossierIndex(input: {
  mode: ResultDossierMode;
  exportedAt: string;
  patient: unknown;
  primaryScore?: number | null;
  scoreLabel?: string;
  scoreReason?: string;
  files: ExportFile[];
  taskContext?: unknown;
  measurementQuality?: Partial<ResultMeasurementQuality>;
}): ResultDossierIndex {
  const measurementQuality = inferMeasurementQuality(input.files, input.measurementQuality);

  return {
    schemaVersion: "bf-result-dossier-v1",
    exportedAt: input.exportedAt,
    mode: input.mode,
    modeLabel: MODE_LABELS[input.mode],
    patient: input.patient ?? null,
    resultSummary: {
      primaryScore:
        typeof input.primaryScore === "number" && Number.isFinite(input.primaryScore)
          ? input.primaryScore
          : null,
      scoreLabel: input.scoreLabel ?? "보조 지표",
      scoreReason:
        input.scoreReason ??
        "치료사가 결과 화면, 원자료, 과제 수행 맥락을 함께 검토하기 위한 보조 지표입니다.",
    },
    taskContext: input.taskContext ?? null,
    measurementQuality,
    review: RESULT_REVIEW_BOUNDARY,
    article24Mapping: {
      purpose:
        "디지털의료제품 허가·심사 제출 전 로컬 수행 결과의 원자료, 산출 지표, 검토 경계를 한 묶음으로 보존합니다.",
      localEvidenceFiles: input.files.map((file) => file.name).sort(),
      regulatoryUse: [
        "제24조 성능·특성 설명 보조",
        "제24조 소프트웨어 검증·확인 산출물 보조",
        "제24조 임상·사용성 평가 원자료 추적 보조",
        "변경관리 영향평가 입력 자료",
      ],
    },
    claimLock: {
      source: "docs/regulatory/claim-lock.md",
      checkedAt: input.exportedAt,
      appliedClauses: [
        "AI 분석 결과는 치료사의 임상적 판단을 보조하기 위한 참고 지표입니다.",
        "노래훈련 STT 전사는 치료사 검토용 참고값으로만 제공합니다.",
        "K-WAB 기반 결과는 자동 진단이 아니라 치료사 검토 보조입니다.",
      ],
    },
    traceability: {
      generatedLocally: true,
      serverRequired: false,
      nextServerEvidence: [
        "서버 DB 영구 저장",
        "기관·치료사 검토 상태",
        "감사로그 및 변경관리 승인 이력",
      ],
    },
  };
}

export function appendDossierFiles(
  files: ExportFile[],
  input: Omit<Parameters<typeof buildResultDossierIndex>[0], "files">,
) {
  const dossierIndex = buildResultDossierIndex({
    ...input,
    files,
  });

  files.push({
    name: "dossier-index.json",
    data: encodeJson(dossierIndex),
  });
  files.push({
    name: "README-regulatory.txt",
    data: encodeText(
      [
        "브레인프렌즈 로컬 결과 ZIP",
        "",
        RESULT_REVIEW_BOUNDARY.claimBoundary,
        "",
        "확인 순서:",
        "1. dossier-index.json - 허가 심사 대응 인덱스와 클레임 경계",
        "2. result.json - 화면 결과와 분석 산출물",
        "3. history.json / storage-snapshot.json - 수행 이력과 로컬 저장 스냅샷",
        "4. media/ - 녹음·키프레임 등 원자료가 있는 경우 포함",
        "",
        "본 ZIP은 서버 감사로그·치료사 최종 검토·공인시험 성적서를 대체하지 않습니다.",
      ].join("\n"),
    ),
  });

  return dossierIndex;
}
