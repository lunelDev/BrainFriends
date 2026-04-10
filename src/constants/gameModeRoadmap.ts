import {
  GAME_MODE_STAGE_CITY_LABELS,
  getGameModeWordHunterStageMission,
} from "@/constants/gameModeStagePayloads";

export type GameModeGameKey =
  | "association_clear"
  | "word_select"
  | "word_assemble"
  | "tetris"
  | "balloon"
  | "memory"
  | "sentence_build"
  | "tongue_twister";

export type GameModeDifficulty = "Easy" | "Normal" | "Hard" | "Expert";
export type GameModeCategoryTone =
  | "food"
  | "spot"
  | "dialect"
  | "festival";
export type GameModeSubstageType =
  | "tetris"
  | "open"
  | "balloon"
  | "battle";

export type GameModeGameDefinition = {
  key: GameModeGameKey;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  imageSrc: string;
  actionLabel: string;
  accentClass: string;
};

export type GameModeCategoryBlock = {
  tone: GameModeCategoryTone;
  label: string;
  emoji: string;
  chips: string[];
};

export type GameModeSubstageDefinition = {
  id: string;
  order: number;
  type: GameModeSubstageType;
  title: string;
  gameKey: GameModeGameKey;
  clearLabel: string;
  timeLabel: string;
  attemptsLabel: string;
  rewardLabel: string;
  earnedLabel: string;
  hint?: string;
  answer?: string;
  collect?: string[];
  sentence?: string;
  chips?: string[];
};

export type GameModeStageSectionDefinition = {
  id: string;
  order: number;
  theme: string;
  themeDesc: string;
  emoji: string;
  boss?: boolean;
  substages: GameModeSubstageDefinition[];
};

export type GameModeLevelDefinition = {
  id: number;
  title: string;
  badge: string;
  summary: string;
  description: string;
  objective: string;
  difficulty: GameModeDifficulty;
  difficultyLabel: string;
  stageAccentClass: string;
  nodeAccentClass: string;
  gameKey: GameModeGameKey;
  zone: string;
  zoneLabel: string;
  regionTag: string;
  stars: number;
  accentColor: string;
  isBoss?: boolean;
  bossLabel?: string;
  categories: GameModeCategoryBlock[];
  previewHeights: number[];
};

export type GameModeStageDetail = GameModeLevelDefinition & {
  sections: GameModeStageSectionDefinition[];
};

export type GameModeStageNodeDefinition = {
  id: string;
  order: number;
  theme: string;
  themeDesc: string;
  emoji: string;
  boss?: boolean;
  candidateVariants: Array<{
    gameKey: GameModeGameKey;
    gameLabel: string;
    sentenceMode?: "example" | "tongue";
  }>;
};

export type GameModeStageMap = GameModeLevelDefinition & {
  nodes: GameModeStageNodeDefinition[];
};

export const GAME_MODE_GAMES: Record<GameModeGameKey, GameModeGameDefinition> = {
  association_clear: {
    key: "association_clear",
    title: "연상 매칭",
    subtitle: "연상어 정리",
    description: "명소와 관련된 단어만 말해 화면의 단어를 정리하는 음성 퍼즐 게임",
    href: "/programs/lingo/association-clear",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-violet-500/45 to-indigo-900/65",
  },
  word_select: {
    key: "word_select",
    title: "단어 선택",
    subtitle: "음성 선택",
    description: "보기 중 관련 단어만 말해 정확하게 선택하는 음성 기반 선택 게임",
    href: "/programs/lingo/word-select",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-amber-500/45 to-orange-900/65",
  },
  word_assemble: {
    key: "word_assemble",
    title: "단어 조합",
    subtitle: "음절 조합",
    description: "제시된 음절을 조합해 명소와 관련된 단어를 만드는 음성 게임",
    href: "/programs/lingo/word-assemble",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-emerald-500/45 to-cyan-900/65",
  },
  tetris: {
    key: "tetris",
    title: "단어 폭탄",
    subtitle: "낙하 반응",
    description: "떨어지는 핵심 단어를 빠르게 말해 정리하는 반응형 음성 게임",
    href: "/programs/lingo/tetris",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-sky-600/45 to-cyan-900/65",
  },
  balloon: {
    key: "balloon",
    title: "풍선 키우기",
    subtitle: "발성 유지",
    description: "안정적인 음량과 호흡으로 풍선을 키우는 발성 훈련형 게임",
    href: "/programs/lingo/balloon",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-emerald-600/45 to-teal-900/65",
  },
  memory: {
    key: "memory",
    title: "단어 배치",
    subtitle: "분류 훈련",
    description: "명소와 관련된 단어를 듣고 정해진 카테고리로 배치하는 게임",
    href: "/programs/lingo/memory",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-amber-500/45 to-yellow-900/65",
  },
  sentence_build: {
    key: "sentence_build",
    title: "문장 만들기",
    subtitle: "문장 완성",
    description: "명소 핵심어를 활용해 문장을 완성하고 또렷하게 읽는 게임",
    href: "/programs/lingo/sentence",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-rose-500/45 to-orange-900/65",
  },
  tongue_twister: {
    key: "tongue_twister",
    title: "잿말놀이",
    subtitle: "속도 훈련",
    description: "명소 테마 잿말 문장을 읽으며 정확도와 속도를 함께 훈련하는 게임",
    href: "/programs/lingo/sentence",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-fuchsia-500/45 to-violet-900/65",
  },
};

