// src/constants/aacData.ts
//
// AAC (보완대체 의사소통) Phase 1 어휘 시드.
// 제품제안서 p.7 5채널 중 5번 보조 채널 (AAC) 의 데이터 자산.
//
// 설계 결정:
//   - 픽토그램은 emoji 재사용 (라이선스 부담 0). visualTrainingData 의 emoji 자산을
//     동일 단어에 한해 그대로 가져온다.
//   - 카테고리 축은 기존 PlaceType (home/hospital/cafe/bank/park/mart) 6 곳을 따른다.
//     기존 step 훈련의 멘탈 모델과 동일하게 유지하기 위함.
//   - 한 place 당:
//       * subjects: 1차 사용자 본인 / 가족 / 의료진 등 화자/대상자 (place 와 독립)
//       * nouns:    place 안에서 자주 쓰는 사물 (visualTrainingData 의 PLACE_SEEDS reuse)
//       * intents:  발화 의도 (행위·감정·상태). place 별로 임상 빈도 높은 것 우선.
//   - 모든 항목은 결정성 있는 stable id 를 가진다. (DB 저장 / V&V 비교용)
//
// Phase 2 이후 calibration:
//   - 임상가 검토로 frequency 가중 조정
//   - 환자 개인화 vocab (aac_user_vocab 테이블) 시 본 시드를 base 로 fork
//   - 사용 로그 기반 추천 (사용 빈도 sort) 단계는 P2

import type { PlaceType } from "./trainingData";

export type AacSymbolKind = "subject" | "noun" | "intent";

export interface AacSymbol {
  /** stable id (DB 저장 / V&V 결정성용). place + kind + slug 형식. */
  id: string;
  label: string;
  emoji: string;
  kind: AacSymbolKind;
  /** undefined 면 모든 place 공통. */
  place?: PlaceType;
  /** 초기 임상 빈도 가중치 (1=낮음, 5=매우 높음). 시드는 균일하게 3, 핵심만 5. */
  frequency: number;
}

// ---------------------------------------------------------------------------
// Universal subjects & core intents (place 와 독립)
// ---------------------------------------------------------------------------

export const AAC_UNIVERSAL_SUBJECTS: AacSymbol[] = [
  { id: "subj/me", label: "저", emoji: "🙋", kind: "subject", frequency: 5 },
  { id: "subj/family", label: "가족", emoji: "👨‍👩‍👧", kind: "subject", frequency: 4 },
  { id: "subj/doctor", label: "의사", emoji: "🧑‍⚕️", kind: "subject", frequency: 4 },
  { id: "subj/staff", label: "직원", emoji: "🧑‍💼", kind: "subject", frequency: 3 },
  { id: "subj/you", label: "너", emoji: "👉", kind: "subject", frequency: 3 },
];

export const AAC_UNIVERSAL_INTENTS: AacSymbol[] = [
  { id: "intent/yes", label: "네", emoji: "✅", kind: "intent", frequency: 5 },
  { id: "intent/no", label: "아니요", emoji: "❌", kind: "intent", frequency: 5 },
  { id: "intent/help", label: "도와주세요", emoji: "🆘", kind: "intent", frequency: 5 },
  { id: "intent/pain", label: "아파요", emoji: "🤕", kind: "intent", frequency: 5 },
  { id: "intent/more", label: "더", emoji: "➕", kind: "intent", frequency: 4 },
  { id: "intent/stop", label: "그만", emoji: "✋", kind: "intent", frequency: 4 },
  { id: "intent/toilet", label: "화장실", emoji: "🚻", kind: "intent", frequency: 5 },
  { id: "intent/water", label: "물", emoji: "💧", kind: "intent", frequency: 5 },
  { id: "intent/like", label: "좋아요", emoji: "👍", kind: "intent", frequency: 4 },
  { id: "intent/dislike", label: "싫어요", emoji: "👎", kind: "intent", frequency: 4 },
];

// ---------------------------------------------------------------------------
// Quick-access core expressions (장소와 무관, 임상 우선순위 최상위)
// ---------------------------------------------------------------------------
//
// AAC 의사 표현에서 가장 빈도가 높고 임상적으로 시급한 4개 영역:
//   - emergency : 응급/도움 요청 (즉시 호출 가능해야 함)
//   - feeling   : 감정 호소 (의식·정서 상태)
//   - body_pain : 신체 부위 통증 (어디가 아픈지 빠르게 가리키기)
//   - greeting  : 사회적 의례 (의사소통 유지)
//
// 모든 quick 항목은 "단독 클릭 = 1문장 호소" 가 되도록 label 자체가 완성형.
// intentTemplate 의 quick 단독 분기에서 라벨을 그대로 출력한다.

