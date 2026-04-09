# 게임모드 스테이지 payload 레퍼런스

최종 기준 gameType: `tetris`, `memory`, `sentence_build`, `tongue_twister`, `balloon`

## Stage 1 - 서울

### 1-low-1 - 한강
- gameType: tetris
- tier: low
- preview: 한강, 야경, 치킨, 유람선
- wordPool: 한강, 강물, 강바람, 야경, 노을, 유람선, 치킨, 라면, 산책, 벤치, 자전거, 공원, 분수, 불꽃, 잔디밭, 피크닉, 돗자리, 서울, 데이트, 강변
- clearCondition: 한강 풍경 단어와 먹거리 단어를 맞춰 줄 완성

### 1-low-2 - 경복궁
- gameType: memory
- tier: low
- preview: 경복궁, 궁궐, 광화문, 전통
- hintPool: 조선의 대표 궁궐이다 | 서울의 전통 상징 공간이다 | 광화문 안쪽에 있는 큰 궁이다 | 임금이 머물던 서울의 궁궐이다
- answerPool: 경복궁, 궁, 궁궐, 광화문, 서울궁

### 1-low-3 - 남산
- gameType: tongue_twister
- tier: low
- preview: 남산 남산, 서울 서울, 서울 서울, 남산 남산
- promptPool: 남산 남산, 서울 서울 | 서울 서울, 남산 남산 | 남산를 빠르게 이어 말해 | 서울의 남산를 한 호흡으로 말해 | 남산, 서울, 이야기를 순서대로 말해

### 1-low-4 - 인사동
- gameType: balloon
- tier: low
- preview: 인사동, 서울, 명소, 풍경
- cueWords: 인사동, 서울, 풍선, 성장, 도전
- guideText: 인사동 핵심어를 유지해 풍선을 끝까지 키운다

### 1-low-5 - 서울 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 서울은 대한민국의 수도다, 한강과 경복궁은 서울의 상징이다
- promptPool: 서울은 대한민국의 수도다 | 한강과 경복궁은 서울의 상징이다 | 남산과 인사동은 서울의 명소다 | 우리는 서울의 전통과 야경을 함께 본다 | 서울은 표준어의 중심 도시다 | 서울의 하 단계 미션을 모두 끝냈다

### 1-mid-1 - 광화문
- gameType: tetris
- tier: mid
- preview: 광화문, 서울, 명소, 풍경
- wordPool: 광화문, 문, 서울, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 광화문 핵심어 줄 완성

### 1-mid-2 - 북촌한옥마을
- gameType: memory
- tier: mid
- preview: 북촌한옥마을, 한옥, 마을, 서울
- hintPool: 북촌한옥마을은 서울의 장소다 | 북촌한옥마을에서 서울의 분위기기를 느낄 수 있다 | 서울을 떠올릴 때 함께 생각나는 핵심어다 | 북촌한옥마을이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 북촌한옥마을, 한옥, 마을, 서울, 명소

### 1-mid-3 - 청계천
- gameType: tongue_twister
- tier: mid
- preview: 청계천 청계천, 서울 서울, 서울 서울, 청계천 청계천
- promptPool: 청계천 청계천, 서울 서울 | 서울 서울, 청계천 청계천 | 청계천를 빠르게 이어 말해 | 서울의 청계천를 한 호흡으로 말해 | 청계천, 서울, 이야기를 순서대로 말해

### 1-mid-4 - 여의도
- gameType: balloon
- tier: mid
- preview: 여의도, 서울, 명소, 풍경
- cueWords: 여의도, 서울, 풍선, 성장, 도전
- guideText: 여의도 핵심어를 유지해 풍선을 끝까지 키운다

### 1-mid-5 - 서울 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 광화문과 청계천은 서울 도심의 상징이다, 여의도와 북촌은 서로 다른 서울의 매력을 보여 준다
- promptPool: 광화문과 청계천은 서울 도심의 상징이다 | 여의도와 북촌은 서로 다른 서울의 매력을 보여 준다 | 서울의 중 단계에서는 전통과 현대가 함께 나온다 | 우리는 서울 곳곳의 풍경을 말로 정리한다 | 광화문 광장과 청계천 산책은 서울 여행의 기본이다 | 북촌한옥마을과 여의도 벚꽃길은 분위기가 서로 다르다

### 1-high-1 - 서울숲
- gameType: tetris
- tier: high
- preview: 서울숲, 산책, 피크닉, 자전거
- wordPool: 서울숲, 산책, 피크닉, 자전거, 숲길, 잔디광장, 가족나들이, 사슴우리, 바람길, 휴식, 도심숲, 봄소풍, 숲체험, 그늘, 벤치, 한적함, 숲냄새, 산책로, 공원길, 주말나들이
- clearCondition: 서울숲 자연 단어와 활동 단어를 묶어 줄 완성

### 1-high-2 - 빛초롱
- gameType: memory
- tier: high
- preview: 빛초롱, 등불, 축제, 야간행사
- hintPool: 서울의 밤을 밝히는 대표 야간 축제다 | 청계천 주변에서 자주 떠오르는 빛 축제다 | 등불과 조형물이 가득한 서울 밤 행사다 | 서울의 빛과 전통 조형물이 함께 보이는 축제다
- answerPool: 빛초롱, 등불, 축제, 야경, 빛

### 1-high-3 - 표준어
- gameType: tongue_twister
- tier: high
- preview: 표준어 표준어, 서울 서울, 서울 서울, 표준어 표준어
- promptPool: 표준어 표준어, 서울 서울 | 서울 서울, 표준어 표준어 | 표준어를 빠르게 이어 말해 | 서울의 표준어를 한 호흡으로 말해 | 표준어, 서울, 이야기를 순서대로 말해

### 1-high-4 - 남산야경
- gameType: balloon
- tier: high
- preview: 남산야경, 서울, 명소, 풍경
- cueWords: 남산야경, 산, 서울, 풍선, 성장, 도전
- guideText: 남산야경 핵심어를 유지해 풍선을 끝까지 키운다

### 1-high-5 - 서울 FINAL
- gameType: sentence_build
- tier: high
- preview: 한강과 경복궁은 서울의 대표 상징이다, 서울은 표준어와 야경이 함께 떠오르는 도시다
- promptPool: 한강과 경복궁은 서울의 대표 상징이다 | 서울은 표준어와 야경이 함께 떠오르는 도시다 | 광화문과 청계천, 여의도와 서울숲은 서로 다른 매력을 보여 준다 | 남산야경과 빛초롱 축제는 서울의 밤을 더 특별하게 만든다 | 우리는 서울의 전통과 현대를 정확한 문장으로 말할 수 있다 | 서울 FINAL 단계에서는 장소 이름과 말소리 목표를 모두 종합한다

## Stage 2 - 인천

### 2-low-1 - 차이나타운
- gameType: memory
- tier: low
- preview: 차이나타운, 인천, 명소
- hintPool: 차이나타운은 인천의 장소다 | 차이나타운에서 인천의 분위기기를 느낄 수 있다 | 인천을 떠올릴 때 함께 생각나는 핵심어다 | 차이나타운이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 차이나타운, 인천, 명소

### 2-low-2 - 월미도
- gameType: tetris
- tier: low
- preview: 월미도, 인천, 명소, 풍경
- wordPool: 월미도, 인천, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 월미도 핵심어 줄 완성

### 2-low-3 - 강화도
- gameType: balloon
- tier: low
- preview: 강화도, 인천, 명소, 풍경
- cueWords: 강화도, 인천, 풍선, 성장, 도전
- guideText: 강화도 핵심어를 유지해 풍선을 끝까지 키운다

### 2-low-4 - 개항장
- gameType: tongue_twister
- tier: low
- preview: 개항장 개항장, 인천 인천, 인천 인천, 개항장 개항장
- promptPool: 개항장 개항장, 인천 인천 | 인천 인천, 개항장 개항장 | 개항장를 빠르게 이어 말해 | 인천의 개항장를 한 호흡으로 말해 | 개항장, 인천, 이야기를 순서대로 말해

### 2-low-5 - 인천 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 차이나타운과 월미도는 인천의 대표 명소다, 인천은 항구와 개항장의 도시다
- promptPool: 차이나타운과 월미도는 인천의 대표 명소다 | 인천은 항구와 개항장의 도시다 | 강화도와 월미도는 서로 다른 인천의 매력을 보여 준다 | 짜장과 만두는 인천 차이나타운에서 떠오르는 먹거리다 | 인천 하 단계에서는 바다와 항구 이미지를 함께 익힌다 | 우리는 인천의 기본 장소 이름을 또렷하게 말할 수 있다

### 2-mid-1 - 송도
- gameType: memory
- tier: mid
- preview: 송도, 신도시, 공원, 빌딩
- hintPool: 인천의 대표 신도시다 | 높은 빌딩과 넓은 공원이 함께 떠오르는 곳이다 | 국제도시 이미지가 강한 인천 지역이다 | 센트럴파크로 유명한 인천 신도시다
- answerPool: 송도, 신도시, 공원, 빌딩, 파크

### 2-mid-2 - 소래포구
- gameType: tetris
- tier: mid
- preview: 포구, 새우, 꽃게, 시장
- wordPool: 포구, 새우, 꽃게, 시장, 소래, 젓갈, 바구니, 상인, 경매, 어판, 조개, 게장, 어민, 생선, 포장, 횟집, 소금, 어시장, 수산, 방파제
- clearCondition: 수산시장 단어와 바다 먹거리 단어를 맞춰 줄 완성

### 2-mid-3 - 짜장면
- gameType: balloon
- tier: mid
- preview: 짜장면, 인천, 명소, 풍경
- cueWords: 짜장면, 인천, 풍선, 성장, 도전
- guideText: 짜장면 핵심어를 유지해 풍선을 끝까지 키운다

