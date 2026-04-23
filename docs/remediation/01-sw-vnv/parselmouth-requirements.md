# Parselmouth 음향분석 요구사항 목록

## 목적

Parselmouth (Praat 의 Python binding) 를 BrainFriends 에 통합할 때 **"어떤 지표를 어떤 step 에서 어떤 기준으로 산출할지"** 를 구현 이전에 고정한다.

본 문서는 수용기준(acceptance criteria) 수준까지만 다루고, 구체 알고리즘·파라미터·API 시그니처는 포함하지 않는다. 그것들은 구현 중에 결정되고 구현 후 별도 설계서에 기록한다.

## 전제

- Parselmouth 는 **결정론적(deterministic)** 으로 취급한다. 같은 입력 → 같은 출력. 따라서 본 문서의 항목들은 **SW V&V (결정론적 테스트)** 범위에 속한다.
- Whisper/OpenAI 관련 지표는 본 문서 범위 외이다 (AI 성능평가 범위).
- 출력 수치는 Praat 6.x 와 동일 알고리즘 기준으로 생성되어야 한다.
- 성능/지연은 본 요구사항 범위 외 (별도 비기능 요구사항에서 다룸).

## 적용 범위 (Scope)

Parselmouth 는 **음성을 녹음하는 step 에만 적용한다**. 화면 탐색·시각 자극·이미지 기반 과제에는 적용하지 않는다.

| Step | 오디오 녹음 | Parselmouth 적용 | 비고 |
| --- | --- | --- | --- |
| step-1 (단어 읽기 — 시각 자극) | ✗ | **적용 안 함** | 현재 녹음 파이프라인 없음. 텍스트 자극만 존재 |
| step-2 (음소·단어 반복) | ✓ | **적용** (음질 중심) | `startRecording` 존재, articulation 분석과 결합 |
| step-3 (이해·선택 과제) | ✗ | **적용 안 함** | 선택 입력 기반, 음성 산출 없음 |
| step-4 (단어/구 생성) | ✓ | **적용** (조음 중심) | `startRecording` 존재, formant 필요 |
| step-5 (문장 생성) | ✓ | **적용** (음질 + 음성 활동) | `getUserMedia` 직접 사용, capture_role='step5-audio' |
| step-6 (이미지 설명·탐색) | ✗ | **적용 안 함** | capture_role='step6-image', 이미지 기반 |
| sing-training | ✓ | **적용** (F0 track 중심) | 기존 jitter 구현 존재, Parselmouth 로 정식화 |

규칙: 녹음이 없으면 Parselmouth REQ 도 없다. 신규 step 추가 시 본 표에 먼저 한 줄 넣고, 오디오 녹음 여부를 명시한 뒤 REQ 를 배정한다.

## 허용오차 원칙

| 구분 | 기본 허용오차 |
| --- | --- |
| 로컬 동일 버전 재실행 | ±0.0 (완전 일치) |
| 동일 플랫폼, 다른 OS / Python 패치 | ±0.5% 이내 |
| Praat 표준 reference 음원 대비 | ±2% 이내 (ref 값이 공개된 경우) |
| 녹음 품질 변동 (volume normalize 후) | ±5% 이내 |

각 REQ 의 수용기준은 위 원칙을 따르며, 예외는 개별 REQ 에 명시한다.

## 요구사항

> 아래 **REQ-ACOUSTIC-001 ~ 021 은 "시스템이 산출할 수 있어야 하는 지표 목록" (capability requirements)** 이다. 각 step 이 어떤 지표를 **실제로 사용하는지**는 "Step 별 사용 지표 매핑" 섹션에서 결정한다. 즉, 모든 step 이 아래 지표를 전부 쓰는 것은 아니다.

### 기초 음향 지표 (녹음을 산출하는 step 에서 사용 가능)

**REQ-ACOUSTIC-001 — 기본 주파수 (F0) 산출**
시스템은 입력 음원에서 F0 (기본 주파수, Hz) 의 평균·표준편차·최소·최대를 산출한다.
수용기준: Praat 6.x 와 동일 파라미터(기본 pitch floor 75Hz / ceiling 600Hz) 사용 시 ±2% 이내 일치.

**REQ-ACOUSTIC-002 — 발성 강도 (Intensity) 산출**
시스템은 입력 음원의 평균·최대 강도 (dB) 를 산출한다.
수용기준: Praat 6.x Intensity 객체와 ±0.5 dB 이내 일치.

