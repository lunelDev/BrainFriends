import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type TherapistFollowUpState =
  | "none"
  | "monitor"
  | "follow_up"
  | "priority";

/**
 * 치료사가 환자에 대해 남기는 단일 메모 entry.
 * 기존(v1) 의 단일 메모 모델에서 v2 로 확장 — 환자당 history[] 로 누적.
 */
export type TherapistPatientNoteEntry = {
  id: string;
  memo: string;
  updatedAt: string;
  updatedBy: string;
};

/**
 * 환자 1명의 치료사 메모 레코드.
 * - followUpState 는 항상 1개(덮어쓰기). 변경 시 history 의 가장 최근 항목과 별개.
 * - history 는 최신순. 최대 MAX_HISTORY 개를 넘으면 오래된 것부터 자동 trim.
 *
 * 호환 필드:
 * - memo / updatedAt / updatedBy 는 history[0] 의 값을 그대로 반영해 채워둔다.
 *   기존 v1 호출자(컴포넌트·집계)가 단일 메모로 읽어도 동작하도록.
 */
export type TherapistPatientNote = {
  patientId: string;
  memo: string;
  followUpState: TherapistFollowUpState;
  updatedAt: string;
  updatedBy: string;
  history: TherapistPatientNoteEntry[];
};

const MAX_HISTORY = 5;

const DATA_DIR = path.join(process.cwd(), "data", "therapist");
const NOTES_PATH = path.join(DATA_DIR, "patient-notes.json");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

/**
 * v1 형태({ patientId, memo, followUpState, updatedAt, updatedBy }) 가 들어와도
 * v2(history 배열 포함) 로 자동 마이그레이션. 디스크에 다시 쓰진 않고 메모리상 변환만.
 * 다음 saveTherapistPatientNote 호출 시 v2 로 영구 저장된다.
 */
function normalizeRecord(raw: unknown, patientId: string): TherapistPatientNote | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const followUpState = normalizeFollowUpState(obj.followUpState);
  const updatedBy = String(obj.updatedBy ?? "");
  const updatedAt = String(obj.updatedAt ?? new Date().toISOString());

  // 이미 v2 (history 배열 보유)
  if (Array.isArray(obj.history)) {
    const history: TherapistPatientNoteEntry[] = (obj.history as unknown[])
      .map((entry) => normalizeEntry(entry))
      .filter((e): e is TherapistPatientNoteEntry => e !== null)
      .slice(0, MAX_HISTORY);
    const head = history[0];
    return {
      patientId,
      memo: head?.memo ?? String(obj.memo ?? ""),
      followUpState,
      updatedAt: head?.updatedAt ?? updatedAt,
      updatedBy: head?.updatedBy ?? updatedBy,
      history,
    };
  }

  // v1 (단일 메모) → history[0] 로 승격
  const legacyMemo = typeof obj.memo === "string" ? obj.memo : "";
  const history: TherapistPatientNoteEntry[] = legacyMemo.trim()
    ? [
        {
          id: deriveStableEntryId(patientId, updatedAt, legacyMemo),
          memo: legacyMemo,
          updatedAt,
          updatedBy,
        },
      ]
    : [];
  return {
    patientId,
    memo: legacyMemo,
    followUpState,
    updatedAt,
    updatedBy,
    history,
  };
}

function normalizeEntry(raw: unknown): TherapistPatientNoteEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const memo = typeof obj.memo === "string" ? obj.memo : "";
  if (!memo.trim()) return null;
  return {
    id: String(obj.id ?? randomUUID()),
    memo,
    updatedAt: String(obj.updatedAt ?? new Date().toISOString()),
    updatedBy: String(obj.updatedBy ?? ""),
  };
}

function normalizeFollowUpState(value: unknown): TherapistFollowUpState {
  if (
    value === "monitor" ||
    value === "follow_up" ||
    value === "priority" ||
    value === "none"
  ) {
    return value;
  }
  return "none";
}

