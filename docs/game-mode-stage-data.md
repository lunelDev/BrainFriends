# 게임 모드 레벨 데이터 문서

## 1. 문서 목적

이 문서는 게임 모드의 전체 레벨 데이터를 한눈에 확인하기 위한 운영용 문서다.  
현재 게임 모드 스테이지는 `단일 도시 + 15노드` 구조로 설계되어 있으며, 각 노드는 `한글 테트리스`, `말로 열기`, `문장 대결` 중 하나의 게임 타입을 가진다.

실제 원본 데이터는 아래 파일을 기준으로 관리한다.

- `C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\constants\gameModeStagePayloads.ts`

---

## 2. 공통 구조

### 2-1. 스테이지 구조

- 스테이지 1개 = 도시 1개
- 도시 1개 = 총 15개 노드
- 난이도 구간
  - `하(low)` 5노드
  - `중(mid)` 5노드
  - `상(high)` 5노드

### 2-2. 게임 타입

- `tetris`
  - 짧은 단어 중심 `wordPool`
  - `previewWords`
  - `clearCondition`
- `memory`
  - 짧은 핵심어 중심 `answerPool`
  - `hintPool`
  - `previewAnswers`
- `sentence`
  - 도시 특징 문장 중심 `promptPool`
  - `previewPrompts`

### 2-3. 발화 설계 원칙

- `하`
  - 쉬운 자음/모음 중심
  - 짧고 또렷한 장소/음식/기본 명사
- `중`
  - 중간 난이도 자음과 모음 확장
  - 도시 확장 명소/음식/축제 반영
- `상`
  - `ㄹ`, `ㅅ`, `ㅆ`, 복합모음 포함
  - 도시 상징, 야경, 축제, 문화 종합

### 2-4. 입력 길이 기준

- `한글 테트리스`
  - 실시간 반응형이라 `1~4음절` 위주
- `말로 열기`
  - 음성 정답 후보는 짧은 핵심어 위주
- `문장 대결`
  - 상대적으로 긴 문장 허용

---

## 3. 전체 스테이지 요약

| Stage | 도시 | 이모지 | 구성 |
| --- | --- | --- | --- |
| 1 | 서울 | 🏙️ | 하/중/상 15노드 |
| 2 | 인천 | ⚓ | 하/중/상 15노드 |
| 3 | 부산 | 🌊 | 하/중/상 15노드 |
| 4 | 경주 | 🏛️ | 하/중/상 15노드 |
| 5 | 대구 | 🔥 | 하/중/상 15노드 |
| 6 | 전주 | 🏘️ | 하/중/상 15노드 |
| 7 | 광주 | 🎨 | 하/중/상 15노드 |
| 8 | 여수 | 🌙 | 하/중/상 15노드 |
| 9 | 강릉 | ☕ | 하/중/상 15노드 |
| 10 | 춘천 | 🍗 | 하/중/상 15노드 |
| 11 | 안동 | 🎭 | 하/중/상 15노드 |
| 12 | 제주 | 🌋 | 하/중/상 15노드 |

---

## 4. 스테이지별 노드 목록

## Stage 1. 서울

도시 설명: `수도 · 표준어의 본거지 · 튜토리얼 스테이지`

### 하(low)

1. 한강 `tetris`
2. 경복궁 `memory`
3. 남산 `sentence`
4. 인사동 `tetris`
5. 서울 하 FINAL `sentence`

### 중(mid)

6. 광화문 `memory`
7. 북촌한옥마을 `tetris`
8. 청계천 `sentence`
9. 여의도 `tetris`
10. 서울 중 FINAL `sentence`

### 상(high)

11. 서울숲 `tetris`
12. 빛초롱 `memory`
13. 표준어 `sentence`
14. 남산야경 `tetris`
15. 서울 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 한강, 야경, 치킨, 유람선, 골목, 한옥, 숲, 불빛
- `memory`
  - 경복궁, 광화문, 빛초롱 같은 서울 핵심어