type LevelSeed = {
  id: number;
  city: string;
  gameKey: GameModeGameKey;
  difficulty: GameModeDifficulty;
  difficultyLabel: string;
  zone: string;
  zoneLabel: string;
  stars: number;
  accentColor: string;
  stageAccentClass: string;
  nodeAccentClass: string;
  isBoss?: boolean;
  bossLabel?: string;
};

const GAME_META_COPY: Record<
  GameModeGameKey,
  {
    summary: string;
    description: (city: string) => string;
    objective: (city: string) => string;
    ruleChips: string[];
    goalChips: string[];
  }
> = {
  association_clear: {
    summary: "연상 단어 정리",
    description: (city) => `${city} 명소를 보며 관련 단어만 음성으로 제거하는 정리형 구간입니다.`,
    objective: (city) => `${city} 명소에서 떠오르는 연상 단어를 빠르게 골라 정리하기`,
    ruleChips: ["연상 단어", "정답 제거", "오답 패널티", "시간 제한"],
    goalChips: ["정답 전부 제거", "오답 억제", "빠른 판정", "반복 훈련"],
  },
  word_select: {
    summary: "관련 단어 고르기",
    description: (city) => `${city} 명소 보기 중 관련 단어만 말해 선택하는 판별형 구간입니다.`,
    objective: (city) => `${city} 명소와 어울리는 단어를 빠르게 구별해 선택하기`,
    ruleChips: ["보기 제시", "음성 선택", "중복 방지", "오답 누적"],
    goalChips: ["정답 모두 선택", "주의 집중", "정확도 유지", "속도 향상"],
  },
  word_assemble: {
    summary: "음절 조합 만들기",
    description: (city) => `${city} 명소 관련 음절을 조합해 단어를 완성하는 조합형 구간입니다.`,
    objective: (city) => `${city} 명소 단서를 보고 음절을 조합해 정답 단어를 발화하기`,
    ruleChips: ["음절 제시", "단어 조합", "중복 방지", "정답 누적"],
    goalChips: ["조합 완성", "음절 인지", "정확 발화", "응용 확장"],
  },
  tetris: {
    summary: "낙하 단어 대응",
    description: (city) => `${city} 명소 핵심어가 빠르게 내려오며 반응 속도를 요구하는 구간입니다.`,
    objective: (city) => `${city} 명소 단어를 놓치지 않고 빠르게 말해 처리하기`,
    ruleChips: ["낙하 단어", "연속 제거", "압박 유지", "실시간 반응"],
    goalChips: ["속도 대응", "집중 유지", "오탈 억제", "콤보 유지"],
  },
  balloon: {
    summary: "호흡과 발성 유지",
    description: (city) => `${city} 핵심어를 일정한 호흡으로 유지하며 발성을 조절하는 구간입니다.`,
    objective: (city) => `${city} 관련 단어를 안정적인 호흡과 음량으로 유지하기`,
    ruleChips: ["호흡 유지", "음량 조절", "지속 발성", "실수 경고"],
    goalChips: ["안정 호흡", "발성 지속", "리듬 유지", "긴장 완화"],
  },
  memory: {
    summary: "카테고리 단어 배치",
    description: (city) => `${city} 단어를 듣고 명소·먹거리·문화·표현 카테고리로 분류하는 구간입니다.`,
    objective: (city) => `${city} 단어를 빠르게 인식하고 맞는 카테고리로 배치하기`,
    ruleChips: ["카테고리 분류", "카드 진행", "음성 판정", "정확도 누적"],
    goalChips: ["분류 완성", "전환 속도", "연속 판단", "기억 강화"],
  },
  sentence_build: {
    summary: "명소 문장 완성",
    description: (city) => `${city} 명소 핵심어를 활용해 문장을 완성하고 읽는 마무리 구간입니다.`,
    objective: (city) => `${city} 명소 단어를 연결해 긴 문장을 완성하고 정확하게 읽기`,
    ruleChips: ["문장 완성", "핵심어 연결", "정확 발화", "최종 정리"],
    goalChips: ["문장 완주", "호흡 분배", "리듬 안정", "최종 클리어"],
  },
  tongue_twister: {
    summary: "잿말 속도 올리기",
    description: (city) => `${city} 명소 문장을 빠르게 읽으며 속도와 정확도를 동시에 훈련하는 구간입니다.`,
    objective: (city) => `${city} 명소 관련 잿말 문장을 또렷하고 빠르게 반복하기`,
    ruleChips: ["반복 발화", "속도 측정", "정확도 확인", "혀 근육 자극"],
    goalChips: ["속도 상승", "발음 안정", "리듬 감각", "집중 강화"],
  },
};

