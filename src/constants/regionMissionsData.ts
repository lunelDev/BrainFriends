// src/constants/regionMissionsData.ts
//
// 신규 게임 모드 데이터 시스템 — "전국 한바퀴" 컨셉.
//
// 구조:
//   Region (권역)  →  City (도시) 2-3개  →  Mission (미션) 5개  →  Game data
//
// 기존 GAME_MODE_STAGE_NODE_PAYLOADS 와 공존한다. 점진적으로 컴포넌트가 신규
// 시스템을 사용하도록 마이그레이션할 때 기존 데이터 파일을 삭제 예정.
//
// Tier 시스템 폐지: 미션 1번부터 5번으로 갈수록 어려워지는 자연 난이도.
//
// 게임 종류 11종:
//   기존 7종: association_clear, word_select, word_assemble, tetris,
//             category_sort, sentence_build, balloon
//   신규 4종: dialect_repeat, place_name, kkutmal_ittgi, proverb_fill
//
// 디자이너 자원 0 — 모든 게임 데이터는 텍스트만 사용한다.
// 테트리스 게임 시각 디자인은 그대로 유지된다 (데이터만 새로 매핑).

import type { GameModeNodeGameType } from "@/constants/gameModeStagePayloads";

// ===== 신규 게임 타입 (기존 GameModeNodeGameType 확장 예정) =====
// 향후 GameModeNodeGameType 에 추가:
//   "dialect_repeat" | "place_name" | "kkutmal_ittgi" | "proverb_fill"
// 1차 단계에서는 별도 union 으로 다루고, 컴포넌트 마이그레이션 후 통합.
export type NewGameType =
  | "dialect_repeat"
  | "place_name"
  | "kkutmal_ittgi"
  | "proverb_fill";

export type RegionMissionGameType = GameModeNodeGameType | NewGameType;

// ===== 미션별 데이터 =====
// 게임 종류에 따라 필요한 필드만 채운다.
// 점진적 통합을 위해 모든 필드가 optional.

export type AssociationClearData = {
  // 장소 → 연상 단어
  promptPlace: string; // 예: "공원"
  answerWords: string[]; // 정답 단어들 (6-10개)
  distractorWords: string[]; // 방해 단어 (3-5개)
};

export type WordSelectData = {
  // 구체 명사 → 카테고리 발화
  promptWord: string; // 예: "돼지국밥"
  correctCategory: string; // 정답 카테고리 - 예: "음식"
  optionCategories: string[]; // 보기 카테고리들 (4-5개)
};

export type WordAssembleData = {
  // 음절 조각 → 단어 만들고 발화
  syllables: string[]; // 예: ["강","아","지","자","전","거"]
  answers: string[]; // 만들 수 있는 단어들 (정답)
};

export type TetrisData = {
  // 떨어지는 단어를 발화로 정리 (기존 시각 디자인 유지)
  wordPool: string[]; // 단어 풀
  previewWords?: string[]; // 미리보기용
  clearCondition?: string; // 안내 문구
};

export type CategorySortData = {
  // 단어 → 분류 슬롯에 배치
  slots: string[]; // 예: ["풍경", "먹거리", "활동", "사람"]
  items: Array<{
    word: string;
    correctSlot: string; // slots 배열의 값 중 하나
  }>;
};

export type SentenceBuildData = {
  // 핵심어 → 문장 만들기
  keywords: string[]; // 예: ["비", "오다", "길"]
  exampleAnswer?: string; // 예시 정답 문장 (참고용)
};

export type BalloonData = {
  // 발성 유지로 풍선 성장
  cueWords: string[]; // 발성할 음절·모음 (예: ["아","이","오"])
  guideText?: string;
};

export type DialectRepeatData = {
  // 사투리 따라하기 (신규)
  dialect: string; // 예: "마이묵으래이"
  standard: string; // 표준어 - 예: "많이 먹으렴"
  region: string; // 사투리 지역 - 예: "부산"
};

export type PlaceNameData = {
  // 지명 따라말하기 (신규)
  placeNames: string[]; // 예: ["광안리","해운대","자갈치"]
};

export type KkutMalIttgiData = {
  // 끝말잇기 (신규)
  startWord: string; // 시작 단어 - 예: "사과"
  // 사용자가 발화한 단어가 사전에 있는지 검증할 어휘 풀
  // (외부 사전 API 가 없을 때 폴백)
  fallbackVocabulary: string[];
  durationSec: number; // 제한 시간 - 보통 30-60
};

export type ProverbFillData = {
  // 속담 완성 (신규)
  proverbParts: string[]; // 속담을 단어로 분해 - 예: ["가는","말이","___","와야"]
  blankAnswers: string[]; // 빈칸 정답 후보들 (동의 표현 허용)
};

