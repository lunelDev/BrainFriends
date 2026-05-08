# 브레인프렌즈 디지털의료제품 허가·심사 갭 매트릭스

작성일: 2026-04-29
최종 정정: 2026-05-07 (NIDS 상담노트 및 새 식약처 가이드라인 세트 반영)
작성 기준: `mfds-guideline-basis.md`, `브레인프렌즈-제품기획서.pdf`, 현재 레포 구현 상태
문서 성격: PM/개발 우선순위 결정을 위한 내부 작업 문서. 최종 법적 판단은 식약처 사전상담·시험기관·인허가 컨설턴트 검토로 확정한다.

> **2026-04-30 정정**: NIDS 답변에 따라 SaMD 와 DTx 는 양자택일 관계가 아니다. **SaMD ⊃ DTx** (SaMD 가 상위 분류, DTx 는 그 안의 부분집합). 본 문서의 §4-2 분기 시나리오 표 및 §6 첫 번째 의사결정 항목은 이 관점에서 다시 읽어야 한다. 자세한 정정 사항은 결정문 참조.
>
> **2026-05-07 정정**: NIDS 상담노트 기준으로 인허가 실행 순서는 **제조업 허가 → GMP 적합인정 → 품목 인허가**이다. NIDS 상담노트는 공식 서면 답변이 아니므로 제출 근거로 쓰지 않고, 확정이 필요한 사항은 식약처 디지털의료제품지원총괄과 정식 민원 또는 품목 인허가 심사에서 확인한다.

## 결론

브레인프렌즈는 이제 **일반 웰니스 앱**이나 단순 재활 앱으로 관리하면 안 된다. 제품기획서가 이미 다음 표현을 쓰고 있기 때문이다.

- 독립형 디지털의료기기소프트웨어
- 언어재활 목적 소프트웨어
- 2등급 검토
- 디지털 치료기기
- AI 멀티모달
- K-WAB 보조 채점
- 안면 분석 온디바이스 및 서버 보안 프록시 STT
- 치료사 검토·확정

따라서 다음 개발은 기능 추가보다 먼저 **허가·심사에서 방어 가능한 제품 범위와 클레임을 잠그는 작업**을 우선해야 한다.

시험·인증 기준의 개발 방향은 `docs/regulatory/test-and-certification-development-guide.md`를 우선 따른다.

현재 PM 판단:

| 항목 | 판단 |
| --- | --- |
| 1차 규제 포지션 | 독립형 디지털의료기기소프트웨어(SaMD) |
| DTx 포지션 | SaMD 안의 치료/재활 목적 제품 성격. 단 "허가된 DTx" 표현은 확증 임상 및 허가 전 금지 |
| 예상 등급 | 2등급 가능성을 기준으로 준비. 최종은 분류·등급 가이드라인에 따른 자체 선언 후 심사에서 확정 |
| AI 적용 | 적용됨. 단 AI가 진단/치료 결정을 직접 내리는지, 보조 분석 도구인지 경계 설정 필요 |
| 가상융합기술 | 현재 미적용. VR/AR/HMD 없음 |
| 최우선 리스크 | 제조업 허가/GMP 선행, 사용목적·효능 클레임, 임상근거, AI 성능평가, SW 안전성 등급 |

## 근거 문서

| 구분 | 파일 |
| --- | --- |
| 기준 문서 | `docs/regulatory/mfds-guideline-basis.md` |
| 제품기획서 | `C:/Users/pc/Downloads/브레인프렌즈-제품기획서.pdf` |

## 제품 클레임 잠금

### 방어 가능한 클레임

현재 코드와 문서로 비교적 방어 가능한 표현이다.

| 클레임 | 근거 |
| --- | --- |
| 독립형 웹 기반 SaMD 형태 | Next.js 앱, 서버 API, 치료사/환자 분리 구조 |
| 음성·안면 기반 언어재활 보조 분석 | `SpeechAnalyzer.ts`, `FaceTracker.tsx`, `articulationAnalyzer.ts`, Parselmouth service |
| K-WAB 기반 점수 산출 보조 | `src/lib/kwab/KWABScoring.ts`, `src/app/api/kwab/final-result` |
| 치료사 검토·메모·follow-up | `src/app/therapist/*`, `src/app/api/therapist/reports/*` |
| 부작용/이상반응 신고 기반 | `src/app/api/adverse-events/*`, `docs/database/adverse_events.sql` |
| SW V&V 일부 자동화 | `src/lib/vnv/*`, `npm run test:vnv` |
| 사이버보안 일부 구현 | `src/lib/security/*`, `src/app/api/security-audit`, `docs/security/*`, `docs/regulatory/source-cybersecurity-requirements.md` |
| 5채널 중 시선/AAC 보조 채널 Phase 1 | `src/utils/faceAnalysis.ts`, `src/lib/training/gazeAccumulator.ts`, `src/components/aac/*` |
| 보호자 주간 리포트 링크 기반 Phase 1 | `src/lib/server/guardianReportsDb.ts`, `src/app/guardian/[token]/page.tsx` |

