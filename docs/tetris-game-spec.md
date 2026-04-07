# 한글 테트리스 기획/구현 정리

## 1. 개요

한글 테트리스는 `제시된 단어 또는 문장`을 `음성으로 정확하게 발화`하면 블록이 자동으로 최적 위치에 배치되는 음성 퍼즐형 훈련 게임이다.

핵심 경험은 다음 3가지다.

- 화면에 보이는 목표어를 보고 발화한다.
- 발화가 기준 정확도 이상이면 블록이 자동 배치된다.
- 10개 문제를 모두 처리하면 결과 리포트가 표시된다.

현재 구현 파일:

- [TetrisGame.tsx](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)
- [tetrisWords.ts](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/data/tetrisWords.ts)

## 2. 게임 목표

사용자는 각 라운드에서 제시되는 목표어를 발화한다.  
정답 판정이 나면 해당 라운드는 성공 처리되고 다음 문제로 넘어간다.  
블록이 바닥 또는 적재 블록과 충돌하면 해당 라운드는 실패 처리된다.

최종적으로 10문제를 모두 처리한 뒤 다음 값을 결과로 본다.

- 성공 개수
- 실패 개수
- 성공률
- 마지막 발화 정확도 점수

## 3. 난이도 구성

레벨 선택은 `1~9단계`까지 제공된다.  
선택 모달은 실제로 `1~9`만 노출하며, `10`은 현재 사용하지 않는다.

데이터 소스:

- [tetrisWords.ts](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/data/tetrisWords.ts)

### 레벨별 문항 성격

#### Level 1
- 2음절 중심의 단일 명사
- 예: `사과`, `나무`, `하늘`

#### Level 2
- 짧은 형용사+명사 조합
- 예: `파란 하늘`, `빨간 사과`

#### Level 3
- 짧은 평서문/구문
- 예: `나는 학교 가요`, `꽃이 피었어요`

#### Level 4
- 조금 더 긴 생활 문장
- 예: `친구랑 같이 놀자`, `노래를 크게 불러`

#### Level 5
- 일상형 완결 문장
- 예: `오늘은 정말 즐거운 날`, `학교 가서 공부 해요`

#### Level 6
- 사자성어/관용 표현
- 예: `일취월장`, `대기만성`

#### Level 7
- 발음 반복형, 음절 훈련형
- 예: `가나다라마바사`, `타탸토툐투튜티`

#### Level 8
- 긴 문장
- 예: `나는 매일 아침 일찍 일어나 운동 해요`

#### Level 9
- 랜덤 레벨 믹스
- 구현상 `1~8단계` 중 랜덤 레벨을 골라 해당 레벨 단어를 섞어 사용한다.

## 4. 라운드 구조

한 판은 총 `10문제`로 고정된다.

라운드 흐름:

1. 목표어 선택
2. 현재 목표어를 상단 카드에 표시
3. 사용자가 발화
4. 음성 인식 결과를 점수화
5. 기준 이상이면 성공, 아니면 계속 발화 대기
6. 블록 충돌 시 실패
7. 다음 문제로 이동
8. 10문제 완료 시 결과 모달 표시

진행 상태는 우측 `문제 흐름` 카드에서 10칸으로 표시한다.

- 성공: 성공 색상
- 실패: 실패 색상
- 미처리: 대기 색상

## 5. 긴 문장 처리 방식

긴 문장은 한 번에 전체를 정답 처리하지 않는다.  
현재 구현은 목표 문장을 `구간(segment)`으로 분리해서 처리한다.

관련 함수:

- [splitTargetIntoSegments](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)

동작 방식:

- 단어가 1개면 그대로 1구간
- 단어가 2~3개면 단어 단위로 분리
- 더 길면 2~4개 구간으로 나눠 순차 판정

예:

- `나는 매일 아침 일찍 운동 해요`
  - `나는 매일`
  - `아침 일찍`
  - `운동 해요`