- `sentence`
  - 남산, 청계천, 표준어, 서울 상징 문장

---

## Stage 2. 인천

도시 설명: `항구도시 · 차이나타운 · 개항의 도시`

### 하(low)

1. 차이나타운 `tetris`
2. 월미도 `memory`
3. 강화도 `sentence`
4. 개항장 `tetris`
5. 인천 하 FINAL `sentence`

### 중(mid)

6. 송도 `memory`
7. 소래포구 `tetris`
8. 짜장면 `sentence`
9. 자유공원 `tetris`
10. 인천 중 FINAL `sentence`

### 상(high)

11. 영종도 `tetris`
12. 인천대교 `memory`
13. 펜타포트 `sentence`
14. 을왕리 `tetris`
15. 인천 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 항구, 포구, 개항장, 바다, 해변
- `memory`
  - 월미도, 송도, 인천대교
- `sentence`
  - 강화도, 짜장면, 펜타포트 기반 문장

---

## Stage 3. 부산

도시 설명: `해양도시 · 영화의 도시 · 대한민국 제2도시`

### 하(low)

1. 해운대 `tetris`
2. 광안리 `memory`
3. 자갈치 `sentence`
4. 감천마을 `tetris`
5. 부산 하 FINAL `sentence`

### 중(mid)

6. 광안대교 `memory`
7. 태종대 `tetris`
8. 국제시장 `sentence`
9. 송도해수욕장 `tetris`
10. 부산 중 FINAL `sentence`

### 상(high)

11. BIFF `tetris`
12. 돼지국밥 `memory`
13. 밀면 `sentence`
14. 오륙도 `tetris`
15. 부산 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 해변, 바다, 영화제, 절벽, 야경
- `memory`
  - 광안리, 광안대교, 돼지국밥
- `sentence`
  - 자갈치, 국제시장, 밀면, 부산 종합 문장

---

## Stage 4. 경주

도시 설명: `천년고도 · 신라의 수도 · 야외박물관`

### 하(low)

1. 불국사 `tetris`
2. 첨성대 `memory`
3. 석굴암 `sentence`
4. 동궁월지 `tetris`
5. 경주 하 FINAL `sentence`

### 중(mid)

6. 황리단길 `memory`
7. 천마총 `tetris`
8. 대릉원 `sentence`
9. 교촌마을 `memory`
10. 경주 중 FINAL `sentence`

### 상(high)

11. 월정교 `tetris`
12. 신라문화제 `memory`
13. 황남빵 `sentence`
14. 보문단지 `tetris`
15. 경주 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 사찰, 유적, 다리, 유산, 휴양지
- `memory`
  - 첨성대, 황리단길, 교촌마을, 신라문화제
- `sentence`
  - 석굴암, 대릉원, 황남빵, 경주 유산 문장

---

## Stage 5. 대구

도시 설명: `분지의 도시 · 치맥의 성지 · 패션의 도시`

### 하(low)

1. 팔공산 `tetris`
2. 동성로 `memory`
3. 막창 `sentence`
4. 김광석거리 `tetris`
5. 대구 하 FINAL `sentence`

### 중(mid)

6. 서문시장 `memory`
7. 치맥 `tetris`
8. 앞산 `sentence`
9. 수성못 `memory`
10. 대구 중 FINAL `sentence`

### 상(high)

11. 근대골목 `tetris`
12. 이월드 `memory`
13. 납작만두 `sentence`
14. 약령시 `tetris`
15. 대구 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 산, 거리, 축제, 역사 골목, 한방시장
- `memory`
  - 동성로, 서문시장, 수성못, 이월드
- `sentence`
  - 막창, 앞산, 납작만두, 대구 종합 문장

---

## Stage 6. 전주

도시 설명: `한옥마을 · 맛의 고장 · 전통문화의 수도`

### 하(low)

