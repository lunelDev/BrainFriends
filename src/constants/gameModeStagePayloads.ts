export type GameModeNodeGameType =
  | "association_clear"
  | "word_select"
  | "word_assemble"
  | "tetris"
  | "memory"
  | "sentence_build"
  | "tongue_twister"
  | "balloon";

export type GameModeSpeechTarget = {
  consonants: string[];
  vowels: string[];
  articulation: string[];
  reason: string;
};

export type GameModeTetrisNodePayload = {
  previewWords: string[];
  wordPool: string[];
  clearCondition: string;
};

export type AssociationWord = {
  word: string;
  isAnswer: boolean;
};

export type GameModeAssociationClearNodePayload = {
  previewWords: string[];
  words: AssociationWord[];
  clearCondition: string;
};

export type GameModeWordAssembleNodePayload = {
  previewWords: string[];
  syllables: string[];
  answers: string[];
  clearCondition: string;
};

export type SelectWord = {
  word: string;
  isAnswer: boolean;
};

export type GameModeWordSelectNodePayload = {
  previewWords: string[];
  words: SelectWord[];
  clearCondition: string;
};

export type GameModeMemoryNodePayload = {
  previewAnswers: string[];
  hintPool: string[];
  answerPool: string[];
};

export type GameModeWordHunterCategoryKey =
  | "festival_culture"
  | "dialect"
  | "landmark"
  | "food_specialty";

export type GameModeWordHunterCategory = {
  key: GameModeWordHunterCategoryKey;
  label: string;
  missionText: string;
  words: string[];
};

export type GameModeWordHunterStageMission = {
  categories: GameModeWordHunterCategory[];
};

export type GameModeSentenceBuildNodePayload = {
  previewPrompts: string[];
  promptPool: string[];
};

export type GameModeTongueTwisterNodePayload = {
  previewPrompts: string[];
  promptPool: string[];
};

export type GameModeBalloonNodePayload = {
  previewWords: string[];
  cueWords: string[];
  guideText: string;
};

export type GameModeStageNodePayload = {
  id: string;
  stageId: number;
  tier: "low" | "mid" | "high";
  order: number;
  title: string;
  gameType: GameModeNodeGameType;
  speechTarget: GameModeSpeechTarget;
  preview: string[];
  payload:
    | GameModeAssociationClearNodePayload
    | GameModeWordSelectNodePayload
    | GameModeWordAssembleNodePayload
    | GameModeTetrisNodePayload
    | GameModeMemoryNodePayload
    | GameModeSentenceBuildNodePayload
    | GameModeTongueTwisterNodePayload
    | GameModeBalloonNodePayload;
};

type TierKey = "low" | "mid" | "high";

type StageSeed = {
  id: number;
  city: string;
  speechTarget: GameModeSpeechTarget;
  labels: Record<TierKey, string[]>;
  missions: {
    landmark: string[];
    food_specialty: string[];
    festival_culture: string[];
    dialect: string[];
  };
  dialectLabel?: "표현" | "사투리";
};

const TIER_GAME_PATTERN: Record<TierKey, GameModeNodeGameType[]> = {
  low: ["association_clear", "word_select", "tongue_twister", "balloon", "sentence_build"],
  mid: ["word_assemble", "tetris", "memory", "association_clear", "word_select"],
  high: ["word_assemble", "tongue_twister", "tetris", "memory", "sentence_build"],
};

const DEFAULT_DISTRACTORS = [
  "자동차",
  "비행기",
  "사과",
  "기차",
  "책상",
  "우주선",
  "사막",
  "공장",
  "로봇",
  "빙하",
] as const;

