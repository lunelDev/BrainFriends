# 게임 모드 구현 명세서 (현재 Next.js 코드베이스 기준)

## 1. 문서 목적

이 문서는 외부용 신규 웹앱 프롬프트를 현재 `BrainFriends` 코드베이스에 맞게 다시 정리한 구현 명세서다.

중요한 전제:

- 이 프로젝트는 이미 **Next.js App Router** 기반으로 동작 중이다.
- 따라서 `React + Vite + Zustand` 신규 구축 방향으로 다시 만들지 않는다.
- 기존 라우팅, 기존 게임 컴포넌트, 기존 로컬 진행 저장 구조를 유지한 채 확장한다.

즉 이 문서는 "새 앱 생성용 기획서"가 아니라, **현재 프로젝트에서 바로 수정 작업을 시작하기 위한 작업 기준서**다.

---

## 2. 현재 구현 기준

### 2-1. 라우팅

현재 게임 모드 관련 진입점은 다음 파일을 기준으로 한다.

- [page.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\app\(training)\select-page\game-mode\page.tsx)
- [page.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\app\(training)\select-page\game-mode\stage\[stageId]\page.tsx)

게임 화면 진입 경로는 기존 lingo 프로그램 페이지를 그대로 사용한다.

- [TetrisGame.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\components\lingo\TetrisGame.tsx)
- [MemoryFlipGame.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\components\lingo\MemoryFlipGame.tsx)
- [BalloonGrowthGame.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\components\lingo\BalloonGrowthGame.tsx)
- [SentenceMagicGame.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\components\lingo\SentenceMagicGame.tsx)

### 2-2. 데이터와 진행 저장

현재 게임 모드 데이터는 다음 두 파일을 기준으로 유지한다.

- [gameModeRoadmap.ts](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\constants\gameModeRoadmap.ts)
- [gameModeProgress.ts](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\lib\gameModeProgress.ts)

즉 별도 `levels.json`을 새 엔진으로 읽는 구조를 먼저 만들 필요는 없다.

---

## 3. 화면 흐름

현재 기준 최종 흐름은 아래를 따른다.

```text
게임 모드 메인
  -> 레벨(도시) 선택
  -> stage/[stageId] 진입
  -> 해당 레벨 내부 15개 노드 로드맵
  -> 노드 클릭 시 랜덤 배정된 게임 1개 진입
  -> 게임 완료
  -> 결과창
  -> 무조건 stage/[stageId] 맵으로 복귀
```

보조 규칙:

- 결과창에는 `다시 시작`을 두지 않는다.
- 결과창 CTA는 무조건 맵 복귀다.
- 맵 복귀 시 방금 클리어한 노드를 기준으로 `오픈 연출 + 스크롤 포커스`가 실행된다.

---

## 4. 레벨/스테이지 구조

### 4-1. 메인 레벨 선택

`game-mode` 메인 페이지는 다음 역할만 수행한다.

- 전체 레벨 카드 표시
- 잠금/해금 상태 표시
- 레벨 선택 시 `stage/[stageId]`로 이동

즉 메인에서는 세부 서브스테이지를 보여주지 않는다.

### 4-2. stage/[stageId] 내부 구조

각 `stage/[stageId]`는 "레벨 상세"가 아니라 **하나의 월드맵**이다.

핵심 규칙:

- 한 레벨 내부에 총 15개 노드가 있다.
- 구조상 5개씩 3줄이지만, UI에서는 `하 / 중 / 상` 같은 박스형 분리를 강하게 드러내지 않는다.
- 사용자는 15개가 하나의 이어진 맵처럼 느껴야 한다.
- 노드는 순차 해금이다.

현재 의도된 개념은 다음과 같다.

- 1번째 줄: 1 ~ 5
- 2번째 줄: 6 ~ 10
- 3번째 줄: 11 ~ 15

사용자에게는 큰 숫자 기준으로 흐름이 보이면 된다.

### 4-3. 노드 해금 규칙

- 첫 노드는 기본 오픈
- 이전 노드를 클리어하면 다음 노드가 열린다
- 잠긴 동안에는 게임 종류를 보여주지 않는다
- 노드가 열리는 순간 후보군 중 랜덤으로 게임 1개를 배정한다
- 한 번 배정된 게임은 그 노드에서 계속 고정된다

