// src/lib/aac/intentTemplate.ts
//
// 환자가 AACBoard 에서 선택한 심볼 시퀀스를 한국어 문장으로 변환하는 규칙 기반 빌더.
// 제품제안서 p.7 "AAC 통합 - 발화 의도 AI 예측" 의 Phase 1 구현.
// Phase 1 은 결정적 규칙(=V&V 가능)이고, 누적 데이터가 충분해진 뒤 ML 기반 예측으로 대체한다.
//
// 결정 사항:
//   - 입력 시퀀스의 순서를 의미 있게 보존하지 않는다.
//     이유: 환자가 어순까지 정확히 구성하기 어렵다. 대신 카테고리(subject/noun/intent) 기반으로
//     문장을 재조립한다.
//   - subject 가 없으면 "저" 를 기본 주어로 채운다.
//   - intent 가 여러 개면 "그리고" 로 연결한다.
//   - intent 가 없고 noun 만 있으면 "저는 X 가 있어요" 가 아니라 "저 X 가 필요해요" 로 폴백한다.
//   - 모든 출력은 마침표로 끝낸다.

import {
  AAC_UNIVERSAL_INTENTS,
  AAC_UNIVERSAL_SUBJECTS,
  AacSymbol,
  findAacSymbolById,
} from "@/constants/aacData";

export interface AacIntentTemplateInput {
  /** 환자가 선택한 심볼 id 시퀀스. 중복 가능. */
  symbolIds: string[];
}

export interface AacIntentTemplateResult {
  /** 한국어 자연 문장. 빈 시퀀스 → "" */
  sentence: string;
  /** 결정 근거. 디버깅 / 치료사 검토 / V&V 결정성용. */
  decomposition: {
    subject: AacSymbol | null;
    nouns: AacSymbol[];
    intents: AacSymbol[];
    unknownIds: string[];
  };
}

const FALLBACK_SUBJECT = AAC_UNIVERSAL_SUBJECTS.find((s) => s.id === "subj/me")!;

const SPECIAL_INTENT_LABELS: Record<string, (nouns: AacSymbol[]) => string | null> = {
  // 특정 intent 는 noun 에 대해 더 자연스러운 문장 형태가 있다.
  "intent/water": (nouns) => (nouns.length === 0 ? "물 주세요" : null),
  "intent/help": () => "도와주세요",
  "intent/yes": () => "네",
  "intent/no": () => "아니요",
  "intent/toilet": () => "화장실 가고 싶어요",
};

function joinKoreanList(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return labels.slice(0, -1).join(", ") + " 그리고 " + labels[labels.length - 1];
}

export function buildAacIntentSentence(
  input: AacIntentTemplateInput,
): AacIntentTemplateResult {
  const subject: AacSymbol | null = (() => {
    for (const id of input.symbolIds) {
      const sym = findAacSymbolById(id);
      if (sym?.kind === "subject") return sym;
    }
    return null;
  })();

  const nouns: AacSymbol[] = [];
  const intents: AacSymbol[] = [];
  const unknownIds: string[] = [];

  for (const id of input.symbolIds) {
    const sym = findAacSymbolById(id);
    if (!sym) {
      unknownIds.push(id);
      continue;
    }
    if (sym.kind === "noun") nouns.push(sym);
    else if (sym.kind === "intent") intents.push(sym);
  }

  if (input.symbolIds.length === 0) {
    return {
      sentence: "",
      decomposition: { subject: null, nouns: [], intents: [], unknownIds: [] },
    };
  }

  const effectiveSubject = subject ?? FALLBACK_SUBJECT;
  const subjectLabel = effectiveSubject === FALLBACK_SUBJECT ? "저" : effectiveSubject.label;

  // 1) 특수 intent 우선 처리 (단독 또는 1개일 때만)
  if (intents.length === 1) {
    const handler = SPECIAL_INTENT_LABELS[intents[0].id];
    if (handler) {
      const special = handler(nouns);
      if (special) {
        return {
          sentence: special.endsWith(".") ? special : `${special}.`,
          decomposition: { subject, nouns, intents, unknownIds },
        };
      }
    }

    // quick 카테고리 단독 클릭 → label 자체가 완성된 호소문이라 그대로 사용한다.
    // (예: "머리가 아파요", "도와주세요", "감사합니다") 1인칭 자연 발화 형태 보존.
    if (intents[0].id.startsWith("quick/") && nouns.length === 0) {
      const label = intents[0].label;
      return {
        sentence: label.endsWith(".") ? label : `${label}.`,
        decomposition: { subject, nouns, intents, unknownIds },
      };
    }
  }

  // 2) intent 가 있는 경우: subject + (noun list +) intent list
  if (intents.length > 0) {
    const intentLabels = intents.map((i) => i.label);
    const intentJoined = joinKoreanList(intentLabels);
    if (nouns.length > 0) {
      const nounJoined = joinKoreanList(nouns.map((n) => n.label));
      return {
        sentence: `${subjectLabel} ${nounJoined} ${intentJoined}.`,
        decomposition: { subject, nouns, intents, unknownIds },
      };
    }
    return {
      sentence: `${subjectLabel} ${intentJoined}.`,
      decomposition: { subject, nouns, intents, unknownIds },
    };
  }

  // 3) intent 없이 noun 만 → 필요 표현 폴백
  if (nouns.length > 0) {
    const nounJoined = joinKoreanList(nouns.map((n) => n.label));
    return {
      sentence: `${subjectLabel} ${nounJoined} 필요해요.`,
      decomposition: { subject, nouns, intents, unknownIds },
    };
  }

  // 4) subject 만 있는 경우
  if (subject) {
    return {
      sentence: `${subject.label}.`,
      decomposition: { subject, nouns, intents, unknownIds },
    };
  }

  // 5) 알 수 없는 id 만 있는 경우
  return {
    sentence: "",
    decomposition: { subject: null, nouns: [], intents: [], unknownIds },
  };
}

/** 호환을 위한 universal intent re-export. AACBoard 에서 쓰임. */
export const AAC_UNIVERSAL_INTENT_IDS = AAC_UNIVERSAL_INTENTS.map((i) => i.id);