### 2-mid-4 - 자유공원
- gameType: tongue_twister
- tier: mid
- preview: 자유공원 자유공원, 인천 인천, 인천 인천, 자유공원 자유공원
- promptPool: 자유공원 자유공원, 인천 인천 | 인천 인천, 자유공원 자유공원 | 자유공원를 빠르게 이어 말해 | 인천의 자유공원를 한 호흡으로 말해 | 자유공원, 인천, 이야기를 순서대로 말해

### 2-mid-5 - 인천 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 송도와 소래포구는 서로 다른 인천의 분위기를 보여 준다, 짜장면과 자유공원은 인천을 떠오르게 한다
- promptPool: 송도와 소래포구는 서로 다른 인천의 분위기를 보여 준다 | 짜장면과 자유공원은 인천을 떠오르게 한다 | 인천의 중 단계에서는 바다와 도시 이미지를 함께 익힌다 | 우리는 인천의 먹거리와 공원 이름을 또렷하게 읽는다 | 송도는 현대적이고 소래포구는 시장 분위기가 강하다 | 인천 중 단계는 장소와 음식 단어를 함께 연결하는 훈련이다

### 2-high-1 - 영종도
- gameType: memory
- tier: high
- preview: 영종도, 인천, 명소
- hintPool: 영종도은 인천의 장소다 | 영종도에서 인천의 분위기기를 느낄 수 있다 | 인천을 떠올릴 때 함께 생각나는 핵심어다 | 영종도이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 영종도, 인천, 명소

### 2-high-2 - 인천대교
- gameType: tetris
- tier: high
- preview: 인천대교, 인천, 명소, 풍경
- wordPool: 인천대교, 대교, 천, 인천, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 인천대교 핵심어 줄 완성

### 2-high-3 - 펜타포트
- gameType: balloon
- tier: high
- preview: 펜타포트, 인천, 명소, 풍경
- cueWords: 펜타포트, 인천, 풍선, 성장, 도전
- guideText: 펜타포트 핵심어를 유지해 풍선을 끝까지 키운다

### 2-high-4 - 을왕리
- gameType: tongue_twister
- tier: high
- preview: 을왕리 을왕리, 인천 인천, 인천 인천, 을왕리 을왕리
- promptPool: 을왕리 을왕리, 인천 인천 | 인천 인천, 을왕리 을왕리 | 을왕리를 빠르게 이어 말해 | 인천의 을왕리를 한 호흡으로 말해 | 을왕리, 인천, 이야기를 순서대로 말해

### 2-high-5 - 인천 FINAL
- gameType: sentence_build
- tier: high
- preview: 인천은 항구와 바다, 먹거리와 축제가 함께 떠오르는 도시다, 차이나타운부터 송도와 영종도까지 인천의 모습은 다양하다
- promptPool: 인천은 항구와 바다, 먹거리와 축제가 함께 떠오르는 도시다 | 차이나타운부터 송도와 영종도까지 인천의 모습은 다양하다 | 월미도와 강화도, 소래포구와 을왕리는 서로 다른 인천의 풍경을 보여 준다 | 짜장면과 공항, 대교와 해변은 인천을 대표하는 여러 이미지다 | 인천 FINAL 단계에서는 장소 이름과 말소리 목표를 함께 종합한다 | 우리는 인천의 주요 명소와 먹거리를 분명한 문장으로 읽을 수 있다

## Stage 3 - 부산

### 3-low-1 - 해운대
- gameType: tongue_twister
- tier: low
- preview: 해운대 해운대, 부산 부산, 부산 부산, 해운대 해운대
- promptPool: 해운대 해운대, 부산 부산 | 부산 부산, 해운대 해운대 | 해운대를 빠르게 이어 말해 | 부산의 해운대를 한 호흡으로 말해 | 해운대, 부산, 이야기를 순서대로 말해

### 3-low-2 - 광안리
- gameType: memory
- tier: low
- preview: 광안리, 야경, 바다, 다리
- hintPool: 광안대교 야경이 떠오르는 부산의 대표 해변이다 | 밤바다와 다리 조명이 함께 유명한 장소다 | 부산에서 야경 명소로 많이 떠올리는 바닷가다 | 해운대와 함께 자주 언급되는 부산 해변이다
- answerPool: 광안리, 야경, 바다, 다리, 해변

### 3-low-3 - 자갈치
- gameType: tetris
- tier: low
- preview: 자갈치, 부산, 명소, 풍경
- wordPool: 자갈치, 부산, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 자갈치 핵심어 줄 완성

### 3-low-4 - 감천마을
- gameType: balloon
- tier: low
- preview: 감천마을, 부산, 명소, 풍경
- cueWords: 감천마을, 마을, 천, 부산, 풍선, 성장, 도전
- guideText: 감천마을 핵심어를 유지해 풍선을 끝까지 키운다

### 3-low-5 - 부산 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 해운대와 광안리는 부산의 대표 바다 명소다, 자갈치와 감천마을은 부산의 다른 매력을 보여 준다
- promptPool: 해운대와 광안리는 부산의 대표 바다 명소다 | 자갈치와 감천마을은 부산의 다른 매력을 보여 준다 | 부산은 바다와 시장과 골목이 함께 떠오르는 도시다 | 우리는 부산의 기본 장소 이름을 또렷하게 읽는다 | 부산 하 단계에서는 해변과 시장 이미지를 함께 익힌다 | 부산의 바다 풍경은 시원하고 활기차다

### 3-mid-1 - 광안대교
- gameType: tongue_twister
- tier: mid
- preview: 광안대교 광안대교, 부산 부산, 부산 부산, 광안대교 광안대교
- promptPool: 광안대교 광안대교, 부산 부산 | 부산 부산, 광안대교 광안대교 | 광안대교를 빠르게 이어 말해 | 부산의 광안대교를 한 호흡으로 말해 | 광안대교, 부산, 이야기를 순서대로 말해

### 3-mid-2 - 태종대
- gameType: memory
- tier: mid
- preview: 태종대, 부산, 명소
- hintPool: 태종대은 부산의 장소다 | 태종대에서 부산의 분위기기를 느낄 수 있다 | 부산을 떠올릴 때 함께 생각나는 핵심어다 | 태종대이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 태종대, 부산, 명소

### 3-mid-3 - 국제시장
- gameType: tetris
- tier: mid
- preview: 국제시장, 부산, 명소, 풍경
- wordPool: 국제시장, 부산, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 국제시장 핵심어 줄 완성

### 3-mid-4 - 송도해수욕장
- gameType: balloon
- tier: mid
- preview: 송도해수욕장, 부산, 명소, 풍경
- cueWords: 송도해수욕장, 부산, 풍선, 성장, 도전
- guideText: 송도해수욕장 핵심어를 유지해 풍선을 끝까지 키운다

### 3-mid-5 - 부산 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 광안대교와 태종대는 부산 바다 풍경의 상징이다, 국제시장과 송도해수욕장은 부산의 다른 분위기를 보여 준다
- promptPool: 광안대교와 태종대는 부산 바다 풍경의 상징이다 | 국제시장과 송도해수욕장은 부산의 다른 분위기를 보여 준다 | 부산의 중 단계에서는 야경과 시장, 해변 이미지를 함께 익힌다 | 우리는 부산의 다양한 장소 이름을 더 긴 문장으로 읽는다 | 광안대교는 야경이 강하고 국제시장은 사람과 먹거리가 많다 | 송도해수욕장과 태종대는 부산의 바다 이미지를 또렷하게 보여 준다

### 3-high-1 - BIFF
- gameType: tongue_twister
- tier: high
- preview: BIFF BIFF, 부산 부산, 부산 부산, BIFF BIFF
- promptPool: BIFF BIFF, 부산 부산 | 부산 부산, BIFF BIFF | BIFF를 빠르게 이어 말해 | 부산의 BIFF를 한 호흡으로 말해 | BIFF, 부산, 이야기를 순서대로 말해

### 3-high-2 - 돼지국밥
- gameType: memory
- tier: high
- preview: 국밥, 돼지, 밥, 부산
- hintPool: 부산 대표 음식으로 가장 자주 떠오르는 국물 요리다 | 부산 아침 식사 이미지가 강한 따뜻한 음식이다 | 고기와 국물이 함께 떠오르는 부산 대표 메뉴다 | 부산 먹거리 하면 가장 먼저 나오는 음식 중 하나다
- answerPool: 국밥, 돼지, 밥, 국물, 부산

### 3-high-3 - 밀면
- gameType: tetris
- tier: high
- preview: 밀면, 부산, 명소, 풍경
- wordPool: 밀면, 부산, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 밀면 핵심어 줄 완성

### 3-high-4 - 오륙도
- gameType: balloon
- tier: high
- preview: 오륙도, 부산, 명소, 풍경
- cueWords: 오륙도, 부산, 풍선, 성장, 도전
- guideText: 오륙도 핵심어를 유지해 풍선을 끝까지 키운다

### 3-high-5 - 부산 FINAL
- gameType: sentence_build
- tier: high
- preview: 부산은 바다와 야경, 시장과 먹거리가 함께 떠오르는 도시다, 해운대부터 BIFF와 돼지국밥까지 부산의 이미지는 매우 선명하다
- promptPool: 부산은 바다와 야경, 시장과 먹거리가 함께 떠오르는 도시다 | 해운대부터 BIFF와 돼지국밥까지 부산의 이미지는 매우 선명하다 | 광안리와 광안대교, 자갈치와 국제시장은 서로 다른 부산의 얼굴이다 | 태종대와 오륙도는 부산 바다 풍경의 깊이를 보여 준다 | 부산 FINAL 단계에서는 장소 이름과 말소리 목표를 모두 종합한다 | 우리는 부산의 대표 명소와 먹거리를 분명한 문장으로 읽을 수 있다

