# 문장 마법 기획/구현 정리

## 1. 개요

문장 마법은 `문장 정확도`를 전투형 연출로 표현한 음성 훈련 게임이다.  
사용자는 제시된 문장 또는 흩어진 단어를 보고 발화하고, 인식 정확도에 따라 플레이어와 적의 HP가 변한다.

핵심 경험은 다음 3가지다.

- 문장 또는 단어 조합을 보고 발화한다.
- 정확도 기준을 넘기면 적 HP가 줄어든다.
- HP 전투를 통해 승패가 결정된다.

현재 구현 파일:

- [SentenceMagicGame.tsx](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/SentenceMagicGame.tsx)
- [sentenceGameData.ts](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/data/sentenceGameData.ts)

## 2. 게임 목표

문장 마법의 목표는 `문장을 얼마나 정확하게 발화했는지`를 전투식으로 표현하는 것이다.

플레이어/적 모두 HP 3으로 시작한다.

라운드 구조:

- 정답 기준 이상 → 적 HP 감소
- 기준 미만 → 플레이어 HP 감소

최종 종료 조건:

- 적 HP 0 → 승리
- 플레이어 HP 0 → 패배

## 3. 모드 구성

데이터 소스:

- [sentenceGameData.ts](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/data/sentenceGameData.ts)

### 문장 만들기 (`example`)

- 흩어진 단어를 보고 자연스러운 문장을 만들어 말하는 모드
- 각 문제는 `answer: string[]` 구조
- 화면에는 단어 칩이 섞여서 보임

예:

- `강아지가 / 공원에서 / 달려요`
- `엄마가 / 사과를 / 씻어요`

### 잰말 놀이 (`tongue`)

- 제시된 문장을 그대로 읽는 모드
- 짧은 말부터 긴 잰말놀이 문장까지 포함

예:

- `간장 공장 공장장`
- `빨간 벽돌 파란 벽돌`
- `간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다`

## 4. 난이도 구성

문장 마법의 난이도는 `정확도 임계값`으로 구성된다.

### 하

- threshold: `55`

### 중

- threshold: `65`

### 상

- threshold: `75`

즉 사용자가 같은 문장을 읽더라도, 선택 난이도에 따라 성공/실패 기준이 달라진다.

## 5. 잰말놀이 문제 그룹 구성

잰말놀이 문제는 threshold 기준으로 그룹이 나뉜다.

관련 데이터:

- `55` → `TONGUE_TWISTER_QUESTIONS.slice(0, 20)`
- `65` → `slice(20, 40)`
- `75` → `slice(40)`

즉 난이도 선택은 단순 판정 기준뿐 아니라 `문항 묶음`에도 영향을 준다.

## 6. 입력 방식

문장 마법은 현재 `브라우저 STT`가 아니라 `녹음 후 서버 STT` 방식이다.

관련 구현:

- [SentenceMagicGame.tsx](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/SentenceMagicGame.tsx)
- [route.ts](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/app/api/proxy/stt/route.ts)

흐름:

1. 사용자가 녹음 시작
2. `MediaRecorder`로 녹음
3. 녹음 정지
4. `audio/webm` blob 생성
5. `/api/proxy/stt`로 전송
6. STT 결과 텍스트 수신
7. 목표 문장과 비교해 정확도 계산

즉 문장 마법은 `한 번 누르고 말한 뒤, 분석 결과를 받는` 구조다.

## 7. 정확도 계산 방식

관련 함수:

- [normalizeText](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/SentenceMagicGame.tsx)
- [levenshtein](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/SentenceMagicGame.tsx)
- [getAccuracyScore](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/SentenceMagicGame.tsx)

순서:

1. 공백, 문장부호 제거
2. 목표 문장과 인식 문장을 정규화
3. 레벤슈타인 거리 계산
4. `1 - distance / maxLength`를 퍼센트로 환산

즉 완전 일치가 아니어도 유사도 기반으로 점수를 산출한다.

## 8. 성공/실패 판정

관련 함수:

