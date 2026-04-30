# 브레인프렌즈 디지털의료제품 허가·심사 갭 매트릭스

작성일: 2026-04-29  
작성 기준: 부산대병원 전달 식약처 가이드라인 7종, `브레인프렌즈-제품기획서.pdf`, 현재 레포 구현 상태  
문서 성격: PM/개발 우선순위 결정을 위한 내부 작업 문서. 최종 법적 판단은 식약처 사전상담·시험기관·인허가 컨설턴트 검토로 확정한다.

## 결론

브레인프렌즈는 이제 **일반 웰니스 앱**이나 단순 재활 앱으로 관리하면 안 된다. 제품기획서가 이미 다음 표현을 쓰고 있기 때문이다.

- 독립형 디지털의료기기소프트웨어
- 언어재활 목적 소프트웨어
- 2등급 검토
- 디지털 치료기기
- AI 멀티모달
- K-WAB 보조 채점
- WASM 온디바이스
- 치료사 검토·확정

따라서 다음 개발은 기능 추가보다 먼저 **허가·심사에서 방어 가능한 제품 범위와 클레임을 잠그는 작업**을 우선해야 한다.

현재 PM 판단:

| 항목 | 판단 |
| --- | --- |
| 1차 규제 포지션 | 독립형 디지털의료기기소프트웨어(SaMD) |
| DTx 포지션 | 가능성 높음. 단 치료 작용기전·전향적 임상 근거가 필요 |
| 예상 등급 | 2등급으로 준비. 최종은 사전분류/사전상담 필요 |
| AI 적용 | 적용됨. 단 AI가 진단/치료 결정을 직접 내리는지, 보조 분석 도구인지 경계 설정 필요 |
| 가상융합기술 | 현재 미적용. VR/AR/HMD 없음 |
| 최우선 리스크 | 사용목적·효능 클레임, AI 성능평가, SW 안전성 등급, GMP/QMS, 임상근거 |

## 근거 문서

| 구분 | 파일 |
| --- | --- |
| 제품기획서 | `C:/Users/pc/Downloads/브레인프렌즈-제품기획서.pdf` |
| 디지털의료기기소프트웨어 허가·심사 | `디지털의료기기소프트웨어+허가·심사+가이드라인(민원인+안내서).pdf` |
| 디지털치료기기 허가·심사 | `디지털치료기기+허가·심사+가이드라인(민원인+안내서).pdf` |
| AI 적용 디지털의료기기 | `인공지능기술이+적용된+디지털의료기기의+허가·심사+가이드라인(민원인+안내서).pdf` |
| 디지털의료기기 GMP | `디지털의료기기+GMP+가이드라인(민원인+안내서)(최종).pdf` |
| 의료기기 소프트웨어 | `의료기기+소프트웨어+허가·심사+가이드라인(민원인+안내서).pdf` |
| 가상융합기술 적용 디지털의료기기 | `가상융합기술이+적용된+디지털의료기기의+허가·심사+가이드라인(민원인안내서).pdf` |
| 디지털의료제품 조직/정책 보도참고 | `3.20 (보도참고) 디지털의료제품지원총괄과.pdf` |

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
| 사이버보안 일부 구현 | `src/lib/security/*`, `src/app/api/security-audit`, `docs/remediation/02-cybersecurity/*` |
| 5채널 중 시선/AAC 보조 채널 Phase 1 | `src/utils/faceAnalysis.ts`, `src/lib/training/gazeAccumulator.ts`, `src/components/aac/*` |
| 보호자 주간 리포트 링크 기반 Phase 1 | `src/lib/server/guardianReportsDb.ts`, `src/app/guardian/[token]/page.tsx` |

### 아직 방어 불충분한 클레임

아래 표현은 그대로 허가 자료에 넣으면 질문을 받을 가능성이 높다.

| 클레임 | 문제 | 조치 |
| --- | --- | --- |
| Whisper-ko Fine-tuning, WER 15% 이하 | 현재는 `whisper-1` 또는 서버 STT 정책. Ko fine-tuning 실체와 검증셋 없음 | “한국어 STT 보조 전사”로 낮추거나, 평가셋/모델 고정/성능시험 필요 |
| WASM 온디바이스·원본 미전송 | 안면은 WASM, STT는 아직 실제 WASM 엔진 미연결 | 현재는 “훈련 STT 서버 송신 차단 정책 도입, WASM 엔진 예정”으로 표현 |
| Bayesian Adaptive Testing / IRT | 실제 IRT/Bayesian 구현 없음 | 구현 전까지 “휴리스틱 적응형 난이도”로 낮춤 |
| AAC 발화 의도 AI 예측 | 현재 규칙 기반 템플릿 | “AAC 심볼 기반 규칙형 의도 문장 생성”으로 표현 |
| K-WAB 자동 채점 | 치료사 확정 없는 자동 진단처럼 보일 수 있음 | “K-WAB 보조 채점 및 치료사 검토 인터페이스”로 고정 |
| 평균 지연 50ms, P95 41.5ms | 측정 리포트 없음 | 성능 시험 자동화 및 기기별 측정 로그 필요 |
| 파일럿 n=50 효과 | 내부 단일군 자료로 확증 표현 불가 | “탐색적 내부 관찰, 확증 임상 예정”으로 제한 |

