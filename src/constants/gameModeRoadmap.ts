export type GameModeGameKey =
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
  tetris: {
    key: "tetris",
    title: "한글 테트리스",
    subtitle: "집중 놀이",
    description: "정확한 발음에 반응하는 실시간 음성 조종 퍼즐",
    href: "/programs/lingo/tetris",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-sky-600/45 to-cyan-900/65",
  },
  balloon: {
    key: "balloon",
    title: "풍선 키우기",
    subtitle: "발성 훈련",
    description:
      "적정 음량을 유지해 풍선을 키우고, 너무 크게 말해 터뜨리지 않게 조절해요.",
    href: "/programs/lingo/balloon",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-emerald-600/45 to-teal-900/65",
  },
  memory: {
    key: "memory",
    title: "말로 열기",
    subtitle: "분류 훈련",
    description:
      "그림을 보고 과일, 동물, 탈것 중 맞는 답을 말해 물음표 카드를 열어요.",
    href: "/programs/lingo/memory",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-amber-500/45 to-yellow-900/65",
  },
  sentence_build: {
    key: "sentence_build",
    title: "문장 만들기",
    subtitle: "문장 훈련",
    description:
      "도시 핵심어를 활용해 문장을 만들고 또렷하게 읽어요.",
    href: "/programs/lingo/sentence",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-rose-500/45 to-orange-900/65",
  },
  tongue_twister: {
    key: "tongue_twister",
    title: "잿말놀이",
    subtitle: "속도 훈련",
    description:
      "도시 테마 잿말놀이 문장을 읽으며 정확도와 속도를 함께 훈련해요.",
    href: "/programs/lingo/sentence",
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-fuchsia-500/45 to-violet-900/65",
  },
};

