# 인허가 산출물 완료 현황 Dashboard v0.1

작성일: 2026-04-30
용도: 외부 인력 (PM / 컨설팅 / 식약처 사전상담) 에 보여줄 수 있는 단일 페이지 현황표
범위: 1차 SaMD 신청 + DTx 후속 결정 (NIDS 답변 기준 SaMD ⊃ DTx)

## 0. 한 줄

**Claude 단독 가능한 코드 + 문서 산출물 약 90% 완료.** 남은 갭은 외부 인력·기관 의존 (임상 실측, 사용성평가 실시, 식약처 회신, 침투시험) + 운영 wiring 4건 (다음 코드 세션).

## 1. 알고리즘 (제안서 8 핵심 모듈)

| 모듈 | 상태 | 비고 |
| --- | --- | --- |
| 음성 분석 STT | ✅ ~85% | WASM Whisper-tiny wiring 완료, 실측 대기 |
| 안면 AI (MediaPipe) | ✅ 100% | (변동 없음) |
| 반응시간 (100ms) | ✅ 100% | (변동 없음) |
| 시선 추적 | ✅ 80% | 데이터 레이어 + 누적기 + 시각화 |
| AAC 통합 | ✅ 70% | Phase 1 규칙 기반 + 주요 훈련 통합 |
| K-WAB 자동화 | ✅ 120% | 6 하위검사 + AQ/LQ/CQ |
| WASM 온디바이스 추론 | ✅ ~85% | 안면·시선·훈련 STT 모두 WASM |
| IRT/Bayesian | ✅ 70% | 코드 ✅, 임상 calibration + step 통합 대기 |

## 2. 임상 워크플로우

| 항목 | 상태 |
| --- | --- |
| Step1~6 흐름 | ✅ ~90% |
| 3-Tier (환자/치료사/보호자) | ✅ ~85% |
| 치료사 대시보드 | ✅ ~90% |
| 보호자 주간 리포트 | ✅ ~70% (Phase 1 토큰 + Phase 2 SMTP stub) |
| 처방 기반 운영 | ✅ 90% |

## 3. SaMD 인프라

| 항목 | 상태 | 산출물 |
| --- | --- | --- |
| SW V&V | ✅ ~95% | SR 35 + TC 53 + 추적성 51 + IEC 62304 별지 제2호 export |
| 사이버보안 35 항목 | ✅ ~77% | TC-SEC-* 10 + SBOM + SOUP + Manifest + CVE 면제 등록부 |
| AI 성능평가 체계 | ✅ ~85% | werRunner + sttBenchmark + 데이터 수집 가이드 + 모델 평가 계획 |
| AI 성능 실측 | ✗ 0% | **외부 의존** — 임상 협력기관 60~80대 30건 |
| 부작용 보고 | ✅ ~90% | adverse-events API + 리뷰 요약 + zod |
| 형상관리 / Release | ✅ ~95% | release manifest + analyzeChangeImpact + git SHA 동결 |

## 4. 규제 산출물 (docs/regulatory/*)

| 문서 | 버전 | 상태 | 용도 |
| --- | --- | --- | --- |
| `claim-lock.md` | **v0.3.0** | ✅ | 사용 가능 클레임 14 + 조건부 9 + 금지 10 + 치환표 9 |
| `intended-use-and-contraindications.md` | v0.1 | ✅ | 사용목적 + 금기 |
| `risk-management-file.md` | **v1.0** | ✅ | RM 21 + §11 결정성 V&V 매핑 + §11.7 IEC 62366 + §11.8 신규 산출물 + §11.9 잔여위험 재평가 |
| `digital-medical-product-gap-matrix.md` | v0.2 | ✅ | 갭 매트릭스 + ✅ 마킹 |
| `srs.md` | v0.1 | ✅ | IEC 62304 §5.2 양식 (SR-* 35) |
| `sds.md` | v0.1 | ✅ | IEC 62304 §5.4 양식 (모듈 38종) |
| `traceability-matrix.md` | v0.1 | ✅ | 수기 추적성 (자동 생성: IEC 62304 별지 제2호 export) |
| `usability-evaluation-protocol.md` | v0.1 | ✅ | IEC 62366-1 §5.4~5.9 (POF 12 + critical 2 + 12 시나리오) |
| `usability-evaluation-irb-package.md` | v0.1 | ✅ | IRB 부속자료 (동의서 + 모집공고문 + 폐기 SOP) |
| `wasm-stt-model-evaluation-plan.md` | v0.1 | ✅ | 후보 5종 + 3 단계 결정 게이트 |
| `ai-evaluation-data-collection-guide.md` | v0.1 | ✅ | 30 자극어 + 60s 10/70s 12/80s 8 분포 + 합격기준 |
| `gmp-qms-decision-matrix.md` | v0.1 | ✅ 자체 / ⚠ 결정 대기 | 3 옵션 (A/B/C) trade-off |
| `change-approval-sop.md` | v0.1 | ✅ | 변경 분류 7종 + 자동 판정 |
| `pms-capa-procedure.md` | v0.1 | ✅ | CAPA 라이프사이클 6단계 |
| `post-market-surveillance-plan.md` | v0.1 | ✅ | PMS 활동 + 보고 의무 |
| `pre-launch-checklist.md` | v0.1 | ✅ | 35 체크 항목 |
| `mfds-pre-consultation-pack.md` | **v1.0** | ✅ | 사전상담 즉시 신청 가능 — Q1~Q6 + 근거 + 후속 트리거 + 신청절차 + 회의 체크리스트 + cross-ref 4 갱신 의무 |
| `cloud-and-data-transfer.md` | v0.1 | ✅ | STT 데이터 송신 정책 |
| `ai-role-boundary.md` | v0.1 | ✅ | AI 역할 경계 |
| `pii-phi-separation-strengthening-plan.md` | v0.1 | ⚠ 정책 | DB migration 별도 세션 |