## Stage 4 - 경주

### 4-low-1 - 불국사
- gameType: balloon
- tier: low
- preview: 불국, 절, 탑, 기와
- cueWords: 불국, 절, 탑, 기와, 사찰, 마당, 문, 계단
- guideText: 불국사 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 4-low-2 - 첨성대
- gameType: tetris
- tier: low
- preview: 첨성대, 경주, 명소, 풍경
- wordPool: 첨성대, 경주, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 첨성대 핵심어 줄 완성

### 4-low-3 - 석굴암
- gameType: memory
- tier: low
- preview: 석굴암, 경주, 명소
- hintPool: 석굴암은 경주의 장소다 | 석굴암에서 경주의 분위기기를 느낄 수 있다 | 경주을 떠올릴 때 함께 생각나는 핵심어다 | 석굴암이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 석굴암, 경주, 명소

### 4-low-4 - 동궁월지
- gameType: tongue_twister
- tier: low
- preview: 동궁, 연못, 궁, 야경
- promptPool: 동궁 동궁를 빠르게 이어 말해 본다 | 월지 월지를 빠르게 이어 말해 본다 | 연못 연못를 빠르게 이어 말해 본다 | 궁 궁를 빠르게 이어 말해 본다 | 야경 야경를 빠르게 이어 말해 본다 | 물빛 물빛를 빠르게 이어 말해 본다

### 4-low-5 - 경주 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 불국사와 첨성대는 경주의 대표 유산이다, 석굴암과 동궁월지는 경주의 아름다움을 보여 준다
- promptPool: 불국사와 첨성대는 경주의 대표 유산이다 | 석굴암과 동궁월지는 경주의 아름다움을 보여 준다 | 경주 하 단계에서는 신라 유산 이름을 정확하게 읽는다 | 우리는 경주의 기본 명소를 모두 익혔다 | 경주는 천년고도의 분위기를 가진 도시다

### 4-mid-1 - 황리단길
- gameType: balloon
- tier: mid
- preview: 황리단, 길, 카페
- cueWords: 황리단, 황리, 길, 카페, 거리
- guideText: 황리단길 핵심어를 일정한 음량으로 유지하는 발성 노드

### 4-mid-2 - 천마총
- gameType: tetris
- tier: mid
- preview: 천마, 총, 무덤, 유물
- wordPool: 천마, 총, 무덤, 유물, 왕릉, 신라, 출토, 금관, 전시, 발굴, 문화, 경주, 역사, 고분, 마차, 말, 벽화, 토기, 관광, 기념
- clearCondition: 무덤 단어와 유물 단어를 맞춰 줄 완성

### 4-mid-3 - 대릉원
- gameType: memory
- tier: mid
- preview: 대릉원, 경주, 명소
- hintPool: 대릉원은 경주의 장소다 | 대릉원에서 경주의 분위기기를 느낄 수 있다 | 경주을 떠올릴 때 함께 생각나는 핵심어다 | 대릉원이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 대릉원, 경주, 명소

### 4-mid-4 - 교촌마을
- gameType: tongue_twister
- tier: mid
- preview: 교촌, 한옥, 마을
- promptPool: 교촌를 또렷하게 빠르게 말해 본다 | 한옥를 또렷하게 빠르게 말해 본다 | 마을를 또렷하게 빠르게 말해 본다 | 촌를 또렷하게 빠르게 말해 본다 | 경주를 또렷하게 빠르게 말해 본다

### 4-mid-5 - 경주 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 황리단길과 천마총은 경주의 다른 매력을 보여 준다, 대릉원과 교촌마을은 경주의 역사와 생활을 함께 느끼게 한다
- promptPool: 황리단길과 천마총은 경주의 다른 매력을 보여 준다 | 대릉원과 교촌마을은 경주의 역사와 생활을 함께 느끼게 한다 | 경주 중 단계에서는 골목과 무덤, 마을 이름을 길게 읽는다 | 우리는 경주의 분위기와 역사 이미지를 함께 익힌다 | 경주 중 FINAL은 도시 확장 구간을 정리하는 문장 노드다

### 4-high-1 - 월정교
- gameType: balloon
- tier: high
- preview: 월정, 다리, 야경, 빛
- cueWords: 월정, 다리, 야경, 빛, 교각, 반영, 물결, 등불
- guideText: 월정교 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 4-high-2 - 신라문화제
- gameType: tetris
- tier: high
- preview: 신라문화제, 경주, 명소, 풍경
- wordPool: 신라문화제, 문, 경주, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 신라문화제 핵심어 줄 완성

### 4-high-3 - 황남빵
- gameType: memory
- tier: high
- preview: 황남빵, 경주, 명소
- hintPool: 황남빵은 경주의 장소다 | 황남빵에서 경주의 분위기기를 느낄 수 있다 | 경주을 떠올릴 때 함께 생각나는 핵심어다 | 황남빵이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 황남빵, 경주, 명소

### 4-high-4 - 보문단지
- gameType: tongue_twister
- tier: high
- preview: 보문, 호수, 숙소, 리조트
- promptPool: 보문 보문를 빠르게 이어 말해 본다 | 호수 호수를 빠르게 이어 말해 본다 | 숙소 숙소를 빠르게 이어 말해 본다 | 리조트 리조트를 빠르게 이어 말해 본다 | 산책 산책를 빠르게 이어 말해 본다 | 관광 관광를 빠르게 이어 말해 본다

### 4-high-5 - 경주 FINAL
- gameType: sentence_build
- tier: high
- preview: 경주는 신라 유산과 감성 거리, 축제와 먹거리가 함께 어우러진 도시다, 우리는 경주의 역사와 현재 이미지를 모두 읽을 수 있다
- promptPool: 경주는 신라 유산과 감성 거리, 축제와 먹거리가 함께 어우러진 도시다 | 우리는 경주의 역사와 현재 이미지를 모두 읽을 수 있다 | 불국사부터 보문단지까지 경주의 장면은 매우 다양하다 | 경주 FINAL은 유산, 거리, 축제, 먹거리 발화를 모두 종합하는 노드다 | 경주는 천년고도의 분위기를 가장 선명하게 보여 준다

## Stage 5 - 대구

### 5-low-1 - 팔공산
- gameType: memory
- tier: low
- preview: 팔공산, 산, 대구, 명소
- hintPool: 팔공산은 대구의 장소다 | 팔공산에서 대구의 분위기기를 느낄 수 있다 | 대구을 떠올릴 때 함께 생각나는 핵심어다 | 팔공산이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 팔공산, 산, 대구, 명소

### 5-low-2 - 동성로
- gameType: tongue_twister
- tier: low
- preview: 동성, 길, 거리
- promptPool: 동성를 또렷하게 빠르게 말해 본다 | 동성로를 또렷하게 빠르게 말해 본다 | 거리를 또렷하게 빠르게 말해 본다 | 길를 또렷하게 빠르게 말해 본다 | 로를 또렷하게 빠르게 말해 본다

### 5-low-3 - 막창
- gameType: tetris
- tier: low
- preview: 막창, 대구, 명소, 풍경
- wordPool: 막창, 대구, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 막창 핵심어 줄 완성

### 5-low-4 - 김광석거리
- gameType: balloon
- tier: low
- preview: 음악, 거리, 벽화, 노래
- cueWords: 음악, 거리, 벽화, 노래, 기타, 가수, 공연, 골목
- guideText: 김광석거리 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 5-low-5 - 대구 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 팔공산과 동성로는 대구의 서로 다른 얼굴이다, 막창과 음악 거리는 대구의 활기를 보여 준다
- promptPool: 팔공산과 동성로는 대구의 서로 다른 얼굴이다 | 막창과 음악 거리는 대구의 활기를 보여 준다 | 대구 하 단계에서는 산과 거리, 먹거리 이름을 익힌다 | 우리는 대구의 기본 장소와 음식을 또렷하게 읽는다 | 대구는 활기와 더위, 먹거리가 함께 떠오르는 도시다

### 5-mid-1 - 서문시장
- gameType: memory
- tier: mid
- preview: 서문, 시장, 야시장
- hintPool: 대구의 대표 전통시장이다 | 먹거리와 옷가게가 많은 큰 시장이다 | 밤이 되면 야시장 이미지도 떠오르는 대구 명소다 | 대구 사람들의 생활감이 강한 시장이다
- answerPool: 서문, 시장, 서문시장, 야시장, 대구

### 5-mid-2 - 치맥
- gameType: tongue_twister
- tier: mid
- preview: 치맥, 축제, 여름, 맥주
- promptPool: 치맥 치맥를 빠르게 이어 말해 본다 | 축제 축제를 빠르게 이어 말해 본다 | 여름 여름를 빠르게 이어 말해 본다 | 맥주 맥주를 빠르게 이어 말해 본다 | 치킨 치킨를 빠르게 이어 말해 본다 | 야외 야외를 빠르게 이어 말해 본다

### 5-mid-3 - 앞산
- gameType: tetris
- tier: mid
- preview: 앞산, 대구, 명소, 풍경
- wordPool: 앞산, 산, 대구, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 앞산 핵심어 줄 완성

### 5-mid-4 - 수성못
- gameType: balloon
- tier: mid
- preview: 수성, 못, 호수
- cueWords: 수성, 수성못, 호수, 못, 대구
- guideText: 수성못 핵심어를 일정한 음량으로 유지하는 발성 노드