**REQ-ACOUSTIC-003 — 유성음 비율 (Voicing Ratio) 산출**
시스템은 음원 길이 대비 유성음 구간 비율을 0~1 범위로 산출한다.
수용기준: Praat 6.x 의 `Count voiced frames` 결과 대비 ±2% 이내.

**REQ-ACOUSTIC-004 — 발화 길이 (Duration) 산출**
시스템은 유효 발화 구간의 시작·종료·전체 길이(초) 를 산출한다.
수용기준: Praat 6.x 의 `Total duration` 과 ±10ms 이내.

### 음질 지표 (step-2, step-5, sing-training)

**REQ-ACOUSTIC-010 — Jitter (local) 산출**
시스템은 국소 jitter (%) 를 산출한다.
수용기준: Praat 6.x `Get jitter (local)` 와 ±5% 이내 (절대값 기준 ±0.1%pt 허용).

**REQ-ACOUSTIC-011 — Shimmer (local) 산출**
시스템은 국소 shimmer (%) 를 산출한다.
수용기준: Praat 6.x `Get shimmer (local)` 와 ±5% 이내.

**REQ-ACOUSTIC-012 — HNR (Harmonics-to-Noise Ratio) 산출**
시스템은 HNR (dB) 을 산출한다.
수용기준: Praat 6.x 의 Harmonicity 객체 평균값과 ±1 dB 이내.

### 조음 지표 (step-2, step-4, step-5)

**REQ-ACOUSTIC-020 — Formant 산출 (F1, F2)**
시스템은 모음 구간의 F1·F2 (Hz) 를 산출한다.
수용기준: Praat 6.x Burg 방식 (5 formants, max 5500Hz) 와 ±5% 이내.

**REQ-ACOUSTIC-021 — 모음 중심 추출 (Mid-frame)**
시스템은 발화 구간 내 가장 안정적인 모음 mid-frame 을 선택해 F1/F2 를 대표값으로 산출한다.
수용기준: 동일 음원 재실행 시 완전 일치, 재녹음 시 ±5% 이내.

### 측정 품질 게이트

**REQ-ACOUSTIC-030 — 측정 품질 등급 (measurement_quality)**
시스템은 각 산출에 대해 `measured` / `degraded` / `failed` 3단계 품질 등급을 기록한다.
수용기준:
- 음원이 SNR 기준 이하이거나 clipping 이 과반이면 `degraded`
- Praat 알고리즘이 예외를 발생시키면 `failed`
- 그 외는 `measured`
- 판정 기준은 동일 입력에서 완전 일치해야 한다

**REQ-ACOUSTIC-031 — `measured` 외 결과의 AI 평가셋 포함 금지**
시스템은 `measurement_quality ≠ 'measured'` 인 결과는 AI 성능평가 데이터셋에서 자동 제외한다.
수용기준: `src/lib/server/evaluationSamplesDb.ts` 의 저장 경로에서 measured 외 입력이 DB 에 들어가지 않음을 단위테스트로 확인.

### Step 별 사용 지표 매핑

각 step 의 **주 지표 (primary)** 는 점수 산출에 직접 사용하며, **보조 지표 (secondary)** 는 결과 JSON 에 함께 기록하되 점수 산출에는 사용하지 않는다 (추적성·재현성 확인용).

> 적용 범위 표에 따라 step-1 / step-3 / step-6 은 녹음이 없으므로 Parselmouth REQ 가 배정되지 않는다.

**REQ-ACOUSTIC-041 — step-2 (음소/단어 반복)**
과제 특성: 음소·단어를 반복 발화. 음질 (목소리의 흔들림·잡음) 이 핵심 관찰 지표.
- Primary: Jitter(local), Shimmer(local), HNR (REQ-010~012)
- Secondary: F0 평균·표준편차, Duration (REQ-001, REQ-004)

수용기준: Primary 지표는 REQ-010~012 허용오차 내, Secondary 지표는 REQ-001·REQ-004 허용오차 내.

**REQ-ACOUSTIC-042 — step-4 (단어/구 생성)**
과제 특성: 제시 카테고리에서 단어/구를 생성. 조음 정확도 (formant) 가 핵심 관찰 지표.
- Primary: Formant F1, F2 (REQ-020~021)
- Secondary: F0 평균, Duration, Intensity 평균 (REQ-001, REQ-004, REQ-002)

수용기준: Primary 지표는 REQ-020~021 허용오차 내, Secondary 지표는 해당 REQ 허용오차 내.

**REQ-ACOUSTIC-043 — step-5 (문장 생성)**
과제 특성: 문장 단위 산출. 긴 발화에서의 음성 활동·지속 시간·음질이 핵심.
- Primary: Intensity 평균, Duration, Voicing Ratio (REQ-002~004)
- Secondary: Jitter(local), Shimmer(local) (REQ-010~011)