export type AacQuickCategory =
  | "emergency"
  | "feeling"
  | "body_pain"
  | "greeting";

export interface AacQuickGroup {
  key: AacQuickCategory;
  title: string;
  shortTitle: string;
  /** 카테고리 톤. AACBoard 색상 매핑에 사용. */
  tone: "rose" | "sky" | "amber" | "emerald";
  items: Array<{ label: string; emoji: string; frequency?: number }>;
}

export const AAC_QUICK_GROUPS: AacQuickGroup[] = [
  {
    key: "emergency",
    title: "긴급 호소",
    shortTitle: "긴급",
    tone: "rose",
    items: [
      { label: "도와주세요", emoji: "🆘", frequency: 5 },
      { label: "119 불러주세요", emoji: "🚑", frequency: 5 },
      { label: "숨이 안 쉬어져요", emoji: "🫁", frequency: 5 },
      { label: "가슴이 답답해요", emoji: "💔", frequency: 5 },
      { label: "어지러워요", emoji: "💫", frequency: 4 },
      { label: "쓰러질 것 같아요", emoji: "😵", frequency: 4 },
    ],
  },
  {
    key: "feeling",
    title: "감정 표현",
    shortTitle: "감정",
    tone: "sky",
    items: [
      { label: "기뻐요", emoji: "😊", frequency: 4 },
      { label: "슬퍼요", emoji: "😢", frequency: 4 },
      { label: "화나요", emoji: "😡", frequency: 4 },
      { label: "무서워요", emoji: "😨", frequency: 5 },
      { label: "외로워요", emoji: "😔", frequency: 4 },
      { label: "불안해요", emoji: "😟", frequency: 4 },
    ],
  },
  {
    key: "body_pain",
    title: "통증 부위",
    shortTitle: "통증",
    tone: "amber",
    items: [
      { label: "머리가 아파요", emoji: "🤕", frequency: 5 },
      { label: "가슴이 아파요", emoji: "❤️‍🩹", frequency: 5 },
      { label: "배가 아파요", emoji: "🤢", frequency: 5 },
      { label: "허리가 아파요", emoji: "🦴", frequency: 4 },
      { label: "팔이 아파요", emoji: "💪", frequency: 4 },
      { label: "다리가 아파요", emoji: "🦵", frequency: 4 },
    ],
  },
  {
    key: "greeting",
    title: "인사·예의",
    shortTitle: "인사",
    tone: "emerald",
    items: [
      { label: "안녕하세요", emoji: "👋", frequency: 4 },
      { label: "감사합니다", emoji: "🙏", frequency: 5 },
      { label: "죄송합니다", emoji: "🙇", frequency: 4 },
      { label: "안녕히 가세요", emoji: "👋", frequency: 3 },
    ],
  },
];

/** quick 카테고리 전체를 1차원 배열로 평탄화 + stable id 부여. */
export const AAC_QUICK_SYMBOLS: AacSymbol[] = AAC_QUICK_GROUPS.flatMap(
  (group) =>
    group.items.map((item, idx) => ({
      id: `quick/${group.key}/${idx}`,
      label: item.label,
      emoji: item.emoji,
      kind: "intent" as const,
      frequency: item.frequency ?? 4,
    })),
);

/** quick 심볼을 카테고리별로 다시 묶은 형태 (AACBoard 가 카테고리 그리드를 그릴 때 사용). */
export const AAC_QUICK_SYMBOLS_BY_CATEGORY: Record<AacQuickCategory, AacSymbol[]> =
  AAC_QUICK_GROUPS.reduce(
    (acc, group) => {
      acc[group.key] = AAC_QUICK_SYMBOLS.filter((s) =>
        s.id.startsWith(`quick/${group.key}/`),
      );
      return acc;
    },
    {
      emergency: [],
      feeling: [],
      body_pain: [],
      greeting: [],
    } as Record<AacQuickCategory, AacSymbol[]>,
  );

// ---------------------------------------------------------------------------
// Place-specific nouns (visualTrainingData PLACE_SEEDS 재사용 with stable ids)
// ---------------------------------------------------------------------------