const TITLE_THEME_RULES: Array<{ pattern: RegExp; words: string[] }> = [
  { pattern: /(강|천|호|못|댐|스카이워크|수상길)/, words: ["물길", "산책", "바람", "야경", "자전거", "휴식"] },
  { pattern: /(해변|해수욕장|바다|대교|포구|항|도|섬|등대|일출봉|해안)/, words: ["바다", "파도", "산책", "노을", "여행", "사진"] },
  { pattern: /(궁|문|사|암|서원|성당|향교|박물관|전당|전시관|문화관|문학촌|기념공원|유적)/, words: ["역사", "전통", "관람", "문화", "유적", "사진"] },
  { pattern: /(시장|거리|골목|광장|상가|로)/, words: ["쇼핑", "먹거리", "골목", "활기", "사람", "산책"] },
  { pattern: /(산|오름|숲|공원|수목원|비자림|숲길|정원)/, words: ["자연", "풍경", "산책", "숲길", "휴식", "등산"] },
  { pattern: /(타워|전망대|케이블카|롯데월드타워)/, words: ["전망", "야경", "사진", "관람", "도시", "풍경"] },
  { pattern: /(폭포|굴|동굴|절벽|용암)/, words: ["절경", "탐방", "물소리", "바람", "자연", "사진"] },
  { pattern: /(마을)/, words: ["전통", "골목", "체험", "사진", "산책", "풍경"] },
  { pattern: /(공항)/, words: ["여행", "비행기", "출발", "도착", "하늘", "활주로"] },
  { pattern: /(레고랜드|이월드|레일파크)/, words: ["놀이", "가족", "체험", "웃음", "사진", "활동"] },
];

const SPECIAL_LANDMARK_KEYWORDS: Record<string, string[]> = {
  한강: ["야경", "치킨", "자전거", "유람선", "피크닉", "강바람"],
  경복궁: ["궁궐", "왕", "수문장", "전통", "한복", "광화문"],
  해운대: ["바다", "파도", "모래", "산책", "여행", "야경"],
  광안리: ["야경", "바다", "다리", "노을", "산책", "해변"],
  한라산: ["등산", "오름", "자연", "정상", "바람", "풍경"],
  성산일출봉: ["일출", "바다", "절벽", "오름", "탐방", "풍경"],
  전주한옥마을: ["한옥", "전통", "한복", "골목", "체험", "사진"],
  남이섬: ["섬", "산책", "자전거", "데이트", "풍경", "가로수"],
  여수밤바다: ["야경", "바다", "낭만", "조명", "산책", "노래"],
  하회마을: ["전통", "탈춤", "한옥", "강변", "문화", "체험"],
  경포대: ["바다", "호수", "일출", "바람", "산책", "풍경"],
  무등산: ["등산", "바위", "자연", "풍경", "산책", "정상"],
};