// ===== 미션 통합 타입 =====
export type MissionConfig = {
  id: string; // 예: "seoul-han-river-1"
  order: number; // 1-5 (난이도)
  gameType: RegionMissionGameType;
  title: string; // 미션 제목 (도시 + 게임 종류)
  description: string; // 한 줄 설명

  // 게임 종류별 데이터 (해당 종류에 맞는 것만 채움)
  associationClear?: AssociationClearData;
  wordSelect?: WordSelectData;
  wordAssemble?: WordAssembleData;
  tetris?: TetrisData;
  categorySort?: CategorySortData;
  sentenceBuild?: SentenceBuildData;
  balloon?: BalloonData;
  dialectRepeat?: DialectRepeatData;
  placeName?: PlaceNameData;
  kkutMalIttgi?: KkutMalIttgiData;
  proverbFill?: ProverbFillData;
};

export type CityConfig = {
  id: string; // 예: "seoul"
  name: string; // 도시명 - 예: "서울"
  description: string; // 한 줄 - 예: "한강과 경복궁의 도시"
  missions: MissionConfig[]; // 5개
};

export type RegionConfig = {
  id: string; // 예: "metro"
  name: string; // 권역명 - 예: "수도권"
  shortLabel: string; // 핀 안에 들어갈 1글자 - 예: "수"
  color: string; // hex - 예: "#7F77DD"
  description: string; // 한 줄 안내
  pin: { x: number; y: number }; // map.png 위 좌표 (0-100 % 단위)
  cities: CityConfig[]; // 2-3개
};

// =============================================================
// 데이터 — 8권역 × 도시 2-3개 × 미션 5개
//
// 1차 단계: 수도권·경상남(부산) 2개 권역 풀 데이터.
// 나머지 6개 권역은 도시 골격만 (미션은 추후 채움).
// =============================================================