### 5-mid-5 - 대구 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 서문시장과 치맥은 대구의 활기찬 분위기를 만든다, 앞산과 수성못은 대구의 풍경 이미지를 넓혀 준다
- promptPool: 서문시장과 치맥은 대구의 활기찬 분위기를 만든다 | 앞산과 수성못은 대구의 풍경 이미지를 넓혀 준다 | 대구 중 단계에서는 축제와 시장, 호수 이미지를 함께 읽는다 | 우리는 대구의 다양한 장소를 더 긴 문장으로 말할 수 있다 | 대구 중 FINAL은 도시 확장 구간을 정리하는 단계다

### 5-high-1 - 근대골목
- gameType: memory
- tier: high
- preview: 근대골목, 대구, 명소
- hintPool: 근대골목은 대구의 장소다 | 근대골목에서 대구의 분위기기를 느낄 수 있다 | 대구을 떠올릴 때 함께 생각나는 핵심어다 | 근대골목이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 근대골목, 대구, 명소

### 5-high-2 - 이월드
- gameType: tongue_twister
- tier: high
- preview: 놀이, 타워, 공원
- promptPool: 이월드를 또렷하게 빠르게 말해 본다 | 놀이를 또렷하게 빠르게 말해 본다 | 타워를 또렷하게 빠르게 말해 본다 | 공원를 또렷하게 빠르게 말해 본다 | 대구를 또렷하게 빠르게 말해 본다

### 5-high-3 - 납작만두
- gameType: tetris
- tier: high
- preview: 납작만두, 대구, 명소, 풍경
- wordPool: 납작만두, 대구, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 납작만두 핵심어 줄 완성

### 5-high-4 - 약령시
- gameType: balloon
- tier: high
- preview: 약령, 한약, 시장, 향
- cueWords: 약령, 한약, 시장, 향, 약재, 상점, 전통, 대구
- guideText: 약령시 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 5-high-5 - 대구 FINAL
- gameType: sentence_build
- tier: high
- preview: 대구는 산과 거리, 시장과 축제, 먹거리가 함께 살아 있는 도시다, 우리는 대구의 활기와 풍경을 긴 문장으로도 정확하게 읽을 수 있다
- promptPool: 대구는 산과 거리, 시장과 축제, 먹거리가 함께 살아 있는 도시다 | 우리는 대구의 활기와 풍경을 긴 문장으로도 정확하게 읽을 수 있다 | 팔공산부터 약령시까지 대구의 장면은 매우 다채롭다 | 대구 FINAL은 장소와 음식, 축제 발화를 모두 종합하는 단계다 | 대구의 말소리 목표를 끝까지 유지하며 문장을 완성한다

## Stage 6 - 전주

### 6-low-1 - 한옥마을
- gameType: tetris
- tier: low
- preview: 한옥, 골목, 기와, 길
- wordPool: 한옥, 골목, 기와, 길, 담장, 한복, 사진, 마을, 전통, 체험, 산책, 전주, 간판, 찻집, 지붕, 대문, 풍경, 나들이, 마당, 거리
- clearCondition: 한옥 단어와 거리 단어를 맞춰 줄 완성

### 6-low-2 - 비빔밥
- gameType: balloon
- tier: low
- preview: 비빔, 밥, 전주
- cueWords: 비빔밥, 비빔, 밥, 전주, 한식
- guideText: 비빔밥 핵심어를 일정한 음량으로 유지하는 발성 노드

### 6-low-3 - 경기전
- gameType: memory
- tier: low
- preview: 경기전, 전주, 명소
- hintPool: 경기전은 전주의 장소다 | 경기전에서 전주의 분위기기를 느낄 수 있다 | 전주을 떠올릴 때 함께 생각나는 핵심어다 | 경기전이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 경기전, 전주, 명소

### 6-low-4 - 전동성당
- gameType: tongue_twister
- tier: low
- preview: 성당, 벽돌, 종, 광장
- promptPool: 성당 성당를 빠르게 이어 말해 본다 | 벽돌 벽돌를 빠르게 이어 말해 본다 | 종 종를 빠르게 이어 말해 본다 | 광장 광장를 빠르게 이어 말해 본다 | 건물 건물를 빠르게 이어 말해 본다 | 전주 전주를 빠르게 이어 말해 본다

### 6-low-5 - 전주 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 한옥마을과 비빔밥은 전주를 대표한다, 경기전과 전동성당은 전주의 전통 분위기를 만든다
- promptPool: 한옥마을과 비빔밥은 전주를 대표한다 | 경기전과 전동성당은 전주의 전통 분위기를 만든다 | 전주 하 단계에서는 전통 거리와 음식 이름을 익힌다 | 우리는 전주의 기본 명소와 먹거리를 또렷하게 말한다 | 전주는 맛과 전통이 함께 떠오르는 도시다

### 6-mid-1 - 오목대
- gameType: tetris
- tier: mid
- preview: 오목대, 전주, 명소, 풍경
- wordPool: 오목대, 전주, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 오목대 핵심어 줄 완성

### 6-mid-2 - 남부시장
- gameType: balloon
- tier: mid
- preview: 시장, 야식, 청년, 골목
- cueWords: 시장, 야식, 청년, 골목, 분식, 가게, 전주, 먹거리
- guideText: 남부시장 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 6-mid-3 - 전주천
- gameType: memory
- tier: mid
- preview: 전주천, 천, 전주, 명소
- hintPool: 전주천은 전주의 장소다 | 전주천에서 전주의 분위기기를 느낄 수 있다 | 전주을 떠올릴 때 함께 생각나는 핵심어다 | 전주천이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 전주천, 천, 전주, 명소

### 6-mid-4 - 한지
- gameType: tongue_twister
- tier: mid
- preview: 한지, 종이, 공예
- promptPool: 한지를 또렷하게 빠르게 말해 본다 | 종이를 또렷하게 빠르게 말해 본다 | 공예를 또렷하게 빠르게 말해 본다 | 전통를 또렷하게 빠르게 말해 본다 | 전주를 또렷하게 빠르게 말해 본다

### 6-mid-5 - 전주 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 오목대와 남부시장은 전주의 다양한 분위기를 보여 준다, 전주천과 한지는 전주의 생활과 전통을 함께 느끼게 한다
- promptPool: 오목대와 남부시장은 전주의 다양한 분위기를 보여 준다 | 전주천과 한지는 전주의 생활과 전통을 함께 느끼게 한다 | 전주 중 단계에서는 시장과 산책길, 공예 단어를 함께 읽는다 | 우리는 전주의 확장 이미지를 조금 더 길게 말할 수 있다 | 전주 중 FINAL은 도시 확장 구간을 정리하는 문장 노드다

### 6-high-1 - 풍남문
- gameType: tetris
- tier: high
- preview: 풍남, 문, 성문, 야경
- wordPool: 풍남, 문, 성문, 야경, 조명, 전주, 역사, 돌길, 광장, 산책, 관광, 문루, 사진, 하늘, 전통, 풍경, 성벽, 불빛, 고도, 밤길
- clearCondition: 성문 단어와 야경 단어를 모아 줄 완성

### 6-high-2 - 콩나물국밥
- gameType: balloon
- tier: high
- preview: 국밥, 콩나물, 전주
- cueWords: 국밥, 콩나물, 콩, 밥, 전주
- guideText: 콩나물국밥 핵심어를 일정한 음량으로 유지하는 발성 노드

### 6-high-3 - 모주
- gameType: memory
- tier: high
- preview: 모주, 전주, 명소
- hintPool: 모주은 전주의 장소다 | 모주에서 전주의 분위기기를 느낄 수 있다 | 전주을 떠올릴 때 함께 생각나는 핵심어다 | 모주이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 모주, 전주, 명소

### 6-high-4 - 소리축제
- gameType: tongue_twister
- tier: high
- preview: 소리, 축제, 무대, 공연
- promptPool: 소리 소리를 빠르게 이어 말해 본다 | 축제 축제를 빠르게 이어 말해 본다 | 무대 무대를 빠르게 이어 말해 본다 | 공연 공연를 빠르게 이어 말해 본다 | 판소리 판소리를 빠르게 이어 말해 본다 | 전주 전주를 빠르게 이어 말해 본다

### 6-high-5 - 전주 FINAL
- gameType: sentence_build
- tier: high
- preview: 전주는 한옥과 먹거리, 전통 예술이 함께 살아 있는 도시다, 우리는 전주의 맛과 전통 이미지를 긴 문장으로도 읽을 수 있다
- promptPool: 전주는 한옥과 먹거리, 전통 예술이 함께 살아 있는 도시다 | 우리는 전주의 맛과 전통 이미지를 긴 문장으로도 읽을 수 있다 | 한옥마을부터 소리축제까지 전주의 장면은 매우 뚜렷하다 | 전주 FINAL은 전통 거리와 음식, 공예와 축제 발화를 종합하는 노드다 | 전주는 한국적인 분위기를 선명하게 보여 주는 도시다

## Stage 7 - 광주

### 7-low-1 - 무등산
- gameType: tongue_twister
- tier: low
- preview: 무등, 산, 길, 숲
- promptPool: 무등 무등를 빠르게 이어 말해 본다 | 산 산를 빠르게 이어 말해 본다 | 길 길를 빠르게 이어 말해 본다 | 숲 숲를 빠르게 이어 말해 본다 | 바람 바람를 빠르게 이어 말해 본다 | 바위 바위를 빠르게 이어 말해 본다

### 7-low-2 - 5·18
- gameType: tetris
- tier: low
- preview: 5·18, 광주, 명소, 풍경
- wordPool: 5·18, 광주, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 5·18 핵심어 줄 완성

### 7-low-3 - 비엔날레
- gameType: memory
- tier: low
- preview: 비엔날레, 광주, 명소
- hintPool: 비엔날레은 광주의 장소다 | 비엔날레에서 광주의 분위기기를 느낄 수 있다 | 광주을 떠올릴 때 함께 생각나는 핵심어다 | 비엔날레이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 비엔날레, 광주, 명소