const LEVEL_SEEDS: LevelSeed[] = [
  {
    id: 1,
    city: "서울",
    gameKey: "association_clear",
    difficulty: "Easy",
    difficultyLabel: "쉬움",
    zone: "zone-1",
    zoneLabel: "ZONE 1 : START",
    stars: 1,
    accentColor: "#b388ff",
    stageAccentClass: "from-violet-500 via-indigo-500 to-slate-900",
    nodeAccentClass: "from-violet-400 to-indigo-600",
  },
  {
    id: 2,
    city: "인천",
    gameKey: "word_select",
    difficulty: "Easy",
    difficultyLabel: "쉬움",
    zone: "zone-1",
    zoneLabel: "ZONE 1 : START",
    stars: 2,
    accentColor: "#f59e0b",
    stageAccentClass: "from-amber-400 via-orange-500 to-slate-900",
    nodeAccentClass: "from-amber-300 to-orange-500",
  },
  {
    id: 3,
    city: "부산",
    gameKey: "memory",
    difficulty: "Easy",
    difficultyLabel: "쉬움",
    zone: "zone-1",
    zoneLabel: "ZONE 1 : START",
    stars: 3,
    accentColor: "#fdcb6e",
    stageAccentClass: "from-yellow-400 via-amber-500 to-slate-900",
    nodeAccentClass: "from-yellow-300 to-amber-500",
    isBoss: true,
    bossLabel: "ZONE BOSS",
  },
  {
    id: 4,
    city: "경주",
    gameKey: "word_assemble",
    difficulty: "Easy",
    difficultyLabel: "쉬움",
    zone: "zone-2",
    zoneLabel: "ZONE 2 : RHYTHM",
    stars: 3,
    accentColor: "#34d399",
    stageAccentClass: "from-emerald-400 via-cyan-500 to-slate-900",
    nodeAccentClass: "from-emerald-300 to-cyan-500",
  },
  {
    id: 5,
    city: "대구",
    gameKey: "balloon",
    difficulty: "Normal",
    difficultyLabel: "보통",
    zone: "zone-2",
    zoneLabel: "ZONE 2 : RHYTHM",
    stars: 4,
    accentColor: "#55efc4",
    stageAccentClass: "from-emerald-600 via-teal-600 to-slate-900",
    nodeAccentClass: "from-emerald-500 to-teal-700",
  },
  {
    id: 6,
    city: "전주",
    gameKey: "tongue_twister",
    difficulty: "Normal",
    difficultyLabel: "보통",
    zone: "zone-2",
    zoneLabel: "ZONE 2 : RHYTHM",
    stars: 4,
    accentColor: "#f472b6",
    stageAccentClass: "from-fuchsia-500 via-violet-600 to-slate-900",
    nodeAccentClass: "from-fuchsia-400 to-violet-600",
    isBoss: true,
    bossLabel: "ZONE BOSS",
  },
  {
    id: 7,
    city: "광주",
    gameKey: "tetris",
    difficulty: "Normal",
    difficultyLabel: "보통",
    zone: "zone-3",
    zoneLabel: "ZONE 3 : SPEED",
    stars: 4,
    accentColor: "#4ecdc4",
    stageAccentClass: "from-sky-500 via-cyan-600 to-slate-900",
    nodeAccentClass: "from-sky-400 to-cyan-600",
  },
  {
    id: 8,
    city: "여수",
    gameKey: "association_clear",
    difficulty: "Normal",
    difficultyLabel: "보통",
    zone: "zone-3",
    zoneLabel: "ZONE 3 : SPEED",
    stars: 4,
    accentColor: "#6c5ce7",
    stageAccentClass: "from-violet-600 via-indigo-600 to-slate-900",
    nodeAccentClass: "from-violet-500 to-indigo-700",
  },
  {
    id: 9,
    city: "강릉",
    gameKey: "word_assemble",
    difficulty: "Hard",
    difficultyLabel: "어려움",
    zone: "zone-3",
    zoneLabel: "ZONE 3 : SPEED",
    stars: 5,
    accentColor: "#00b894",
    stageAccentClass: "from-emerald-600 via-teal-700 to-slate-900",
    nodeAccentClass: "from-emerald-500 to-teal-700",
  },
  {
    id: 10,
    city: "춘천",
    gameKey: "word_select",
    difficulty: "Hard",
    difficultyLabel: "어려움",
    zone: "zone-4",
    zoneLabel: "ZONE 4 : FINAL",
    stars: 5,
    accentColor: "#f59e0b",
    stageAccentClass: "from-amber-500 via-orange-600 to-slate-900",
    nodeAccentClass: "from-amber-400 to-orange-600",
  },
  {
    id: 11,
    city: "안동",
    gameKey: "memory",
    difficulty: "Hard",
    difficultyLabel: "어려움",
    zone: "zone-4",
    zoneLabel: "ZONE 4 : FINAL",
    stars: 5,
    accentColor: "#ffeaa7",
    stageAccentClass: "from-yellow-500 via-amber-600 to-slate-900",
    nodeAccentClass: "from-yellow-400 to-amber-600",
  },
  {
    id: 12,
    city: "제주",
    gameKey: "sentence_build",
    difficulty: "Hard",
    difficultyLabel: "어려움",
    zone: "zone-4",
    zoneLabel: "ZONE 4 : FINAL",
    stars: 5,
    accentColor: "#ff7675",
    stageAccentClass: "from-orange-500 via-rose-600 to-slate-900",
    nodeAccentClass: "from-orange-400 to-rose-600",
    isBoss: true,
    bossLabel: "FINAL BOSS",
  },
];