### 아직 방어 불충분한 클레임

아래 표현은 그대로 허가 자료에 넣으면 질문을 받을 가능성이 높다.

| 클레임 | 문제 | 조치 |
| --- | --- | --- |
| Whisper-ko Fine-tuning, WER 15% 이하 | 현재는 `whisper-1` 또는 서버 STT 정책. Ko fine-tuning 실체와 검증셋 없음 | “한국어 STT 보조 전사”로 낮추거나, 평가셋/모델 고정/성능시험 필요 |
| WASM 온디바이스·원본 미전송 | 안면은 WASM. STT는 현재 서버 보안 프록시 경로를 사용하며 원본 음성 전송 가능성이 있음 | “안면 분석은 온디바이스, STT는 서버 보안 프록시 기반 보조 전사”로 표현 |
| Bayesian Adaptive Testing / IRT | 실제 IRT/Bayesian 구현 없음 | 구현 전까지 “휴리스틱 적응형 난이도”로 낮춤 |
| AAC 발화 의도 AI 예측 | 현재 규칙 기반 템플릿 | “AAC 심볼 기반 규칙형 의도 문장 생성”으로 표현 |
| K-WAB 자동 채점 | 치료사 확정 없는 자동 진단처럼 보일 수 있음 | “K-WAB 보조 채점 및 치료사 검토 인터페이스”로 고정 |
| 평균 지연 50ms, P95 41.5ms | 측정 리포트 없음 | 성능 시험 자동화 및 기기별 측정 로그 필요 |
| 파일럿 n=50 효과 | 내부 단일군 자료로 확증 표현 불가 | “탐색적 내부 관찰, 확증 임상 예정”으로 제한 |

## 허가·심사 갭 매트릭스

