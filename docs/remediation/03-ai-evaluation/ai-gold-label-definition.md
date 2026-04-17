# AI 성능평가 Gold-Label 정의서

## 문서 정보

| 항목 | 내용 |
| --- | --- |
| 제품명 | BrainFriends |
| 문서 유형 | AI 성능평가 정답 기준(Gold-Label) 정의서 |
| 버전 | 1.0 |
| 작성일 | 2026-04-17 |
| 참조 규격 | 식약처 인공지능 의료기기 허가심사 가이드라인, IEC 62304 |
| 거버넌스 기록 | `src/lib/ai/modelGovernance.ts` (`ACTIVE_MODEL_GOVERNANCE`) |

---

## 1. 목적

이 문서는 BrainFriends AI 성능평가에서 사용하는 각 지표의 정답 기준(Gold-Label)을 정의합니다.

Gold-Label 정의의 목적은 다음과 같습니다.

- 평가 지표의 계산 방법과 기준값을 외부 검토자(시험기관)가 확인할 수 있도록 명문화
- 모델 버전 변경 시 성능 비교의 일관성을 보장
- 시험기관 제출 시 정확도 산출 근거로 활용

---

## 2. 평가 대상 지표 개요

BrainFriends AI 성능평가는 다음 세 영역의 지표를 다룹니다.

| 영역 | 지표 | 참조 기준 |
| --- | --- | --- |
| 언어 수행 점수 | AQ (Aphasia Quotient) | K-WAB (Korean Western Aphasia Battery) |
| 발음 분석 | 자음 정확도 (consonant_accuracy) | 안면 랜드마크 기반 조음 분석 알고리즘 |
| 발음 분석 | 모음 정확도 (vowel_accuracy) | 안면 랜드마크 기반 조음 분석 알고리즘 |
| 측정 품질 분류 | measured / partial / demo | 세션 수행 조건 기반 분류 규칙 |

---

## 3. AQ (Aphasia Quotient) Gold-Label 정의

### 3.1 참조 표준

AQ는 국내외 임상에서 사용되는 **K-WAB (Korean Western Aphasia Battery)** 의 AQ 산출 공식을 직접 구현한 값입니다.

- 참조 도구: K-WAB (김향희·나덕렬, 1997)
- AQ 범위: 0 ~ 100점 (소수점 2자리)

### 3.2 AQ 계산 공식

```
AQ = (스스로말하기 + 알아듣기 + 따라말하기 + 이름대기) / 4.2
```

각 하위 검사의 배점 범위는 다음과 같습니다.

| 하위 검사 | 세부 항목 | 배점 범위 |
| --- | --- | --- |
| 스스로말하기 | 내용전달 (0-10) + 유창성 (0-10) | 0 ~ 20 |
| 알아듣기 | 예-아니오 (0-60) + 청각낱말인지 (0-60) + 명령이행 (0-80) | 0 ~ 200 |
| 따라말하기 | 총점 | 0 ~ 100 |
| 이름대기 | 물건이름대기 (0-60) + 단어유창성 (0-20) + 문장완성 (0-10) + 문장반응 (0-10) | 0 ~ 100 |

분모 4.2는 K-WAB 원저에서 정의한 정규화 계수로, 합산 최대값(20+200+100+100=420)을 100점 척도로 변환합니다.

**구현 위치:** `src/lib/kwab/KWABScoring.ts` — `calculateAQ()` 함수

### 3.3 정답 기준 판정 방법

AQ gold-label은 다음 두 가지 방법을 조합하여 판정합니다.

**방법 1: 결정론적 fixture 검증 (자동화)**

고정된 하위 검사 점수 입력에 대해 `AQ=77.62`가 출력되는지 확인합니다. 이 결과는 `TC-SCORE-001`에서 deterministic run으로 매 빌드마다 검증됩니다.

**방법 2: K-WAB 원저 공식 대조 (수동 검증)**

K-WAB 검사지 원본에 기재된 AQ 산출 공식과 `KWABScoring.ts`의 구현이 일치하는지 언어재활사가 확인합니다. 확인 주기: 모델 버전 변경 시마다.

### 3.4 심각도 분류 기준

AQ 값에 따른 심각도 분류 기준은 K-WAB 원저를 따릅니다.

