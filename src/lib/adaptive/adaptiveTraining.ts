import {
  estimateAbilityEap,
  pickNextItem,
  type IrtItem,
  type IrtPrior,
  type IrtResponse,
} from "./irt";

type AdaptiveStep = 1 | 2 | 4;

export interface AdaptiveTrainingResponse {
  itemKey: string;
  correct: boolean;
}

export interface AdaptiveTrainingOrderResult<T> {
  orderedItems: T[];
  theta: number;
  sd: number;
  usedResponses: number;
  selectionMethod: "irt_mfi" | "sequential_fallback";
  nextItemKey: string | null;
  nextItemId: string | null;
  itemMetaByKey: Record<
    string,
    {
      adaptiveItemId: string;
      adaptiveTheta: number;
      adaptiveSd: number;
      itemDifficulty: number;
      itemDiscrimination: number;
      selectionMethod: "irt_mfi" | "sequential_fallback";
    }
  >;
}

function normalizeAdaptiveKey(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function inferItemParams(params: {
  step: AdaptiveStep;
  itemKey: string;
  itemText: string;
  fallbackIndex: number;
  calibratedBank?: readonly IrtItem[];
}): IrtItem {
  const normalizedText = normalizeAdaptiveKey(params.itemText);
  const normalizedKey = normalizeAdaptiveKey(params.itemKey);
  const matched = params.calibratedBank?.find((item) => {
    const idTail = String(item.id).replace(/^step\d+-/, "");
    return (
      normalizeAdaptiveKey(item.id) === normalizedKey ||
      normalizeAdaptiveKey(idTail) === normalizedText ||
      normalizeAdaptiveKey(idTail) === normalizedKey
    );
  });
  if (matched) {
    return {
      ...matched,
      metadata: {
        ...(matched.metadata ?? {}),
        source: "calibrated_bank",
        itemKey: params.itemKey,
      },
    };
  }

  const plainLength = normalizeAdaptiveKey(params.itemText).length || 1;
  const stepOffset = params.step === 1 ? -0.6 : params.step === 2 ? -0.2 : 0.2;
  const inferredDifficulty = clamp(
    stepOffset + (plainLength - 4) / 5 + params.fallbackIndex * 0.04,
    -2.5,
    2.5,
  );
  const discrimination = clamp(0.9 + Math.min(plainLength, 14) * 0.02, 0.9, 1.2);
  return {
    id: `step${params.step}-${normalizedKey || params.fallbackIndex}`,
    a: round3(discrimination),
    b: round3(inferredDifficulty),
    metadata: {
      step: params.step,
      source: "inferred_from_content",
      itemKey: params.itemKey,
      textLength: plainLength,
    },
  };
}

export function buildAdaptiveTrainingOrder<T>(params: {
  step: AdaptiveStep;
  items: readonly T[];
  responses: readonly AdaptiveTrainingResponse[];
  getItemKey: (item: T) => string;
  getItemText: (item: T) => string;
  calibratedBank?: readonly IrtItem[];
  maxItems?: number;
  prior?: IrtPrior;
}): AdaptiveTrainingOrderResult<T> {
  const maxItems = params.maxItems ?? params.items.length;
  const sourceItems = params.items.slice(0, maxItems);
  const pool = sourceItems.map((item, index) => {
    const itemKey = params.getItemKey(item);
    const itemText = params.getItemText(item);
    const irtItem = inferItemParams({
      step: params.step,
      itemKey,
      itemText,
      fallbackIndex: index,
      calibratedBank: params.calibratedBank,
    });
    return { item, itemKey, irtItem };
  });

  const byKey = new Map(pool.map((entry) => [entry.itemKey, entry]));
  const irtResponses: IrtResponse[] = [];
  const completedKeys: string[] = [];
  for (const response of params.responses) {
    if (completedKeys.includes(response.itemKey)) continue;
    const matched = byKey.get(response.itemKey);
    if (!matched) continue;
    completedKeys.push(response.itemKey);
    irtResponses.push({
      itemId: matched.irtItem.id,
      correct: response.correct,
    });
  }

  const ability = estimateAbilityEap({
    items: pool.map((entry) => entry.irtItem),
    responses: irtResponses,
    prior: params.prior,
  });
  const pick = pickNextItem({
    items: pool.map((entry) => entry.irtItem),
    theta: ability.theta,
    excludeItemIds: irtResponses.map((response) => response.itemId),
  });
  const selectedEntry = pick.selected
    ? pool.find((entry) => entry.irtItem.id === pick.selected?.id) ?? null
    : null;
  const completedItems = completedKeys
    .map((key) => byKey.get(key)?.item)
    .filter((item): item is T => Boolean(item));
  const selectedItems = selectedEntry ? [selectedEntry.item] : [];
  const remainingItems = pool
    .filter(
      (entry) =>
        !completedKeys.includes(entry.itemKey) &&
        entry.itemKey !== selectedEntry?.itemKey,
    )
    .sort((a, b) => {
      if (a.irtItem.b !== b.irtItem.b) return a.irtItem.b - b.irtItem.b;
      return a.itemKey.localeCompare(b.itemKey);
    })
    .map((entry) => entry.item);

  const itemMetaByKey = Object.fromEntries(
    pool.map((entry) => [
      entry.itemKey,
      {
        adaptiveItemId: entry.irtItem.id,
        adaptiveTheta: ability.theta,
        adaptiveSd: ability.sd,
        itemDifficulty: round3(entry.irtItem.b),
        itemDiscrimination: round3(entry.irtItem.a),
        selectionMethod: selectedEntry ? "irt_mfi" : "sequential_fallback",
      },
    ]),
  ) as AdaptiveTrainingOrderResult<T>["itemMetaByKey"];

  return {
    orderedItems: [...completedItems, ...selectedItems, ...remainingItems],
    theta: ability.theta,
    sd: ability.sd,
    usedResponses: ability.usedResponses,
    selectionMethod: selectedEntry ? "irt_mfi" : "sequential_fallback",
    nextItemKey: selectedEntry?.itemKey ?? null,
    nextItemId: selectedEntry?.irtItem.id ?? null,
    itemMetaByKey,
  };
}