### 7-low-4 - 양림동
- gameType: balloon
- tier: low
- preview: 양림, 골목, 카페, 벽화
- cueWords: 양림, 골목, 카페, 벽화, 산책, 거리, 풍경, 건물
- guideText: 양림동 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 7-low-5 - 광주 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 무등산과 5·18은 광주의 자연과 역사를 함께 보여 준다, 비엔날레와 양림동은 광주의 문화 이미지를 만든다
- promptPool: 무등산과 5·18은 광주의 자연과 역사를 함께 보여 준다 | 비엔날레와 양림동은 광주의 문화 이미지를 만든다 | 광주 하 단계에서는 산과 역사, 예술과 골목 이름을 익힌다 | 우리는 광주의 기본 이미지를 또렷하게 읽는다 | 광주는 예술과 기억이 함께 떠오르는 도시다

### 7-mid-1 - 아시아문화전당
- gameType: tongue_twister
- tier: mid
- preview: 전당, 문화, 아시아
- promptPool: 전당를 또렷하게 빠르게 말해 본다 | 문화를 또렷하게 빠르게 말해 본다 | 아시아를 또렷하게 빠르게 말해 본다 | 광주를 또렷하게 빠르게 말해 본다 | ACC를 또렷하게 빠르게 말해 본다

### 7-mid-2 - 상추튀김
- gameType: tetris
- tier: mid
- preview: 상추, 튀김, 분식, 광주
- wordPool: 상추, 튀김, 분식, 광주, 간식, 소스, 떡볶이, 시장, 바삭, 맛집, 친구, 저녁, 메뉴, 먹방, 포장, 가게, 골목, 밥상, 추억, 별미
- clearCondition: 분식 단어와 먹거리 단어를 조합해 줄 완성

### 7-mid-3 - 충장로
- gameType: memory
- tier: mid
- preview: 충장로, 광주, 명소
- hintPool: 충장로은 광주의 장소다 | 충장로에서 광주의 분위기기를 느낄 수 있다 | 광주을 떠올릴 때 함께 생각나는 핵심어다 | 충장로이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 충장로, 광주, 명소

### 7-mid-4 - 김치축제
- gameType: balloon
- tier: mid
- preview: 김치, 축제, 광주
- cueWords: 김치, 축제, 광주, 행사, 김장
- guideText: 김치축제 핵심어를 일정한 음량으로 유지하는 발성 노드

### 7-mid-5 - 광주 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 문화전당과 충장로는 광주의 현재 분위기를 보여 준다, 상추튀김과 김치축제는 광주의 먹거리 이미지를 넓혀 준다
- promptPool: 문화전당과 충장로는 광주의 현재 분위기를 보여 준다 | 상추튀김과 김치축제는 광주의 먹거리 이미지를 넓혀 준다 | 광주 중 단계에서는 문화 공간과 번화가, 축제를 함께 읽는다 | 우리는 광주의 확장 이미지를 더 길게 말할 수 있다 | 광주 중 FINAL은 도시 확장 구간을 정리하는 노드다

### 7-high-1 - 펭귄마을
- gameType: tongue_twister
- tier: high
- preview: 펭귄, 마을, 골목, 소품
- promptPool: 펭귄 펭귄를 빠르게 이어 말해 본다 | 마을 마을를 빠르게 이어 말해 본다 | 골목 골목를 빠르게 이어 말해 본다 | 소품 소품를 빠르게 이어 말해 본다 | 감성 감성를 빠르게 이어 말해 본다 | 사진 사진를 빠르게 이어 말해 본다

### 7-high-2 - 빛고을
- gameType: tetris
- tier: high
- preview: 빛고을, 광주, 명소, 풍경
- wordPool: 빛고을, 광주, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 빛고을 핵심어 줄 완성

### 7-high-3 - 예술의거리
- gameType: memory
- tier: high
- preview: 예술의거리, 거리, 광주, 명소
- hintPool: 예술의거리은 광주의 장소다 | 예술의거리에서 광주의 분위기기를 느낄 수 있다 | 광주을 떠올릴 때 함께 생각나는 핵심어다 | 예술의거리이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 예술의거리, 거리, 광주, 명소

### 7-high-4 - 광주천
- gameType: balloon
- tier: high
- preview: 광주, 천, 산책, 물길
- cueWords: 광주, 천, 산책, 물길, 다리, 도심, 바람, 야경
- guideText: 광주천 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 7-high-5 - 광주 FINAL
- gameType: sentence_build
- tier: high
- preview: 광주는 역사와 예술, 먹거리와 빛의 이미지를 함께 가진 도시다, 우리는 광주의 다양한 장면을 긴 문장으로도 분명하게 읽을 수 있다
- promptPool: 광주는 역사와 예술, 먹거리와 빛의 이미지를 함께 가진 도시다 | 우리는 광주의 다양한 장면을 긴 문장으로도 분명하게 읽을 수 있다 | 무등산부터 빛고을까지 광주의 정체성은 매우 뚜렷하다 | 광주 FINAL은 역사와 문화, 거리와 먹거리 발화를 종합하는 노드다 | 광주의 말소리 목표를 끝까지 유지하며 문장을 완성한다

## Stage 8 - 여수

### 8-low-1 - 여수밤바다
- gameType: memory
- tier: low
- preview: 여수밤바다, 여수, 명소
- hintPool: 여수밤바다은 여수의 장소다 | 여수밤바다에서 여수의 분위기기를 느낄 수 있다 | 여수을 떠올릴 때 함께 생각나는 핵심어다 | 여수밤바다이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 여수밤바다, 여수, 명소

### 8-low-2 - 오동도
- gameType: balloon
- tier: low
- preview: 오동, 섬, 여수
- cueWords: 오동도, 오동, 섬, 여수, 동백
- guideText: 오동도 핵심어를 일정한 음량으로 유지하는 발성 노드

### 8-low-3 - 향일암
- gameType: tongue_twister
- tier: low
- preview: 향일암은 여수의 일출 명소다, 우리는 향일암에서 바다를 본다
- promptPool: 향일암은 여수의 일출 명소다 | 우리는 향일암에서 바다를 본다 | 향일암 길은 조용하고 맑다 | 여수의 절경은 향일암과 함께 떠오른다 | 향일암 노드는 바다 풍경 문장을 또렷하게 읽는 단계다

### 8-low-4 - 돌산공원
- gameType: tetris
- tier: low
- preview: 돌산, 공원, 전망, 케이블
- wordPool: 돌산, 공원, 전망, 케이블, 야경, 다리, 바람, 산책, 사진, 도시, 불빛, 노을, 여수, 타워, 바다, 공원길, 포토, 휴식, 풍경, 야간
- clearCondition: 전망 단어와 공원 단어를 조합해 줄 완성

### 8-low-5 - 여수 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 여수밤바다와 오동도는 여수의 낭만을 보여 준다, 향일암과 돌산공원은 여수의 바다 풍경을 넓혀 준다
- promptPool: 여수밤바다와 오동도는 여수의 낭만을 보여 준다 | 향일암과 돌산공원은 여수의 바다 풍경을 넓혀 준다 | 여수 하 단계에서는 바다와 섬, 전망 이름을 익힌다 | 우리는 여수의 기본 이미지를 또렷하게 읽는다 | 여수는 밤바다와 낭만이 함께 떠오르는 도시다

### 8-mid-1 - 해상케이블카
- gameType: memory
- tier: mid
- preview: 케이블, 해상, 여수
- hintPool: 여수 바다 위를 지나가는 대표 체험 시설이다 | 돌산과 바다 풍경을 함께 즐기는 탈것이다 | 여수에서 높은 곳에서 바다를 보는 이미지가 강하다 | 케이블카라는 말이 직접 들어가는 여수 명소다
- answerPool: 케이블, 해상, 여수, 카, 바다

### 8-mid-2 - 갓김치
- gameType: balloon
- tier: mid
- preview: 갓김치, 갓, 김치, 반찬
- cueWords: 갓김치, 갓, 김치, 반찬, 맛집, 여수, 매콤, 식탁
- guideText: 갓김치 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 8-mid-3 - 이순신광장
- gameType: tongue_twister
- tier: mid
- preview: 이순신광장은 여수의 중심 광장이다, 여수 여행에서는 이순신광장을 자주 지난다
- promptPool: 이순신광장은 여수의 중심 광장이다 | 여수 여행에서는 이순신광장을 자주 지난다 | 광장 주변에는 먹거리와 바다 풍경이 함께 있다 | 이순신광장 노드는 중간 길이 장소 문장을 읽는 단계다 | 여수 도심 이미지는 광장과 함께 기억되기 쉽다

### 8-mid-4 - 엑스포
- gameType: tetris
- tier: mid
- preview: 엑스포, 여수, 명소, 풍경
- wordPool: 엑스포, 여수, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 엑스포 핵심어 줄 완성

### 8-mid-5 - 여수 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 해상케이블카와 이순신광장은 여수의 확장된 이미지를 보여 준다, 갓김치와 엑스포는 여수의 먹거리와 현대 이미지를 함께 만든다
- promptPool: 해상케이블카와 이순신광장은 여수의 확장된 이미지를 보여 준다 | 갓김치와 엑스포는 여수의 먹거리와 현대 이미지를 함께 만든다 | 여수 중 단계에서는 체험과 광장, 행사 이름을 함께 읽는다 | 우리는 여수의 확장 이미지를 더 길게 말할 수 있다 | 여수 중 FINAL은 도시 확장 구간을 정리하는 문장 노드다

### 8-high-1 - 돌게장
- gameType: memory
- tier: high
- preview: 돌게장, 여수, 명소
- hintPool: 돌게장은 여수의 장소다 | 돌게장에서 여수의 분위기기를 느낄 수 있다 | 여수을 떠올릴 때 함께 생각나는 핵심어다 | 돌게장이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 돌게장, 여수, 명소