- [evaluateTranscript](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/SentenceMagicGame.tsx)
- [buildSuccessModal](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/SentenceMagicGame.tsx)
- [buildFailModal](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/SentenceMagicGame.tsx)

판정:

- `accuracy >= selectedThreshold` → 성공
- 그 외 → 실패

성공 시:

- 적 HP 1 감소
- 성공 모달 표시

실패 시:

- 플레이어 HP 1 감소
- 실패 모달 표시

## 9. 라운드 진행 방식

질문 배열은 모드에 따라 다르다.

- `example` → `SENTENCE_EXAMPLE_QUESTIONS`
- `tongue` → threshold에 맞는 그룹

현재 라운드는 `index`로 관리한다.

전투 흐름:

1. 문제 표시
2. 녹음
3. STT 분석
4. 성공/실패 모달
5. `다음으로`
6. 다음 index 또는 전투 종료

즉 한 문제당 한 번의 녹음/판정이 전투의 한 턴이다.

## 10. HP / 전투 상태바

상단 `BattleStatusBar`는 다음을 표시한다.

- 플레이어 HP 3칸
- 적 HP 3칸
- 현재 ROUND

녹음 중:

- 플레이어 아이콘 오라 강화
- 중앙 진행 바 활성화

분석 중:

- 적 아이콘 붉은 pulse

즉 단순 점수판이 아니라, 현재 전투 상태를 시각적으로 보여주는 HUD 역할을 한다.

## 11. 메인 화면 구조

현재 본문 구성:

- 상단: BattleStatusBar
- 메인 카드:
  - 선택된 모드 표기
  - 문장 또는 단어 칩
  - 녹음 버튼
  - 안내 메시지
  - 실시간 Recognition 요약
- 오류가 있을 때만 하단 `음성 안내` 카드

좌우 사이드 패널은 제거된 상태다.

## 12. 결과 모달 구조

문장 마법은 전투 중간 결과와 최종 결과를 구분한다.

### 중간 결과 모달

- 공격 성공 / 반격 피격
- 나 / 상대 카드
- 정확도와 인식 문장 요약
- `다음으로` 버튼

### 최종 결과 모달

- 승리 / 패배
- 더 큰 전투 연출 카드
- 정확도 상세 토글
- 단계 선택 / 메인 화면 이동

공통 셸 기반 파일:

- [LingoResultModalShell.tsx](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/LingoResultModalShell.tsx)

## 13. 관리자/디버그 요소

로컬 또는 관리자 환경에서는 상단 헤더에 다음 버튼이 표시될 수 있다.

- `성공 예시`
- `실패 예시`

관련 함수:

- [runExampleBattle](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/SentenceMagicGame.tsx)

즉 운영 사용자 화면과 개발 확인용 기능이 분리되어 있다.

## 14. 현재 기획상 장점

- 발화 정확도를 전투 구조로 직관적으로 표현 가능
- 문장 만들기 / 잰말 놀이를 하나의 게임 프레임 안에 담을 수 있음
- threshold 기반으로 난이도 조절이 명확함

## 15. 현재 구현상 주의점

### 1. STT 응답 속도는 네트워크 영향이 큼

문장 마법은 브라우저 즉시 인식이 아니라 서버 STT를 기다려야 한다.

### 2. 잰말놀이 긴 문장은 인식 편차가 큼

문장이 길어질수록 STT 품질, 마이크 환경, 발화 속도에 영향받는다.

### 3. accuracy는 문자열 유사도 중심

발음 자연스러움, 억양, 호흡 품질보다는 텍스트 유사도에 더 가깝다.

## 16. 향후 개선 제안

- 긴 문장에 대한 구간형 피드백 추가
- 발화 속도/끊김 평가 분리
- 결과 모달에서 최종 정확도 추세 제공

## 17. 한 줄 요약

현재 문장 마법은 `녹음 -> 서버 STT -> 유사도 점수 -> HP 전투` 구조를 가진 문장 정확도 중심의 음성 배틀 게임이다.