const STAGE_SEEDS: StageSeed[] = [
  {
    id: 1,
    city: "서울",
    speechTarget: {
      consonants: ["ㅅ", "ㄹ", "ㄱ"],
      vowels: ["ㅓ", "ㅜ"],
      articulation: ["마찰음", "유음", "기본모음"],
      reason: "서울 명소를 기반으로 기본 연상과 선택 훈련을 시작하는 단계",
    },
    labels: {
      low: ["한강", "경복궁", "남산타워", "인사동", "북촌한옥마을"],
      mid: ["광화문", "청계천", "명동", "이태원", "동대문디자인플라자"],
      high: ["홍대거리", "강남역", "올림픽공원", "잠실롯데월드타워", "서울숲"],
    },
    missions: {
      landmark: ["한강", "경복궁", "남산타워", "인사동", "북촌한옥마을"],
      food_specialty: ["치킨", "떡볶이", "삼겹살", "비빔밥", "김치찌개"],
      festival_culture: ["야경", "한복", "공연", "전통", "공예"],
      dialect: ["안녕", "감사", "사랑", "행복", "미래"],
    },
    dialectLabel: "표현",
  },
  {
    id: 2,
    city: "인천",
    speechTarget: {
      consonants: ["ㅇ", "ㅊ", "ㄴ"],
      vowels: ["ㅣ", "ㅕ"],
      articulation: ["비음", "파찰음", "전설모음"],
      reason: "인천 명소를 따라 선택과 연상 구분을 확장하는 단계",
    },
    labels: {
      low: ["월미도", "차이나타운", "개항장", "송도센트럴파크", "자유공원"],
      mid: ["인천공항", "소래포구", "강화도", "영종도", "인천대교"],
      high: ["부평지하상가", "문학경기장", "송월동동화마을", "을왕리해수욕장", "아라뱃길"],
    },
    missions: {
      landmark: ["월미도", "차이나타운", "송도센트럴파크", "인천공항", "강화도"],
      food_specialty: ["짜장면", "게장", "새우", "해산물", "냉면"],
      festival_culture: ["항구", "무역", "개항", "역사", "야경"],
      dialect: ["바다", "갈매기", "낙조", "여행", "배"],
    },
    dialectLabel: "표현",
  },
  {
    id: 3,
    city: "부산",
    speechTarget: {
      consonants: ["ㅂ", "ㅅ", "ㄴ"],
      vowels: ["ㅜ", "ㅏ"],
      articulation: ["파열음", "마찰음", "후설모음"],
      reason: "부산의 바다와 시장을 주제로 빠른 반응을 키우는 단계",
    },
    labels: {
      low: ["해운대", "광안리", "자갈치시장", "감천문화마을", "국제시장"],
      mid: ["태종대", "남포동", "용두산공원", "기장", "송정해수욕장"],
      high: ["영도흰여울마을", "해동용궁사", "광안대교", "오륙도", "부산엑스더스카이"],
    },
    missions: {
      landmark: ["해운대", "광안리", "자갈치시장", "감천문화마을", "태종대"],
      food_specialty: ["돼지국밥", "밀면", "씨앗호떡", "회", "어묵"],
      festival_culture: ["영화제", "불꽃축제", "야경", "항구", "바다"],
      dialect: ["마이", "아이가", "억수로", "가가", "이카이"],
    },
    dialectLabel: "사투리",
  },
  {
    id: 4,
    city: "경주",
    speechTarget: {
      consonants: ["ㄱ", "ㅈ", "ㅎ"],
      vowels: ["ㅕ", "ㅜ"],
      articulation: ["파열음", "파찰음", "원순모음"],
      reason: "경주의 역사 유적을 따라 조합과 문장 완성을 심화하는 단계",
    },
    labels: {
      low: ["불국사", "첨성대", "석굴암", "동궁과월지", "황리단길"],
      mid: ["대릉원", "교촌마을", "분황사", "문무대왕릉", "월정교"],
      high: ["양동마을", "경주국립박물관", "포석정", "오릉", "보문호"],
    },
    missions: {
      landmark: ["불국사", "첨성대", "석굴암", "대릉원", "월정교"],
      food_specialty: ["경주빵", "황남빵", "쌈밥", "한정식", "보리밥"],
      festival_culture: ["신라", "유적", "왕릉", "역사", "전통"],
      dialect: ["예", "마", "어예", "아로", "됩니더"],
    },
    dialectLabel: "표현",
  },
  {
    id: 5,
    city: "대구",
    speechTarget: {
      consonants: ["ㄷ", "ㄱ", "ㅁ"],
      vowels: ["ㅐ", "ㅗ"],
      articulation: ["파열음", "비음", "전설모음"],
      reason: "대구의 시장과 공원을 중심으로 호흡과 반응을 안정화하는 단계",
    },
    labels: {
      low: ["동성로", "서문시장", "팔공산", "수성못", "김광석거리"],
      mid: ["근대골목", "앞산전망대", "방천시장", "동화사", "이월드"],
      high: ["대구스타디움", "달성공원", "도동서원", "대구미술관", "엑스코"],
    },
    missions: {
      landmark: ["동성로", "서문시장", "팔공산", "수성못", "김광석거리"],
      food_specialty: ["막창", "납작만두", "뭉티기", "찜갈비", "야시장"],
      festival_culture: ["섬유", "패션", "음악", "근대", "공연"],
      dialect: ["마이", "카더라", "안카나", "됩더", "와가"],
    },
    dialectLabel: "사투리",
  },
  {
    id: 6,
    city: "전주",
    speechTarget: {
      consonants: ["ㅈ", "ㄴ", "ㅎ"],
      vowels: ["ㅓ", "ㅗ"],
      articulation: ["파찰음", "비음", "마찰음"],
      reason: "전주의 전통 공간에서 잿말과 문장 훈련을 이어가는 단계",
    },
    labels: {
      low: ["전주한옥마을", "경기전", "전동성당", "덕진공원", "오목대"],
      mid: ["전주향교", "남부시장", "풍남문", "전주객사", "한벽당"],
      high: ["자만벽화마을", "완산공원", "전주영화의거리", "아중호수", "국립전주박물관"],
    },
    missions: {
      landmark: ["전주한옥마을", "경기전", "전동성당", "덕진공원", "전주향교"],
      food_specialty: ["비빔밥", "콩나물국밥", "막걸리", "한정식", "피순대"],
      festival_culture: ["한옥", "전통", "한복", "한지", "사물놀이"],
      dialect: ["워메", "거시기", "허벌나게", "암시랑", "글쎄요"],
    },
    dialectLabel: "표현",
  },
  {
    id: 7,
    city: "광주",
    speechTarget: {
      consonants: ["ㄱ", "ㅈ", "ㅂ"],
      vowels: ["ㅘ", "ㅜ"],
      articulation: ["파열음", "파찰음", "원순모음"],
      reason: "광주의 예술과 민주화 공간을 따라 폭탄형 반응을 강화하는 단계",
    },
    labels: {
      low: ["무등산", "국립아시아문화전당", "양림동", "5·18기념공원", "충장로"],
      mid: ["광주호수생태공원", "대인시장", "광주비엔날레전시관", "금남로", "펭귄마을"],
      high: ["사직공원전망타워", "광주극장", "우치공원", "김대중컨벤션센터", "광주천"],
    },
    missions: {
      landmark: ["무등산", "국립아시아문화전당", "양림동", "5·18기념공원", "충장로"],
      food_specialty: ["육회비빔밥", "오리탕", "보리밥", "떡갈비", "상추튀김"],
      festival_culture: ["민주화", "예술", "비엔날레", "공연", "문화"],
      dialect: ["거시기", "워메", "시방", "허벌", "불라"],
    },
    dialectLabel: "표현",
  },
  {
    id: 8,
    city: "여수",
    speechTarget: {
      consonants: ["ㅇ", "ㅅ", "ㄹ"],
      vowels: ["ㅕ", "ㅜ"],
      articulation: ["비음", "마찰음", "유음"],
      reason: "여수의 바다 야경을 바탕으로 연상 정리 난도를 끌어올리는 단계",
    },
    labels: {
      low: ["여수밤바다", "오동도", "돌산공원", "향일암", "이순신광장"],
      mid: ["여수엑스포", "자산공원", "거문도", "백도", "여수해상케이블카"],
      high: ["금오도", "만성리검은모래해변", "여수해양공원", "하멜등대", "돌산대교"],
    },
    missions: {
      landmark: ["여수밤바다", "오동도", "돌산공원", "향일암", "이순신광장"],
      food_specialty: ["게장", "갓김치", "장어구이", "서대회", "해산물"],
      festival_culture: ["야경", "낭만", "케이블카", "항구", "엑스포"],
      dialect: ["거시기", "허벌", "시방", "요것", "어따"],
    },
    dialectLabel: "표현",
  },
  {
    id: 9,
    city: "강릉",
    speechTarget: {
      consonants: ["ㄱ", "ㄹ", "ㅇ"],
      vowels: ["ㅏ", "ㅡ"],
      articulation: ["파열음", "유음", "중설모음"],
      reason: "강릉의 바다와 커피 문화를 이용해 조합형 난도를 높이는 단계",
    },
    labels: {
      low: ["경포대", "오죽헌", "안목해변", "정동진", "강릉중앙시장"],
      mid: ["선교장", "주문진", "강문해변", "경포호", "사천해변"],
      high: ["하슬라아트월드", "대관령양떼목장", "헌화로", "초당순두부마을", "경포아쿠아리움"],
    },
    missions: {
      landmark: ["경포대", "오죽헌", "안목해변", "정동진", "선교장"],
      food_specialty: ["커피", "초당순두부", "곰치국", "도루묵", "감자옹심이"],
      festival_culture: ["단오제", "해돋이", "신사임당", "율곡", "커피축제"],
      dialect: ["마따나", "그라믄", "뭐여", "한나절", "이래서"],
    },
    dialectLabel: "표현",
  },
  {
    id: 10,
    city: "춘천",
    speechTarget: {
      consonants: ["ㅊ", "ㄴ", "ㄱ"],
      vowels: ["ㅜ", "ㅐ"],
      articulation: ["파찰음", "비음", "전설모음"],
      reason: "춘천의 호수와 레저 공간을 바탕으로 선택 난도를 높이는 단계",
    },
    labels: {
      low: ["남이섬", "소양강스카이워크", "의암호", "청평사", "김유정문학촌"],
      mid: ["춘천명동닭갈비골목", "강촌레일파크", "삼악산호수케이블카", "공지천", "애니메이션박물관"],
      high: ["소양강댐", "제이드가든", "레고랜드", "구봉산전망대", "춘천물레길"],
    },
    missions: {
      landmark: ["남이섬", "소양강스카이워크", "의암호", "청평사", "강촌레일파크"],
      food_specialty: ["닭갈비", "막국수", "감자전", "순두부", "막걸리"],
      festival_culture: ["레저", "영화제", "자전거", "낭만", "호반"],
      dialect: ["강원도", "맑은물", "시원한", "가자", "산길"],
    },
    dialectLabel: "표현",
  },
  {
    id: 11,
    city: "안동",
    speechTarget: {
      consonants: ["ㅇ", "ㄷ", "ㅎ"],
      vowels: ["ㅏ", "ㅗ"],
      articulation: ["비음", "파열음", "후설모음"],
      reason: "안동의 전통문화 자원을 이용해 기억형 난도를 높이는 단계",
    },
    labels: {
      low: ["하회마을", "봉정사", "도산서원", "월영교", "임청각"],
      mid: ["안동민속박물관", "부용대", "안동찜닭골목", "안동댐", "병산서원"],
      high: ["선성수상길", "월영당", "안동구시장", "학가산", "안동소주전통음식박물관"],
    },
    missions: {
      landmark: ["하회마을", "봉정사", "도산서원", "월영교", "부용대"],
      food_specialty: ["안동찜닭", "안동국시", "간고등어", "헛제삿밥", "안동소주"],
      festival_culture: ["유교", "탈춤", "선비", "전통", "유네스코"],
      dialect: ["예", "그라이소", "머라꼬", "인자", "아이구"],
    },
    dialectLabel: "표현",
  },
  {
    id: 12,
    city: "제주",
    speechTarget: {
      consonants: ["ㅈ", "ㅎ", "ㄹ"],
      vowels: ["ㅔ", "ㅜ"],
      articulation: ["파찰음", "마찰음", "전설모음"],
      reason: "제주의 자연 명소를 바탕으로 파이널 문장 훈련을 마무리하는 단계",
    },
    labels: {
      low: ["한라산", "성산일출봉", "만장굴", "협재해변", "우도"],
      mid: ["중문관광단지", "사려니숲길", "섭지코지", "제주올레길", "천지연폭포"],
      high: ["비자림", "정방폭포", "한림공원", "용두암", "카멜리아힐"],
    },
    missions: {
      landmark: ["한라산", "성산일출봉", "만장굴", "협재해변", "우도"],
      food_specialty: ["흑돼지", "갈치조림", "한라봉", "오메기떡", "고등어회"],
      festival_culture: ["해녀", "오름", "돌담", "용암", "올레길"],
      dialect: ["혼저옵서예", "마씀", "하영", "게메", "어멍"],
    },
    dialectLabel: "사투리",
  },
];