### 8-high-2 - 서시장
- gameType: balloon
- tier: high
- preview: 서시장, 시장, 여수
- cueWords: 서시장, 시장, 여수, 장, 서
- guideText: 서시장 핵심어를 일정한 음량으로 유지하는 발성 노드

### 8-high-3 - 거북선대교
- gameType: tongue_twister
- tier: high
- preview: 거북선대교는 여수의 큰 다리 풍경이다, 여수의 다리 야경은 밤바다와 잘 어울린다
- promptPool: 거북선대교는 여수의 큰 다리 풍경이다 | 여수의 다리 야경은 밤바다와 잘 어울린다 | 거북선대교 노드는 ㄹ과 ㄱ, ㅅ 발화를 함께 읽는 단계다 | 여수의 도시 풍경은 다리와 바다로 완성된다 | 우리는 여수의 다리 이름도 길게 읽을 수 있다

### 8-high-4 - 장어구이
- gameType: tetris
- tier: high
- preview: 장어, 구이, 불, 식당
- wordPool: 장어, 구이, 불, 식당, 숯불, 맛집, 여수, 저녁, 바다, 별미, 양념, 식사, 한상, 연기, 주문, 포장, 반찬, 고소, 쌈, 밥
- clearCondition: 식당 단어와 음식 단어를 이어 줄 완성

### 8-high-5 - 여수 FINAL
- gameType: sentence_build
- tier: high
- preview: 여수는 밤바다와 섬, 다리와 먹거리가 함께 살아 있는 도시다, 우리는 여수의 낭만과 해양 이미지를 긴 문장으로 읽을 수 있다
- promptPool: 여수는 밤바다와 섬, 다리와 먹거리가 함께 살아 있는 도시다 | 우리는 여수의 낭만과 해양 이미지를 긴 문장으로 읽을 수 있다 | 오동도부터 거북선대교까지 여수의 장면은 매우 선명하다 | 여수 FINAL은 바다 풍경과 먹거리, 광장과 행사 발화를 종합하는 노드다 | 여수의 말소리 목표를 끝까지 유지하며 문장을 완성한다

## Stage 9 - 강릉

### 9-low-1 - 경포대
- gameType: tetris
- tier: low
- preview: 경포, 바다, 정자, 바람
- wordPool: 경포, 바다, 정자, 바람, 모래, 파도, 호수, 산책, 해변, 일출, 강릉, 노을, 솔숲, 풍경, 휴식, 하늘, 물빛, 여행, 바닷길, 포토
- clearCondition: 바다 단어와 풍경 단어를 모아 줄 완성

### 9-low-2 - 정동진
- gameType: tongue_twister
- tier: low
- preview: 정동진, 해돋이, 역
- promptPool: 정동진를 또렷하게 빠르게 말해 본다 | 해돋이를 또렷하게 빠르게 말해 본다 | 역를 또렷하게 빠르게 말해 본다 | 일출를 또렷하게 빠르게 말해 본다 | 강릉를 또렷하게 빠르게 말해 본다

### 9-low-3 - 오죽헌
- gameType: memory
- tier: low
- preview: 오죽헌, 강릉, 명소
- hintPool: 오죽헌은 강릉의 장소다 | 오죽헌에서 강릉의 분위기기를 느낄 수 있다 | 강릉을 떠올릴 때 함께 생각나는 핵심어다 | 오죽헌이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 오죽헌, 강릉, 명소

### 9-low-4 - 커피거리
- gameType: balloon
- tier: low
- preview: 커피, 거리, 향, 카페
- cueWords: 커피, 거리, 향, 카페, 머그, 로스팅, 잔, 바다
- guideText: 커피거리 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 9-low-5 - 강릉 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 경포대와 정동진은 강릉의 바다 이미지를 대표한다, 오죽헌과 커피거리는 강릉의 문화와 감성을 함께 보여 준다
- promptPool: 경포대와 정동진은 강릉의 바다 이미지를 대표한다 | 오죽헌과 커피거리는 강릉의 문화와 감성을 함께 보여 준다 | 강릉 하 단계에서는 바다와 역사, 커피 이미지를 익힌다 | 우리는 강릉의 기본 장소를 또렷하게 읽는다 | 강릉은 동해와 감성이 함께 떠오르는 도시다

### 9-mid-1 - 안목해변
- gameType: tetris
- tier: mid
- preview: 안목해변, 강릉, 명소, 풍경
- wordPool: 안목해변, 해변, 강릉, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 안목해변 핵심어 줄 완성

### 9-mid-2 - 초당두부
- gameType: tongue_twister
- tier: mid
- preview: 두부, 초당, 식당, 강릉
- promptPool: 두부 두부를 빠르게 이어 말해 본다 | 초당 초당를 빠르게 이어 말해 본다 | 식당 식당를 빠르게 이어 말해 본다 | 강릉 강릉를 빠르게 이어 말해 본다 | 순두부 순두부를 빠르게 이어 말해 본다 | 반찬 반찬를 빠르게 이어 말해 본다

### 9-mid-3 - 단오제
- gameType: memory
- tier: mid
- preview: 단오제, 강릉, 명소
- hintPool: 단오제은 강릉의 장소다 | 단오제에서 강릉의 분위기기를 느낄 수 있다 | 강릉을 떠올릴 때 함께 생각나는 핵심어다 | 단오제이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 단오제, 강릉, 명소

### 9-mid-4 - 주문진
- gameType: balloon
- tier: mid
- preview: 주문진, 항구, 시장
- cueWords: 주문진, 항구, 시장, 강릉, 바다
- guideText: 주문진 핵심어를 일정한 음량으로 유지하는 발성 노드

### 9-mid-5 - 강릉 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 안목해변과 단오제는 강릉의 감성과 전통을 함께 보여 준다, 초당두부와 주문진은 강릉의 생활과 먹거리 이미지를 넓혀 준다
- promptPool: 안목해변과 단오제는 강릉의 감성과 전통을 함께 보여 준다 | 초당두부와 주문진은 강릉의 생활과 먹거리 이미지를 넓혀 준다 | 강릉 중 단계에서는 해변과 음식, 축제와 항구 이름을 함께 읽는다 | 우리는 강릉의 확장 이미지를 더 길게 말할 수 있다 | 강릉 중 FINAL은 도시 확장 구간을 정리하는 문장 노드다

### 9-high-1 - 강문해변
- gameType: tetris
- tier: high
- preview: 강문, 해변, 파도, 모래
- wordPool: 강문, 해변, 파도, 모래, 산책, 강릉, 야경, 카페, 바람, 노을, 서핑, 물빛, 휴식, 사진, 발자국, 해안, 포토, 파랑, 나들이, 풍경
- clearCondition: 해변 단어와 파도 단어를 모아 줄 완성

### 9-high-2 - 선교장
- gameType: tongue_twister
- tier: high
- preview: 선교장, 고택, 강릉
- promptPool: 선교장를 또렷하게 빠르게 말해 본다 | 고택를 또렷하게 빠르게 말해 본다 | 한옥를 또렷하게 빠르게 말해 본다 | 강릉를 또렷하게 빠르게 말해 본다 | 집를 또렷하게 빠르게 말해 본다

### 9-high-3 - 커피
- gameType: memory
- tier: high
- preview: 커피, 강릉, 명소
- hintPool: 커피은 강릉의 장소다 | 커피에서 강릉의 분위기기를 느낄 수 있다 | 강릉을 떠올릴 때 함께 생각나는 핵심어다 | 커피이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 커피, 강릉, 명소

### 9-high-4 - 바다열차
- gameType: balloon
- tier: high
- preview: 열차, 바다, 창, 여행
- cueWords: 열차, 바다, 창, 여행, 강릉, 레일, 풍경, 좌석
- guideText: 바다열차 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 9-high-5 - 강릉 FINAL
- gameType: sentence_build
- tier: high
- preview: 강릉은 바다와 커피, 전통과 축제가 함께 있는 도시다, 우리는 강릉의 감성과 동해 이미지를 긴 문장으로 읽을 수 있다
- promptPool: 강릉은 바다와 커피, 전통과 축제가 함께 있는 도시다 | 우리는 강릉의 감성과 동해 이미지를 긴 문장으로 읽을 수 있다 | 경포대부터 바다열차까지 강릉의 장면은 매우 선명하다 | 강릉 FINAL은 해변과 음식, 축제와 전통 발화를 종합하는 노드다 | 강릉의 말소리 목표를 끝까지 유지하며 문장을 완성한다

## Stage 10 - 춘천

### 10-low-1 - 남이섬
- gameType: balloon
- tier: low
- preview: 남이, 섬, 나무, 길
- cueWords: 남이, 섬, 나무, 길, 산책, 연인, 가을, 단풍
- guideText: 남이섬 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 10-low-2 - 닭갈비
- gameType: memory
- tier: low
- preview: 닭갈비, 닭, 춘천
- hintPool: 춘천을 대표하는 가장 유명한 음식이다 | 철판과 매운 양념 이미지가 떠오르는 춘천 메뉴다 | 춘천 여행에서 꼭 먹는 음식으로 자주 말한다 | 닭과 갈비라는 소리가 함께 들어가는 춘천 음식이다
- answerPool: 닭갈비, 닭, 갈비, 춘천, 철판

### 10-low-3 - 막국수
- gameType: tetris
- tier: low
- preview: 막국수, 춘천, 명소, 풍경
- wordPool: 막국수, 춘천, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 막국수 핵심어 줄 완성