export const GAME_MODE_ROADMAP: GameModeLevelDefinition[] = [
  {
    id: 1,
    title: "서울 튜토리얼",
    badge: "LV.01",
    summary: "호흡 감각 열기",
    description: "짧은 발성 유지와 기본 음량 구간에 익숙해지는 시작 구간입니다.",
    objective: "안전 구간을 유지하며 기본 발성 루틴에 적응하기",
    difficulty: "Easy",
    difficultyLabel: "쉬움",
    stageAccentClass: "from-emerald-500 via-teal-500 to-slate-900",
    nodeAccentClass: "from-emerald-400 to-teal-600",
    gameKey: "balloon",
    zone: "zone-1",
    zoneLabel: "ZONE 1 : 튜토리얼",
    regionTag: "호흡 기초",
    stars: 1,
    accentColor: "#74b9ff",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🎈", chips: ["안전 구간", "기본 발성", "작은 실수 허용", "튜토리얼"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["호흡 유지", "음량 인지", "리듬 적응", "시각 피드백"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Easy", "입문", "저속", "안정성"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.2 오픈", "발성 루틴", "기초 클리어"] },
    ],
    previewHeights: [36, 24, 42, 18, 30, 36, 42, 24],
  },
  {
    id: 2,
    title: "인천 스타트",
    badge: "LV.02",
    summary: "짧은 반응 만들기",
    description: "떨어지는 블록에 맞춰 한글 발화를 빠르게 반응하는 구간입니다.",
    objective: "짧은 단어 발화를 리듬에 맞춰 반응하기",
    difficulty: "Easy",
    difficultyLabel: "쉬움",
    stageAccentClass: "from-sky-500 via-cyan-500 to-slate-900",
    nodeAccentClass: "from-sky-400 to-cyan-600",
    gameKey: "tetris",
    zone: "zone-1",
    zoneLabel: "ZONE 1 : 튜토리얼",
    regionTag: "반응 기초",
    stars: 2,
    accentColor: "#81ecec",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🍜", chips: ["낙하 속도", "음성 입력", "단어 매칭", "기초 퍼즐"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["반응 속도", "짧은 발화", "시선 집중", "타이밍"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Easy", "초반 속도", "짧은 목표", "입문"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.3 오픈", "집중 루프", "초기 리듬"] },
    ],
    previewHeights: [28, 40, 20, 36, 44, 16, 32],
  },
  {
    id: 3,
    title: "부산 분류전",
    badge: "LV.03",
    summary: "카테고리 예열",
    description: "이미지를 보고 분류어를 빠르게 떠올리는 초반 선택 구간입니다.",
    objective: "기초 카테고리 말하기를 망설임 없이 이어가기",
    difficulty: "Easy",
    difficultyLabel: "쉬움",
    stageAccentClass: "from-amber-400 via-yellow-500 to-slate-900",
    nodeAccentClass: "from-amber-300 to-yellow-500",
    gameKey: "memory",
    zone: "zone-2",
    zoneLabel: "ZONE 2 : 남부 해안",
    regionTag: "분류 입문",
    stars: 3,
    accentColor: "#fd79a8",
    isBoss: true,
    bossLabel: "ZONE BOSS",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🍜", chips: ["카드 오픈", "말로 분류", "연속 판정", "즉시 반응"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["시각 자극", "범주 판단", "구두 반응", "주의 전환"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Easy", "짧은 제한", "기초 범주", "입문"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.4 오픈", "분류 감각", "초기 연속성"] },
    ],
    previewHeights: [44, 32, 48, 20, 36, 44, 28, 40],
  },
  {
    id: 4,
    title: "경주 문장전",
    badge: "LV.04",
    summary: "문장 스타트",
    description: "짧은 문장을 안정적으로 읽고 공격 타이밍을 익히는 구간입니다.",
    objective: "짧은 문장 발화를 정확하게 끝까지 유지하기",
    difficulty: "Easy",
    difficultyLabel: "쉬움",
    stageAccentClass: "from-rose-400 via-orange-500 to-slate-900",
    nodeAccentClass: "from-rose-300 to-orange-500",
    gameKey: "sentence_build",
    zone: "zone-2",
    zoneLabel: "ZONE 2 : 남부 해안",
    regionTag: "문장 입문",
    stars: 3,
    accentColor: "#fdcb6e",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🍜", chips: ["문장 읽기", "명중 판정", "전투 연출", "기초 리듬"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["문장 유지", "호흡 분절", "정확도", "재도전"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Easy", "짧은 문장", "낮은 기준", "입문"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.5 오픈", "문장 루프", "기초 클리어"] },
    ],
    previewHeights: [38, 26, 42, 18, 34, 44, 22],
  },
  {
    id: 5,
    title: "대구 호흡전",
    badge: "LV.05",
    summary: "호흡 조절 심화",
    description: "발성 길이가 늘어나며 일정한 호흡 압력을 유지해야 하는 구간입니다.",
    objective: "길어진 발성 유지 시간 동안 음량 흔들림 줄이기",
    difficulty: "Normal",
    difficultyLabel: "보통",
    stageAccentClass: "from-emerald-600 via-teal-600 to-slate-900",
    nodeAccentClass: "from-emerald-500 to-teal-700",
    gameKey: "balloon",
    zone: "zone-2",
    zoneLabel: "ZONE 2 : 남부 해안",
    regionTag: "호흡 심화",
    stars: 4,
    accentColor: "#e17055",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🎈", chips: ["긴 유지", "감소 패널티", "정밀 조절", "연속 발성"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["호흡 압력", "속도 안정", "지속력", "회복"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Normal", "중간 시간", "조절 필요", "실수 경고"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.6 오픈", "중급 루틴", "유지력"] },
    ],
    previewHeights: [30, 46, 22, 38, 44, 18, 36],
  },
  {
    id: 6,
    title: "전주 속도전",
    badge: "LV.06",
    summary: "발화 속도 올리기",
    description: "한글 테트리스의 낙하 속도가 올라가면서 반응 속도를 요구합니다.",
    objective: "짧은 발화를 더 빠른 속도에 맞춰 정확하게 입력하기",
    difficulty: "Normal",
    difficultyLabel: "보통",
    stageAccentClass: "from-sky-600 via-blue-600 to-slate-900",
    nodeAccentClass: "from-sky-500 to-blue-700",
    gameKey: "tetris",
    zone: "zone-3",
    zoneLabel: "ZONE 3 : 전라·충청",
    regionTag: "속도 심화",
    stars: 4,
    accentColor: "#55efc4",
    isBoss: true,
    bossLabel: "ZONE BOSS",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🍜", chips: ["속도 상승", "낙하 압박", "짧은 구문", "반응 퍼즐"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["반응 속도", "빠른 매칭", "집중 유지", "리듬"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Normal", "중속 낙하", "중간 길이", "가속"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.7 오픈", "중급 반응", "가속 해금"] },
    ],
    previewHeights: [40, 28, 46, 18, 34, 48, 24, 38],
  },
  {
    id: 7,
    title: "광주 압박전",
    badge: "LV.07",
    summary: "분류 선택 압박",
    description: "선택 시간과 카드 부담이 늘어나는 중반 분류 구간입니다.",
    objective: "시각 자극을 빠르게 해석해 올바른 카테고리 말하기",
    difficulty: "Normal",
    difficultyLabel: "보통",
    stageAccentClass: "from-amber-500 via-orange-500 to-slate-900",
    nodeAccentClass: "from-amber-400 to-orange-600",
    gameKey: "memory",
    zone: "zone-3",
    zoneLabel: "ZONE 3 : 전라·충청",
    regionTag: "분류 심화",
    stars: 4,
    accentColor: "#00cec9",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🍜", chips: ["카드 증가", "시간 압박", "연속 분류", "리셋 관리"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["시각 탐색", "범주 전환", "빠른 발화", "주의 집중"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Normal", "중간 제한", "반복 입력", "압박"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.8 오픈", "분류 속도", "중급 반복"] },
    ],
    previewHeights: [32, 44, 20, 40, 26, 46, 30],
  },
  {
    id: 8,
    title: "여수 공방전",
    badge: "LV.08",
    summary: "문장 안정화",
    description: "문장 길이와 반격 압박이 함께 올라가는 전환 구간입니다.",
    objective: "문장 정확도를 유지하면서 실수 복구 속도 높이기",
    difficulty: "Normal",
    difficultyLabel: "보통",
    stageAccentClass: "from-rose-500 via-pink-600 to-slate-900",
    nodeAccentClass: "from-rose-400 to-pink-600",
    gameKey: "sentence_build",
    zone: "zone-3",
    zoneLabel: "ZONE 3 : 전라·충청",
    regionTag: "문장 심화",
    stars: 4,
    accentColor: "#6c5ce7",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🍜", chips: ["중간 문장", "전투 압박", "정확도 기준", "실수 복구"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["문장 흐름", "호흡 배분", "리듬 유지", "재공격"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Normal", "중간 길이", "반격 증가", "안정화"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.9 오픈", "중급 문장", "전투 루틴"] },
    ],
    previewHeights: [36, 48, 22, 40, 28, 44, 18],
  },
  {
    id: 9,
    title: "강릉 장기전",
    badge: "LV.09",
    summary: "긴 발성 유지",
    description: "조금만 흔들려도 위험 구간에 들어가는 중후반 발성 구간입니다.",
    objective: "장시간 발성에서 일정한 힘과 속도 유지하기",
    difficulty: "Hard",
    difficultyLabel: "어려움",
    stageAccentClass: "from-emerald-700 via-cyan-700 to-slate-900",
    nodeAccentClass: "from-emerald-600 to-cyan-700",
    gameKey: "balloon",
    zone: "zone-4",
    zoneLabel: "ZONE 4 : 강원·제주",
    regionTag: "호흡 고난도",
    stars: 5,
    accentColor: "#00b894",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🎈", chips: ["긴 발성", "좁은 안전폭", "위험 축적", "실수 최소화"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["장기 유지", "미세 조절", "집중력", "복구력"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Hard", "좁은 구간", "긴 시간", "고난도"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.10 오픈", "고난도 호흡", "장기전 루틴"] },
    ],
    previewHeights: [42, 30, 48, 24, 38, 44, 20, 36],
  },
  {
    id: 10,
    title: "춘천 복합전",
    badge: "LV.10",
    summary: "복합 반응 구간",
    description: "테트리스 목표 길이와 처리 속도가 동시에 높아지는 구간입니다.",
    objective: "빠른 리듬 속에서 길어진 발화 목표를 놓치지 않기",
    difficulty: "Hard",
    difficultyLabel: "어려움",
    stageAccentClass: "from-indigo-600 via-sky-700 to-slate-900",
    nodeAccentClass: "from-indigo-500 to-sky-700",
    gameKey: "tetris",
    zone: "zone-4",
    zoneLabel: "ZONE 4 : 강원·제주",
    regionTag: "복합 반응",
    stars: 5,
    accentColor: "#badc58",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🍜", chips: ["긴 목표", "빠른 낙하", "복합 매칭", "고속 판정"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["복합 집중", "구문 처리", "리듬 추적", "즉시 발화"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Hard", "고속", "긴 구문", "복합"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.11 오픈", "상급 반응", "복합 처리"] },
    ],
    previewHeights: [34, 46, 26, 42, 18, 40, 32],
  },
  {
    id: 11,
    title: "안동 반복전",
    badge: "LV.11",
    summary: "빠른 분류 반복",
    description: "카드 회전과 제한 시간이 더 빡빡해지는 고난도 분류 구간입니다.",
    objective: "연속 자극에서도 카테고리 전환 실수 줄이기",
    difficulty: "Hard",
    difficultyLabel: "어려움",
    stageAccentClass: "from-yellow-500 via-amber-600 to-slate-900",
    nodeAccentClass: "from-yellow-400 to-amber-600",
    gameKey: "memory",
    zone: "zone-4",
    zoneLabel: "ZONE 4 : 강원·제주",
    regionTag: "분류 고난도",
    stars: 5,
    accentColor: "#ffeaa7",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🍜", chips: ["최대 카드", "빠른 회전", "연속 입력", "실수 누적"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["전환 속도", "시각 검색", "분류 유지", "오류 억제"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Hard", "빡빡한 시간", "고반복", "집중"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["Lv.12 오픈", "상급 분류", "최종전 준비"] },
    ],
    previewHeights: [44, 32, 48, 22, 38, 46, 28, 40],
  },
  {
    id: 12,
    title: "제주 파이널",
    badge: "LV.12",
    summary: "문장 리듬 압박",
    description: "문장 대결의 공격-방어 템포가 빨라지는 고난도 구간입니다.",
    objective: "긴 문장을 흔들림 없이 읽고 정확도 편차 줄이기",
    difficulty: "Hard",
    difficultyLabel: "어려움",
    stageAccentClass: "from-orange-500 via-rose-600 to-slate-900",
    nodeAccentClass: "from-orange-400 to-rose-600",
    gameKey: "sentence_build",
    zone: "zone-4",
    zoneLabel: "ZONE 4 : 강원·제주",
    regionTag: "FINAL BOSS",
    stars: 5,
    accentColor: "#ff7675",
    isBoss: true,
    bossLabel: "FINAL BOSS",
    categories: [
      { tone: "food", label: "핵심 규칙", emoji: "🍜", chips: ["긴 문장", "빠른 템포", "상대 반격", "최종 시험"] },
      { tone: "spot", label: "훈련 포인트", emoji: "🗺️", chips: ["호흡 완성", "정확도 유지", "리듬 압박", "문장 복원"] },
      { tone: "dialect", label: "난이도 정보", emoji: "💬", chips: ["Hard", "최종 단계", "최고 압박", "보스전"] },
      { tone: "festival", label: "해금 보상", emoji: "🎉", chips: ["엔딩 도달", "파이널 클리어", "최종 기록"] },
    ],
    previewHeights: [48, 38, 50, 28, 44, 50, 32, 46, 38],
  },
];

