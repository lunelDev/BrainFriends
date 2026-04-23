# Whisper vs Parselmouth 역할 경계

## 목적

BrainFriends 음성 분석에 사용되는 두 엔진의 역할을 명확히 구분한다. 두 엔진이 같은 음원에서 동시에 결과를 내기 때문에, **각 결과를 어디에 쓰고 어디에 안 쓰는지** 를 정해놓지 않으면 코드와 시험기관 보고서 모두 흔들린다.

## 한 줄 정의

- **Whisper** = 음성을 텍스트로 변환 (전사). 외부 OpenAI 호출, 확률적, AI 성능평가 대상.
- **Parselmouth** = 음원에서 음향 수치 측정 (F0·jitter·formant 등). 로컬 실행, 결정론적, SW V&V 대상.

## 적용 범위 주의

본 문서는 **녹음이 발생하는 step 에서만** 의미를 가진다. 녹음이 없는 step 에는 두 엔진 모두 적용되지 않는다.

- 적용: step-2, step-4, step-5, sing-training (오디오 녹음 존재)
- 미적용: step-1 (시각 자극), step-3 (이해·선택), step-6 (이미지/필기), lingo 대부분

step 별 세부 적용 여부와 REQ 매핑은 `docs/remediation/01-sw-vnv/parselmouth-requirements.md` 의 "적용 범위" 표를 단일 진실원으로 본다.

## 역할 비교표

| 구분 | Whisper | Parselmouth |
| --- | --- | --- |
| 출력 종류 | 텍스트 (transcript) | 수치 (Hz, dB, %, 초) |
| 실행 위치 | OpenAI 외부 API | 서버 로컬 (Python) |
| 결정론성 | stochastic (재현 한계) | deterministic (완전 재현) |
| 외부 의존성 | OpenAI 모델 버전, 네트워크 | Python 패키지 버전만 |
| SaMD 분류 | AI 성능평가 | SW V&V |
| 평가 기준 | 정확도, WER, gold-label 비교 | reference 음원 ±허용오차 |
| 실패 모드 | 네트워크 끊김, 모델 오류 | 입력 SNR/clipping, 알고리즘 예외 |
| 비용 발생 | 호출당 OpenAI 비용 | 없음 (CPU 만) |
| 개인정보 | 음원이 OpenAI 로 송신됨 | 음원 외부 송신 없음 |

## 어떤 결과를 어디에 쓰는가

### 사용 매핑

| 산출 항목 | 사용 엔진 | 이유 |
| --- | --- | --- |
| 전사 텍스트 (lyric/word) | Whisper | 음성→텍스트 변환은 Parselmouth 범위 외 |
| 자음 정확도 (consonant accuracy) | Whisper transcript + 자체 articulation analyzer | 음소 단위 비교는 transcript 기반 |
| 모음 정확도 (vowel accuracy) | Whisper transcript + Parselmouth formant 보조 | 1차 transcript, 2차 formant 검증 |
| F0 (pitch) | **Parselmouth** | 음향 수치, deterministic 필요 |
| Jitter / Shimmer | **Parselmouth** | 음질 분석, deterministic 필요 |
| HNR | **Parselmouth** | 음질 분석, deterministic 필요 |
| Formant (F1/F2) | **Parselmouth** | 조음 분석 |
| Intensity (dB) | **Parselmouth** | 음향 측정 |
| 발화 길이 (duration) | **Parselmouth** | 음향 분석 기반이 더 정확 |
| 가사 일치도 (lyric accuracy) | Whisper transcript 기반 | 텍스트 비교 |

원칙은 다음과 같다.

- **텍스트 기반 지표** = Whisper
- **수치 기반 음향 지표** = Parselmouth
- **혼합 지표** = Whisper 가 1차 기준, Parselmouth 가 보조 검증

### 충돌 시 결정 규칙