즉 긴 문장은 `구간별 성공 -> 다음 구간 -> 마지막 구간 완료 시 최종 성공` 구조다.

## 6. 음성 인식 방식

현재 테트리스는 `브라우저 음성 인식` 기반이다.

관련 구현:

- [buildRecognition](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)

특징:

- `SpeechRecognition` 또는 `webkitSpeechRecognition` 사용
- 언어는 `ko-KR`
- `continuous = true`
- `interimResults = true`

즉 사용자가 말하는 동안 중간 결과와 최종 결과를 모두 받아서 처리한다.

## 7. 정답 판정 방식

정답 판정은 `완전 일치`가 아니라 `유사도 점수 기반`이다.

관련 함수:

- [getSpeechScore](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)
- [levenshteinDistance](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)
- [getPassThreshold](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)

### 판정 순서

1. 인식 결과 정규화
2. 목표 구간과의 레벤슈타인 거리 계산
3. 유사도 점수 환산
4. 기준 점수 이상이면 성공

### 기준 점수

구현상 기준은 목표어 길이에 따라 달라진다.

- 길이 2 이하: `80점`
- 길이 4 이하: `76점`
- 길이 7 이하: `72점`
- 그 이상: `68점`

즉 짧은 단어일수록 더 엄격하고, 긴 문장일수록 상대적으로 완화된다.

### 등급 라벨

성공 시 추가 라벨을 만든다.

- 기준 미만: `Fail`
- 98 이상: `Perfect`
- 기준+8 이상 또는 90 이상: `Excellent`
- 그 외 성공: `Good`

## 8. 점수 측정 방식

UI에 보이는 핵심 점수는 `음성 정확도`다.

현재 구현 기준:

- `totalAccuracy`는 `가장 최근 발화의 유사도 점수`
- 우측 상태판의 `음성 정확도`는 이 값을 그대로 표시

즉 현재는 `세션 평균 점수`가 아니라 `최근 판정 점수`에 가깝다.

### 결과 모달의 AverageScore

결과 모달의 `averageScore` 필드는 이름과 달리 현재 구현상 `마지막 totalAccuracy 값`을 넘긴다.

즉 실제 평균이라기보다:

- 마지막 라운드 또는 마지막 성공/실패 판정 당시의 점수

를 표시하는 구조다.

이 부분은 향후 진짜 평균을 원하면 별도 누적 합/카운트 로직이 필요하다.

## 9. 성공 처리 로직

관련 함수:

- [processResult](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)
- [advanceAfterMatch](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)
- [autoPlaceAndClear](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)

성공 시 흐름:

1. 인식 결과가 기준 점수 이상이면 성공
2. 긴 문장이면 다음 구간으로 이동
3. 마지막 구간까지 끝났으면 블록 자동 배치
4. 해당 문제를 `success`로 기록
5. 다음 목표어로 이동

## 10. 블록 배치 방식

테트리스는 사용자가 방향키로 직접 움직이는 구조가 아니라, 발화 성공 시 `AI가 최적 위치를 계산해 자동 배치`한다.

관련 함수:

- [autoPlaceAndClear](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)

로직:

- 현재 블록을 4방향 회전 시뮬레이션
- 가능한 모든 x 위치를 탐색
- 가장 점수가 높은 위치를 선택

내부 평가 기준:

- 더 아래까지 내려가는 위치에 가산점
- 줄 완성이 가능한 위치에 큰 보너스

즉 사용자는 `잘 말하는 것`에 집중하고, 블록 배치는 자동 최적화된다.

## 11. 실패 처리 로직

관련 함수:

- [playerDrop](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)
- [applyDangerPenalty](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)

실패 조건:

- 블록이 한 칸 내려가려 할 때 충돌 발생

실패 시 처리:

1. 현재 문제를 `fail`로 기록
2. 실패 수 증가
3. 연속 실패 스택 증가
4. 보드 아래에서 가비지 줄 1개 상승
5. 다음 문제로 이동
6. 새 블록 생성