const PLACE_NOUN_SEEDS: Record<PlaceType, Array<{ label: string; emoji: string }>> = {
  home: [
    { label: "텔레비전", emoji: "📺" },
    { label: "냉장고", emoji: "🧊" },
    { label: "시계", emoji: "⏰" },
    { label: "소파", emoji: "🛋️" },
    { label: "숟가락", emoji: "🥄" },
    { label: "컵", emoji: "☕" },
    { label: "책", emoji: "📘" },
    { label: "리모컨", emoji: "🎮" },
    { label: "베개", emoji: "🛏️" },
  ],
  hospital: [
    { label: "약", emoji: "💊" },
    { label: "주사기", emoji: "💉" },
    { label: "마스크", emoji: "😷" },
    { label: "청진기", emoji: "🩺" },
    { label: "체온계", emoji: "🌡️" },
    { label: "휠체어", emoji: "🦽" },
    { label: "붕대", emoji: "🩹" },
    { label: "검사실", emoji: "🔬" },
    { label: "처방전", emoji: "📄" },
  ],
  cafe: [
    { label: "커피", emoji: "☕" },
    { label: "케이크", emoji: "🍰" },
    { label: "샌드위치", emoji: "🥪" },
    { label: "주스", emoji: "🧃" },
    { label: "차", emoji: "🍵" },
    { label: "메뉴판", emoji: "📜" },
    { label: "테이블", emoji: "🪑" },
    { label: "영수증", emoji: "🧾" },
    { label: "설탕", emoji: "🍬" },
  ],
  bank: [
    { label: "지폐", emoji: "💵" },
    { label: "동전", emoji: "🪙" },
    { label: "카드", emoji: "💳" },
    { label: "통장", emoji: "📕" },
    { label: "ATM", emoji: "🏧" },
    { label: "번호표", emoji: "🎫" },
    { label: "지갑", emoji: "👛" },
    { label: "도장", emoji: "💮" },
    { label: "비밀번호", emoji: "🔢" },
  ],
  park: [
    { label: "나무", emoji: "🌳" },
    { label: "꽃", emoji: "🌸" },
    { label: "벤치", emoji: "🪵" },
    { label: "강아지", emoji: "🐶" },
    { label: "자전거", emoji: "🚲" },
    { label: "공", emoji: "⚽" },
    { label: "분수", emoji: "⛲" },
    { label: "햇볕", emoji: "☀️" },
    { label: "운동화", emoji: "👟" },
  ],
  mart: [
    { label: "사과", emoji: "🍎" },
    { label: "바나나", emoji: "🍌" },
    { label: "우유", emoji: "🥛" },
    { label: "달걀", emoji: "🥚" },
    { label: "라면", emoji: "🍜" },
    { label: "카트", emoji: "🛒" },
    { label: "바구니", emoji: "🧺" },
    { label: "쇼핑백", emoji: "🛍️" },
    { label: "계산대", emoji: "🧾" },
  ],
};

// ---------------------------------------------------------------------------
// Place-specific intents (임상 빈도 우선 신규 큐레이션)
// ---------------------------------------------------------------------------

