export const MEMORY_CATEGORIES = [
  { id: "fruit", label: "과일", color: "#f59e0b" },
  { id: "animal", label: "동물", color: "#34d399" },
  { id: "vehicle", label: "탈것", color: "#60a5fa" },
];

export const MEMORY_CARD_WORDS = [
  { word: "사과", category: "fruit", visual: "🍎" },
  { word: "포도", category: "fruit", visual: "🍇" },
  { word: "바나나", category: "fruit", visual: "🍌" },
  { word: "딸기", category: "fruit", visual: "🍓" },
  { word: "토끼", category: "animal", visual: "🐰" },
  { word: "강아지", category: "animal", visual: "🐶" },
  { word: "고양이", category: "animal", visual: "🐱" },
  { word: "코끼리", category: "animal", visual: "🐘" },
  { word: "자동차", category: "vehicle", visual: "🚗" },
  { word: "기차", category: "vehicle", visual: "🚆" },
  { word: "버스", category: "vehicle", visual: "🚌" },
  { word: "비행기", category: "vehicle", visual: "✈️" },
];

export const MEMORY_DIFFICULTIES = [
  { id: "easy", label: "쉬움", cardsPerCategory: 2 },
  { id: "normal", label: "보통", cardsPerCategory: 3 },
  { id: "hard", label: "어려움", cardsPerCategory: 4 },
] as const;

export type MemoryDifficultyId = (typeof MEMORY_DIFFICULTIES)[number]["id"];
