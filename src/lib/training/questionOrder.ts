export function shuffleTrainingItems<T>(items: readonly T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function getSessionShuffledItems<T>(
  storageKey: string,
  items: readonly T[],
  getItemId: (item: T) => string,
): T[] {
  const source = [...items];
  if (typeof window === "undefined" || source.length <= 1) {
    return shuffleTrainingItems(source);
  }

  const byId = new Map(source.map((item) => [getItemId(item), item]));
  const canonicalIds = source.map(getItemId);
  try {
    const raw = sessionStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (
      Array.isArray(parsed) &&
      parsed.length === canonicalIds.length &&
      parsed.every((id) => byId.has(String(id)))
    ) {
      return parsed.map((id) => byId.get(String(id))!).filter(Boolean);
    }
  } catch {
    // Ignore malformed shuffle state and generate a fresh order.
  }

  const shuffled = shuffleTrainingItems(source);
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify(shuffled.map((item) => getItemId(item))),
    );
  } catch {
    // Session storage is best-effort; the shuffled order still works in memory.
  }
  return shuffled;
}