| 영역 | 가이드라인 관점 | 현재 상태 | 갭 | 우선순위 |
| --- | --- | --- | --- | --- |
| 제품 분류·등급 | 독립형 디지털의료기기소프트웨어 여부, DTx 여부, 등급 판단 필요 | 제품기획서상 2등급/DTx 준비로 기재 + NIDS 답변 (SaMD ⊃ DTx 양자택일 아님) ✅ | 식약처 사전상담 회신 대기 | **P0 ⚠ 부분** (자료 ✅ / 회신 대기) |
| 사용목적 | 대상 질환, 사용자, 환경, 출력 정보, 금기사항 명확화 | `intended-use-and-contraindications.md` v0.1 ✅ + claim-lock §3 §5 잠금 ✅ + 환자 온보딩 exclusion check (RM-007 통제) ✅ | 식약처 사전상담 회신 후 미세조정 | **P0 ✅ 자체 완료** |
| 작용원리 | 과학적 근거 기반 작용원리와 정보통신체계도 필요 | claim-lock §3 잠금 + ai-role-boundary.md ✅ + cloud-and-data-transfer.md ✅ + sds.md (architecture diagram) ✅ | 임상 작용기전 문헌 인용 강화 | **P0 ✅ 자체 완료** |
| DTx 판단 | 치료 작용기전의 과학적·임상적 근거 필요 | SaMD 안의 DTx 성격으로 관리. "허가된 DTx" 표현 금지 ✅ | 치료/재활 효과 주장 시 전향적 임상자료 필요 | **P0 ⚠ 클레임 제한 / P1 임상** |
| SW 안전성 등급 | A/B/C 등급 판단 및 근거 필요 | risk-management-file v1.0 §3 Class B 권고 ✅ + 21개 RM-* 매트릭스 ✅ | 식약처 사전상담 회신 | **P0 ✅ 자체 완료** |
| 위험관리 | ISO 14971 위험관리 파일 필요 | risk-management-file **v1.0 마감** ✅ + §11 결정성 V&V 매핑 + §11.7 IEC 62366 매핑 + §11.8 신규 산출물 7종 + §11.9 잔여위험 재평가 ✅ | 임상/사용성 실측 결과 반영 v1.x | **P0 ✅ 자체 완료** |
| SRS/SDS | 요구사항, 구조설계, 상세설계, 추적성 필요 | `srs.md` v0.1 (IEC 62304 §5.2 양식) ✅ + `sds.md` v0.1 (§5.4 + 모듈 38종) ✅ + traceability-matrix.md ✅ + IEC 62304 별지 제2호 export ✅ | 시판 전 v1.0 마감 | **P0 ✅ 자체 완료** |
| V&V | 요구사항-설계-시험-결과 추적 필요 | 결정성 V&V **53/53 PASS** ✅, SR-* 35개 + TC 53건 + 추적성 51행 + IEC 62304 별지 제2호 export | (보강 완료) | **P0 ✅ 자체 완료** |
| AI 성능평가 | 학습/시험 데이터셋, 성능, 편향, 변경관리 필요 | werRunner.ts (`npm run ai-eval:wer`) + sttBenchmark.ts (`npm run ai-eval:rtf`) + 데이터 수집 가이드 v0.1 + WASM 모델 평가 계획 v0.1 ✅ 평가 체계 | **임상 협력기관 30건 음성** (외부 의존) | **P0 ✅ 체계 / ✗ 실측** |
| STT/외부 서비스 | 클라우드 서비스, 모델 버전, 데이터 송신 명시 필요 | 현재 제품 기본값은 보안 프록시 기반 서버 STT. 브라우저 직접 외부 전송은 하지 않으며, 원본 음성은 서버 프록시를 통해 제한적으로 외부 STT 서비스에 전달될 수 있음 | 위탁/제3자 처리 고지, 원본 음성 보존 금지, STT metadata export 확인 필요 | **P0 ✅ 정책 / ⚠ 운영 고지** |
| 사이버보안 | 접근통제, 전송/저장 보호, 감사로그, 취약점 관리 | 35 항목 ~77% 결정성 V&V (TC-SEC-* 10건) ✅ + SBOM ✅ + SOUP ✅ + Manifest ✅ + CVE 면제 등록부 (high 7건) ✅ + 감사로그 확대 helper ✅ | 외부 침투 시험 (위탁) | **P0 ✅ 자체 / ✗ 침투 시험** |
| 제조업 허가 / GMP/QMS | 제조업 허가 후 GMP 적합인정, 이후 품목 인허가 순차 진행 | gmp-qms-decision-matrix v0.1 ✅ + change-approval-sop ✅ + pms-capa-procedure ✅ + post-market-surveillance-plan ✅ + release manifest ✅ | 제조업 허가 준비, 품질책임자/RA-QA 지정, 하이브리드 외주 견적 | **P0 ⚠ 사업 실행 필요** |
| 사용적합성 | IEC 62366 기반 사용 시나리오·평가 필요 | 프로토콜 v0.1 작성 (POF 12 + critical 2 + 12 시나리오 + HRUS 매핑 + summative 15명 설계 + 결정성 합격기준), 실제 평가 미실시 | summative 평가 실행, formative round 1~3 진행 | **P0 부분 완료** (프로토콜 ✅ / 평가 진행 ✗) |
| 임상평가 | 치료/재활 임상 유효성을 표방하면 전향적 임상 또는 임상적 성능 자료 필요 | 내부 단일군 파일럿/사용성 데이터 축적 중 | RCT/IRB/통계분석계획서, 질환군 데이터, Gold Standard | **P1 ⚠ 외부 협력기관 의존** |
| 변경관리 | 알고리즘, 운영환경, UI, 통신 변경 영향평가 필요 | analyzeChangeImpact 결정성 함수 ✅ + change-approval-sop v0.1 ✅ + release manifest delta 자동 분류 ✅ | (적용 완료) | **P0 ✅ 자체 완료** |
| 시판 후 감시 | 불만, 이상반응, CAPA, PMS 필요 | post-market-surveillance-plan v0.1 + pms-capa-procedure v0.1 + adverseEventReview ✅ | 실제 운영 인력 지정 (PM) | **P1 ✅ 자체 완료** |
| 보호자 리포트 | 3-tier 사용자 구조 근거 | Phase 1 read-only 토큰 링크 ✅ + Phase 2 SMTP/SES 발송 stub (decideSend + executeSendBatch) ✅ + 동의 상태머신 ✅ | 실제 SMTP/SES wiring (다음 세션 또는 운영) | **P1 ✅ 코드 / ⚠ 운영 wiring** |
| 가상융합기술 | VR/AR/HMD 적용 시 별도 가이드라인 | 현재 미적용 | 없음. 추가 개발 시 재검토 | 제외 |