const PLACE_INTENT_SEEDS: Record<PlaceType, Array<{ label: string; emoji: string; frequency?: number }>> = {
  home: [
    { label: "자고 싶어요", emoji: "😴", frequency: 5 },
    { label: "먹고 싶어요", emoji: "🍽️", frequency: 5 },
    { label: "추워요", emoji: "🥶" },
    { label: "더워요", emoji: "🥵" },
    { label: "씻을래요", emoji: "🚿" },
    { label: "누울래요", emoji: "🛌" },
    { label: "TV 볼래요", emoji: "📺" },
    { label: "가족 보고 싶어요", emoji: "💖", frequency: 4 },
  ],
  hospital: [
    { label: "약 주세요", emoji: "💊", frequency: 5 },
    { label: "어지러워요", emoji: "💫" },
    { label: "답답해요", emoji: "😮‍💨" },
    { label: "토할 것 같아요", emoji: "🤢" },
    { label: "잠이 안 와요", emoji: "🌙" },
    { label: "검사 받았어요", emoji: "🔬" },
    { label: "퇴원할래요", emoji: "🏠" },
    { label: "의사 만날래요", emoji: "🧑‍⚕️" },
  ],
  cafe: [
    { label: "따뜻하게 주세요", emoji: "🔥", frequency: 5 },
    { label: "차갑게 주세요", emoji: "🧊", frequency: 5 },
    { label: "설탕 빼주세요", emoji: "🚫" },
    { label: "한 잔 더", emoji: "➕" },
    { label: "주문할게요", emoji: "🛎️" },
    { label: "영수증 주세요", emoji: "🧾" },
    { label: "고마워요", emoji: "🙏", frequency: 4 },
    { label: "잘 마셨어요", emoji: "😋" },
  ],
  bank: [
    { label: "입금할게요", emoji: "📥", frequency: 5 },
    { label: "출금할게요", emoji: "📤", frequency: 5 },
    { label: "통장 만들래요", emoji: "📕" },
    { label: "카드 분실했어요", emoji: "❗" },
    { label: "비밀번호 바꿀래요", emoji: "🔢" },
    { label: "모르겠어요", emoji: "🤔" },
    { label: "다시 알려주세요", emoji: "🔁" },
    { label: "끝났어요", emoji: "✔️" },
  ],
  park: [
    { label: "산책 가요", emoji: "🚶" },
    { label: "햇볕 좋아요", emoji: "☀️" },
    { label: "시원해요", emoji: "🍃" },
    { label: "앉을게요", emoji: "🪑" },
    { label: "걷고 싶어요", emoji: "👣" },
    { label: "쉬고 싶어요", emoji: "😌", frequency: 4 },
    { label: "강아지 봐요", emoji: "🐶" },
    { label: "사진 찍어주세요", emoji: "📷" },
  ],
  mart: [
    { label: "살게요", emoji: "🛍️", frequency: 5 },
    { label: "안 살래요", emoji: "🚫" },
    { label: "더 필요해요", emoji: "➕" },
    { label: "어디에 있어요", emoji: "❓" },
    { label: "얼마예요", emoji: "💰", frequency: 5 },
    { label: "비싸요", emoji: "📈" },
    { label: "싸요", emoji: "📉" },
    { label: "계산해주세요", emoji: "🧾" },
  ],
};

function buildPlaceSymbols(place: PlaceType): AacSymbol[] {
  const nouns = PLACE_NOUN_SEEDS[place].map((seed, idx) => ({
    id: `noun/${place}/${idx}`,
    label: seed.label,
    emoji: seed.emoji,
    kind: "noun" as const,
    place,
    frequency: 3,
  }));
  const intents = PLACE_INTENT_SEEDS[place].map((seed, idx) => ({
    id: `intent/${place}/${idx}`,
    label: seed.label,
    emoji: seed.emoji,
    kind: "intent" as const,
    place,
    frequency: seed.frequency ?? 3,
  }));
  return [...nouns, ...intents];
}

export const AAC_PLACE_SYMBOLS: Record<PlaceType, AacSymbol[]> = {
  home: buildPlaceSymbols("home"),
  hospital: buildPlaceSymbols("hospital"),
  cafe: buildPlaceSymbols("cafe"),
  bank: buildPlaceSymbols("bank"),
  park: buildPlaceSymbols("park"),
  mart: buildPlaceSymbols("mart"),
};

/**
 * 화면에 노출할 한 place 의 전체 심볼 = universal subjects + universal intents + place symbols.
 * 호출자(컴포넌트)는 kind 별 그룹핑하여 그리드를 만든다.
 */
export function getAacSymbolsForPlace(place: PlaceType): AacSymbol[] {
  return [
    ...AAC_UNIVERSAL_SUBJECTS,
    ...AAC_UNIVERSAL_INTENTS,
    ...AAC_PLACE_SYMBOLS[place],
  ];
}

/** id → symbol 빠른 조회. 결정성 보장. */
export function findAacSymbolById(id: string): AacSymbol | undefined {
  if (id.startsWith("subj/")) {
    return AAC_UNIVERSAL_SUBJECTS.find((s) => s.id === id);
  }
  if (id.startsWith("quick/")) {
    return AAC_QUICK_SYMBOLS.find((s) => s.id === id);
  }
  if (id.startsWith("intent/") && id.split("/").length === 2) {
    return AAC_UNIVERSAL_INTENTS.find((s) => s.id === id);
  }
  for (const place of Object.keys(AAC_PLACE_SYMBOLS) as PlaceType[]) {
    const hit = AAC_PLACE_SYMBOLS[place].find((s) => s.id === id);
    if (hit) return hit;
  }
  return undefined;
}