1. 한옥마을 `tetris`
2. 비빔밥 `memory`
3. 경기전 `sentence`
4. 전동성당 `tetris`
5. 전주 하 FINAL `sentence`

### 중(mid)

6. 오목대 `memory`
7. 남부시장 `tetris`
8. 전주천 `sentence`
9. 한지 `memory`
10. 전주 중 FINAL `sentence`

### 상(high)

11. 풍남문 `tetris`
12. 콩나물국밥 `memory`
13. 모주 `sentence`
14. 소리축제 `tetris`
15. 전주 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 한옥, 성당, 시장, 문, 축제
- `memory`
  - 비빔밥, 오목대, 한지, 콩나물국밥
- `sentence`
  - 경기전, 전주천, 모주, 전주 종합 문장

---

## Stage 7. 광주

도시 설명: `예술의 도시 · 빛의 도시 · 민주주의의 성지`

### 하(low)

1. 무등산 `tetris`
2. 5·18 `memory`
3. 비엔날레 `sentence`
4. 양림동 `tetris`
5. 광주 하 FINAL `sentence`

### 중(mid)

6. 아시아문화전당 `memory`
7. 상추튀김 `tetris`
8. 충장로 `sentence`
9. 김치축제 `memory`
10. 광주 중 FINAL `sentence`

### 상(high)

11. 펭귄마을 `tetris`
12. 빛고을 `memory`
13. 예술의거리 `sentence`
14. 광주천 `tetris`
15. 광주 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 산, 마을, 음식, 하천, 예술 거리 풍경
- `memory`
  - 5·18, 문화전당, 김치축제, 빛고을
- `sentence`
  - 비엔날레, 충장로, 예술의거리, 광주 종합 문장

---

## Stage 8. 여수

도시 설명: `밤바다의 도시 · 엑스포 · 남해안의 보석`

### 하(low)

1. 여수밤바다 `tetris`
2. 오동도 `memory`
3. 향일암 `sentence`
4. 돌산공원 `tetris`
5. 여수 하 FINAL `sentence`

### 중(mid)

6. 해상케이블카 `memory`
7. 갓김치 `tetris`
8. 이순신광장 `sentence`
9. 엑스포 `memory`
10. 여수 중 FINAL `sentence`

### 상(high)

11. 돌게장 `tetris`
12. 서시장 `memory`
13. 거북선대교 `sentence`
14. 장어구이 `tetris`
15. 여수 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 밤바다, 공원, 음식, 해변, 바다 풍경
- `memory`
  - 오동도, 케이블카, 엑스포, 서시장
- `sentence`
  - 향일암, 이순신광장, 거북선대교, 여수 종합 문장

---

## Stage 9. 강릉

도시 설명: `커피도시 · 단오의 고장 · 동해안의 낭만`

### 하(low)

1. 경포대 `tetris`
2. 정동진 `memory`
3. 오죽헌 `sentence`
4. 커피거리 `tetris`
5. 강릉 하 FINAL `sentence`

### 중(mid)

6. 안목해변 `memory`
7. 초당두부 `tetris`
8. 단오제 `sentence`
9. 주문진 `memory`
10. 강릉 중 FINAL `sentence`

### 상(high)

11. 강문해변 `tetris`
12. 선교장 `memory`
13. 커피 `sentence`
14. 바다열차 `tetris`
15. 강릉 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 해변, 커피, 두부, 열차, 바다 풍경
- `memory`
  - 정동진, 안목해변, 주문진, 선교장
- `sentence`
  - 오죽헌, 단오제, 커피, 강릉 종합 문장

---

## Stage 10. 춘천

도시 설명: `닭갈비의 도시 · 호반의 도시 · 남이섬`

### 하(low)

1. 남이섬 `tetris`
2. 닭갈비 `memory`
3. 막국수 `sentence`
4. 소양강 `tetris`
5. 춘천 하 FINAL `sentence`

### 중(mid)

6. 의암호 `memory`
7. 강촌 `tetris`
8. 공지천 `sentence`
9. 마임축제 `memory`
10. 춘천 중 FINAL `sentence`

