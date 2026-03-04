// src/constants/writingData.ts
import { PlaceType } from "./trainingData";
import { VISUAL_MATCHING_PROTOCOLS } from "./visualTrainingData";
import { calculateHangulStrokeCount } from "@/lib/text/hangulStroke";

export interface WritingWord {
  id: number;
  hint: string;
  emoji: string;
  answer: string;
  category: string;
  strokes: number; // 판정을 위한 획수 데이터
}
// src/constants/writingData.ts

const LABEL_META: Record<
  string,
  { hint: string; category: string; strokes: number }
> = {
  // home
  텔레비전: { hint: "방송을 보는 가전", category: "가전", strokes: 22 },
  냉장고: { hint: "음식을 차갑게 보관하는 곳", category: "가전", strokes: 17 },
  거울: { hint: "얼굴을 보는 물건", category: "생활", strokes: 10 },
  시계: { hint: "시간을 확인하는 물건", category: "생활", strokes: 10 },
  소파: { hint: "앉아서 쉬는 가구", category: "가구", strokes: 10 },
  숟가락: { hint: "밥을 떠먹는 도구", category: "주방", strokes: 22 },
  젓가락: { hint: "음식을 집는 도구", category: "주방", strokes: 20 },
  컵: { hint: "음료를 담는 용기", category: "용기", strokes: 7 },
  책: { hint: "글을 읽는 물건", category: "학습", strokes: 8 },
  빗: { hint: "머리를 정리하는 도구", category: "생활", strokes: 7 },
  리모컨: { hint: "TV 채널을 바꾸는 것", category: "가전", strokes: 15 },
  베개: { hint: "머리를 받치고 자는 것", category: "침구", strokes: 10 },

  // hospital
  붕대: { hint: "상처를 감싸는 천", category: "의료", strokes: 15 },
  주사기: { hint: "약물을 주입하는 도구", category: "의료", strokes: 11 },
  반창고: { hint: "상처에 붙이는 것", category: "의료", strokes: 17 },
  실내화: { hint: "병실에서 신는 신발", category: "생활", strokes: 17 },
  옷걸이: { hint: "옷을 거는 물건", category: "생활", strokes: 16 },
  마스크: { hint: "코와 입을 가리는 것", category: "위생", strokes: 11 },
  청진기: { hint: "가슴 소리를 듣는 도구", category: "의료", strokes: 21 },
  의사: { hint: "환자를 치료하는 사람", category: "직업", strokes: 10 },
  간호사: { hint: "환자를 돌보는 의료인", category: "직업", strokes: 17 },
  체온계: { hint: "체온을 재는 도구", category: "의료", strokes: 16 },
  휠체어: { hint: "환자를 옮기는 의자", category: "의료", strokes: 20 },

  // cafe
  커피: { hint: "향이 나는 대표 음료", category: "음료", strokes: 10 },
  케이크: { hint: "달콤한 디저트", category: "디저트", strokes: 14 },
  쿠키: { hint: "작고 바삭한 과자", category: "디저트", strokes: 10 },
  빵: { hint: "밀가루로 만든 음식", category: "식품", strokes: 9 },
  샌드위치: {
    hint: "빵 사이에 재료를 넣은 음식",
    category: "식품",
    strokes: 24,
  },
  주스: { hint: "과일로 만든 음료", category: "음료", strokes: 8 },
  차: { hint: "따뜻하게 마시는 음료", category: "음료", strokes: 4 },
  아이스크림: { hint: "차갑고 달콤한 디저트", category: "디저트", strokes: 28 },
  커피머신: { hint: "커피를 추출하는 기계", category: "가전", strokes: 23 },
  메뉴판: { hint: "음식과 가격을 보는 판", category: "용품", strokes: 15 },
  포크: { hint: "음식을 찍어 먹는 도구", category: "식기", strokes: 9 },
  테이블: { hint: "음식을 놓는 가구", category: "가구", strokes: 16 },

  // bank
  지폐: { hint: "종이로 된 돈", category: "금융", strokes: 11 },
  동전: { hint: "금속으로 된 돈", category: "금융", strokes: 11 },
  카드: { hint: "결제할 때 쓰는 것", category: "금융", strokes: 8 },
  도장: { hint: "서류에 찍는 것", category: "문구", strokes: 10 },
  ATM: { hint: "현금을 찾는 기계", category: "기기", strokes: 6 },
  통장: { hint: "돈을 넣는 책", category: "금융", strokes: 11 },
  계산기: { hint: "숫자를 계산하는 것", category: "기기", strokes: 18 },
  펜: { hint: "글씨를 쓰는 도구", category: "문구", strokes: 5 },
  번호표: { hint: "순서를 기다릴 때 받는 것", category: "서류", strokes: 15 },
  금고: { hint: "귀중품을 보관하는 곳", category: "보관", strokes: 10 },
  지갑: { hint: "돈을 넣는 물건", category: "용품", strokes: 10 },
  가방: { hint: "물건을 담아 옮기는 것", category: "용품", strokes: 11 },

  // park
  나무: { hint: "키가 크고 잎이 있는 것", category: "자연", strokes: 8 },
  꽃: { hint: "예쁜 색의 식물", category: "자연", strokes: 6 },
  벤치: { hint: "앉아서 쉬는 곳", category: "시설", strokes: 12 },
  강아지: { hint: "사람과 함께 사는 동물", category: "동물", strokes: 17 },
  자전거: { hint: "두 바퀴로 타는 것", category: "이동", strokes: 17 },
  공: { hint: "굴리거나 던지는 둥근 물건", category: "놀이", strokes: 4 },
  연: { hint: "공중에 띄우는 것", category: "놀이", strokes: 4 },
  모자: { hint: "머리에 쓰는 것", category: "의류", strokes: 8 },
  식수대: { hint: "물을 마실 수 있는 시설", category: "시설", strokes: 14 },
  쓰레기통: { hint: "쓰레기를 버리는 통", category: "시설", strokes: 25 },
  분수: { hint: "물이 솟아오르는 곳", category: "시설", strokes: 10 },
  운동화: { hint: "걷거나 뛸 때 신는 신발", category: "의류", strokes: 18 },

  // mart
  사과: { hint: "빨간 과일", category: "과일", strokes: 10 },
  바나나: { hint: "노란 과일", category: "과일", strokes: 16 },
  수박: { hint: "크고 초록색 껍질의 과일", category: "과일", strokes: 10 },
  우유: { hint: "하얀 음료", category: "음료", strokes: 9 },
  달걀: { hint: "둥근 알 모양 식품", category: "식품", strokes: 11 },
  두부: { hint: "콩으로 만든 흰 식품", category: "식품", strokes: 9 },
  카트: {
    hint: "물건을 싣고 미는 바퀴 달린 도구",
    category: "용품",
    strokes: 8,
  },
  바구니: { hint: "물건을 담는 용기", category: "용품", strokes: 13 },
  쇼핑백: { hint: "물건을 담아 들고 가는 봉투", category: "용품", strokes: 19 },
  라면: { hint: "끓여 먹는 면 요리", category: "식품", strokes: 10 },
  당근: { hint: "주황색 채소", category: "채소", strokes: 11 },
  생선: { hint: "물속에 사는 동물", category: "식품", strokes: 11 },
};

const getWordMeta = (label: string) =>
  LABEL_META[label] || {
    hint: `${label}에 해당하는 단어`,
    category: "기타",
    strokes: Math.max(4, label.length * 4),
  };

const buildWritingWords = (place: PlaceType): WritingWord[] => {
  const protocols = VISUAL_MATCHING_PROTOCOLS[place] || [];

  return protocols.map((question, index) => {
    const answerOption =
      question.options.find((opt) => opt.label === question.targetWord) ||
      question.options[0];
    const meta = getWordMeta(question.targetWord);
    const computedStrokes = calculateHangulStrokeCount(question.targetWord);

    return {
      id: index + 1,
      hint: meta.hint,
      emoji: answerOption?.emoji || "🖼️",
      answer: question.targetWord,
      category: meta.category,
      strokes: computedStrokes > 0 ? computedStrokes : meta.strokes,
    };
  });
};

export const WRITING_WORDS: Record<PlaceType, WritingWord[]> = {
  home: buildWritingWords("home"),
  hospital: buildWritingWords("hospital"),
  cafe: buildWritingWords("cafe"),
  bank: buildWritingWords("bank"),
  park: buildWritingWords("park"),
  mart: buildWritingWords("mart"),
};