export const GAME_MODE_STAGE_CITY_LABELS: Record<number, Record<TierKey, string[]>> =
  Object.fromEntries(
    STAGE_SEEDS.map((stage) => [
      stage.id,
      {
        low: [...stage.labels.low],
        mid: [...stage.labels.mid],
        high: [...stage.labels.high],
      },
    ]),
  ) as Record<number, Record<TierKey, string[]>>;

function uniqueWords(words: string[]) {
  const bucket = new Set<string>();
  const result: string[] = [];

  for (const raw of words) {
    const word = raw.trim();
    if (!word || bucket.has(word)) continue;
    bucket.add(word);
    result.push(word);
  }

  return result;
}

function buildRuleWords(title: string) {
  return uniqueWords(
    TITLE_THEME_RULES.flatMap((rule) => (rule.pattern.test(title) ? rule.words : [])),
  );
}

function buildRelatedWords(stage: StageSeed, title: string) {
  const genericWords = ["사진", "여행", "산책", "관람", "풍경", "명소"];
  return uniqueWords([
    ...(SPECIAL_LANDMARK_KEYWORDS[title] ?? []),
    ...buildRuleWords(title),
    stage.city,
    ...genericWords,
  ])
    .filter((word) => word !== title)
    .slice(0, 8);
}