### 10-low-4 - 소양강
- gameType: tongue_twister
- tier: low
- preview: 소양, 강, 다리, 물
- promptPool: 소양 소양를 빠르게 이어 말해 본다 | 강 강를 빠르게 이어 말해 본다 | 다리 다리를 빠르게 이어 말해 본다 | 물 물를 빠르게 이어 말해 본다 | 호수 호수를 빠르게 이어 말해 본다 | 바람 바람를 빠르게 이어 말해 본다

### 10-low-5 - 춘천 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 남이섬과 소양강은 춘천의 물과 자연 이미지를 보여 준다, 닭갈비와 막국수는 춘천 먹거리의 대표다
- promptPool: 남이섬과 소양강은 춘천의 물과 자연 이미지를 보여 준다 | 닭갈비와 막국수는 춘천 먹거리의 대표다 | 춘천 하 단계에서는 섬과 강, 대표 음식 이름을 익힌다 | 우리는 춘천의 기본 이미지를 또렷하게 읽는다 | 춘천은 호반 도시의 여유가 느껴지는 곳이다

### 10-mid-1 - 의암호
- gameType: balloon
- tier: mid
- preview: 의암, 호, 호수
- cueWords: 의암호, 의암, 호수, 호, 춘천
- guideText: 의암호 핵심어를 일정한 음량으로 유지하는 발성 노드

### 10-mid-2 - 강촌
- gameType: memory
- tier: mid
- preview: 강촌, 춘천, 명소
- hintPool: 강촌은 춘천의 장소다 | 강촌에서 춘천의 분위기기를 느낄 수 있다 | 춘천을 떠올릴 때 함께 생각나는 핵심어다 | 강촌이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 강촌, 춘천, 명소

### 10-mid-3 - 공지천
- gameType: tetris
- tier: mid
- preview: 공지천, 춘천, 명소, 풍경
- wordPool: 공지천, 천, 춘천, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 공지천 핵심어 줄 완성

### 10-mid-4 - 마임축제
- gameType: tongue_twister
- tier: mid
- preview: 마임, 축제, 춘천
- promptPool: 마임를 또렷하게 빠르게 말해 본다 | 축제를 또렷하게 빠르게 말해 본다 | 춘천를 또렷하게 빠르게 말해 본다 | 행사를 또렷하게 빠르게 말해 본다 | 공연를 또렷하게 빠르게 말해 본다

### 10-mid-5 - 춘천 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 의암호와 공지천은 춘천의 물길 이미지를 넓혀 준다, 강촌과 마임축제는 춘천의 여행과 문화 이미지를 더해 준다
- promptPool: 의암호와 공지천은 춘천의 물길 이미지를 넓혀 준다 | 강촌과 마임축제는 춘천의 여행과 문화 이미지를 더해 준다 | 춘천 중 단계에서는 호수와 여행, 축제 이름을 함께 읽는다 | 우리는 춘천의 확장 이미지를 더 길게 말할 수 있다 | 춘천 중 FINAL은 도시 확장 구간을 정리하는 문장 노드다

### 10-high-1 - 삼악산
- gameType: balloon
- tier: high
- preview: 삼악, 산, 케이블, 전망
- cueWords: 삼악, 산, 케이블, 전망, 호수, 춘천, 산책, 정상
- guideText: 삼악산 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 10-high-2 - 레고랜드
- gameType: memory
- tier: high
- preview: 레고, 놀이, 춘천
- hintPool: 춘천의 가족형 테마 공간으로 자주 떠오르는 장소다 | 블록과 놀이기구 이미지가 함께 있는 공간이다 | 춘천의 새로운 관광 이미지로 자주 말한다 | 레고라는 짧은 소리가 직접 들어가는 춘천 명소다
- answerPool: 레고, 놀이, 춘천, 랜드, 공원

### 10-high-3 - 호반
- gameType: tetris
- tier: high
- preview: 호반, 춘천, 명소, 풍경
- wordPool: 호반, 춘천, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 호반 핵심어 줄 완성

### 10-high-4 - 감자빵
- gameType: tongue_twister
- tier: high
- preview: 감자, 빵, 간식, 춘천
- promptPool: 감자 감자를 빠르게 이어 말해 본다 | 빵 빵를 빠르게 이어 말해 본다 | 간식 간식를 빠르게 이어 말해 본다 | 춘천 춘천를 빠르게 이어 말해 본다 | 맛집 맛집를 빠르게 이어 말해 본다 | 포장 포장를 빠르게 이어 말해 본다

### 10-high-5 - 춘천 FINAL
- gameType: sentence_build
- tier: high
- preview: 춘천은 호수와 섬, 여행과 먹거리가 함께 살아 있는 도시다, 우리는 춘천의 여유로운 이미지를 긴 문장으로 읽을 수 있다
- promptPool: 춘천은 호수와 섬, 여행과 먹거리가 함께 살아 있는 도시다 | 우리는 춘천의 여유로운 이미지를 긴 문장으로 읽을 수 있다 | 남이섬부터 감자빵까지 춘천의 장면은 매우 또렷하다 | 춘천 FINAL은 자연과 여행, 축제와 먹거리 발화를 종합하는 노드다 | 춘천의 말소리 목표를 끝까지 유지하며 문장을 완성한다

## Stage 11 - 안동

### 11-low-1 - 하회마을
- gameType: memory
- tier: low
- preview: 하회마을, 마을, 안동, 명소
- hintPool: 하회마을은 안동의 장소다 | 하회마을에서 안동의 분위기기를 느낄 수 있다 | 안동을 떠올릴 때 함께 생각나는 핵심어다 | 하회마을이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 하회마을, 마을, 안동, 명소

### 11-low-2 - 도산서원
- gameType: tetris
- tier: low
- preview: 도산서원, 안동, 명소, 풍경
- wordPool: 도산서원, 서원, 산, 안동, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 도산서원 핵심어 줄 완성

### 11-low-3 - 안동찜닭
- gameType: tongue_twister
- tier: low
- preview: 안동찜닭은 안동의 대표 음식이다, 우리는 안동찜닭을 떠올리며 문장을 읽는다
- promptPool: 안동찜닭은 안동의 대표 음식이다 | 우리는 안동찜닭을 떠올리며 문장을 읽는다 | 안동 먹거리 이미지는 찜닭과 함께 강하게 남는다 | 안동찜닭 노드는 음식 문장을 또렷하게 읽는 단계다 | 안동의 맛과 전통은 함께 기억되기 쉽다

### 11-low-4 - 탈춤
- gameType: balloon
- tier: low
- preview: 탈춤, 가면, 축제, 춤
- cueWords: 탈춤, 가면, 축제, 춤, 무대, 공연, 안동, 전통
- guideText: 탈춤 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 11-low-5 - 안동 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 하회마을과 도산서원은 안동의 전통을 보여 준다, 안동찜닭과 탈춤은 안동의 맛과 문화를 대표한다
- promptPool: 하회마을과 도산서원은 안동의 전통을 보여 준다 | 안동찜닭과 탈춤은 안동의 맛과 문화를 대표한다 | 안동 하 단계에서는 전통 마을과 음식, 공연 이름을 익힌다 | 우리는 안동의 기본 이미지를 또렷하게 읽는다 | 안동은 유교 문화와 탈춤의 도시다

### 11-mid-1 - 봉정사
- gameType: memory
- tier: mid
- preview: 봉정, 절, 안동
- hintPool: 안동의 오래된 사찰이다 | 전통 건축과 산속 분위기가 떠오르는 안동 장소다 | 고즈넉한 절집 이미지를 가진 안동 유산이다 | 봉이라는 소리로 시작하는 안동 사찰 이름이다
- answerPool: 봉정, 절, 안동, 사찰, 절집

### 11-mid-2 - 월영교
- gameType: tetris
- tier: mid
- preview: 월영, 다리, 야경, 빛
- wordPool: 월영, 다리, 야경, 빛, 반영, 호수, 산책, 안동, 노을, 조명, 밤길, 풍경, 다리길, 사진, 연인, 물빛, 달빛, 전망, 휴식, 불빛
- clearCondition: 다리 단어와 야경 단어를 맞춰 줄 완성

### 11-mid-3 - 안동소주
- gameType: tongue_twister
- tier: mid
- preview: 안동소주는 안동의 전통 술로 유명하다, 안동의 맛 이야기에는 안동소주가 자주 나온다
- promptPool: 안동소주는 안동의 전통 술로 유명하다 | 안동의 맛 이야기에는 안동소주가 자주 나온다 | 안동소주 노드는 전통 먹거리 문장을 길게 읽는 단계다 | 안동의 이미지에는 음식과 술 문화도 함께 들어 있다 | 우리는 안동의 전통 먹거리 문장을 분명하게 읽는다

### 11-mid-4 - 간고등어
- gameType: balloon
- tier: mid
- preview: 고등어, 안동, 생선
- cueWords: 고등어, 간고등어, 생선, 안동, 구이
- guideText: 간고등어 핵심어를 일정한 음량으로 유지하는 발성 노드

### 11-mid-5 - 안동 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 봉정사와 월영교는 안동의 고즈넉한 분위기를 넓혀 준다, 안동소주와 간고등어는 안동 먹거리 이미지를 더해 준다
- promptPool: 봉정사와 월영교는 안동의 고즈넉한 분위기를 넓혀 준다 | 안동소주와 간고등어는 안동 먹거리 이미지를 더해 준다 | 안동 중 단계에서는 사찰과 다리, 술과 생선 이름을 함께 읽는다 | 우리는 안동의 확장 이미지를 더 길게 말할 수 있다 | 안동 중 FINAL은 도시 확장 구간을 정리하는 문장 노드다

### 11-high-1 - 병산서원
- gameType: memory
- tier: high
- preview: 병산서원, 서원, 산, 안동
- hintPool: 병산서원은 안동의 장소다 | 병산서원에서 안동의 분위기기를 느낄 수 있다 | 안동을 떠올릴 때 함께 생각나는 핵심어다 | 병산서원이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 병산서원, 서원, 산, 안동, 명소