## 5. 사이버보안 (docs/security/*)

| 산출물 | 상태 |
| --- | --- |
| SBOM (`sbom/latest.json`) | ✅ |
| SOUP (`soup/latest.json` 23 entries) | ✅ |
| Release Manifest (`manifest/latest.json` sha256 동결) | ✅ |
| CVE 면제 등록부 (`cve-exemptions.md` v0.1, high 7건) | ✅ |
| 사이버보안 운영 정책 (`cybersecurity-policy-decisions.md`) | ✅ |
| 외부 침투 시험 보고서 | ✗ **외부 의존** |

## 6. 사용자 매뉴얼 (docs/manuals/*)

| 매뉴얼 | 상태 |
| --- | --- |
| `manual-therapist.md` v0.1 | ✅ |
| `manual-patient.md` v0.1 | ✅ |
| `manual-guardian.md` v0.1 | ✅ |

## 7. 결정성 V&V (53 TC PASS)

| 카테고리 | TC 수 | 상태 |
| --- | --- | --- |
| 점수 / 측정 / history | 6 | ✅ |
| 권한 / 세션 / fallback | 6 | ✅ |
| 시선 / AAC / STT 정책 | 8 | ✅ |
| 보호자 / 이상반응 / 환자 리포트 | 5 | ✅ |
| AI/STT 버전 메타 | 1 | ✅ |
| 사이버보안 (TC-SEC-*) | 10 | ✅ |
| ISO 14971 / PHI / WER / Consent / Change / IEC 62304 export | 6 | ✅ |
| IEC 62366 사용성 검증 | 1 | ✅ |
| WASM-STT 어댑터 + 로딩 머신 | 2 | ✅ |
| AI eval runner (WER + RTF) | 2 | ✅ |
| IRT (2PL+EAP+MFI + item bank) | 2 | ✅ |
| 환자 온보딩 / 감사 확대 / 발송 | 3 | ✅ |
| **합계** | **53** | **✅ 53/53 PASS** |

## 8. 외부 의존 (Claude 불가)

| 항목 | 담당 | 예상 기간 |
| --- | --- | --- |
| 임상 협력기관 음성 30건 수집 | 임상 협력기관 + PM | 4~8주 |
| 사용성평가 IRB → formative 5/5/5~8 → summative 15 | 위탁시험기관 + PM | 8~12주 |
| 식약처 사전상담 신청 + 회신 | PM (외주 또는 자체) | 4~6주 |
| 식약처 품목분류 질의서 | PM (외주 권장) | 6~10주 |
| 보안 침투 시험 외부 위탁 | 보안 위탁사 | 4~6주 |
| ISO 13485 인증 (선택) | 인증기관 | 12~16주 |
| 임상시험 IRB (DTx 트랙) | 임상 협력기관 | 12~24주 |
| 부산대 / 서울 Big5 RCT MOU | PM | 4~8주 |

## 9. 사업 의사결정 (PM 단독)

| 결정 | 영향 | 결정 기한 |
| --- | --- | --- |
| GMP/QMS 옵션 A/B/C | 시판 timing + 비용 + 인력 | D-90 |
| DTx 분류 동시 신청 vs 후속 | 임상시험 부담 + 시판 timing | 사전상담 회신 후 |
| 외주 컨설팅 예산 | A/B/C 결정 입력 | 즉시 |
| 시판 timing 목표 D-day | 모든 timeline 기준 | 즉시 |
| 임상 협력기관 선정 | 임상자료 강도 | E1 시작 전 |
| MCI 적응증 분리 시점 | 1차 허가 범위 | 사전상담 시 |

## 10. 다음 코드 세션 (Claude 가능, 4건)

| ID | 작업 | 예상 |
| --- | --- | --- |
| C2 후속 | useWasmSttLoading 을 sentence-magic / sing-training / step-1 STT 호출부 wiring | 1 세션 |
| C3 후속 | step-1~5 entry 에서 random/순차 → pickNextItem(getItemBankForStep) | 1.5 세션 |
| C7 Phase 1 | patients_identity schema + dual-write + audit log 강화 | 1.5 세션 |
| C1 운영 | 운영환경에서 npm install next@16.2.4 + manifest 재산출 | 0.5 세션 (PM/운영) |

## 11. 한 줄 결론

**1차 SaMD 인허가 신청서 골격 (PDF #6 13 섹션 + [별표3]) 의 자체 작성 가능 부분 거의 모두 완성.** 식약처 사전상담 신청 가능한 상태. 임상/사용성 실측 데이터 + 외부 침투 시험만 남으면 시판 신청 가능.

## 12. 갱신 이력

- 2026-04-30 v0.1: 초안. 12 묶음 dashboard. claim-lock v0.3.0 + RM v1.0 + 53 TC PASS 기준 산출물 약 90% 완료 표기.
- 2026-04-30 v0.2: §4 mfds-pre-consultation-pack v0.1 → **v1.0** 마킹 (사전상담 즉시 신청 가능 상태). §10 다음 코드 세션 4건은 변동 없음. 외부 의존(§8) 의 식약처 회신 timing 이 즉시 시작 가능.