function buildDistractors(stage: StageSeed, title: string, answers: string[]) {
  const otherLandmarks = Object.values(stage.labels)
    .flat()
    .filter((label) => label !== title);

  return uniqueWords([...DEFAULT_DISTRACTORS, ...otherLandmarks])
    .filter((word) => !answers.includes(word) && word !== title && word !== stage.city)
    .slice(0, 4);
}

function pickAssembleAnswers(stage: StageSeed, title: string, relatedWords: string[]) {
  const candidates = uniqueWords([title, ...relatedWords]).filter(
    (word) => /^[가-힣A-Za-z0-9]+$/.test(word) && word.length >= 2 && word.length <= 6,
  );

  if (candidates.length >= 3) {
    return candidates.slice(0, 3);
  }

  return uniqueWords([...candidates, stage.city, "명소", "풍경"]).slice(0, 3);
}

function extractSyllables(words: string[]) {
  return words.join("").replace(/\s+/g, "").split("");
}

function buildPreview(title: string, relatedWords: string[]) {
  return [title, ...relatedWords.slice(0, 3)];
}

function buildAssociationClearPayload(
  stage: StageSeed,
  title: string,
  relatedWords: string[],
): GameModeAssociationClearNodePayload {
  const answers = relatedWords.slice(0, 6);
  const distractors = buildDistractors(stage, title, answers);

  return {
    previewWords: answers.slice(0, 4),
    words: [
      ...answers.map((word) => ({ word, isAnswer: true })),
      ...distractors.map((word) => ({ word, isAnswer: false })),
    ],
    clearCondition: `${title}와(과) 관련된 연상 단어만 골라 모두 정리하기`,
  };
}

