# 게임모드 작업 현황

## 개요

이 문서는 현재 `game-mode` 기준으로 작업된 게임들을 정리한 문서다.

중요 원칙:

- 기존 프로젝트 구조를 유지한다.
- `stage -> gameType 분기 -> 전용 컴포넌트 -> 게임 라우트` 흐름을 재사용한다.
- `언어재활`, `자가진단`, `노래방` UI/UX는 건드리지 않는다.
- 명소를 직접 맞히는 퀴즈가 아니라 `명소 -> 연상 단어` 구조를 유지한다.
- 단어 판정은 AI 추론이 아니라 사전 정의 데이터 기준으로 처리한다.

## 현재 게임모드 목록

### 기존 게임

| gameType | 노출 이름 | 설명 |
| --- | --- | --- |
| `tetris` | 단어 폭탄 | 낙하하는 단어를 음성으로 처리하는 반응형 게임 |
| `memory` | 단어 배치 | 단어를 카테고리 성격에 맞게 배치하는 게임 |
| `sentence_build` | 문장 만들기 | 문장을 조합하는 게임 |
| `tongue_twister` | 잿말놀이 | 빠르게 발화하는 훈련형 게임 |
| `balloon` | 풍선 키우기 | 발성 유지 기반 게임 |

### 추가된 신규 게임

| gameType | 노출 이름 | 설명 |
| --- | --- | --- |
| `association_clear` | 연상 매칭 | 명소와 관련된 단어만 말해서 화면에서 제거하는 게임 |
| `word_assemble` | 단어 조합 | 제시된 음절을 조합해 만들 수 있는 단어를 말하는 게임 |
| `word_select` | 단어 선택 | 보기 단어 중 관련 있는 단어만 음성으로 선택하는 게임 |

## 신규 gameType 기준

### 1. 연상 매칭

- 목적: 명소와 관련된 단어만 말해서 정리
- 입력 방식: STT 또는 mock 테스트 입력
- 성공 조건: 정답 단어를 모두 제거
- 실패 조건: 시간 초과 또는 오답 누적

예시 구조:

```ts
type AssociationWord = {
  word: string;
  isAnswer: boolean;
};

type AssociationClearStage = {
  id: string;
  title: string;
  gameType: "association_clear";
  words: AssociationWord[];
  clearCondition?: string;
};
```

샘플 연결:

- `한강`

### 2. 단어 조합

- 목적: 제시된 음절을 조합해 만들 수 있는 단어를 말하기
- 입력 방식: STT 또는 mock 테스트 입력
- 성공 조건: 정답 단어를 모두 찾기
- 검증 방식: `answers.includes(input)` 와 음절 조합 가능 여부를 함께 확인

예시 구조:

```ts
type WordAssembleStage = {
  id: string;
  title: string;
  gameType: "word_assemble";
  syllables: string[];
  answers: string[];
  clearCondition?: string;
};
```

샘플 연결:

- `광안리`

### 3. 단어 선택

- 목적: 보기 단어 중 명소와 관련 있는 단어만 음성으로 선택
- 입력 방식: STT 또는 mock 테스트 입력
- 성공 조건: 정답 단어를 모두 선택
- 실패 조건: 오답 누적 또는 시간 초과

예시 구조:

```ts
type SelectWord = {
  word: string;
  isAnswer: boolean;
};

type WordSelectStage = {
  id: string;
  title: string;
  gameType: "word_select";
  words: SelectWord[];
};
```

샘플 연결:

- `경복궁`

## 현재 샘플 노드 연결

현재 실제 payload 기준으로 연결된 대표 샘플은 아래와 같다.

| 노드 | 명소 | gameType | 노출 이름 |
| --- | --- | --- | --- |
| `1-low-1` | 한강 | `association_clear` | 연상 매칭 |
| `1-low-2` | 경복궁 | `word_select` | 단어 선택 |
| `3-low-2` | 광안리 | `word_assemble` | 단어 조합 |

## 공통 구현 기준

- 음성 입력 연결 방식은 `onRecognizedWord(word: string)` 형태를 유지한다.
- 실제 STT 없이도 테스트 가능하도록 mock 입력 버튼 또는 테스트 경로를 둔다.
- 문자열 비교는 exact match만 쓰지 않고 `normalizeWord`를 거친다.
- 이미 처리한 단어는 중복 인정하지 않는다.
- 기존 `gameType` 흐름을 깨지 않고 최소 확장으로 추가한다.

## 관리자 디버깅 기준

관리자 계정일 경우 게임 디버깅을 위해 전체 레벨과 노드가 잠금 해제된다.

기준:

- `patient.userRole === "admin"`
- 또는 사용자 이름이 `관리자`

적용 위치:

- 게임모드 선택 화면
- 스테이지 상세 화면

## 관련 주요 파일

### 공통 설정

- `src/constants/gameModeRoadmap.ts`
- `src/constants/gameModeStagePayloads.ts`
- `src/lib/gameModeProgress.ts`
- `src/lib/lingo/normalizeWord.ts`

### 신규 게임 컴포넌트

- `src/components/lingo/AssociationClearGame.tsx`
- `src/components/lingo/WordAssembleGame.tsx`
- `src/components/lingo/WordSelectGame.tsx`

### 신규 게임 라우트

- `src/app/(training)/programs/lingo/association-clear/page.tsx`
- `src/app/(training)/programs/lingo/word-assemble/page.tsx`
- `src/app/(training)/programs/lingo/word-select/page.tsx`

### 선택 화면 / 스테이지 화면

- `src/app/(training)/select-page/game-mode/page.tsx`
- `src/app/(training)/select-page/game-mode/stage/[stageId]/page.tsx`

## 다음 정리 포인트

다음 작업에서는 아래를 먼저 확정하는 것이 좋다.

1. 각 도시/명소 노드에 어떤 gameType을 배치할지 표로 고정
2. 기존 게임과 신규 게임을 선택 화면에서 어떻게 묶어서 보여줄지 정리
3. `memory`, `tongue_twister` 등 기존 게임을 현재 기획 의도에 맞게 유지할지 교체할지 결정
4. 신규 게임별 점수, 시간, 오답 허용 횟수 기준을 공통 규칙으로 맞출지 결정