| AQ 범위 | 심각도 |
| --- | --- |
| 93.8 이상 | 정상 |
| 76.0 ~ 93.7 | 경도 |
| 51.0 ~ 75.9 | 중등도 |
| 26.0 ~ 50.9 | 중증 |
| 25.9 이하 | 최중증 |

**구현 위치:** `src/lib/kwab/KWABScoring.ts` — `determineSeverity()` 함수

### 3.5 정상군 비교 기준

AQ 정상군 비교는 연령(15-65세 / 65세 이상)과 교육년수(0년 / 1-6년 / 7년 이상) 조합 6개 그룹의 평균 및 표준편차를 기준으로 합니다.

| 그룹 | 평균 AQ | 표준편차 |
| --- | --- | --- |
| 15-65세, 교육 0년 | 90.73 | 4.40 |
| 15-65세, 교육 1-6년 | 94.47 | 4.11 |
| 15-65세, 교육 7년 이상 | 97.21 | 2.25 |
| 65세 이상, 교육 0년 | 88.09 | 5.87 |
| 65세 이상, 교육 1-6년 | 94.39 | 3.82 |
| 65세 이상, 교육 7년 이상 | 94.91 | 5.00 |

출처: K-WAB 정상화 데이터 (`data/k_wab/aq_norm_sd.csv`)

**구현 위치:** `src/lib/kwab/KWABScoring.ts` — `NORMAL_STANDARDS` 상수

---

## 4. 자음 정확도 (consonant_accuracy) Gold-Label 정의

### 4.1 측정 방법

자음 정확도는 MediaPipe Face Landmarker 기반 안면 랜드마크에서 추출한 입 개폐 정보를 분석하여 계산합니다. 직접적인 음성 파형 분석이 아닌 **안면 움직임 패턴 기반** 간접 측정입니다.

**측정 대상:** 목표 발화 텍스트에 양순음(ㅁ, ㅂ, ㅍ)이 포함된 경우

### 4.2 입력 특징값 정의

| 특징값 | 설명 | 단위 |
| --- | --- | --- |
| `mouthOpening` | 입 개구 비율 (랜드마크 기반) | 0~1 |
| `mouthWidth` | 입 너비 비율 (랜드마크 기반) | 0~1 |
| `lipSymmetry` | 입술 좌우 대칭도 | 0~1 (1=완전 대칭) |
| `timestampMs` | 프레임 타임스탬프 | ms |

### 4.3 자음 정확도 계산 방법 (양순음 포함 텍스트)

양순음이 포함된 목표 텍스트에 대한 자음 정확도는 다음 4개 성분의 가중 합산으로 계산됩니다.

```
기본점수 = closureRatePct × 0.35
         + closureHoldScore × 0.25
         + lipSymmetryPct × 0.20
         + openingSpeedScore × 0.20
```

각 성분의 정의는 다음과 같습니다.

| 성분 | 정의 | 계산 방법 |
| --- | --- | --- |
| `closureRatePct` | 전체 프레임 중 입 폐쇄(mouthOpening ≤ 0.05) 프레임 비율 | (폐쇄 프레임 수 / 전체 프레임 수) × 100 |
| `closureHoldScore` | 입 폐쇄 유지 시간 점수 | clamp((closureHoldEmaMs - 40) / (240 - 40) × 100, 0, 100) |
| `lipSymmetryPct` | 입술 대칭도 점수 | lipSymmetry × 100 |
| `openingSpeedScore` | 폐쇄 후 개구 속도 점수 | clamp((700 - openingSpeedMs) / (700 - 220) × 100, 0, 100) |

**패널티 조건 (4가지)**

다음 패널티가 기본점수에서 차감됩니다.

| 패널티 | 적용 조건 | 최대 차감 |
| --- | --- | --- |
| staticMouthPenalty | 입 개구 범위(max-min) < 0.12 (정적 입 자세) | 28점 |
| noTransitionPenalty | 10프레임 이상 수집 후 개구 전환 이력 0건 | 18점 |
| closureDominancePenalty | closureRatePct > 85% (과도한 폐쇄 지배) | 22점 |
| overHoldPenalty | maxClosureHoldMs > 520ms (폐쇄 과도 유지) | 18점 |