function buildWordSelectPayload(
  stage: StageSeed,
  title: string,
  relatedWords: string[],
): GameModeWordSelectNodePayload {
  const answers = relatedWords.slice(0, 5);
  const distractors = buildDistractors(stage, title, answers);

  return {
    previewWords: answers.slice(0, 4),
    words: [
      ...answers.map((word) => ({ word, isAnswer: true })),
      ...distractors.map((word) => ({ word, isAnswer: false })),
    ],
    clearCondition: `${title}와(과) 관련된 보기 단어만 모두 선택하기`,
  };
}

function buildWordAssemblePayload(
  stage: StageSeed,
  title: string,
  relatedWords: string[],
): GameModeWordAssembleNodePayload {
  const answers = pickAssembleAnswers(stage, title, relatedWords);

  return {
    previewWords: answers,
    syllables: extractSyllables(answers),
    answers,
    clearCondition: `제시된 음절을 조합해 ${title}와(과) 관련된 단어를 모두 찾기`,
  };
}

function buildTetrisPayload(
  stage: StageSeed,
  title: string,
  relatedWords: string[],
): GameModeTetrisNodePayload {
  const wordPool = uniqueWords([title, ...relatedWords, stage.city, "정리", "속도", "집중"]).slice(0, 11);

  return {
    previewWords: wordPool.slice(0, 4),
    wordPool,
    clearCondition: `${title} 핵심어를 빠르게 말해 단어 폭탄을 정리하기`,
  };
}