## 허가·심사 갭 매트릭스

| 영역 | 가이드라인 관점 | 현재 상태 | 갭 | 우선순위 |
| --- | --- | --- | --- | --- |
| 제품 분류·등급 | 독립형 디지털의료기기소프트웨어 여부, DTx 여부, 등급 판단 필요 | 제품기획서상 2등급/DTx 준비로 기재 | 공식 사전분류 문의 없음 | P0 |
| 사용목적 | 대상 질환, 사용자, 환경, 출력 정보, 금기사항 명확화 | 실어증·구음장애·MCI, 치료사 보조 도구로 기재 | MCI 포함 여부가 범위를 넓힘. 금기/제외 기준 부족 | P0 |
| 작용원리 | 과학적 근거 기반 작용원리와 정보통신체계도 필요 | 제품기획서에 멀티모달 흐름 있음 | 코드-클레임 불일치 일부 존재 | P0 |
| DTx 판단 | 치료 작용기전의 과학적·임상적 근거 필요 | 문헌명 일부 기재 | CPG/논문/임상자료 연결표 부족 | P0 |
| SW 안전성 등급 | A/B/C 등급 판단 및 근거 필요 | 없음 | 위해요인별 심각도·위험통제 문서 부재 | P0 |
| 위험관리 | ISO 14971 위험관리 파일 필요 | 보안/저장 일부 문서 있음 | hazard, harm, risk control, residual risk 파일 없음 | P0 |
| SRS/SDS | 요구사항, 구조설계, 상세설계, 추적성 필요 | `src/lib/vnv/requirements.ts` 일부 요건 존재 | IEC 62304 양식의 SRS/SDS 아님 | P0 |
| V&V | 요구사항-설계-시험-결과 추적 필요 | deterministic V&V 17건 통과 | 범위가 핵심 기능 일부에 한정 | P0 |
| AI 성능평가 | 학습/시험 데이터셋, 성능, 편향, 변경관리 필요 | `src/lib/ai/*`, 평가 문서 일부 | 실제 데이터셋·성능 수치 부족 | P0 |
| STT/외부 서비스 | 클라우드 서비스, 모델 버전, 데이터 송신 명시 필요 | STT 정책 가드 추가 | WASM 엔진 미연결, OpenAI 사용 경계 문서화 필요 | P0 |
| 사이버보안 | 접근통제, 전송/저장 보호, 감사로그, 취약점 관리 | 일부 구현 및 문서 있음 | 위협모델, SBOM, 침투/취약점 시험 증적 부족 | P0 |
| GMP/QMS | 품질매뉴얼, 품질방침, SOP, 형상/변경/문제해결 필요 | 일부 개발 문서만 존재 | ISO 13485/IEC 62304 체계 문서 부족 | P0 |
| 사용적합성 | IEC 62366 기반 사용 시나리오·평가 필요 | UX 구현은 있음 | formative/summative 사용성평가 프로토콜 없음 | P1 |
| 임상평가 | DTx라면 전향적 임상 또는 임상적 성능 자료 필요 | 내부 단일군 파일럿 기재 | RCT/IRB/통계분석계획서 필요 | P1 |
| 변경관리 | 알고리즘, 운영환경, UI, 통신 변경 영향평가 필요 | Git 관리 | 변경허가 판단 SOP 없음 | P0 |
| 시판 후 감시 | 불만, 이상반응, CAPA, PMS 필요 | adverse-events API 존재 | PMS/CAPA 운영 절차 미작성 | P1 |
| 보호자 리포트 | 3-tier 사용자 구조 근거 | 링크 기반 리포트 구현 | 동의/수신자/발송 로그 미완성 | P1 |
| 가상융합기술 | VR/AR/HMD 적용 시 별도 가이드라인 | 현재 미적용 | 없음. 추가 개발 시 재검토 | 제외 |

## 현재 코드/문서 증적 매핑