export const REGION_MISSIONS: RegionConfig[] = [
  // ───────── 1. 수도권 ─────────
  {
    id: "metro",
    name: "수도권",
    shortLabel: "수",
    color: "#7F77DD",
    description: "서울과 인천을 따라 한바퀴",
    pin: { x: 37, y: 22 },
    cities: [
      {
        id: "seoul",
        name: "서울",
        description: "한강과 경복궁의 도시",
        missions: [
          {
            id: "seoul-1",
            order: 1,
            gameType: "place_name",
            title: "서울의 명소",
            description: "서울의 대표 장소 이름을 따라 말해보세요",
            placeName: {
              placeNames: [
                "한강",
                "경복궁",
                "남산타워",
                "광화문",
                "북촌한옥마을",
              ],
            },
          },
          {
            id: "seoul-2",
            order: 2,
            gameType: "association_clear",
            title: "한강 하면 떠오르는 것",
            description: "한강과 관련된 단어를 말해 정리하세요",
            associationClear: {
              promptPlace: "한강",
              answerWords: [
                "야경",
                "치킨",
                "자전거",
                "유람선",
                "피크닉",
                "강바람",
                "다리",
              ],
              distractorWords: ["지하철", "냉장고", "사막"],
            },
          },
          {
            id: "seoul-3",
            order: 3,
            gameType: "word_select",
            title: "이건 무엇일까요",
            description: "단어가 어느 카테고리인지 말해보세요",
            wordSelect: {
              promptWord: "광화문",
              correctCategory: "장소",
              optionCategories: ["장소", "음식", "동물", "도구"],
            },
          },
          {
            id: "seoul-4",
            order: 4,
            gameType: "dialect_repeat",
            title: "서울말 따라하기",
            description: "서울 말씨로 따라 말해보세요",
            dialectRepeat: {
              dialect: "그렇구나",
              standard: "그렇구나",
              region: "서울",
            },
          },
          {
            id: "seoul-5",
            order: 5,
            gameType: "sentence_build",
            title: "서울 한 문장 만들기",
            description: "키워드로 짧은 문장을 만들어 말하세요",
            sentenceBuild: {
              keywords: ["한강", "야경", "산책"],
              exampleAnswer: "한강의 야경을 보며 산책했어요",
            },
          },
        ],
      },
      {
        id: "suwon",
        name: "수원",
        description: "화성행궁과 수원갈비의 도시",
        missions: [
          {
            id: "suwon-1",
            order: 1,
            gameType: "place_name",
            title: "수원의 명소",
            description: "수원의 대표 장소 이름을 따라 말해보세요",
            placeName: {
              placeNames: [
                "화성행궁",
                "수원화성",
                "팔달문",
                "광교호수공원",
                "수원천",
              ],
            },
          },
          {
            id: "suwon-2",
            order: 2,
            gameType: "word_select",
            title: "이건 무엇일까요",
            description: "수원갈비는 어느 카테고리인가요?",
            wordSelect: {
              promptWord: "수원갈비",
              correctCategory: "음식",
              optionCategories: ["장소", "음식", "동물", "도구"],
            },
          },
          {
            id: "suwon-3",
            order: 3,
            gameType: "association_clear",
            title: "수원화성 하면",
            description: "수원화성과 관련된 단어를 말해 정리하세요",
            associationClear: {
              promptPlace: "수원화성",
              answerWords: [
                "성벽",
                "장군",
                "옛날",
                "성문",
                "유산",
                "걷기",
                "관광",
              ],
              distractorWords: ["바다", "사막", "냉장고"],
            },
          },
          {
            id: "suwon-4",
            order: 4,
            gameType: "memory",
            title: "수원 단어 분류",
            description: "수원 관련 단어를 분류해 말해보세요",
            categorySort: {
              slots: ["장소", "먹거리", "활동", "사람"],
              items: [
                { word: "화성행궁", correctSlot: "장소" },
                { word: "수원갈비", correctSlot: "먹거리" },
                { word: "성곽 산책", correctSlot: "활동" },
                { word: "정조", correctSlot: "사람" },
              ],
            },
          },
          {
            id: "suwon-5",
            order: 5,
            gameType: "sentence_build",
            title: "수원 한 문장 만들기",
            description: "키워드로 짧은 문장을 만들어 말하세요",
            sentenceBuild: {
              keywords: ["화성", "성곽", "걷기"],
              exampleAnswer: "수원 화성의 성곽을 따라 걸었어요",
            },
          },
        ],
      },
      {
        id: "incheon",
        name: "인천",
        description: "차이나타운과 송도의 도시",
        missions: [
          {
            id: "incheon-1",
            order: 1,
            gameType: "place_name",
            title: "인천의 명소",
            description: "인천의 대표 장소 이름을 따라 말해보세요",
            placeName: {
              placeNames: [
                "차이나타운",
                "월미도",
                "송도",
                "인천공항",
                "강화도",
              ],
            },
          },
          {
            id: "incheon-2",
            order: 2,
            gameType: "association_clear",
            title: "월미도 하면",
            description: "월미도와 관련된 단어를 말해 정리하세요",
            associationClear: {
              promptPlace: "월미도",
              answerWords: [
                "바다",
                "놀이공원",
                "산책",
                "야경",
                "디스코팡팡",
                "여행",
              ],
              distractorWords: ["산", "사막", "기차"],
            },
          },
          {
            id: "incheon-3",
            order: 3,
            gameType: "memory",
            title: "단어 분류",
            description: "단어를 듣고 어디에 속하는지 말해보세요",
            categorySort: {
              slots: ["장소", "먹거리", "활동", "사람"],
              items: [
                { word: "차이나타운", correctSlot: "장소" },
                { word: "짜장면", correctSlot: "먹거리" },
                { word: "관광", correctSlot: "활동" },
                { word: "선원", correctSlot: "사람" },
              ],
            },
          },
          {
            id: "incheon-4",
            order: 4,
            gameType: "word_assemble",
            title: "음절 조합",
            description: "음절을 조합해서 단어를 만들어 말하세요",
            wordAssemble: {
              syllables: ["강", "화", "도", "월", "미"],
              answers: ["강화도", "월미도"],
            },
          },
          {
            id: "incheon-5",
            order: 5,
            gameType: "tetris",
            title: "떨어지는 단어 발화",
            description: "떨어지는 단어를 빠르게 말해 정리하세요",
            tetris: {
              wordPool: [
                "차이나타운",
                "송도",
                "월미도",
                "공항",
                "갈매기",
                "바다",
                "여행",
              ],
              previewWords: ["월미도", "공항", "송도"],
              clearCondition: "10개 단어 발화하면 클리어",
            },
          },
        ],
      },
    ],
  },

  // ───────── 2. 경상남(부산) — 사용자 예시 컨셉 살림 ─────────
  {
    id: "gyeongnam",
    name: "경상남",
    shortLabel: "경남",
    color: "#97C459",
    description: "부산과 경남의 바다와 사투리",
    pin: { x: 60, y: 63 },
    cities: [
      {
        id: "busan",
        name: "부산",
        description: "광안리·해운대·자갈치의 도시",
        missions: [
          {
            id: "busan-1",
            order: 1,
            gameType: "place_name",
            title: "부산의 명소",
            description: "부산의 대표 장소 이름을 따라 말해보세요",
            placeName: {
              placeNames: [
                "광안리",
                "해운대",
                "자갈치",
                "광안대교",
                "감천문화마을",
              ],
            },
          },
          {
            id: "busan-2",
            order: 2,
            gameType: "word_select",
            title: "이건 무엇일까요",
            description: "돼지국밥은 어느 카테고리인가요?",
            wordSelect: {
              promptWord: "돼지국밥",
              correctCategory: "음식",
              optionCategories: ["장소", "음식", "동물", "도구"],
            },
          },
          {
            id: "busan-3",
            order: 3,
            gameType: "association_clear",
            title: "광안리 하면",
            description: "광안리와 관련된 단어를 말해 정리하세요",
            associationClear: {
              promptPlace: "광안리",
              answerWords: [
                "바다",
                "야경",
                "다리",
                "해변",
                "산책",
                "노을",
                "축제",
              ],
              distractorWords: ["사막", "기차", "냉장고"],
            },
          },
          {
            id: "busan-4",
            order: 4,
            gameType: "dialect_repeat",
            title: "부산 사투리",
            description: "부산 사투리를 따라 말해보세요",
            dialectRepeat: {
              dialect: "마이묵으래이",
              standard: "많이 먹으렴",
              region: "부산",
            },
          },
          {
            id: "busan-5",
            order: 5,
            gameType: "balloon",
            title: "부산 갈매기 발성",
            description: "발성을 길게 유지해 풍선을 키워보세요",
            balloon: {
              cueWords: ["아", "이", "오"],
              guideText: "부산 갈매기~ 길게 발성해 풍선을 키워봐요",
            },
          },
        ],
      },
    ],
  },

  // ───────── 3-7. 나머지 권역 — 도시 골격만 (미션은 추후 채움) ─────────
  // PM 결정: 대구는 경상북에 흡수 → 권역 7개로 통일.
  {
    id: "gangwon",
    name: "강원",
    shortLabel: "강",
    color: "#5DCAA5",
    description: "산과 바다의 권역",
    pin: { x: 59, y: 19.5 },
    cities: [
      {
        id: "chuncheon",
        name: "춘천",
        description: "호수와 닭갈비의 도시",
        missions: [],
      },
      {
        id: "gangneung",
        name: "강릉",
        description: "경포대와 커피의 도시",
        missions: [],
      },
    ],
  },
  {
    id: "chungcheong",
    name: "충청",
    description: "백제와 호수의 권역",
    shortLabel: "충",
    color: "#85B7EB",
    pin: { x: 38, y: 46 },
    cities: [
      {
        id: "daejeon",
        name: "대전",
        description: "과학과 빵의 도시",
        missions: [],
      },
      {
        id: "cheongju",
        name: "청주",
        description: "직지와 가로수의 도시",
        missions: [],
      },
    ],
  },
  {
    id: "jeolla",
    name: "전라",
    shortLabel: "전",
    color: "#EF9F27",
    description: "남도의 음식과 한옥",
    pin: { x: 33, y: 68 },
    cities: [
      {
        id: "jeonju",
        name: "전주",
        description: "한옥마을과 비빔밥의 도시",
        missions: [],
      },
      { id: "yeosu", name: "여수", description: "밤바다의 도시", missions: [] },
      {
        id: "gwangju",
        name: "광주",
        description: "예술과 민주의 도시",
        missions: [],
      },
    ],
  },
  {
    id: "gyeongbuk",
    name: "경상북",
    shortLabel: "경북",
    color: "#D4537E",
    description: "신라와 안동의 권역. 대구 포함",
    pin: { x: 67, y: 42 },
    cities: [
      { id: "gyeongju", name: "경주", description: "천년 고도", missions: [] },
      {
        id: "andong",
        name: "안동",
        description: "하회마을과 탈춤의 도시",
        missions: [],
      },
      // PM 결정: 대구를 경상북 권역의 한 도시로 흡수.
      {
        id: "daegu",
        name: "대구",
        description: "동성로와 약령시",
        missions: [],
      },
    ],
  },
  {
    id: "jeju",
    name: "제주",
    shortLabel: "제",
    color: "#378ADD",
    description: "한라산과 바다",
    pin: { x: 32, y: 92 },
    cities: [
      { id: "jeju", name: "제주", description: "성산일출봉과 한라산", missions: [] },
    ],
  },
];

// ===== 조회 헬퍼 =====
export function getRegionById(regionId: string): RegionConfig | null {
  return REGION_MISSIONS.find((r) => r.id === regionId) ?? null;
}

export function getCityById(regionId: string, cityId: string): CityConfig | null {
  const region = getRegionById(regionId);
  return region?.cities.find((c) => c.id === cityId) ?? null;
}

export function getMissionById(
  regionId: string,
  cityId: string,
  missionId: string,
): MissionConfig | null {
  const city = getCityById(regionId, cityId);
  return city?.missions.find((m) => m.id === missionId) ?? null;
}

export function listAllMissions(): MissionConfig[] {
  return REGION_MISSIONS.flatMap((r) =>
    r.cities.flatMap((c) => c.missions),
  );
}