function buildCategoryBlocks(seed: LevelSeed): GameModeCategoryBlock[] {
  const mission = getGameModeWordHunterStageMission(seed.id);
  const stageLabels = GAME_MODE_STAGE_CITY_LABELS[seed.id];
  const primaryGame = GAME_META_COPY[seed.gameKey];
  const landmarks = mission?.categories.find((category) => category.key === "landmark")?.words ?? [];
  const foods = mission?.categories.find((category) => category.key === "food_specialty")?.words ?? [];
  const cultures = mission?.categories.find((category) => category.key === "festival_culture")?.words ?? [];
  const dialects = mission?.categories.find((category) => category.key === "dialect")?.words ?? [];

  return [
    {
      tone: "food",
      label: "핵심 규칙",
      emoji: "🎮",
      chips: primaryGame.ruleChips,
    },
    {
      tone: "spot",
      label: "대표 명소",
      emoji: "🗺️",
      chips: [...landmarks.slice(0, 3), stageLabels.low[0]],
    },
    {
      tone: "dialect",
      label: "도시 단서",
      emoji: "💬",
      chips: uniqueStrings([...foods.slice(0, 2), ...cultures.slice(0, 1), ...dialects.slice(0, 1)]),
    },
    {
      tone: "festival",
      label: "훈련 목표",
      emoji: "🏁",
      chips: primaryGame.goalChips,
    },
  ];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildPreviewHeights(index: number) {
  const bases = [
    [36, 24, 42, 18, 30, 36, 42, 24],
    [28, 40, 20, 36, 44, 16, 32, 38],
    [44, 32, 48, 20, 36, 44, 28, 40],
    [38, 26, 42, 18, 34, 44, 22, 36],
  ];
  return bases[index % bases.length];
}

export const GAME_MODE_ROADMAP: GameModeLevelDefinition[] = LEVEL_SEEDS.map((seed, index) => {
  const gameCopy = GAME_META_COPY[seed.gameKey];
  return {
    id: seed.id,
    title: seed.city,
    badge: `LV.${String(seed.id).padStart(2, "0")}`,
    summary: gameCopy.summary,
    description: gameCopy.description(seed.city),
    objective: gameCopy.objective(seed.city),
    difficulty: seed.difficulty,
    difficultyLabel: seed.difficultyLabel,
    stageAccentClass: seed.stageAccentClass,
    nodeAccentClass: seed.nodeAccentClass,
    gameKey: seed.gameKey,
    zone: seed.zone,
    zoneLabel: seed.zoneLabel,
    regionTag: seed.city,
    stars: seed.stars,
    accentColor: seed.accentColor,
    isBoss: seed.isBoss,
    bossLabel: seed.bossLabel,
    categories: buildCategoryBlocks(seed),
    previewHeights: buildPreviewHeights(index),
  };
});

export const GAME_MODE_ZONE_ORDER = [
  "ZONE 1 : START",
  "ZONE 2 : RHYTHM",
  "ZONE 3 : SPEED",
  "ZONE 4 : FINAL",
] as const;

export const GAME_MODE_RANDOM_STAGE_VARIANTS: Array<{
  gameKey: GameModeGameKey;
  gameLabel: string;
  sentenceMode?: "example" | "tongue";
}> = [
  { gameKey: "association_clear", gameLabel: "연상 매칭" },
  { gameKey: "word_select", gameLabel: "단어 선택" },
  { gameKey: "word_assemble", gameLabel: "단어 조합" },
  { gameKey: "memory", gameLabel: "단어 배치" },
  { gameKey: "tetris", gameLabel: "단어 폭탄" },
  { gameKey: "balloon", gameLabel: "풍선 키우기" },
  { gameKey: "sentence_build", gameLabel: "문장 만들기", sentenceMode: "example" },
  { gameKey: "tongue_twister", gameLabel: "잿말놀이", sentenceMode: "tongue" },
];

const STAGE_THEME_EMOJIS = ["🌊", "🗺️", "⚡", "🎯", "👑"] as const;

const SUBSTAGE_META: Record<
  GameModeSubstageType,
  { label: string; gameKey: GameModeGameKey }
> = {
  tetris: { label: "단어 폭탄", gameKey: "tetris" },
  open: { label: "단어 배치", gameKey: "memory" },
  balloon: { label: "풍선 이벤트", gameKey: "balloon" },
  battle: { label: "문장 만들기", gameKey: "sentence_build" },
};

function getCategory(level: GameModeLevelDefinition, tone: GameModeCategoryTone) {
  return level.categories.find((category) => category.tone === tone);
}

function pickChips(
  level: GameModeLevelDefinition,
  stageIndex: number,
  tone: GameModeCategoryTone,
  count: number,
) {
  const chips = getCategory(level, tone)?.chips ?? [];
  if (!chips.length) return [];

  const rotated = Array.from({ length: count }, (_, index) => {
    return chips[(stageIndex + index) % chips.length];
  });

  return Array.from(new Set(rotated));
}

function toCollectTokens(text: string, fallback: string[]) {
  const stripped = text.replace(/\s+/g, "");
  const chars = Array.from(stripped).filter((char) => /[가-힣A-Za-z0-9]/.test(char));
  return (chars.length ? chars.slice(0, 5) : fallback.slice(0, 4)).map((char) =>
    char.toUpperCase(),
  );
}

function buildStageThemes(level: GameModeLevelDefinition) {
  return [
    {
      theme: `${level.title} 워밍업`,
      themeDesc: `${level.summary}의 기초 감각을 여는 구간`,
    },
    {
      theme: `${level.title} 집중`,
      themeDesc: `${level.objective}에 맞춘 핵심 반복 구간`,
    },
    {
      theme: `${level.summary} 가속`,
      themeDesc: `${level.difficultyLabel} 난도로 템포를 끌어올리는 구간`,
    },
    {
      theme: `${level.title} 응용`,
      themeDesc: `${level.description}을 실제 플레이 감각으로 연결하는 구간`,
    },
    {
      theme: `${level.title} FINAL`,
      themeDesc: `${level.bossLabel ?? "BOSS"} 패턴으로 마무리하는 구간`,
    },
  ];
}

function buildSubstages(
  level: GameModeLevelDefinition,
  sectionId: string,
  sectionOrder: number,
  theme: string,
  themeDesc: string,
  boss: boolean,
): GameModeSubstageDefinition[] {
  const foodChips = pickChips(level, sectionOrder - 1, "food", boss ? 6 : 5);
  const spotChips = pickChips(level, sectionOrder, "spot", boss ? 5 : 4);
  const rewardChips = getCategory(level, "festival")?.chips ?? [];
  const answerSource = foodChips[0] ?? level.title.replace(/\s+/g, "");
  const collectTokens = toCollectTokens(
    `${level.title}${theme}`.replace(/[^가-힣A-Za-z0-9]/g, ""),
    [...foodChips, ...spotChips],
  );

  return [
    {
      id: `${sectionId}-1`,
      order: 1,
      type: "tetris",
      title: SUBSTAGE_META.tetris.label,
      gameKey: SUBSTAGE_META.tetris.gameKey,
      chips: foodChips,
      clearLabel: boss ? "5줄 완성" : `${3 + Math.min(sectionOrder, 2)}줄 완성`,
      timeLabel: `${55 + sectionOrder * 10}초`,
      attemptsLabel: boss ? "2회" : "무제한",
      rewardLabel: rewardChips[0] ?? `코인 x${30 + sectionOrder * 10}`,
      earnedLabel: foodChips.join(" · "),
    },
    {
      id: `${sectionId}-2`,
      order: 2,
      type: "open",
      title: SUBSTAGE_META.open.label,
      gameKey: SUBSTAGE_META.open.gameKey,
      hint: `${themeDesc}와 가장 어울리는 핵심 단어는?`,
      answer: answerSource,
      clearLabel: "정답 1회 입력",
      timeLabel: boss ? "40초" : "제한없음",
      attemptsLabel: boss ? "1회" : "3회",
      rewardLabel: rewardChips[1] ?? "단어 카드 1장",
      earnedLabel: answerSource,
    },
    {
      id: `${sectionId}-3`,
      order: 3,
      type: "balloon",
      title: SUBSTAGE_META.balloon.label,
      gameKey: SUBSTAGE_META.balloon.gameKey,
      collect: collectTokens,
      clearLabel: `"${collectTokens.join("")}" 완성`,
      timeLabel: boss ? "60초 한정" : "상시",
      attemptsLabel: "1회",
      rewardLabel: rewardChips[2] ?? `코인 x${50 + sectionOrder * 5}`,
      earnedLabel: collectTokens.join(" · "),
    },
    {
      id: `${sectionId}-4`,
      order: 4,
      type: "battle",
      title: SUBSTAGE_META.battle.label,
      gameKey: SUBSTAGE_META.battle.gameKey,
      sentence: `"${theme}"에서 ${spotChips[0] ?? level.regionTag} 루틴을 이어가기`,
      clearLabel: boss ? "빈칸 2개 완성" : "빈칸 1개 완성",
      timeLabel: `${18 + sectionOrder * 2}초`,
      attemptsLabel: "1회",
      rewardLabel: rewardChips[rewardChips.length - 1] ?? "배지 보상",
      earnedLabel: spotChips.join(" · "),
    },
  ];
}

function buildSections(level: GameModeLevelDefinition): GameModeStageSectionDefinition[] {
  return buildStageThemes(level).map((themeInfo, index) => {
    const order = index + 1;
    const sectionId = `${level.id}-${order}`;
    const boss = order === 5;

    return {
      id: sectionId,
      order,
      theme: themeInfo.theme,
      themeDesc: themeInfo.themeDesc,
      emoji: STAGE_THEME_EMOJIS[index] ?? "🎮",
      boss,
      substages: buildSubstages(
        level,
        sectionId,
        order,
        themeInfo.theme,
        themeInfo.themeDesc,
        boss,
      ),
    };
  });
}

export function getGameModeStage(stageId: number) {
  return GAME_MODE_ROADMAP.find((stage) => stage.id === stageId) ?? null;
}

export function getGameModeStageDetail(stageId: number): GameModeStageDetail | null {
  const stage = getGameModeStage(stageId);
  if (!stage) return null;

  return {
    ...stage,
    sections: buildSections(stage),
  };
}

export function getGameModeStageMap(stageId: number): GameModeStageMap | null {
  const stage = getGameModeStage(stageId);
  if (!stage) return null;

  return {
    ...stage,
    nodes: buildStageThemes(stage).map((themeInfo, index) => {
      return {
        id: `${stage.id}-${index + 1}`,
        order: index + 1,
        theme: themeInfo.theme,
        themeDesc: themeInfo.themeDesc,
        emoji: STAGE_THEME_EMOJIS[index] ?? "🎮",
        boss: index === 4,
        candidateVariants: [...GAME_MODE_RANDOM_STAGE_VARIANTS],
      };
    }),
  };
}