즉 테트리스의 시간 압박은 `별도 타이머 UI`가 아니라 `블록 낙하와 충돌`로 구현된다.

## 12. 낙하/속도 로직

관련 함수:

- [getDropInterval](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)

현재 구현:

- 전 레벨 공통 `1000ms`

즉 지금은 레벨이 바뀌어도 블록 낙하속도는 동일하다.  
난이도 차이는 주로 제시 문항의 길이와 발음 난이도에서 발생한다.

참고:

- 내부적으로 `fallProgress`, `dropTimeLeftMs`, `dropTimeTotalMs`를 계산하는 로직은 아직 남아 있다.
- 하지만 현재 UI에는 낙하 시간 카운트/시간바를 노출하지 않는다.

## 13. 보드 구조

구현상 보드는 다음 요소로 구성된다.

- 기본 빈 보드 생성
- 시작 시 하단에 랜덤 debris(초기 장애물) 생성
- 실패 시 가비지 줄 상승
- 줄이 완성되면 sweep

관련 함수:

- [makeBoard](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)
- [fillDebris](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)
- [raiseGarbageRow](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)
- [sweepLines](c:/Users/pc/Desktop/ProjectFiles/BrainFriends/src/components/lingo/TetrisGame.tsx)

## 14. 카메라/부가 요소

테트리스는 부가적으로 카메라 프리뷰와 얼굴 추적 UI를 포함한다.

현재 목적:

- 사용자의 참여감/모니터링 보조
- 연속 성공 시 코스튬/비주얼 효과 지원

즉 메인 게임 판정은 음성이고, 카메라는 보조 요소다.

## 15. 관리자/디버그 요소

현재 구현에는 로컬 디버그 기준에서 다음 기능이 있을 수 있다.

- 강제 성공 처리
- 강제 실패 처리
- 기술 상태 토글

즉 운영 사용자용 정보와 개발자 확인용 정보가 일부 함께 존재한다.

## 16. 현재 기획상 장점

- 음성 발화 자체에 집중하는 구조
- 블록 이동을 자동화해 조작 부담 감소
- 긴 문장도 구간 단위로 처리 가능
- 10문제 세션 구조로 결과 리포트 연결이 쉬움

## 17. 현재 구현상 주의점

### 1. 점수명과 실제 의미 차이

`averageScore`는 현재 진짜 평균이 아니다.

### 2. 레벨별 낙하 속도 차이 없음

난이도는 단어/문장 난이도 중심이며, 물리 속도는 아직 동일하다.

### 3. 브라우저 음성 인식 의존

현재 구현은 브라우저 STT 품질에 영향을 받는다.  
특히 브라우저 종류나 마이크 환경에 따라 체감이 다를 수 있다.

### 4. 긴 문장 인식은 아직 UX 보정 여지 있음

구간 분할 로직은 들어가 있지만, 실제 문장 분할 기준은 향후 기획 조정 여지가 있다.

## 18. 향후 개선 제안

### 기획 개선

- 레벨별 낙하 속도 차등 적용
- 긴 문장 분할 기준을 발화 난이도 기반으로 재설계
- 결과 리포트에 실제 평균 정확도 사용

### UX 개선

- 현재 구간/전체 구간 관계를 더 명확히 표시
- 실패 이유(시간 부족/인식 실패/정확도 부족) 분리
- 브라우저/마이크 상태 안내를 더 사용자 친화적으로 단순화

### 데이터 개선

- Level 9 랜덤 믹스 규칙 명확화
- Level 10 사용 여부 결정

## 19. 한 줄 요약

현재 테트리스는 `음성 발화 정확도`를 중심으로, `10문제 세션`, `긴 문장 구간 분할`, `성공 시 자동 최적 배치`, `실패 시 가비지 상승` 구조를 갖는 음성 퍼즐형 훈련 게임이다.