/**
 * legacy v1 메모를 history[0] 으로 끌어올릴 때 안정적인 id 를 부여한다.
 * 같은 메모 + 같은 시간이면 같은 id 가 되도록 — 매 read 마다 id 가 바뀌면
 * UI 의 key 가 흔들려서 React 경고가 발생한다.
 */
function deriveStableEntryId(
  patientId: string,
  updatedAt: string,
  memo: string,
): string {
  const seed = `${patientId}|${updatedAt}|${memo.length}`;
  // 8자리 고정 hash 면 충분 (충돌 가능성 무시할 수준)
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return `legacy-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

async function readNotesStore(): Promise<Record<string, TherapistPatientNote>> {
  await ensureDataDir();
  let parsed: unknown;
  try {
    const raw = await readFile(NOTES_PATH, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "ENOENT") return {};
    throw error;
  }

  if (!parsed || typeof parsed !== "object") return {};
  const result: Record<string, TherapistPatientNote> = {};
  for (const [patientId, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const normalized = normalizeRecord(raw, patientId);
    if (normalized) result[patientId] = normalized;
  }
  return result;
}

async function writeNotesStore(store: Record<string, TherapistPatientNote>) {
  await ensureDataDir();
  await writeFile(NOTES_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getTherapistPatientNote(patientId: string) {
  const store = await readNotesStore();
  return store[patientId] ?? null;
}

/**
 * 메모 store 의 모든 항목을 반환한다.
 * 권한/스코프 필터링은 호출 측 (therapistReportsDb.listTherapistPatientNotesScoped) 에서 한다.
 */
export async function listAllTherapistPatientNotes() {
  return readNotesStore();
}

/**
 * v2: 새 메모를 history 의 맨 앞에 추가한다.
 * - 빈 메모는 추가하지 않고, followUpState 만 갱신할 수도 있다.
 * - history 가 MAX_HISTORY 를 넘으면 오래된 것부터 잘라낸다.
 */
export async function saveTherapistPatientNote(input: {
  patientId: string;
  memo: string;
  followUpState: TherapistFollowUpState;
  updatedBy: string;
}): Promise<TherapistPatientNote> {
  const store = await readNotesStore();
  const existing = store[input.patientId] ?? null;
  const trimmedMemo = input.memo.trim();
  const now = new Date().toISOString();

  let history = existing?.history ?? [];
  if (trimmedMemo) {
    const newEntry: TherapistPatientNoteEntry = {
      id: randomUUID(),
      memo: trimmedMemo,
      updatedAt: now,
      updatedBy: input.updatedBy,
    };
    history = [newEntry, ...history].slice(0, MAX_HISTORY);
  }

  const head = history[0];
  const next: TherapistPatientNote = {
    patientId: input.patientId,
    memo: head?.memo ?? "",
    followUpState: input.followUpState,
    updatedAt: head?.updatedAt ?? existing?.updatedAt ?? now,
    updatedBy: head?.updatedBy ?? existing?.updatedBy ?? input.updatedBy,
    history,
  };
  store[input.patientId] = next;
  await writeNotesStore(store);
  return next;
}

/**
 * 특정 메모 1건을 history 에서 삭제. (오답·오해소지 제거 용도)
 * head 가 삭제되면 자연스럽게 다음 메모가 head 가 된다.
 */
export async function deleteTherapistPatientNoteEntry(input: {
  patientId: string;
  entryId: string;
}): Promise<TherapistPatientNote | null> {
  const store = await readNotesStore();
  const existing = store[input.patientId];
  if (!existing) return null;
  const nextHistory = existing.history.filter((e) => e.id !== input.entryId);
  if (nextHistory.length === existing.history.length) return existing; // 변경 없음
  const head = nextHistory[0];
  const next: TherapistPatientNote = {
    ...existing,
    memo: head?.memo ?? "",
    updatedAt: head?.updatedAt ?? existing.updatedAt,
    updatedBy: head?.updatedBy ?? existing.updatedBy,
    history: nextHistory,
  };
  store[input.patientId] = next;
  await writeNotesStore(store);
  return next;
}
