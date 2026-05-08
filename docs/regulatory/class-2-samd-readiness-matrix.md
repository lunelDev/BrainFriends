# Class 2 SaMD Readiness Matrix

작성일: 2026-05-08  
목적: 브레인프렌즈를 `2등급 가능성 기준의 독립형 디지털의료기기소프트웨어(SaMD)`로 준비할 때, 고시 제2026-4호/5호/6호와 심사기준별로 이미 된 것과 해야 할 것을 한 장에서 관리한다.

## 1. 잠금 결정

브레인프렌즈의 1차 인허가 준비 포지션은 아래처럼 잠근다.

| 항목 | 잠금값 |
| --- | --- |
| 제품 유형 | 독립형 디지털의료기기소프트웨어(SaMD) |
| 준비 등급 | 2등급 가능성 기준 |
| 사용목적 | 실어증·마비말장애 환자의 언어재활 훈련 및 경과 모니터링 보조 |
| AI 역할 | 치료사 검토용 보조 지표 제공 |
| 금지 경계 | 자동 진단, 자동 처방, 의료진 대체, 확증 전 치료효과 주장 |
| 최종 확정 | 식약처 품목분류/사전상담/인허가 심사 결과에 따름 |

## 2. 고시 제24~26조 기준 제출 패키지

| 조항 | 의미 | 이미 되어있는 것 | 아직 부족한 것 | 다음 작업 |
| --- | --- | --- | --- | --- |
| 제24조 첨부서류 범위 | 독립형 SaMD 제출자료 8개 묶음: 사용목적/작용원리, 국내외 현황/개발경위, SW V&V, 임상시험 등 평가, 사이버보안, 사용적합성, 전문가용 자료, 변경관리 계획서 | SRS/SDS/V&V/보안/사용성/AI 역할 문서 일부 | 제24조 dossier index가 아직 없음 | `제24조 첨부서류 인덱스` 작성 |
| 제25조 면제·갈음 | 2등급 독립형 SaMD는 조건 충족 시 일부 자료 면제 또는 임상자료 갈음 가능 | 2등급 가능성 기준, 보조지표 경계 문서화 | 분석성능 검증셋과 식약처 인정 전략 부족 | locked test set + gold label + 결과 ZIP 고정 |
| 제26조 첨부서류 요건 | 기능별 사용목적/입출력/처리원리, V&V 절차/결과/anomaly/retest/impact, 임상/보안/사용성 자료 형식 요구 | 기능·위험·시험 문서 일부 | anomaly list, 재시험, 영향평가, 전문가용 IFU, AI 변경관리 계획 부족 | release manifest + CAPA export + 치료사 검토 증적 |

## 3. 심사기준별 완료/미완료

| 심사기준 | 이미 되어있는 것 | 아직 부족한 것 | 다음 작업 |
| --- | --- | --- | --- |
| 제품 분류·등급 | SaMD 후보, 2등급 가능성, 치료·재활 축 보수 적용 문서화 | 제품코드 후보와 공식 질의 회신 | 품목분류 질의서 초안 작성 |
| 사용목적/대상환자 | 실어증·마비말장애, 3-tier 사용자, 6개 장면, 금지 클레임 정리 | 마비말장애 DTx 트랙과 일반 SaMD 트랙 분리 문구 | intended-use 문서에 `일반 SaMD` / `DTx 후속` 구분 보강 |
| AI 역할 경계 | STT/안면/시선/AAC/K-WAB이 보조지표라는 문서 있음 | UI/로그에서 치료사 검토 완료 증적이 더 필요 | 치료사 검토 화면에 원음/전사/정오답/reviewRequired 표시 |
| GMP/QMS | GMP 요구사항 30개 추출, 하이브리드 권장, 변경관리/PMS/CAPA 초안 | 품질책임자, 제조업 허가, 실제 GMP 착수, release 기록 형식 | release manifest를 GMP 출시기록으로 확장 |
| IEC 62304 SW 문서 | SRS, SDS, traceability, V&V export 존재 | 최신 변경분(AAC/시선/저장/노래훈련/OpenAI 정책) 반영 필요 | traceability 최신화 |
| V&V | 결정성 테스트와 export 체계 있음 | 수동 UI 점검, 시험환경/시험자/버전 기록 보강 | V&V export에 환경/시험자/대상버전 필드 추가 |
| ISO 14971 위험관리 | 위험관리 파일, RM-* 매핑, 잔여위험 개념 있음 | 채점오류, 녹음누락, 치료기회 박탈, AI 오판 위험 최신화 | risk-management-file에 신규 위험 추가 |
| 사이버보안 | 35개 요구사항 추출, 일부 결정성 테스트, HMAC 감사로그, rate limit, 세션잠금, SBOM/SOUP | 백업/복구, 권한표, 감사로그 접근통제, 보존정책, 외부 침투시험 | 보안 gap 77% → 90% 목표 작업 |
| 데이터/개인정보 | STT 정책, 서버 프록시, 비식별화 계획, 보호자 링크 제한 | 클라우드 사업자/보존기간/위탁처리 고지 확정 | cloud-and-data-transfer에 운영값 확정 |
| AI 성능평가 | WER/CER/RTF 체계, AI 허가 대응표, AI 임상 요구사항 추출 | locked test set, SLP gold label, 학습/튜닝/시험 데이터 분리, 실측 결과 | AI 평가셋 스키마와 gold label 저장 구조 고정 |
| 마비말장애 DTx 지표 | DTx 가이드라인 요구사항 35개 추출 | 말 명료도, MPT, DDK, PCC, PHQ-9, QoL-Dys 실측/화면 없음 | 30개 단어 PCC + 말 명료도 수동평가 설계 |
| 사용적합성 IEC 62366 | 프로토콜, POF, critical task, formative/summative 설계 | 실제 formative/summative 수행 결과 | 5/5/5 formative 또는 내부 파일럿 먼저 수행 |
| 결과 저장/시험 증빙 | 결과 ZIP/export 구조 일부, history/result/storage snapshot | 언어재활 녹음 파일/전사/점수근거 누락 리스크 | 결과 저장/ZIP export 완전 고정 |
| 문제보고/CAPA | CAPA/PMS 문서 초안, adverse event 기능 일부 | 저장 실패/STT 실패/채점 이상이 CAPA export로 묶이지 않음 | 문제보고/CAPA export 구현 |
| 임상/외부 대응 | NIDS 상담노트, 사전상담 패키지 일부 | 공식 질의, 임상기관, IRB, 시험기관, 통계계획 | clinical-protocol-outline 작성 |