### 11-high-2 - 유교문화
- gameType: tetris
- tier: high
- preview: 유교문화, 안동, 명소, 풍경
- wordPool: 유교문화, 문, 안동, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 유교문화 핵심어 줄 완성

### 11-high-3 - 헛제삿밥
- gameType: tongue_twister
- tier: high
- preview: 헛제삿밥은 안동의 독특한 음식이다, 안동 먹거리 문장에는 헛제삿밥도 자주 나온다
- promptPool: 헛제삿밥은 안동의 독특한 음식이다 | 안동 먹거리 문장에는 헛제삿밥도 자주 나온다 | 헛제삿밥 노드는 ㅅ과 ㅂ 발화를 또렷하게 읽는 심화 단계다 | 안동의 음식 이미지는 전통 문화와 함께 기억된다 | 우리는 안동의 긴 음식 이름도 분명하게 말할 수 있다

### 11-high-4 - 민속촌
- gameType: balloon
- tier: high
- preview: 민속, 촌, 체험, 전통
- cueWords: 민속, 촌, 체험, 전통, 안동, 한옥, 놀이, 공연
- guideText: 민속촌 핵심어를 안정적으로 발성하며 풍선을 키우는 노드

### 11-high-5 - 안동 FINAL
- gameType: sentence_build
- tier: high
- preview: 안동은 유교 문화와 전통 마을, 탈춤과 먹거리가 함께 살아 있는 도시다, 우리는 안동의 고즈넉한 이미지를 긴 문장으로 읽을 수 있다
- promptPool: 안동은 유교 문화와 전통 마을, 탈춤과 먹거리가 함께 살아 있는 도시다 | 우리는 안동의 고즈넉한 이미지를 긴 문장으로 읽을 수 있다 | 하회마을부터 민속촌까지 안동의 장면은 매우 선명하다 | 안동 FINAL은 전통 공간과 문화, 먹거리 발화를 종합하는 노드다 | 안동의 말소리 목표를 끝까지 유지하며 문장을 완성한다

## Stage 12 - 제주

### 12-low-1 - 한라산
- gameType: tetris
- tier: low
- preview: 한라, 산, 오름, 바람
- wordPool: 한라, 산, 오름, 바람, 구름, 정상, 등산, 제주, 자연, 풍경, 숲길, 휴식, 하늘, 노을, 사진, 길, 화산, 초원, 산책, 맑음
- clearCondition: 산 단어와 자연 단어를 모아 줄 완성

### 12-low-2 - 성산일출봉
- gameType: memory
- tier: low
- preview: 성산, 일출, 봉
- hintPool: 제주의 대표 일출 명소다 | 바다와 해돋이 이미지가 함께 떠오르는 제주 장소다 | 봉우리와 일출을 함께 말할 때 자주 나오는 제주의 이름이다 | 성산이라는 소리로 시작하는 제주 명소다
- answerPool: 성산, 일출, 봉, 제주, 해돋이

### 12-low-3 - 우도
- gameType: balloon
- tier: low
- preview: 우도는 제주 바다와 잘 어울리는 섬이다, 우리는 우도에서 맑은 바다를 본다
- cueWords: 우도는 제주 바다와 잘 어울리는 섬이다, 우리는 우도에서 맑은 바다를 본다, 우도 길은 조용하고 푸르다, 제주의 섬 이미지는 우도와 함께 선명해진다
- guideText: 우도 관련 문구를 안정적으로 발성하는 풍선 노드

### 12-low-4 - 협재해변
- gameType: tongue_twister
- tier: low
- preview: 협재, 해변, 모래, 바다
- promptPool: 협재 협재를 빠르게 이어 말해 본다 | 해변 해변를 빠르게 이어 말해 본다 | 모래 모래를 빠르게 이어 말해 본다 | 바다 바다를 빠르게 이어 말해 본다 | 물빛 물빛를 빠르게 이어 말해 본다 | 산책 산책를 빠르게 이어 말해 본다

### 12-low-5 - 제주 하 FINAL
- gameType: sentence_build
- tier: low
- preview: 한라산과 성산일출봉은 제주 자연의 상징이다, 우도와 협재해변은 제주 바다의 매력을 보여 준다
- promptPool: 한라산과 성산일출봉은 제주 자연의 상징이다 | 우도와 협재해변은 제주 바다의 매력을 보여 준다 | 제주 하 단계에서는 산과 섬, 해변 이름을 익힌다 | 우리는 제주의 기본 풍경 이미지를 또렷하게 읽는다 | 제주는 자연이 강하게 떠오르는 도시다

### 12-mid-1 - 흑돼지
- gameType: tetris
- tier: mid
- preview: 흑돼지, 제주, 명소, 풍경
- wordPool: 흑돼지, 제주, 명소, 풍경, 산책, 여행, 사진, 장면, 이야기, 도시
- clearCondition: 흑돼지 핵심어 줄 완성

### 12-mid-2 - 한라봉
- gameType: memory
- tier: mid
- preview: 한라봉, 제주, 명소
- hintPool: 한라봉은 제주의 장소다 | 한라봉에서 제주의 분위기기를 느낄 수 있다 | 제주을 떠올릴 때 함께 생각나는 핵심어다 | 한라봉이라는 말을 듣고 맞는 단어를 고라 본다
- answerPool: 한라봉, 제주, 명소

### 12-mid-3 - 만장굴
- gameType: balloon
- tier: mid
- preview: 만장굴은 제주의 대표 용암 동굴이다, 우리는 만장굴에서 제주의 화산 흔적을 본다
- cueWords: 만장굴은 제주의 대표 용암 동굴이다, 우리는 만장굴에서 제주의 화산 흔적을 본다, 만장굴 노드는 지질 문장을 길게 읽는 단계다, 제주의 화산 이미지는 동굴과 함께 더 선명해진다
- guideText: 만장굴 관련 문구를 안정적으로 발성하는 풍선 노드

### 12-mid-4 - 오름
- gameType: tongue_twister
- tier: mid
- preview: 오름, 제주, 언덕
- promptPool: 오름를 또렷하게 빠르게 말해 본다 | 제주를 또렷하게 빠르게 말해 본다 | 언덕를 또렷하게 빠르게 말해 본다 | 산를 또렷하게 빠르게 말해 본다 | 화산를 또렷하게 빠르게 말해 본다

### 12-mid-5 - 제주 중 FINAL
- gameType: sentence_build
- tier: mid
- preview: 흑돼지와 한라봉은 제주의 대표 먹거리다, 만장굴과 오름은 제주의 화산 이미지를 넓혀 준다
- promptPool: 흑돼지와 한라봉은 제주의 대표 먹거리다 | 만장굴과 오름은 제주의 화산 이미지를 넓혀 준다 | 제주 중 단계에서는 먹거리와 화산 지형 이름을 함께 읽는다 | 우리는 제주의 확장 이미지를 더 길게 말할 수 있다 | 제주 중 FINAL은 도시 확장 구간을 정리하는 문장 노드다

### 12-high-1 - 섭지코지
- gameType: tetris
- tier: high
- preview: 섭지, 코지, 해안, 바람
- wordPool: 섭지, 코지, 해안, 바람, 제주, 초원, 노을, 등대, 산책, 절벽, 풍경, 파도, 하늘, 사진, 물빛, 길, 해변, 바닷길, 야생, 여행
- clearCondition: 해안 단어와 풍경 단어를 맞춰 줄 완성

### 12-high-2 - 용두암
- gameType: memory
- tier: high
- preview: 용두, 암, 바위
- hintPool: 제주의 대표 바위 명소다 | 용 머리처럼 생긴 바위 이미지가 떠오르는 장소다 | 제주 공항 근처에서 자주 말하는 바닷가 명소다 | 바위라는 뜻이 담긴 제주의 유명한 이름이다
- answerPool: 용두암, 용두, 바위, 암, 제주

### 12-high-3 - 해녀
- gameType: balloon
- tier: high
- preview: 해녀는 제주의 상징적인 문화다, 우리는 해녀 문화를 떠올리며 문장을 읽는다
- cueWords: 해녀는 제주의 상징적인 문화다, 우리는 해녀 문화를 떠올리며 문장을 읽는다, 해녀 노드는 ㄴ과 ㄹ, ㅎ 발화를 또렷하게 읽는 심화 단계다, 제주의 바다 이미지는 해녀와 함께 더 깊어진다
- guideText: 해녀 관련 문구를 안정적으로 발성하는 풍선 노드

### 12-high-4 - 올레길
- gameType: tongue_twister
- tier: high
- preview: 올레, 길, 걷기, 제주
- promptPool: 올레 올레를 빠르게 이어 말해 본다 | 길 길를 빠르게 이어 말해 본다 | 걷기 걷기를 빠르게 이어 말해 본다 | 제주 제주를 빠르게 이어 말해 본다 | 바람 바람를 빠르게 이어 말해 본다 | 파도 파도를 빠르게 이어 말해 본다

### 12-high-5 - 제주 FINAL
- gameType: sentence_build
- tier: high
- preview: 제주는 화산과 바다, 먹거리와 문화가 함께 살아 있는 섬이다, 우리는 제주의 자연과 상징을 긴 문장으로 읽을 수 있다
- promptPool: 제주는 화산과 바다, 먹거리와 문화가 함께 살아 있는 섬이다 | 우리는 제주의 자연과 상징을 긴 문장으로 읽을 수 있다 | 한라산부터 올레길까지 제주의 장면은 매우 선명하다 | 제주 FINAL은 자연과 먹거리, 바다와 문화 발화를 종합하는 노드다 | 제주의 말소리 목표를 끝까지 유지하며 문장을 완성한다

