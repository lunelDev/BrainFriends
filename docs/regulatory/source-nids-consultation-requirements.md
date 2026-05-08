# NIDS 상담노트 요구사항 추출표

작성일: 2026-05-07  
원문: `C:/Users/pc/Desktop/디지털의료기기 가이드라인/NIDS_상담노트_브레인프렌즈.docx`  
주의: 본 노트는 사내 참고용이며 공식 제출 근거가 아니다.

## 1. 핵심 결론

NIDS 상담노트 기준으로 브레인프렌즈는 다음 전제를 우선 적용한다.

- 한국 출시 절차는 `제조업 허가 -> GMP 적합인정 -> 품목 인허가` 순서로 본다.
- NIDS 상담노트는 공식 답변이 아니므로 대외 제출 근거로 직접 쓰지 않는다.
- 제품은 독립형 디지털의료기기소프트웨어(SaMD)로 준비한다.
- DTx는 별도 절차가 아니라 SaMD 안의 치료 목적 제품 성격으로 본다.
- 치료/재활 효과를 표방하면 임상시험 면제는 어렵다고 전제한다.
- AI 성능평가는 별도 제출물이 아니라 V&V 안에 포함한다.
- 사용적합성 평가는 형성 평가와 총괄 평가를 분리하고, 사용자군별 대표성을 확보해야 한다.

## 2. 요구사항 매트릭스

| ID | 원문 근거 | 요구사항 | 내부 반영 | 상태 |
| --- | --- | --- | --- | --- |
| NIDS-001 | §1, §2, Table 1 | 제조업 허가, GMP, 품목 인허가를 순차 절차로 관리한다. | `mfds-guideline-basis.md`, `gmp-qms-decision-matrix.md` | 문서 반영 / 실행 미완 |
| NIDS-002 | §1, §18~21, §197~200 | NIDS 상담노트를 공식 제출 근거로 쓰지 않는다. | `mfds-guideline-basis.md`, `regulatory-source-audit.md` | 문서 반영 |
| NIDS-003 | §3 | NIDS와 식약처 디지털의료제품지원총괄과의 권한을 분리한다. | `mfds-pre-consultation-pack.md`, `mfds-guideline-basis.md` | 문서 반영 |
| NIDS-004 | §44, §163~166, §199 | 디지털 의료기기 해당 여부 질의를 먼저 신청한다. | `digital-medical-product-gap-matrix.md`, `mfds-pre-consultation-pack.md` | 문서 반영 / 민원 미실행 |
| NIDS-005 | §4, Table 2 | 분류·등급은 업체가 가이드라인 기준으로 자체 선언하고 심사에서 확정한다. | `mfds-guideline-basis.md`, `digital-medical-product-gap-matrix.md` | 문서 반영 |
| NIDS-006 | §47~56 | 등급 판단은 의료 영향, 환자 상태, 오작동 피해 수준 3축으로 검토한다. | `mfds-guideline-basis.md`, `risk-management-file.md` | 일부 반영 / 등급 근거표 보강 필요 |
| NIDS-007 | §57~64 | SaMD와 DTx를 별도 트랙으로 나누지 않는다. | `mfds-guideline-basis.md`, `claim-lock.md` | 문서 반영 |
| NIDS-008 | §65~77, Table 3 | 임상적 유효성을 표방하면 임상시험 필요성을 기본 전제로 둔다. | `claim-lock.md`, `digital-medical-product-gap-matrix.md` | 문서 반영 / 임상 미실시 |
| NIDS-009 | §78~87, Table 7 | 사이버보안은 IA-01~RA-05 35개 항목 기준으로 준비하고 적용 불가 사유를 명시한다. | `cloud-and-data-transfer.md`, `risk-management-file.md`, `traceability-matrix.md` | 일부 반영 / 100% 미완 |
| NIDS-010 | §84~85 | FDA 510(k), MDR, IEC 81001-5-1 등 해외 기준은 식약처 가이드라인 대체 근거로 쓰지 않는다. | `mfds-guideline-basis.md` | 문서 반영 |
| NIDS-011 | §88~101, Table 4, Table 7 | AI 성능평가는 V&V 안에 포함하고, 시험 데이터셋, gold standard, 기준값 근거를 제시한다. | `mfds-ai-permit-review-response.md`, `ai-evaluation-data-collection-guide.md` | 일부 반영 / 실데이터 미확정 |
| NIDS-012 | §92~94, Table 4 | AI 학습데이터 정보와 업데이트 주기, 클라우드 정보는 정보공개 대상임을 전제로 정확히 기재한다. | `mfds-ai-permit-review-response.md`, `cloud-and-data-transfer.md` | 일부 반영 / 실값 미확정 |
| NIDS-013 | §102~114 | 사용적합성은 사용 사양서, 형성 평가, 총괄 평가를 분리하고 사용자군별 대표성을 확보한다. | `usability-evaluation-protocol.md`, `usability-evaluation-irb-package.md` | 계획 반영 / 평가 미실시 |
| NIDS-014 | §108~112 | 총괄 평가는 사용자군별 15명 기준으로 보수적으로 계획한다. | `usability-evaluation-protocol.md` | 문서 반영 / 모집 미실행 |
| NIDS-015 | §113~114 | 사용 사양서의 의료 환경과 실제 평가 환경을 일치시킨다. | `usability-evaluation-protocol.md` | 문서 반영 |
| NIDS-016 | §115~125, Table 5, Table 7 | V&V는 Unit/Integration/System Test, 이상 현상 목록을 IEC 62304 구조로 제출한다. | `srs.md`, `sds.md`, `traceability-matrix.md`, V&V export | 일부 반영 / 최신성 확인 필요 |
| NIDS-017 | §117~118, Table 5 | GMP 적합인정서 보유 제조사 자체 작성이 현실적 V&V 작성 경로다. | `gmp-qms-decision-matrix.md` | 문서 반영 / GMP 미실행 |
| NIDS-018 | §126~139, Table 6 | 처리기한과 보완 절차를 일정 리스크에 반영한다. | `mfds-pre-consultation-pack.md`, `digital-medical-product-gap-matrix.md` | 일부 반영 |
| NIDS-019 | §140~162 | 성적서 선확보 후 GMP 전략은 설계 변경 시 성적서 무효화 리스크가 있다. | `gmp-qms-decision-matrix.md` | 문서 반영 |
| NIDS-020 | §150~157 | 설계 단계부터 사용적합성, V&V, 사이버보안 절차를 같이 설계한다. | `test-and-certification-development-guide.md` | 문서 반영 / 코드 증적 진행 중 |