function buildMemoryPayload(
  stage: StageSeed,
  title: string,
  relatedWords: string[],
): GameModeMemoryNodePayload {
  const answerPool = uniqueWords([title, ...relatedWords.slice(0, 5), stage.city]).slice(0, 6);

  return {
    previewAnswers: answerPool.slice(0, 4),
    hintPool: [
      `${title}는 ${stage.city}의 대표 명소다`,
      `${title}에서 ${relatedWords[0] ?? "풍경"}과 ${relatedWords[1] ?? "산책"}을(를) 떠올릴 수 있다`,
      `${title}와(과) 어울리는 단어를 듣고 카테고리에 맞게 분류한다`,
      `${stage.city}의 단어 감각을 이어서 말해 본다`,
    ],
    answerPool,
  };
}

function buildTongueTwisterPayload(
  stage: StageSeed,
  title: string,
  relatedWords: string[],
): GameModeTongueTwisterNodePayload {
  const prompts = [
    `${title} ${title} ${stage.city} ${stage.city}`,
    `${stage.city} ${stage.city} ${title} ${title}`,
    `${title} 길 따라 ${relatedWords[0] ?? "산책"} ${relatedWords[1] ?? "사진"}`,
    `${stage.city} ${title}에서 ${relatedWords[2] ?? "풍경"} 소리`,
    `${title}에서 ${relatedWords[3] ?? "여행"}하고 ${relatedWords[4] ?? "관람"}하기`,
  ];

  return {
    previewPrompts: prompts.slice(0, 2),
    promptPool: prompts,
  };
}

function buildBalloonPayload(
  stage: StageSeed,
  title: string,
  relatedWords: string[],
): GameModeBalloonNodePayload {
  const cueWords = uniqueWords([title, ...relatedWords.slice(0, 4)]);

  return {
    previewWords: cueWords.slice(0, 4),
    cueWords,
    guideText: `${title} 핵심어를 안정적으로 말하며 호흡을 유지하기`,
  };
}

function buildSentencePayload(
  stage: StageSeed,
  title: string,
  relatedWords: string[],
): GameModeSentenceBuildNodePayload {
  const prompts = [
    `${title}에 가면 ${relatedWords[0] ?? "풍경"}과 ${relatedWords[1] ?? "산책"}이 떠오른다`,
    `${stage.city}의 ${title}는 ${relatedWords[2] ?? "명소"}로 잘 알려져 있다`,
    `${title}에서 ${relatedWords[3] ?? "여행"}하고 ${relatedWords[4] ?? "사진"}을 남긴다`,
    `${stage.city} 여행에서 ${title}는 꼭 들러야 할 장소다`,
  ];

  return {
    previewPrompts: prompts.slice(0, 2),
    promptPool: prompts,
  };
}