## 현재 코드/문서 증적 매핑

| 규제 산출물 | 현재 근거 | 상태 |
| --- | --- | --- |
| V&V 테스트 러너 | `src/lib/vnv/runDeterministicChecks.ts` (53 TC) | ✅ 충족 |
| V&V 요구사항 목록 | `src/lib/vnv/requirements.ts` (SR-* 35) | ✅ 충족 |
| V&V 제출 문서 | `srs.md` + `sds.md` + `traceability-matrix.md` + V&V export | ✅ 충족 |
| AI 평가 문서 | `ai-evaluation-data-collection-guide.md` + `mfds-ai-permit-review-response.md` + `werRunner.ts` + `sttBenchmark.ts` | ✅ 체계 / ✗ 실측 |
| 보안 문서 | `source-cybersecurity-requirements.md` + `cloud-and-data-transfer.md` + `cve-exemptions.md` + SBOM/SOUP/Manifest | ✅ 자체 / ✗ 침투 시험 |
| 개인정보/PHI 분리 | `docs/10-operations/pii-phi-separation.md` + 강화 계획 v0.1 + `phiMasking.ts` (`SR-PHI-013`) | ⚠ 정책 ✅ / DB migration 별도 |
| 감사로그 | `auditChain.ts` (HMAC) + `auditExpansion.ts` (5 카테고리) + 보존기간 매핑 | ✅ 충족 |
| 이상반응 | `adverseEventsDb.ts` + `adverseEventReview.ts` (`SR-AE-011`) + zod 검증 | ✅ 충족 |
| 보호자 리포트 | Phase 1 read-only 토큰 ✅ + Phase 2 SMTP/SES stub (`weeklyReportSender.ts`) ✅ + 동의 상태머신 ✅ | ✅ 코드 / ⚠ 운영 wiring |
| STT 정책 + 서버 보안 프록시 | `sttPolicy.ts` + `/api/proxy/stt` + `cloud-and-data-transfer.md` + WER/RTF runner | ✅ 정책 / ⚠ 운영 고지 |
| 시선 추적 | `faceAnalysis.ts` + `gazeAccumulator.ts` (`SR-GAZE-007`) + 치료사 표시 | ✅ 충족 |
| AAC | `intentTemplate.ts` + `AACBoard.tsx` + 주요 훈련 통합 (`inputModality=aac`) | ✅ 충족 |
| 적응형 난이도 (IRT) | `lib/adaptive/irt.ts` (`SR-IRT-018`, 2PL+EAP+MFI) + `lib/adaptive/itemBank.ts` v0.1 (step 1/2/4) | ✅ 코드 / ⚠ step page 통합 |
| IEC 62366 사용적합성 | `usability-evaluation-protocol.md` v0.1 + IRB 패키지 v0.1 + `useScenarioValidator.ts` (POF 12 + critical 2) | ✅ 자체 / ✗ 평가 실시 |
| ISO 14971 위험관리 | `risk-management-file.md` **v1.0** + 21 RM-* + 결정성 V&V 매핑 + 잔여위험 재평가 | ✅ 자체 |
| 추적성 매트릭스 | IEC 62304 별지 제2호 export (`/api/therapist/system/iec62304-traceability?format=md`) + `traceability.ts` (51행) | ✅ 충족 |
| 형상관리 / Release | `releaseManifest.ts` + `analyzeChangeImpact.ts` + git SHA + SBOM + SOUP sha256 동결 | ✅ 충족 |
| 환자 온보딩 | `lib/onboarding/exclusionCheck.ts` (RM-007 통제) | ✅ 충족 |
| Service Worker 캐싱 | `wasmSttCacheStrategy.ts` + `public/sw.js` stub | ✅ 스켈레톤 |
| 사용자 매뉴얼 | `docs/manuals/manual-{therapist,patient,guardian}.md` v0.1 | ✅ 충족 |
| GMP/QMS | `gmp-qms-decision-matrix.md` + `change-approval-sop.md` + `pms-capa-procedure.md` + `post-market-surveillance-plan.md` + 사용자 매뉴얼 3종 + `permit-readiness-internal-standard.md` | ✅ 자체 / ⚠ 옵션 결정 (PM) |

