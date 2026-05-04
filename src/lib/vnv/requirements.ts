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
  | "SR-AE-011"
  | "SR-RISK-012"
  | "SR-PHI-013"
  | "SR-AI-EVAL-014"
  | "SR-AI-EVAL-RUNNER"
  | "SR-AI-RTF-RUNNER"
  | "SR-WASM-STT-LOADING"
  | "SR-IRT-018"
  | "SR-ONBOARDING-EXCLUSION"
  | "SR-SEC-AUDIT-EXPANSION"
  | "SR-GUARDIAN-SENDER"
  | "SR-IRT-ITEMBANK"
  | "SR-CONSENT-015"
  | "SR-CHANGE-016"
  | "SR-IEC62304-EXPORT"
  | "SR-USABILITY-017"
  | "SR-SEC-IA05"
  | "SR-SEC-IA07"
  | "SR-SEC-UC03"
  | "SR-SEC-RA01"
  | "SR-SEC-UC07"
  | "SR-SEC-TRE01"
  | "SR-SEC-SI07"
  | "SR-SEC-SI05"
  | "SR-SEC-SI04-SOUP"
  | "SR-SEC-SI04-MANIFEST";

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
    description: "유효한 계정으로 로그인하면 환자 세션이 생성되고 다음 화면으로 이동해야 한다.",
    verificationMethod: "integration",
    acceptanceCriteria: "인증 성공 후 세션 API에서 patient 정보가 반환된다.",
  },
  {
    id: "SR-PERMISSION-002",
    title: "카메라 및 마이크 권한 없으면 진입 차단",
    description: "권한이 거부된 경우 훈련 또는 진단 흐름으로 진행되면 안 된다.",
    verificationMethod: "system",
    acceptanceCriteria: "권한 거부 시 오류 메시지가 표시되고 다음 화면 진입이 차단된다. 환자 리포트 접근은 admin 또는 담당 치료사로 제한되며 비담당 치료사와 타 환자 접근은 차단된다.",
  },
  {
    id: "SR-SESSION-003",
    title: "Step 결과 저장 및 복원",
    description: "각 step 결과가 저장되고 동일 사용자 흐름에서 다시 복원 가능해야 한다.",
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
    description: "세션 종료 후 history entry가 생성되고 결과를 다시 조회할 수 있어야 한다.",
    verificationMethod: "integration",
    acceptanceCriteria: "세션 종료 후 history entry가 생성되고 결과 화면에서 조회된다. 저장 실패 시 compact/server-only fallback 과 재시도 또는 수동 검토 상태가 결정적으로 산출된다.",
  },
  {
    id: "SR-MEASURE-006",
    title: "measured / partial / demo 구분 반영",
    description: "측정 상태가 measured, partial, demo로 정확히 분류되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria: "입력 상태에 따라 measurementQuality.overall 값이 정확히 계산된다.",
  },
  {
    id: "SR-GAZE-007",
    title: "시선(보조 채널) 결정성 산출",
    description: "MediaPipe iris 랜드마크가 들어오면 동일한 입력에 대해 동일한 gazeX / gazeY / centeredScore 가 산출되고, 세션 종료 시 치료사 검토용 history summary 로 보존되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria: "고정 랜드마크 fixture 입력에 대해 gazeX=0, gazeY=0, centeredScore=100, irisDetected=true 가 결정적으로 산출되고, 비어 있지 않은 gaze report 는 history summary 로 유지된다.",
  },
  {
    id: "SR-AAC-008",
    title: "AAC 의도 템플릿 결정성",
    description: "AAC 보드에서 환자가 commit 한 심볼 시퀀스는 동일 입력에 대해 동일한 한국어 문장이 생성되고, 주요 훈련 흐름에서는 inputModality=aac 로 추적되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria: "고정 심볼 시퀀스 입력 fixture 에 대해 buildAacIntentSentence 가 동일한 sentence 를 산출하고, 알 수 없는 id 는 unknownIds 에 누적된다.",
  },
  {
    id: "SR-STT-009",
    title: "훈련 STT 서버 송신 정책 분리",
    description: "일상 훈련과 게임 훈련 STT 는 mock, WASM 온디바이스, 서버 Whisper, 차단 상태가 구분되어야 한다. WASM 이 없을 때 서버 Whisper 송신은 명시 플래그 없이는 차단되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria: "DEV_MODE 는 mock_stt, daily_training/game_training 은 WASM 미가용 + fallback false 에서 서버 업로드 전 client preflight 로 차단되고, weekly_kwab 은 server_whisper 로 결정된다.",
  },
  {
    id: "SR-GUARDIAN-010",
    title: "보호자 주간 리포트 결정성 요약",
    description: "보호자에게 공유되는 주간 리포트는 최근 7일 훈련 기록과 이상반응 건수를 동일 입력에서 동일하게 요약해야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria: "고정 세션 fixture 에 대해 총 훈련 수, 최신 AQ, AQ 변화, 단계별 완료율, 이상반응 상태가 결정적으로 산출된다.",
  },
  {
    id: "SR-AE-011",
    title: "이상반응 신고 조회 및 중증 미확인 분류",
    description: "환자 또는 처방자가 등록한 이상반응은 최신순으로 조회 가능해야 하며, 미해결 건과 미확인 중증 건이 검토 필요 상태로 분류되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria: "고정 이상반응 fixture 에 대해 최신순 정렬, total/unresolved/severeUnacknowledged 집계, 보호자 리포트 reported 상태가 결정적으로 산출된다.",
  },
  {
    id: "SR-RISK-012",
    title: "ISO 14971 위해요인 위험등급 결정성 분류",
    description: "식약처 디지털의료기기 GMP [별표3] 2.1.1~2.1.6 / PDF #1 §IV.3 SW 안전성 등급 / ISO 14971 대응. severity (1~5) × probability (1~5) → riskClass A/B/C 결정성 매핑.",
    verificationMethod: "unit",
    acceptanceCriteria: "fixture 입력에 대해 riskScore=severity*probability, riskClass: ≤6→A, 7~14→B, ≥15→C 결정성 산출. classifyHazardList 중복 제거 + 정렬, summarizeHazards.unacceptable=residualClass=C count.",
  },
  {
    id: "SR-PHI-013",
    title: "PHI 마스킹 결정성",
    description: "식약처 디지털의료기기 GMP [별첨5] 보안지침 / 개인정보보호법 대응. 외부 산출물의 PHI (이름·전화·RRN·이메일·환자ID) 결정성 마스킹.",
    verificationMethod: "unit",
    acceptanceCriteria: "각 PHI 종류별 결정성 마스킹, 알 수 없는 패턴은 blanket=true. maskPhiObject 는 PHI 키 자동 탐지 + touched 알파벳 정렬.",
  },
  {
    id: "SR-AI-EVAL-014",
    title: "WER/CER 결정성 계산",
    description: "식약처 AI 적용 가이드라인 PDF #2 §III.2 성능 검증 대응. Levenshtein 기반 WER/CER 결정성 + NFC 정규화 + passRateAt15.",
    verificationMethod: "unit",
    acceptanceCriteria: "fixture (정확/치환/빈입력) 에 대해 결정성 wer, aggregateWer 의 mean/passRateAt15 산출, 빈 결과셋은 모두 0 반환.",
  },
  {
    id: "SR-AI-EVAL-RUNNER",
    title: "AI STT 성능평가 (WER/CER) runner 결정성",
    description:
      "식약처 AI 적용 디지털의료기기 가이드라인 PDF #2 §III.2 성능 검증 산출물 — " +
      "60~80대 환자 음성 fixture (CSV) 입력에 대해 stratified WER/CER 보고서 (overall + ageGroup + severity + noise + device) " +
      "와 JSON / Markdown 직렬화가 결정성으로 산출되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "parseWerCsv 는 헤더 검증 + sampleId 알파벳 정렬 + RFC 4180 quoted field 처리. " +
      "evaluateWerRows 는 동일 (rows, generatedAt, datasetId, modelId) → 동일 보고서. " +
      "classifyAgeGroup: 60s/70s/80s/other 결정성. serializeWerReportJson 동일 입력 동일 문자열 (sortKeys). " +
      "passRateAt15 = WER ≤ 0.15 비율, claim-lock §4 WER 행 검증 도구.",
  },
  {
    id: "SR-AI-RTF-RUNNER",
    title: "STT 성능 벤치마크 (RTF / latency percentile) runner 결정성",
    description:
      "식약처 AI 적용 디지털의료기기 가이드라인 PDF #2 §III.2 응답 시간 산출물 + " +
      "제품기획서 P95 41.5ms 정량 클레임 검증 도구. " +
      "audioDurationMs / processingMs 입력에 대해 RTF, mean/P50/P95/P99 latency, stratified 산출.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "parseRtfCsv RFC 4180 + 헤더 검증 + sampleId 알파벳 정렬, percentile 보간 결정성, " +
      "evaluateRtfRows 동일 입력 동일 출력, classifyRtfAgeGroup 60s/70s/80s/other, " +
      "passRateP95Target = processingMs ≤ p95TargetMs (default 41.5) 비율, JSON sortKeys + Markdown 결정성.",
  },
  {
    id: "SR-WASM-STT-LOADING",
    title: "WASM Whisper 모델 로드 상태 머신 결정성",
    description:
      "claim-lock §3 WASM 온디바이스 STT 행의 사용자 경험 보장. " +
      "not_started → loading → (ready | failed) → reset 상태 전이 결정성. " +
      "progress 0~1 클램프 + 한국어 메시지 자동 산출.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "startLoading/reportProgress/markReady/markFailed/reset 결정성. " +
      "isLegalTransition: not_started→loading, loading→ready/failed, ready/failed→not_started, idempotent 만 합법. " +
      "clampProgress: NaN/음수/1초과 → 0/0/1, friendlyMessageFor 4 errorCode 매핑 + fallback. " +
      "elapsedLoadingMs 시간 계산 결정성.",
  },
  {
    id: "SR-IRT-018",
    title: "2PL IRT + Maximum Fisher Information adaptive testing 결정성",
    description:
      "식약처 디지털의료기기 가이드라인 PDF #2 §III.4 적응형 알고리즘 + 제품제안서 '핵심 모듈 IRT/Bayesian Adaptive Testing' 클레임. " +
      "2PL IRT 모델 (a, b parameter + θ EAP 추정) + MFI 문항 선택의 결정성 산출.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "probabilityCorrect 결정성 + 양극단 clamp, fisherInformation = a²·P·(1-P), " +
      "estimateAbilityEap 동일 입력 동일 θ_hat (41 quadrature -4~+4), " +
      "pickNextItem MFI + tie-break itemId asc, " +
      "simulateAdaptiveSession 고정 oracle → 동일 시퀀스 + 수렴 검증.",
  },
  {
    id: "SR-ONBOARDING-EXCLUSION",
    title: "환자 온보딩 exclusion check (RM-007 통제)",
    description:
      "1차 허가 범위 (뇌질환 후 실어증·마비말장애) 외 사용자 가입 시도 시 결정성 차단 또는 의료진 confirmation 분기. " +
      "MCI/치매 단독 차단, 급성기 (< 6주) 차단, 진단 미입력 차단, 80대 이상은 임상가 확인 권고.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "evaluateOnboardingExclusion 동일 입력 동일 출력. " +
      "차단 사유 알파벳 정렬. age < 18 / 진단 미입력 / MCI 단독 / 급성기 4 case 검증.",
  },
  {
    id: "SR-SEC-AUDIT-EXPANSION",
    title: "감사로그 확대 결정성 helper (RM-016 통제 보강)",
    description:
      "식약처 사이버보안 UC-07 + ISO 27001 A.12.4. 도메인 카테고리별 감사 entry 표준화: " +
      "guardian_link / kwab_finalization / permission_change / regulatory_filing / evaluation_publication.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "enrichAuditEntry 동일 입력 동일 출력. 5 카테고리 action/summary/PHI 강제/metadata 정렬 결정성. " +
      "AUDIT_RETENTION_DAYS 5/7/10년 매핑 안정.",
  },
  {
    id: "SR-GUARDIAN-SENDER",
    title: "보호자 주간 리포트 발송 결정 결정성",
    description:
      "Phase 2 — SMTP/SES/카카오 발송 결정 함수와 dry-run 발송 증적 저장. 동의 / 채널 구성 / 7일 중복 방지.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "decideSend 4 reason (no_consent / no_channel / duplicate / ok) 결정성. " +
      "executeSendBatch 알파벳 정렬 + stub adapter fallback. dry_run/sent/failed/skipped 발송 요약은 동일 입력 동일 outcome.",
  },
  {
    id: "SR-IRT-ITEMBANK",
    title: "IRT step item bank 결정성 (v0.1)",
    description:
      "step-1 / step-2 / step-4 의 IRT a/b parameter calibrated 단어/문항 풀 시드. " +
      "v0.1 은 임상가 1차 추정 (b 매핑) + 균일 a=1.0. v0.2+ 임상 calibration.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "getItemBankForStep 동일 step 동일 bank. 모든 item id stable + a/b 정의됨.",
  },
  {
    id: "SR-CONSENT-015",
    title: "보호자 동의 상태머신 결정성",
    description: "PDF #6 §16 사용자 적합성 / 개인정보보호법. pending/granted/revoked/expired 상태머신 결정성. pending TTL 7일 초과 시 자동 expired.",
    verificationMethod: "unit",
    acceptanceCriteria: "각 상태별 reportAccessAllowed/reissueRequired/reason 결정성. isLegalTransition: pending→granted/revoked/expired, granted→revoked 만 합법.",
  },
  {
    id: "SR-CHANGE-016",
    title: "변경관리 영향평가 (CIA) 결정성",
    description: "식약처 AI 적용 가이드라인 PDF #2 §III.5 변경허가 / GMP [별표3] 1.1.7 형상관리 대응. release manifest delta → 영향받는 SR-* + major/minor/patch 분류.",
    verificationMethod: "unit",
    acceptanceCriteria: "diffManifestComponents 는 added/removed/changed 알파벳 정렬. analyzeChangeImpact 는 모델자산/≥3 변경→major+filing, lock/sbom→minor, git만→patch 결정성 분류.",
  },
  {
    id: "SR-IEC62304-EXPORT",
    title: "IEC 62304 별지 제2호 추적성 매트릭스 export 결정성",
    description: "식약처 디지털의료기기 GMP [별표3] 1.1.1 / IEC 62304 §5.7 / PDF #5 [별첨2~5] 양식 대응. 인허가 신청용 추적성 매트릭스가 결정성 함수로 산출되고, JSON/Markdown/CSV 3종 직렬화 모두 동일 입력에 동일 출력.",
    verificationMethod: "unit",
    acceptanceCriteria: "buildIec62304TraceabilityMatrix 는 requirementId 알파벳 정렬 + designModules/testCaseIds 정렬 + uncovered/untested/hazardControlled 카운트 결정성. serializeIec62304Markdown/Csv 동일 입력 동일 출력. CSV escape (콤마/줄바꿈/따옴표) 결정성.",
  },
  {
    id: "SR-USABILITY-017",
    title: "IEC 62366 사용성평가 합격기준 결정성 산출",
    description:
      "식약처 디지털의료기기 GMP [별표3] 1.1.6 / PDF #7 §III.2.바 / IEC 62366-1 §5.4~5.9 대응. " +
      "Use scenario × task observation fixture 입력에 대해 critical task 완료율, primary operating function 완료율, " +
      "use error severity bucket, ISO 14971 hazard coverage 가 결정성으로 산출되고 summative pass/fail 판정이 일관되어야 한다.",
    verificationMethod: "unit",
    acceptanceCriteria:
      "buildTaskCompletionStats 는 taskId 알파벳 정렬 + (participantId, taskId) last-wins. " +
      "evaluateSummativeUsability 는 critical=100% / primary=80% 미달 / severe unmitigated > 0 / 참여자 0 시 failureReasons 결정성 산출, " +
      "buildHazardCoverage 는 hazardId 와 verifiedByTaskIds 알파벳 정렬, useErrorBuckets 는 minor→moderate→severe 고정 순서.",
  },
  {
    id: "SR-SEC-IA05",
    title: "비밀번호 강도 정책",
    description: "식약처 디지털의료기기 사이버보안 가이드라인 IA-05 대응. 신규 가입 시 길이/복잡도/반복 검증.",
    verificationMethod: "unit",
    acceptanceCriteria: "8자 미만 / 단일 문자종류 / 동일 문자 4회 반복 거부, 8자 + 2종 + 반복없음 통과.",
  },
  {
    id: "SR-SEC-IA07",
    title: "연속 로그인 실패 시 잠금",
    description: "식약처 디지털의료기기 사이버보안 가이드라인 IA-07 대응. 5회 실패 시 15분 잠금.",
    verificationMethod: "unit",
    acceptanceCriteria: "fixture 시퀀스에 대해 lockoutAt, attemptCount, audit reason 결정성 산출.",
  },
  {
    id: "SR-SEC-UC03",
    title: "세션 idle timeout",
    description: "식약처 디지털의료기기 사이버보안 가이드라인 UC-03 대응. 30분 idle 시 만료.",
    verificationMethod: "unit",
    acceptanceCriteria: "fixture 입력에 대해 isExpired/remainingMs/shouldReauth 결정성 산출.",
  },
  {
    id: "SR-SEC-RA01",
    title: "DoS 방지 sliding window rate limit",
    description: "식약처 디지털의료기기 사이버보안 가이드라인 RA-01 대응. 라우트별 sliding window.",
    verificationMethod: "unit",
    acceptanceCriteria: "fixture 입력에 대해 allowed/nextHistory/retryAfterMs/resetAtMs 결정성 산출.",
  },
  {
    id: "SR-SEC-UC07",
    title: "감사로그 부인 방지 HMAC 체인",
    description: "식약처 디지털의료기기 사이버보안 가이드라인 UC-07 대응. HMAC 체인 + prevHash.",
    verificationMethod: "unit",
    acceptanceCriteria: "동일 입력 동일 hash, 변조 시 valid=false + breakAt 결정성 식별.",
  },
  {
    id: "SR-SEC-TRE01",
    title: "감사로그 append-only 시간 단조성",
    description: "식약처 디지털의료기기 사이버보안 가이드라인 TRE-01 대응. 시간 역행 없음.",
    verificationMethod: "unit",
    acceptanceCriteria: "역행 없으면 valid=true, 있으면 valid=false + violationAt 결정성 식별.",
  },
  {
    id: "SR-SEC-SI07",
    title: "통합 오류 처리 dictionary",
    description: "식약처 디지털의료기기 사이버보안 가이드라인 SI-07 대응. 통합 코드 dictionary.",
    verificationMethod: "unit",
    acceptanceCriteria: "오류 코드 → httpStatus/userMessage/auditCategory 결정성 매핑, 미정의는 internal_error fallback.",
  },
  {
    id: "SR-SEC-SI05",
    title: "입력값 검증 통합 스키마",
    description: "식약처 디지털의료기기 사이버보안 가이드라인 SI-05 대응. zod 스키마 통합.",
    verificationMethod: "unit",
    acceptanceCriteria: "정상 fixture는 ok=true, 비정상은 ok=false + invalid_payload + auditDetail 결정성 산출.",
  },
  {
    id: "SR-SEC-SI04-SOUP",
    title: "SOUP 목록 결정성 정규화",
    description: "식약처 디지털의료기기 사이버보안 SI-04 + GMP [별표3] 2.3 대응. SOUP 정규화.",
    verificationMethod: "unit",
    acceptanceCriteria: "buildSoupList 동일 순서/내용 반환, model=C+model_eval, npm=A 결정성 산출.",
  },
  {
    id: "SR-SEC-SI04-MANIFEST",
    title: "Release manifest 결정성 + 시작 시 무결성 검증",
    description: "식약처 디지털의료기기 사이버보안 SI-04 + GMP [별표3] 2.3 형상관리 대응. release manifest 빌드/검증.",
    verificationMethod: "unit",
    acceptanceCriteria: "buildManifest 동일 입력 동일 manifestHash, verifyManifest sha변조/version/missing/extra 5종 breach 결정성 식별.",
  },
];

export function getRequirementById(requirementId: RequirementId) {
  return SOFTWARE_REQUIREMENTS.find((requirement) => requirement.id === requirementId) ?? null;
}