## 4. 개발 우선순위

### P0: 2등급 SaMD 방어에 바로 필요한 것

| 순서 | 작업 | 산출물 |
| --- | --- | --- |
| 1 | 제24조 첨부서류 인덱스 작성 | 8개 제출자료 묶음별 내부 문서/코드/증적 링크 |
| 2 | 결과 저장/ZIP export 완전 고정 | audio, target, transcript, scoreReason, reviewRequired, app/model/doc version |
| 3 | release manifest를 GMP 출시기록으로 확장 | git SHA, SBOM, SOUP, package-lock, V&V 결과, 잔여위험 승인, anomaly/retest/impact |
| 4 | 문제보고/CAPA export | STT 실패, 저장 실패, 채점 이상, 권한 거부, AE/ADE JSON/CSV |
| 5 | 치료사 검토 화면 강화 | 원음 재생, target/transcript 비교, 정오답, 말 명료도 0~100 입력 |
| 6 | 보안 gap 보강 | 권한표, 감사로그 접근통제, 백업/복구, 보존정책 |

### P1: DTx/AI 성능평가로 이어지는 것

| 순서 | 작업 | 산출물 |
| --- | --- | --- |
| 1 | AI 평가셋 스키마 고정 | locked test set, SLP gold label, stratification, WER/CER/RTF |
| 2 | 마비말장애 평가세트 | 30개 목표단어 PCC, MPT, DDK, baseline/4주/8주 |
| 3 | clinical protocol outline | 대상자, 선정/제외, endpoint, 안전성, 동의/보상 |
| 4 | 사용성평가 실행 | formative 결과, summative 계획/결과 |

## 5. 현재 방어 가능한 것

- 독립형 SaMD 구조
- 2등급 가능성 기준 준비
- 치료사 검토용 보조지표 경계
- 5채널 보조지표 중 STT/안면/반응시간/시선/AAC 개념 반영
- K-WAB 기반 보조 채점
- STT는 서버 보안 프록시 기반으로 정리
- V&V, 사이버보안, AI 평가, GMP 요구사항 문서화 시작

## 6. 아직 외부에 말하면 안 되는 것

- 2등급 확정
- 허가 완료 또는 GMP 적합인정 완료
- DTx 허가 제품
- 치료효과 입증
- WER 15% 이하 달성
- 완전 온디바이스 STT
- AI 자동 진단/처방/치료 결정
- 임상시험 면제 확정

## 7. PM 결론

2등급 SaMD 전략은 현실적이다. 다만 이 전략은 “기능이 많다”로 방어되지 않고, 제24~26조 기준의 `첨부서류 인덱스`, `원자료 저장`, `치료사 검토`, `품질기록`, `위험관리`, `보안`, `분석성능 데이터셋`으로 방어된다.

따라서 다음 작업은 제24조 첨부서류 인덱스를 만든 뒤, 결과 저장/ZIP export와 release manifest, 문제보고/CAPA export를 고시 요구사항에 연결하는 것이다.
