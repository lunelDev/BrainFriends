# Regulatory Docs Index

작성일: 2026-05-07  
목적: 브레인프렌즈 인허가/임상/품질 준비에 실제로 쓰는 핵심 문서만 빠르게 찾기 위한 최소 인덱스

## 1. 먼저 보는 문서

| 문서 | 용도 |
| --- | --- |
| `permit-readiness-internal-standard.md` | 허가 준비 내부 기준서. 허가 관련 핵심 내용을 링크 없이 한 MD 안에 통합 정리 |
| `regulatory-master-map.md` | 분류·등급 → GMP → 개발 증빙 → 임상/성능 지표를 한 화면에서 보는 통합 지도 |
| `regulatory-work-log.md` | 날짜별로 어떤 원문을 봤고 어떤 판단/문서/다음 작업을 남겼는지 확인하는 작업 로그 |
| `ktl-meeting-developer-action-plan-2026-05-12.md` | KTL 1차 미팅 내용을 개발자가 해야 할 작업으로 전환한 액션 플랜 |
| `ktl-vmodel-worklist.md` | KTL 후속 5대 축(claim-lock, V 모델, traceability, AI 검증셋, 사이버보안) 작업 체크리스트 |
| `product-introduction-integrated.md` | 제품소개노트와 기존 claim-lock을 통합한 대외/기관 미팅용 제품 소개 기준문 |
| `class-2-samd-readiness-matrix.md` | 2등급 SaMD 준비 기준으로 이미 된 것과 해야 할 것을 정리한 실행 매트릭스 |
| `article-24-dossier-index.md` | 제24조 첨부서류 8종 기준으로 내부 산출물/코드 증적/부족 항목을 보는 제출자료 인덱스 |
| `regulatory-source-audit.md` | 제공받은 원문 가이드라인/NIDS 자료가 내부 문서에 어떻게 반영됐는지 추적 |
| `source-nids-consultation-requirements.md` | NIDS 상담노트 요구사항 추출표 |
| `source-digital-medical-product-notice-2026-requirements.md` | 디지털의료제품 고시 제2026-4/5/6호, 특히 제24~26조 허가·심사 첨부서류 대응표 |
| `source-classification-grade-requirements.md` | 디지털의료기기 분류·등급 가이드라인 요구사항 추출표 |
| `source-cybersecurity-requirements.md` | 의료기기 사이버보안 가이드라인 35개 요구사항 추출표 |
| `source-gmp-requirements.md` | 디지털의료기기 GMP 가이드라인 30개 요구사항 추출표 |
| `source-poststroke-dysarthria-dtx-requirements.md` | 뇌졸중 후 마비말장애 DTx 안전성·성능/임상시험계획서 요구사항 추출표 |
| `source-ai-clinical-stroke-requirements.md` | AI 적용 디지털의료기기 후향적 임상시험계획서 요구사항 추출표 |
| `mfds-guideline-basis.md` | 이번에 가져온 가이드라인 8종 + NIDS 상담노트를 어떻게 해석할지 고정 |
| `mfds-ai-permit-review-response.md` | AI 허가·심사 방안 6개 항목 대응표 |
| `test-and-certification-development-guide.md` | 제품을 시험·인증 가이드에 맞춰 어떻게 개발할지 고정 |
| `digital-medical-product-gap-matrix.md` | 전체 갭, 우선순위, 지금 해야 할 일 |
| `claim-lock.md` | 대외 문구, 금지 문구, 제품 범위 잠금 |
| `gmp-qms-decision-matrix.md` | 제조업 허가 → GMP → 품목 인허가 실행 판단 |

## 2. 허가 본문 작성용

| 문서 | 용도 |
| --- | --- |
| `intended-use-and-contraindications.md` | 사용목적, 대상환자, 제외/금기 |
| `ai-role-boundary.md` | AI가 어디까지 보조인지 경계 |
| `cloud-and-data-transfer.md` | 서버 STT, 외부 전송, 저장 정책 |
| `risk-management-file.md` | ISO 14971 위험관리 |

## 3. 품질/QMS/V&V

| 문서 | 용도 |
| --- | --- |
| `srs.md` | IEC 62304 요구사항 명세 |
| `sds.md` | IEC 62304 설계 명세 |
| `traceability-matrix.md` | 요구사항-위험-시험 추적성 |
| `change-approval-sop.md` | 변경관리 SOP |
| `pms-capa-procedure.md` | CAPA 절차 |
| `post-market-surveillance-plan.md` | 시판 후 감시 |

## 4. 임상/사용성/성능평가

| 문서 | 용도 |
| --- | --- |
| `usability-evaluation-protocol.md` | IEC 62366 사용적합성 프로토콜 |
| `usability-evaluation-irb-package.md` | IRB 부속자료 |
| `usability-evaluation-report-v1.0.md` | IEC 62366 형성/총괄 평가 결과보고서 템플릿 |
| `ai-evaluation-data-collection-guide.md` | STT/AI 평가 데이터 수집 |

## 5. 정리 원칙

- WASM-STT 전용 계획서, 중간 대시보드, 내부 메모성 후속 질의서는 삭제했다.
- 허가 관련 판단은 `permit-readiness-internal-standard.md`에 통합한다.
- 현재 전략과 충돌하는 문서는 남기지 않는다.
- 새 문서를 만들 때는 이 인덱스의 4개 묶음 중 어디에 속하는지 먼저 판단한다.
- 외부 기준이 바뀌면 먼저 `mfds-guideline-basis.md`를 갱신한 뒤 다른 문서를 수정한다.