최종 자음 정확도 = clamp(기본점수 - 패널티 합산, 0, 100)

**구현 위치:** `src/lib/analysis/articulationAnalyzer.ts` — `analyzeArticulation()` 함수

### 4.4 자음 정확도 계산 방법 (양순음 미포함 텍스트)

양순음이 포함되지 않은 텍스트에서는 입술 너비와 폐쇄 경향으로 대체 계산합니다.

```
자음 정확도 = (mouthWidth / nonBilabialWidthTarget × 100) × 0.50
            + (1 - mouthOpening) × 100 × 0.50
```

`nonBilabialWidthTarget` 기준값: balanced 프로필 기준 0.10

**구현 위치:** `src/lib/analysis/articulationAnalyzer.ts` — `analyzeArticulation()` 함수

### 4.5 정답 기준 판정 방법

자음 정확도 gold-label은 다음 방법으로 판정합니다.

- **임상 전문가 육안 판정:** 동일 발화를 수행한 영상에 대해 언어재활사가 "정조음 / 대치 / 왜곡 / 생략"으로 분류한 후 정조음 비율을 기준 점수로 설정
- **허용 오차:** ±15점 이내를 일치로 판정 (안면 간접 측정 방식의 본질적 한계를 반영)
- **비교 대상 수:** 평가셋 내 measured 샘플 전체 (최소 30건 권장)

---

## 5. 모음 정확도 (vowel_accuracy) Gold-Label 정의

### 5.1 측정 방법

모음 정확도 역시 안면 랜드마크 기반 간접 측정입니다. 목표 텍스트에 포함된 모음 유형(저모음, 원순모음, 일반 모음)에 따라 계산 방식이 달라집니다.

### 5.2 모음 유형 분류

| 분류 | 해당 모음 | 판별 기준 |
| --- | --- | --- |
| 저모음 (low vowel) | ㅏ, ㅓ | 중성 인덱스 0, 4 |
| 원순모음 (rounded vowel) | ㅗ, ㅛ, ㅜ, ㅠ 및 복합 원순 | 중성 인덱스 8-17 |
| 일반 모음 | 위 외 모음 | 해당 없음 |

**구현 위치:** `src/lib/analysis/articulationAnalyzer.ts` — `getTextTargets()` 함수

### 5.3 모음 정확도 계산 방법

**저모음 포함 텍스트**

```
openingScore = clamp(mouthOpening / lowVowelOpeningThreshold × 100, 0, 100)
widthScore = clamp(mouthWidth / vowelWidthTarget × 100, 0, 100)
vowelHitRatio = (lowVowelOpeningThreshold 이상인 프레임 수 / 전체 프레임 수) × 100

기본 모음정확도 = openingScore × 0.60 + widthScore × 0.20 + vowelHitRatio × 0.20
최종 모음정확도 = 기본 모음정확도 × 0.80 + patternMatchPct × 0.20
```

`lowVowelOpeningThreshold` 기준값: balanced 프로필 기준 0.60

**원순모음 포함 텍스트**

```
widthToOpeningRatio = mouthWidth / max(mouthOpening, 0.05)
roundingPct = clamp((1.08 - widthToOpeningRatio) / 0.70 × 100, 0, 100)

최종 모음정확도 = openingScore × 0.25 + widthScore × 0.20
               + roundingPct × 0.35 + patternMatchPct × 0.20
```

**일반 모음 텍스트**

```
기본 모음정확도 = openingScore × 0.65 + widthScore × 0.35
최종 모음정확도 = 기본 모음정확도 × 0.80 + patternMatchPct × 0.20
```

**구현 위치:** `src/lib/analysis/articulationAnalyzer.ts` — `analyzeArticulation()` 함수 내 vowelAccuracy / refinedVowelAccuracy

### 5.4 정답 기준 판정 방법

- **임상 전문가 청취 판정:** 동일 발화에 대해 언어재활사가 모음 정확도를 0-100 척도로 직접 평정
- **허용 오차:** ±15점 이내를 일치로 판정
- **비교 대상 수:** 평가셋 내 measured 샘플 전체 (최소 30건 권장)

---

## 6. 측정 품질 분류 (measured / partial / demo) Gold-Label 정의