### 상(high)

11. 삼악산 `tetris`
12. 레고랜드 `memory`
13. 호반 `sentence`
14. 감자빵 `tetris`
15. 춘천 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 섬, 강, 산, 간식, 자연 풍경
- `memory`
  - 닭갈비, 의암호, 마임축제, 레고랜드
- `sentence`
  - 막국수, 공지천, 호반, 춘천 종합 문장

---

## Stage 11. 안동

도시 설명: `유교문화의 본향 · 탈춤의 고장 · 하회마을`

### 하(low)

1. 하회마을 `tetris`
2. 도산서원 `memory`
3. 안동찜닭 `sentence`
4. 탈춤 `tetris`
5. 안동 하 FINAL `sentence`

### 중(mid)

6. 봉정사 `memory`
7. 월영교 `tetris`
8. 안동소주 `sentence`
9. 간고등어 `memory`
10. 안동 중 FINAL `sentence`

### 상(high)

11. 병산서원 `tetris`
12. 유교문화 `memory`
13. 헛제삿밥 `sentence`
14. 민속촌 `tetris`
15. 안동 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 마을, 공연, 다리, 서원, 전통 체험
- `memory`
  - 도산서원, 봉정사, 간고등어, 유교문화
- `sentence`
  - 안동찜닭, 안동소주, 헛제삿밥, 안동 종합 문장

---

## Stage 12. 제주

도시 설명: `화산섬 · 유네스코 자연유산 · 대한민국의 보물`

### 하(low)

1. 한라산 `tetris`
2. 성산일출봉 `memory`
3. 우도 `sentence`
4. 협재해변 `tetris`
5. 제주 하 FINAL `sentence`

### 중(mid)

6. 흑돼지 `memory`
7. 한라봉 `tetris`
8. 만장굴 `sentence`
9. 오름 `memory`
10. 제주 중 FINAL `sentence`

### 상(high)

11. 섭지코지 `tetris`
12. 용두암 `memory`
13. 해녀 `sentence`
14. 올레길 `tetris`
15. 제주 FINAL `sentence`

대표 데이터 방향:

- `tetris`
  - 산, 해변, 과일, 해안, 올레길
- `memory`
  - 성산일출봉, 흑돼지, 오름, 용두암
- `sentence`
  - 우도, 만장굴, 해녀, 제주 종합 문장

---

## 5. 데이터 사용 규칙

### 5-1. Stage 페이지

- `stage/[stageId]` 는 단일 도시만 렌더링한다.
- 한 페이지에 다른 도시 노드가 섞이면 안 된다.

### 5-2. 게임 진입 기준

- `roadmapStage`
- `roadmapNode`

두 값으로 현재 노드를 식별한다.

### 5-3. 게임별 payload 로딩

- `한글 테트리스`
  - `wordPool`
  - `previewWords`
  - `clearCondition`
- `말로 열기`
  - `hintPool`
  - `answerPool`
  - `previewAnswers`
- `문장 대결`
  - `promptPool`
  - `previewPrompts`

### 5-4. 문서와 원본의 관계

이 문서는 운영/기획 확인용 문서다.  
실제 단어 풀, 힌트 풀, 문장 풀의 상세 값은 아래 원본을 기준으로 확인한다.

- `C:\Users\pc\Desktop\ProjectFiles\BrainFriends\src\constants\gameModeStagePayloads.ts`

---

## 6. 참고 자료

- `C:\Users\pc\Desktop\ProjectFiles\BrainFriends\docs\자음발달순서.png`
- `C:\Users\pc\Desktop\ProjectFiles\BrainFriends\docs\모음발달순서.png`
- `C:\Users\pc\Desktop\ProjectFiles\BrainFriends\docs\발음방법 및 위치.png`

이 자료를 기준으로 `speechTarget`의 자음/모음/조음 위치/난이도 설계를 반영한다.