function buildNodePayload(
  stage: StageSeed,
  tier: TierKey,
  index: number,
  order: number,
): GameModeStageNodePayload {
  const title = stage.labels[tier][index];
  const gameType = TIER_GAME_PATTERN[tier][index];
  const relatedWords = buildRelatedWords(stage, title);
  const preview = buildPreview(title, relatedWords);

  switch (gameType) {
    case "association_clear":
      return {
        id: `${stage.id}-${tier}-${index + 1}`,
        stageId: stage.id,
        tier,
        order,
        title,
        gameType,
        speechTarget: stage.speechTarget,
        preview,
        payload: buildAssociationClearPayload(stage, title, relatedWords),
      };
    case "word_select":
      return {
        id: `${stage.id}-${tier}-${index + 1}`,
        stageId: stage.id,
        tier,
        order,
        title,
        gameType,
        speechTarget: stage.speechTarget,
        preview,
        payload: buildWordSelectPayload(stage, title, relatedWords),
      };
    case "word_assemble":
      return {
        id: `${stage.id}-${tier}-${index + 1}`,
        stageId: stage.id,
        tier,
        order,
        title,
        gameType,
        speechTarget: stage.speechTarget,
        preview,
        payload: buildWordAssemblePayload(stage, title, relatedWords),
      };
    case "tetris":
      return {
        id: `${stage.id}-${tier}-${index + 1}`,
        stageId: stage.id,
        tier,
        order,
        title,
        gameType,
        speechTarget: stage.speechTarget,
        preview,
        payload: buildTetrisPayload(stage, title, relatedWords),
      };
    case "memory":
      return {
        id: `${stage.id}-${tier}-${index + 1}`,
        stageId: stage.id,
        tier,
        order,
        title,
        gameType,
        speechTarget: stage.speechTarget,
        preview,
        payload: buildMemoryPayload(stage, title, relatedWords),
      };
    case "tongue_twister":
      return {
        id: `${stage.id}-${tier}-${index + 1}`,
        stageId: stage.id,
        tier,
        order,
        title,
        gameType,
        speechTarget: stage.speechTarget,
        preview,
        payload: buildTongueTwisterPayload(stage, title, relatedWords),
      };
    case "balloon":
      return {
        id: `${stage.id}-${tier}-${index + 1}`,
        stageId: stage.id,
        tier,
        order,
        title,
        gameType,
        speechTarget: stage.speechTarget,
        preview,
        payload: buildBalloonPayload(stage, title, relatedWords),
      };
    case "sentence_build":
    default:
      return {
        id: `${stage.id}-${tier}-${index + 1}`,
        stageId: stage.id,
        tier,
        order,
        title,
        gameType: "sentence_build",
        speechTarget: stage.speechTarget,
        preview,
        payload: buildSentencePayload(stage, title, relatedWords),
      };
  }
}

function buildStageNodes(stage: StageSeed) {
  let order = 1;

  return (["low", "mid", "high"] as const).flatMap((tier) =>
    stage.labels[tier].map((_, index) => {
      const node = buildNodePayload(stage, tier, index, order);
      order += 1;
      return node;
    }),
  );
}

export const GAME_MODE_STAGE_NODE_PAYLOADS: Record<number, GameModeStageNodePayload[]> =
  Object.fromEntries(STAGE_SEEDS.map((stage) => [stage.id, buildStageNodes(stage)])) as Record<
    number,
    GameModeStageNodePayload[]
  >;

const GAME_MODE_WORD_HUNTER_MISSIONS: Record<number, GameModeWordHunterStageMission> =
  Object.fromEntries(
    STAGE_SEEDS.map((stage) => [
      stage.id,
      {
        categories: [
          {
            key: "landmark" as const,
            label: "명소",
            missionText: `${stage.city}의 명소를 말해보세요`,
            words: stage.missions.landmark,
          },
          {
            key: "food_specialty" as const,
            label: "먹거리",
            missionText: `${stage.city}의 먹거리를 말해보세요`,
            words: stage.missions.food_specialty,
          },
          {
            key: "festival_culture" as const,
            label: "문화",
            missionText: `${stage.city}의 문화 키워드를 말해보세요`,
            words: stage.missions.festival_culture,
          },
          {
            key: "dialect" as const,
            label: stage.dialectLabel ?? "표현",
            missionText: `${stage.city} ${stage.dialectLabel === "사투리" ? "사투리" : "표현"}를 말해보세요`,
            words: stage.missions.dialect,
          },
        ],
      },
    ]),
  ) as Record<number, GameModeWordHunterStageMission>;

export function getGameModeNodePayload(
  stageId: number,
  nodeId: string,
): GameModeStageNodePayload | null {
  const nodes = GAME_MODE_STAGE_NODE_PAYLOADS[stageId];
  if (!nodes) return null;
  return nodes.find((node) => node.id === nodeId) ?? null;
}

export function getGameModeStageNodes(stageId: number): GameModeStageNodePayload[] {
  return GAME_MODE_STAGE_NODE_PAYLOADS[stageId] ?? [];
}

export function getGameModeWordHunterStageMission(
  stageId: number,
): GameModeWordHunterStageMission | null {
  return GAME_MODE_WORD_HUNTER_MISSIONS[stageId] ?? null;
}