---

## 5. 노드 랜덤 배정 규칙

랜덤 후보는 현재 [gameModeRoadmap.ts](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\constants\gameModeRoadmap.ts)에 정의된 `candidateVariants`를 사용한다.

현재 지원 후보군:

- `memory` = 말로 열기
- `tetris` = 테트리스
- `balloon` = 풍선 키우기
- `sentence` + `sentenceMode: "example"` = 문장 만들기
- `sentence` + `sentenceMode: "tongue"` = 잿말놀이

배정 규칙:

1. 노드가 잠금 해제되기 전까지는 아무 것도 확정하지 않는다.
2. 잠금이 해제되는 시점에만 랜덤 배정한다.
3. 배정 결과는 [gameModeProgress.ts](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\lib\gameModeProgress.ts)에 저장한다.
4. 이후 동일 노드 진입 시 같은 게임을 유지한다.

---

## 6. 현재 사용 중인 진행 상태

현재 로컬 진행 상태는 [gameModeProgress.ts](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\lib\gameModeProgress.ts) 기준으로 관리한다.

중요 필드:

- `unlockedThroughStage`
- `assignedStageGames`
- `assignedStageModes`
- `clearedStages`
- `lastVisitedStage`

핵심 helper:

- `assignGameModeStageGame`
- `getAssignedGameModeStageGame`
- `getAssignedGameModeStageMode`
- `hasClearedGameModeStage`
- `markGameModeStageCleared`
- `unlockGameModeStage`
- `setLastVisitedGameModeStage`

즉 Zustand를 신규 도입하지 않고도 현재 요구사항은 이미 처리 가능하다.

---

## 7. 게임별 연결 방식

각 게임은 독립 구현을 유지하되, 게임 모드에서 들어왔을 때만 roadmap 쿼리를 받아 동작을 바꾼다.

현재 사용 쿼리:

- `roadmapStage`
- `roadmapNode`
- `difficulty`
- `fromStageMap=1`
- `sentenceMode` (문장 게임 전용)

### 7-1. 테트리스

- 파일: [TetrisGame.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\components\lingo\TetrisGame.tsx)
- stage map에서 들어오면 내부 단계 선택 없이 바로 시작
- 결과창 CTA는 맵 복귀만 허용
- 성공 시 해당 노드를 클리어 처리

### 7-2. 말로 열기

- 파일: [MemoryFlipGame.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\components\lingo\MemoryFlipGame.tsx)
- stage map에서 들어오면 내부 단계 선택 없이 바로 시작
- 성공 시 해당 노드를 클리어 처리
- 결과창 CTA는 맵 복귀만 허용

### 7-3. 풍선 키우기

- 파일: [BalloonGrowthGame.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\components\lingo\BalloonGrowthGame.tsx)
- 게임 모드 노드로 진입한 경우 성공 시 클리어 기록
- 결과창 CTA는 맵 복귀만 허용

### 7-4. 문장 대결 / 잿말놀이

- 파일: [SentenceMagicGame.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\components\lingo\SentenceMagicGame.tsx)
- `sentenceMode`에 따라 일반 문장 / 잿말놀이를 구분
- 최종 결과창에서만 맵 복귀 CTA 표시
- roadmap 진입 시 성공하면 해당 노드 클리어 처리

---

## 8. stage 맵 UI 규칙

현재 stage 맵은 [page.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\app\(training)\select-page\game-mode\stage\[stageId]\page.tsx) 에서 담당한다.

UI 원칙:

- 메인 `game-mode`와 같은 톤의 다크 네이비 배경 유지
- 과한 설명 문구 최소화
- 노드는 `큰 숫자 + 짧은 라벨 + 게임 배지 + 시작 버튼` 정도만 표시
- 한눈에 흐름이 보여야 하므로 카드 크기를 과하게 키우지 않는다
- 잠긴 노드는 최소 정보만 노출

사용자 피드백 기준으로 피해야 할 것:

- `하 / 중 / 상` 큰 구획 제목
- `다음 레벨 열기` 같은 설명성 카드
- `1-1-1` 같은 과하게 긴 식별자
- 비어 보이는 큰 카드 박스

즉 stage 맵은 관리형 UI가 아니라 **모바일 게임 로드맵처럼 보여야 한다**.

---

## 9. 맵 복귀 연출 규칙

게임 성공 후 결과창에서 맵으로 돌아오면, stage 페이지는 복귀 연출을 실행한다.

현재 의도:

- `opened=1`
- `focusNode=<id>`

이 두 쿼리를 읽고:

1. 잠깐 맵 오픈 연출 표시
2. 방금 클리어한 노드로 스크롤
3. 연출 종료 후 URL 쿼리 제거

현재 쿼리 제거는 라우터 재이동이 아니라 `window.history.replaceState(...)`를 사용한다.

이유:

- 다시 라우팅할 때 생길 수 있는 불필요한 재실행을 막기 위함
- 이미 한 차례 `router is not defined` / 잘못된 복귀 흐름 문제가 있었기 때문

---

## 10. 신규 프롬프트에서 가져와도 되는 것

외부용 신규 웹앱 프롬프트에서 아래 내용은 참고 가능하다.

- 12개 도시 데이터의 어휘 풀
- `테트리스 / 말로 열기 / 풍선 / 문장 대결`이라는 게임 역할 구분
- 한국 지역 테마 카드 정보
- 모바일 퍼스트 톤
- 다크 테마 색상 방향

즉 **콘텐츠와 화면 아이디어는 참고 가능**하다.

---

## 11. 그대로 가져오면 안 되는 것

다음은 현재 프로젝트에 그대로 적용하면 안 된다.

- `React + Vite` 신규 구조 생성
- `Zustand` 글로벌 상태를 새로 중심 축으로 교체
- `levels.json` 중심으로 전체 라우팅을 갈아엎는 작업
- `/screens`, `/games`, `/components` 기준의 새 앱 폴더 구조를 따로 만드는 것
- 기존 lingo 게임을 버리고 새 게임 엔진을 처음부터 작성하는 것

즉 현재는 **재구축보다 통합**이 우선이다.

---

## 12. 실제 수정 우선순위

### 우선순위 1

- [page.tsx](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\app\(training)\select-page\game-mode\stage\[stageId]\page.tsx)
- 목적: stage 맵 UX 정리, 노드 밀도 조정, 라벨 단순화, 연결감 개선

### 우선순위 2

- [gameModeRoadmap.ts](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\constants\gameModeRoadmap.ts)
- 목적: 실제 도시/테마 데이터 고도화, 노드별 짧은 라벨 정리, 랜덤 후보군 조정

### 우선순위 3

- [gameModeProgress.ts](C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\lib\gameModeProgress.ts)
- 목적: 랜덤 배정/해금/클리어 저장 안정화

### 우선순위 4

- 각 게임 컴포넌트
- 목적: roadmap 진입 시 선택 화면 제거, 결과창에서 맵 복귀만 허용, 클리어 처리 일관화

---

## 13. 향후 데이터 확장 방식

사용자가 제공한 `cities = [...]` 배열은 장기적으로 다음 방식으로 흡수할 수 있다.

1. 도시 메타 정보는 `GAME_MODE_ROADMAP` 카드 데이터로 사용
2. stage/theme/substage 콘텐츠는 별도 세부 데이터 구조로 점진 이관
3. 기존 게임 화면이 필요로 하는 입력 형식에 맞게 변환

즉 JSON을 그대로 주입하는 것이 아니라, 현재 타입 시스템에 맞게 단계적으로 매핑한다.

---

## 14. 최종 기준

현재 프로젝트의 목표는 아래 한 줄로 정리된다.

> 기존 Next.js 게임 모드 구조를 유지하면서, `도시 선택 -> 15노드 맵 -> 랜덤 게임 진입 -> 결과 후 맵 복귀` 흐름을 모바일 게임처럼 다듬는다.

이 문서를 기준으로 작업하면, 새 앱을 다시 짜지 않고도 현재 코드베이스를 일관되게 발전시킬 수 있다.