## 개발 우선순위 재정렬

### P0-Reg: 인허가 방향 잠금 전 반드시

1. **제품 클레임 잠금 문서**
   - 파일 제안: `docs/regulatory/claim-lock.md`
   - 산출물: 허가자료에 쓸 수 있는 표현 / 쓰면 안 되는 표현 / 보류 표현
   - 특히 수정할 표현: `Whisper-ko Fine-tuning`, `WASM 원본 미전송`, `Bayesian IRT`, `AAC AI 예측`, `K-WAB 자동 채점`

2. **사용목적·대상환자·금기사항 정의**
   - 파일 제안: `docs/regulatory/intended-use-and-contraindications.md`
   - 결정 필요: MCI를 1차 허가 범위에 포함할지 제외할지
   - PM 권고: 1차 허가는 `뇌졸중/뇌손상 후 실어증·구음장애`로 좁히고, MCI는 후속 적응증으로 분리

3. **SW 안전성 등급 + ISO 14971 위험관리 파일 v0.1**
   - 파일 제안: `docs/regulatory/risk-management-file.md`
   - 최소 항목: hazard, foreseeable sequence, harm, severity, probability, risk control, residual risk
   - 코드 연결: 권한 차단, STT 실패 fallback, 치료사 검토, 이상반응 신고, 데이터 비식별화

4. **IEC 62304용 SRS/SDS/Traceability 초안**
   - 파일 제안:
     - `docs/regulatory/srs.md`
     - `docs/regulatory/sds.md`
     - `docs/regulatory/traceability-matrix.md`
   - 기존 `SR-*`, `TC-*`를 확장해 요구사항-설계-시험-위험통제 연결

5. **AI 역할 경계 문서**
   - 파일 제안: `docs/regulatory/ai-role-boundary.md`
   - 핵심 결정: AI가 “진단/치료 결정”을 하는가, “전사·보조 분석·치료사 검토용 지표”를 제공하는가
   - PM 권고: 1차 허가에서는 AI를 치료사 보조 분석으로 제한

6. **STT/외부 서비스 데이터 송신 명세**
   - 파일 제안: `docs/regulatory/cloud-and-data-transfer.md`
   - 현재 상태: STT는 서버 보안 프록시 경로를 사용한다.
   - 허가 표현: “원본 미전송/완전 온디바이스”가 아니라 “현재 버전에서 어떤 데이터가 어디로 가는지”를 정확히 써야 함

### P0-Code: 시험·인증 대응 코드 작업

1. **step-2/4/5 채점 보정**
   - target phrase 대비 transcript 비교 규칙을 재점검한다.
   - 다른 말을 했는데 100점이 나오는 케이스를 제거한다.

2. **결과 저장 구조 통일**
   - 자가진단, 언어재활, 노래훈련 결과에 `target`, `transcript`, `scoreReason`, `reviewRequired`, `audio`를 공통 저장한다.
   - ZIP export 와 DB 저장 형식을 임상/시험용으로 통일한다.

3. **치료사 검토 화면 강화**
   - transcript 원문, 문제별 정오답, 녹음 재생, 시선/AAC 사용 여부, 측정 품질을 확인 가능하게 한다.

4. **운영/사용성 증적 로그 확장**
   - 녹음 실패, 권한 거부, 저장 실패, 재시도, 중단, 검토 완료 이벤트를 남긴다.

5. **AI/STT 성능평가용 export 고정**
   - WER/CER, RTF, 질환군 stratification, 모델 버전 비교가 가능하도록 export 스키마를 고정한다.

### P1-Reg: RCT/실증 진입 전

1. **임상평가 전략**
   - 탐색/확증 분리
   - 1차 endpoint: K-WAB AQ 변화
   - 2차 endpoint: 이름대기, 반복, 이해, 완료율, 만족도, 이상반응
   - 통계분석계획서(SAP) 작성

2. **사용적합성 평가**
   - 환자, 치료사, 보호자 3개 사용자군
   - formative 5~8명, summative 15명 이상 수준으로 설계 검토