### 6.1 분류 기준

측정 품질 분류는 세션 수행 조건을 기반으로 자동 판정합니다. AI 모델이 관여하지 않는 규칙 기반 분류입니다.

| 분류 | 정의 | 조건 |
| --- | --- | --- |
| `measured` | 정식 측정 완료 | 권한 허용 + transcript 존재 + 안면 추적 완료 |
| `partial` | 일부 측정 완료 | 권한 허용 + transcript 또는 안면 추적 중 하나만 완료 |
| `demo` | 시연 / 비공식 실행 | 권한 거부 또는 개발 모드 실행 |

### 6.2 AI 성능평가 포함 기준

AI 성능평가 정식 평가 대상은 `measured` 분류 샘플만 포함합니다. `partial`, `demo` 샘플은 제외됩니다.

**구현 위치:** `src/lib/vnv/deterministicChecks.ts`, `src/lib/kwab/SessionManager.ts`
**자동 검증:** `TC-MQ-001` (deterministic run)

---

## 7. 성능 허용 기준 (Acceptance Criteria)

시험기관 제출 시 적용하는 성능 합격 기준입니다. 아래 기준은 현재 내부 기준이며, 시험기관 사전 문의 후 조정될 수 있습니다.

| 지표 | 내부 합격 기준 | 비고 |
| --- | --- | --- |
| AQ 결정론적 일치율 | 100% (fixture 기준) | `TC-SCORE-001` 통과 필수 |
| 자음 정확도 임상 일치율 | ±15점 이내 일치 ≥ 70% | 안면 간접 측정 방식 반영 |
| 모음 정확도 임상 일치율 | ±15점 이내 일치 ≥ 70% | 안면 간접 측정 방식 반영 |
| measured 분류 정확도 | 100% (규칙 기반) | `TC-MQ-001` 통과 필수 |

---

## 8. 모델 거버넌스 연결

현재 활성화된 모델 버전 정보는 다음과 같습니다.

| 항목 | 값 |
| --- | --- |
| modelVersion | `speech-face-v1.2.0` |
| analysisVersion | `analysis-2026-04` |
| evaluationDatasetVersion | `evalset-kr-articulation-2026-01` |
| approvedAt | 2026-04-14 |
| approvedBy | qa.manager |

**구현 위치:** `src/lib/ai/modelGovernance.ts` — `ACTIVE_MODEL_GOVERNANCE`

모델 버전이 변경될 경우 이 문서의 계산 방법 항목과 `modelGovernance.ts`를 함께 업데이트해야 합니다.

---

## 9. 평가 환경 및 제약사항

### 9.1 측정 방식의 한계

| 제약사항 | 설명 | 완화 방법 |
| --- | --- | --- |
| 안면 간접 측정 | 음성 파형이 아닌 안면 움직임으로 발음 평가 | 허용 오차 ±15점 적용, 임상 전문가 육안 검증 병행 |
| 조명/카메라 품질 의존성 | 저조도 또는 낮은 해상도 환경에서 정확도 저하 가능 | 최소 환경 기준 명시 (별도 사용 환경 가이드 참조) |
| 양순음 미포함 텍스트 | 자음 정확도 계산 정밀도가 낮아짐 | 평가셋 구성 시 양순음 포함 항목 비율 명시 필요 |

### 9.2 평가 환경 최소 기준

| 항목 | 최소 기준 |
| --- | --- |
| 카메라 해상도 | 720p 이상 |
| 프레임 속도 | 15fps 이상 (분석 알고리즘 deltaMs 기준: 8~120ms) |
| 조도 | 300lux 이상 (얼굴 정면 균일 조명) |
| 얼굴 크기 | 화면 내 얼굴 영역 25% 이상 |

---

## 10. 관련 문서

- [AI 성능평가 현재 운영본 보고서](./ai-evaluation-current-report.md)
- [AI 평가 데이터셋 정의서](./ai-evaluation-dataset-definition.md)
- [AI 오류 사례 기록서](./ai-evaluation-error-case-log.md)
- [AI 성능평가 제출 개요](./ai-evaluation-submission-outline.md)
- [제품 정의 1장](../00-summary/brainfriends-product-definition-one-pager.md)