| 규제 산출물 | 현재 근거 | 상태 |
| --- | --- | --- |
| V&V 테스트 러너 | `src/lib/vnv/runDeterministicChecks.ts` | 부분 충족 |
| V&V 요구사항 목록 | `src/lib/vnv/requirements.ts` | 부분 충족 |
| V&V 제출 문서 | `docs/remediation/01-sw-vnv/*` | 부분 충족 |
| AI 평가 문서 | `docs/remediation/03-ai-evaluation/*` | 부분 충족 |
| 보안 문서 | `docs/remediation/02-cybersecurity/*`, `docs/security/README.md` | 부분 충족 |
| 개인정보/PHI 분리 | `docs/10-operations/pii-phi-separation.md` | 부분 충족 |
| 감사로그 | `src/lib/server/auditLog.ts`, `docs/10-operations/audit-log-schema.md` | 부분 충족 |
| 이상반응 | `src/lib/server/adverseEventsDb.ts`, `src/app/api/adverse-events/*` | 부분 충족 |
| 보호자 리포트 | `src/lib/server/guardianReportsDb.ts`, `src/app/guardian/[token]/page.tsx` | Phase 1 |
| STT 정책 | `src/lib/speech/sttPolicy.ts`, `src/app/api/proxy/stt/route.ts` | Phase 1 |
| 시선 추적 | `src/utils/faceAnalysis.ts`, `src/lib/training/gazeAccumulator.ts` | Phase 1 |
| AAC | `src/lib/aac/intentTemplate.ts`, `src/components/aac/AACBoard.tsx` | Phase 1 |
| GMP/QMS | `docs/submission/gmp-outsourcing-rfp.md` | 미흡 |

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
   - 현재 상태: 훈련 STT는 서버 송신 차단 정책이 있으나 WASM 엔진 미연결
   - 허가 표현: “훈련 세션 온디바이스 전환 예정”이 아니라 “현재 버전에서 어떤 데이터가 어디로 가는지”를 정확히 써야 함

### P0-Code: 규제 리스크를 줄이는 코드 작업

1. **WASM-STT 실제 엔진 연결 또는 클레임 하향**
   - 둘 중 하나를 반드시 택해야 한다.
   - 엔진 연결 전에는 “원본 미전송”을 전 제품 클레임으로 쓰면 안 된다.

2. **IRT/Bayesian 구현 또는 클레임 하향**
   - 제품기획서에 핵심 모듈로 들어가 있으므로 방치하면 질문 대상.
   - 단기 PM 권고: 허가 1차 자료에서는 `adaptive difficulty rule engine`으로 하향.

3. **V&V 케이스 확장**
   - 현재 17건은 좋은 출발점이지만 허가 제출용으로는 범위가 좁다.
   - 우선 추가할 TC:
     - STT 실패 시 치료사 검토 필요 상태
     - 보호자 링크 만료/권한
     - 이상반응 신고 저장/조회
     - history 저장 실패 fallback
     - 개인정보/PHI 제거

4. **변경관리 자동 기록**
   - 제품 버전, 모델 버전, prompt 버전, 데이터셋 버전을 결과에 남겨야 한다.
   - 특히 AI/STT/조음 분석 로직 변경 시 성능 재평가 트리거가 필요.

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
| 6 | 코드 작업 재개: IRT 또는 WASM-STT | 클레임 잠금 후 구현 여부 결정 |

## 제품기획서 문구 수정 권고

| 현재 표현 | 권고 표현 |
| --- | --- |
| Whisper-ko Fine-tuning | 한국어 음성 전사 보조 모듈. 모델 버전 및 성능은 별도 검증셋 기준으로 관리 |
| WER 15% 이하 | 내부 목표치. 허가자료에는 실측 완료 전 목표로만 표기 |
| WASM 온디바이스·원본 미전송 | 안면 분석은 온디바이스. STT는 훈련/평가 경로별 데이터 송신 정책을 별도 명시 |
| Bayesian Adaptive Testing / IRT 적용 | 현재 구현 전이면 적응형 난이도 조절 로직으로 표현 |
| AAC 발화 의도 AI 예측 | AAC 심볼 기반 발화 의도 문장 생성. AI 분류기는 후속 고도화 |
| K-WAB 자동 채점 | K-WAB 보조 채점 및 치료사 검토·확정 |
| 임상 효과 | 단일군 파일럿에서 관찰된 변화. 확증적 유효성은 전향적 임상에서 검증 예정 |

## 다음 의사결정

PM 관점에서 바로 결정해야 할 것은 하나다.

**1차 허가 범위를 좁힐 것인가, 제품기획서 전체 클레임을 유지할 것인가.**

권고안은 다음과 같다.

- 1차 허가 범위: 뇌졸중/뇌손상 후 실어증·구음장애 대상 언어재활 보조 SaMD
- 보조 사용자: 치료사/의사, 보호자 모니터링
- 핵심 출력: 훈련 결과, K-WAB 보조 점수, 조음/음향/안면/반응시간/시선/AAC 보조 지표
- 제외/보류: MCI, 완전 자동 진단, 완전 자동 치료 결정, AI가 임상 확정 판단을 대체한다는 표현

이렇게 좁히면 P0는 문서·추적성·위험관리 중심이고, P1에서 RCT/IRT/WASM-STT를 순차적으로 붙일 수 있다.