두 엔진의 결과가 동일 의미를 가질 때 (예: 발화 길이 — Whisper segments 의 시작/끝 vs Parselmouth duration), 다음 규칙을 따른다.

1. 본 문서의 "사용 매핑" 표에 명시된 엔진 결과를 **단일 진실원**으로 채택한다
2. 다른 엔진의 결과는 보조 지표로 결과 JSON 에 같이 저장하되, 점수 산출에는 사용하지 않는다
3. 두 결과 차이가 30% 이상이면 `measurement_quality.overall = 'degraded'` 로 강등한다 (이상 감지 시그널)

### 실패 시 fallback 정책

| 시나리오 | Whisper 결과 | Parselmouth 결과 | 처리 |
| --- | --- | --- | --- |
| 정상 | OK | OK | 둘 다 사용, 점수 산출 정상 |
| Whisper 실패 (네트워크/API 오류) | NULL | OK | 음향 지표만 보고, 전사 의존 점수는 `measurement_quality = degraded`, 사용자에게 "전사 실패, 음향 지표만 표시" 안내 |
| Parselmouth 실패 (입력 SNR 미달) | OK | NULL | 전사·articulation 점수는 정상, 음향 지표는 `measurement_quality = failed`, 평가셋 자동 제외 |
| 둘 다 실패 | NULL | NULL | 결과 저장 안 함, 사용자에게 재녹음 요청 |
| Whisper 결과 무발화 (`no_speech_prob > 0.6`) | EMPTY | - | Parselmouth 도 실행하지 않음 (입력 전 차단), 사용자에게 재녹음 요청 |

## 시험기관에 어떻게 설명하는가

이 분리는 시험기관 제출 시 **두 가지 비용 절감** 효과를 낸다.

**하나, AI 성능평가 범위 축소.** Parselmouth 결과는 결정론적이라 AI 성능평가가 아닌 SW V&V 의 `acoustic deterministic test` 로 처리된다 (REQ-ACOUSTIC-001 ~ 051). reference 음원과 기대값으로 검증하므로 gold-label 데이터셋이 필요 없다. AI 성능평가는 Whisper 만 대상이 되며, 평가 데이터셋 규모와 비용이 절반 가까이 줄어든다.

**둘, 외부 송신 위험 분리.** Whisper 만 외부 송신을 발생시키므로, 사이버보안 문서의 "외부 데이터 송신 항목" 은 Whisper 한 줄로 끝난다. Parselmouth 는 로컬 실행이라 송신 항목에 등재되지 않는다.

## 시험기관 제출 시 별도 명시 사항

- Whisper 모델명을 시험 기간 동안 고정 (`whisper-1` 명시)
- OpenAI 모델 변경 가능성에 대한 선고지
- 외부 호출 없이 재현 가능한 서브셋: 평가 음원에 대한 Whisper 결과를 사전에 캐시한 JSON 을 별도 제공
- Parselmouth · Praat 엔진 · Python · NumPy 의 정확한 버전과 lockfile 해시

## 코드 작성 시 가드레일

구현하면서 다음 두 가지를 어기지 않는다.

1. **점수 산출에서 두 엔진 결과를 평균/혼합하지 않는다.** 각 점수마다 단일 엔진 결정. 평균을 내면 결정론성이 깨진다.
2. **Parselmouth 호출에 Whisper 결과를 입력으로 넣지 않는다.** 두 파이프라인은 입력 음원에서 갈라진 뒤 합류하지 않는다. 합류하면 시험기관에 두 엔진의 추적성을 같이 설명해야 해서 보고서가 복잡해진다.

## 정리

Whisper 는 텍스트, Parselmouth 는 수치. 결과는 같은 JSON 에 들어가지만 산출 경로는 분리. 점수 산출은 매핑 표 기준. 충돌 시 단일 진실원 우선. 실패는 위 fallback 표대로. 이 한 페이지가 시험기관 제출 시 "왜 두 엔진을 쓰는가" 의 단일 답변이 된다.