3. **GMP/QMS 문서 패키지**
   - 품질매뉴얼
   - 설계 및 개발 절차서
   - 유지보수 절차서
   - 문제해결 절차서
   - 형상관리 절차서
   - 보안지침 절차서
   - SOUP 목록

4. **AI 성능평가 데이터셋**
   - 최소 내부 검증셋부터 시작
   - 실어증/구음장애 음성, 연령대, 성별, 중증도 분포 기록
   - STT WER/CER, 조음 점수 정합성, K-WAB 보조 채점 일치율 산출

## PM 권고: 다음 2주 작업 순서

| 순서 | 작업 | 이유 |
| --- | --- | --- |
| 1 | `claim-lock.md` 작성 | 허가자료·IRB·제품소개서 표현을 먼저 통제해야 함 |
| 2 | `intended-use-and-contraindications.md` 작성 | 제품 범위가 넓으면 임상/성능평가 부담이 폭증 |
| 3 | `risk-management-file.md` v0.1 | SW 안전성 등급, 위험통제, V&V 범위가 여기서 결정 |
| 4 | `traceability-matrix.md` v0.1 | 지금 있는 `SR-*`/`TC-*`를 제출용 구조로 전환 |
| 5 | AI 역할 경계 + STT 데이터 송신 명세 | AI 가이드라인과 사이버보안 질문에 대비 |
| 6 | 코드 작업 재개: 저장 일관성 + 채점 보정 + 치료사 검토 화면 | 시험·인증용 증적 확보 |

## 제품기획서 문구 수정 권고

| 현재 표현 | 권고 표현 |
| --- | --- |
| Whisper-ko Fine-tuning | 한국어 음성 전사 보조 모듈. 모델 버전 및 성능은 별도 검증셋 기준으로 관리 |
| WER 15% 이하 | 내부 목표치. 허가자료에는 실측 완료 전 목표로만 표기 |
| WASM 온디바이스·원본 미전송 | 안면 분석은 온디바이스. STT는 서버 보안 프록시 기반 보조 전사로 분리 명시 |
| Bayesian Adaptive Testing / IRT 적용 | 현재 구현 전이면 적응형 난이도 조절 로직으로 표현 |
| AAC 발화 의도 AI 예측 | AAC 심볼 기반 발화 의도 문장 생성. AI 분류기는 후속 고도화 |
| K-WAB 자동 채점 | K-WAB 보조 채점 및 치료사 검토·확정 |
| 임상 효과 | 단일군 파일럿에서 관찰된 변화. 확증적 유효성은 전향적 임상에서 검증 예정 |

## 다음 의사결정

> **2026-04-30 정정**: NIDS 답변에 따라 "DTx 트랙 vs SaMD 트랙" 이 아니라 "1차 SaMD 신청 + DTx 분류 동시·후속 결정" 구조이다. 따라서 의사결정도 단순화된다.

PM 관점에서 바로 결정해야 할 것은 다음 두 가지이다.

### 1. 1차 허가 범위

**결정 대상**: 1차 SaMD 신청에 어떤 사용목적·대상환자·금기사항을 명시할 것인가.

권고안:

- 1차 허가 범위: 뇌졸중/뇌손상 후 실어증·구음장애 대상 언어재활 보조 SaMD
- 보조 사용자: 치료사/의사, 보호자 모니터링
- 핵심 출력: 훈련 결과, K-WAB 보조 점수, 조음/음향/안면/반응시간/시선/AAC 보조 지표
- 제외/보류: MCI, 완전 자동 진단, 완전 자동 치료 결정, AI가 임상 확정 판단을 대체한다는 표현

### 2. DTx 분류 동시 신청 여부

**결정 대상**: 1차 SaMD 신청에 DTx 첨부자료 (PDF #7 §III.2 8종 + 전향적 임상자료) 를 함께 제출할지, 1차는 SaMD 정보제공·관리형으로 신청 후 변경허가로 DTx 분류를 추가 신청할지.

판단 변수:

- 부산대 / 서울 Big 5 RCT 진행 시점과 자료 강도
- CPG·논문 인용 자료 (실어증 디지털 재활) 확보 수준
- 1차 허가 timing (시판·매출 시작 시점) vs DTx 마케팅 가치 우선순위

이렇게 분리하면 1차 허가는 P0 문서·추적성·위험관리 중심으로 진행 가능하고, RCT/IRT/STT 성능평가는 DTx 인정 자료 강화를 위해 P1 에서 순차 보강할 수 있다.