## 3. 브레인프렌즈 즉시 작업으로 바뀌는 항목

| 우선순위 | 작업 | 이유 |
| --- | --- | --- |
| P0 | 디지털 의료기기 해당 여부 질의서 작성 | NIDS 공식 답변이 아니므로 식약처 서면 질의가 필요 |
| P0 | 등급 판단 3축 근거표 작성 | 자체 등급 선언 근거가 필요 |
| P0 | V&V/저장/채점/녹음파일 증적 보강 | V&V 안에 AI 성능평가와 시험 결과가 들어가야 함 |
| P0 | 사용적합성 formative 계획 확정 | 실제 평가 전 계획서가 심사 대응의 시작점 |
| P1 | 사이버보안 35항목 100% 대응표 | 현재 일부 반영 상태 |
| P1 | AI 평가셋/gold standard/기준값 표 확정 | AI 허가·심사 보완 가능성이 큰 항목 |

## 4. 아직 내부 문서와 충돌 가능성이 있는 항목

- 기존 문서 일부에 남아 있는 `K-WAB`, `AQ`, `WASM-STT`, `원본 미전송`, `치료효과` 표현은 claim-lock 기준으로 계속 정리해야 한다.
- 사용적합성 총괄 평가 인원은 현재 프로토콜에서 `총 15명`으로 되어 있으나, NIDS 노트는 사용자군이 다르면 군별 15명 기준을 보수적으로 봐야 한다고 적고 있다. 최종 전략은 시험기관 또는 식약처 질의로 확인해야 한다.
- 사이버보안 35항목은 현재 약 77% 수준으로 표시되어 있으므로, "완료" 표현을 쓰면 안 된다.

## 5. 다음 문서

다음으로 파야 할 문서는 `디지털의료기기 분류 및 등급 지정 등에 관한 가이드라인 개정안(최종).pdf`이다. 이유는 현행 가이드라인에서 만든 `source-classification-grade-requirements.md`의 등급 초안이 개정안 기준에서도 유지되는지 확인해야 하기 때문이다.