export const GAME_MODE_ZONE_ORDER = [
  "ZONE 1 : 튜토리얼",
  "ZONE 2 : 남부 해안",
  "ZONE 3 : 전라·충청",
  "ZONE 4 : 강원·제주",
] as const;

export const GAME_MODE_RANDOM_STAGE_VARIANTS: Array<{
  gameKey: GameModeGameKey;
  gameLabel: string;
  sentenceMode?: "example" | "tongue";
}> = [
  { gameKey: "memory", gameLabel: "말로 열기" },
  { gameKey: "tetris", gameLabel: "테트리스" },
  { gameKey: "balloon", gameLabel: "풍선 키우기" },
  { gameKey: "sentence_build", gameLabel: "문장 만들기", sentenceMode: "example" },
  { gameKey: "tongue_twister", gameLabel: "잿말놀이", sentenceMode: "tongue" },
];

const STAGE_THEME_EMOJIS = ["🌊", "🗺️", "⚡", "🎯", "👑"] as const;

const SUBSTAGE_META: Record<
  GameModeSubstageType,
  { label: string; gameKey: GameModeGameKey }
> = {
  tetris: { label: "테트리스", gameKey: "tetris" },
  open: { label: "말로 열기", gameKey: "memory" },
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
      themeDesc: `${level.regionTag} 감각을 여는 시작 구간`,
    },
    {
      theme: `${level.regionTag} 집중`,
      themeDesc: `${level.objective}에 맞춘 핵심 반복 구간`,
    },
    {
      theme: `${level.summary} 가속`,
      themeDesc: `${level.difficultyLabel} 템포로 반응을 끌어올리는 구간`,
    },
    {
      theme: `${level.title} 응용`,
      themeDesc: `${level.description}을 실제 플레이 흐름으로 묶는 구간`,
    },
    {
      theme: `${level.title} FINAL`,
      themeDesc: `${level.bossLabel ?? "BOSS"} 패턴으로 마무리하는 보스 구간`,
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

  const openHint = `${themeDesc}와 가장 어울리는 핵심 단어는?`;
  const battleSentence = `"${theme}에서 ${spotChips[0] ?? level.regionTag} 루틴을 ___로 이어가기"`;

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
      hint: openHint,
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
      sentence: battleSentence,
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