수용기준: Primary 지표는 REQ-002~004 허용오차 내, Secondary 지표는 REQ-010~011 허용오차 내.
비고: Formant 는 step-4 의 조음 정확도 산출이 주 목적이므로 step-5 에서는 측정하지 않는다. (필요 시 향후 별도 REQ 로 추가.)

**REQ-ACOUSTIC-044 — sing-training (노래)**
과제 특성: 지정 음정을 일정 길이로 발성. F0 궤적 추적이 핵심.
- Primary: F0 track (30ms 프레임 시퀀스) (REQ-001 확장)
- Secondary: Jitter(local), Shimmer(local), HNR (REQ-010~012)

수용기준: Primary 인 F0 track 은 Praat 의 `To Pitch` 결과 포인트 시퀀스와 **완전 일치** (결정론성 엄격 확인). Secondary 는 REQ-010~012 허용오차 내.

### 적용 안 함 (Non-applicable)

**REQ-ACOUSTIC-NA-001 — step-1, step-3, step-6 미적용 선언**
step-1 (시각 자극 기반 단어 읽기), step-3 (이해·선택 과제), step-6 (이미지 기반 과제) 은 음성 녹음 파이프라인이 없거나 이미지 기반이므로 Parselmouth REQ 를 배정하지 않는다.
수용기준: 코드베이스에서 해당 step 컴포넌트에 `startRecording` / `getUserMedia` / Parselmouth 호출이 등장하지 않음을 리뷰로 확인한다. 향후 이 step 에 녹음이 추가되면 본 문서 "적용 범위" 표를 먼저 갱신한다.

### 버전 고정

**REQ-ACOUSTIC-050 — 버전 고정 및 기록**
시스템은 각 측정 결과에 Parselmouth 패키지 버전, 내부 Praat 엔진 버전, Python 버전, NumPy 버전을 version_snapshot 으로 동봉한다.
수용기준: 결과 JSON 의 `version_snapshot.acoustic_engine` 에 네 항목이 모두 채워져 저장된다.

**REQ-ACOUSTIC-051 — 결정론성 회귀 테스트**
시스템은 `tests/vnv/acoustic/` 아래 reference 음원 세트에 대해 측정값이 기대값(JSON) 과 일치하는지 CI 에서 자동 검증한다.
수용기준: reference 음원별 기대값과의 비교 결과가 허용오차 이내임을 `npm run test:vnv` 가 pass 한다.

## Reference 음원 세트 (시험기관 제출용)

아래 세트를 사전에 준비하여 V&V 결과서와 함께 제출한다. 각 음원에 대해 본 문서의 REQ 별 기대값을 사전 산출해둔다.

| 음원 | 특성 | 측정 대상 REQ |
| --- | --- | --- |
| ref-001-sine-440Hz | 순정 사인파 440Hz | REQ-001 (F0) |
| ref-002-sine-220Hz | 순정 사인파 220Hz | REQ-001 |
| ref-010-synth-jitter-1pct | 합성 음원, jitter 1% 고정 | REQ-010 |
| ref-011-synth-shimmer-0p5dB | 합성 음원, shimmer 0.5dB 고정 | REQ-011 |
| ref-012-male-avg | 남성 평균 발화 (한국어 "아") | REQ-001, 010~012 |
| ref-013-female-avg | 여성 평균 발화 (한국어 "아") | REQ-001, 010~012 |
| ref-020-vowel-ah | /ㅏ/ 모음 단독 | REQ-020 (F1/F2) |
| ref-021-vowel-ee | /ㅣ/ 모음 단독 | REQ-020 |
| ref-030-clipping | clipping 발생 음원 | REQ-030 (degraded 판정) |
| ref-031-silence | 무음 | REQ-030 (failed 판정) |

## 이 문서를 어떻게 쓰는가

- 구현 시작 전: 각 REQ 가 실제로 필요한지 체크. 필요 없으면 지금 빼도 된다 (구현 후 빼는 건 V&V 문서 수정으로 이어짐).
- 구현 중: REQ ID 를 코드 주석에 적어 추적성을 만든다 (예: `// REQ-ACOUSTIC-010`).
- 구현 후: 각 REQ 에 대한 테스트 결과(pass/fail) 를 `docs/remediation/01-sw-vnv/sw-vnv-current-test-report.md` 에 기록한다.
- 제출 시: 본 문서 + 테스트 결과서 + reference 음원 + 기대값 JSON 을 패키지로 제출한다.
