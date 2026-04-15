export type Step1Record = {
  sessionId: string;
  place: string;
  step: 1;

  questionId: string;
  audioSrc: string;

  selectedId: string;
  selectedLabel: string;

  rtMs: number;
  playedCount: number;

  createdAt: number;
};

const KEY = "btt.training.v1";

type StoreShape = {
  records: Step1Record[];
};

export function loadStore(): StoreShape {
  if (typeof window === "undefined") return { records: [] };

  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) {
    const init: StoreShape = { records: [] };
    window.sessionStorage.setItem(KEY, JSON.stringify(init));
    return init;
  }

  try {
    return JSON.parse(raw) as StoreShape;
  } catch {
    const init: StoreShape = { records: [] };
    window.sessionStorage.setItem(KEY, JSON.stringify(init));
    return init;
  }
}

export function appendRecord(record: Step1Record) {
  const store = loadStore();
  const next: StoreShape = { records: [...store.records, record] };
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
}

export function getRecords() {
  return loadStore().records;
}

export function clearRecords() {
  const next: StoreShape = { records: [] };
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
}
