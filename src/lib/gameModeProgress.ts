"use client";

import type { GameModeGameKey } from "@/constants/gameModeRoadmap";

const GAME_MODE_PROGRESS_KEY = "brainfriends_game_mode_progress";

export type GameModeProgress = {
  unlockedThroughStage: number;
  lastVisitedStage: number;
  lastPlayedGameKey: string | null;
  playedStageGames: string[];
  clearedSubstages: string[];
  clearedStages: string[];
  assignedStageGames: Record<string, GameModeGameKey>;
  assignedStageModes: Record<string, "example" | "tongue">;
  updatedAt: number;
};

const DEFAULT_GAME_MODE_PROGRESS: GameModeProgress = {
  unlockedThroughStage: 1,
  lastVisitedStage: 1,
  lastPlayedGameKey: null,
  playedStageGames: [],
  clearedSubstages: [],
  clearedStages: [],
  assignedStageGames: {},
  assignedStageModes: {},
  updatedAt: 0,
};

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeProgress(value: unknown): GameModeProgress {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_GAME_MODE_PROGRESS };
  }

  const candidate = value as Partial<GameModeProgress>;

  return {
    unlockedThroughStage: Math.max(
      1,
      Math.floor(candidate.unlockedThroughStage ?? 1),
    ),
    lastVisitedStage: Math.max(1, Math.floor(candidate.lastVisitedStage ?? 1)),
    lastPlayedGameKey:
      typeof candidate.lastPlayedGameKey === "string"
        ? candidate.lastPlayedGameKey
        : null,
    playedStageGames: normalizeStringArray(candidate.playedStageGames),
    clearedSubstages: normalizeStringArray(candidate.clearedSubstages),
    clearedStages: normalizeStringArray(candidate.clearedStages),
    assignedStageGames:
      candidate.assignedStageGames &&
      typeof candidate.assignedStageGames === "object" &&
      !Array.isArray(candidate.assignedStageGames)
        ? Object.fromEntries(
            Object.entries(candidate.assignedStageGames).filter(
              ([, gameKey]) =>
                gameKey === "association_clear" ||
                gameKey === "word_select" ||
                gameKey === "word_assemble" ||
                gameKey === "tetris" ||
                gameKey === "balloon" ||
                gameKey === "memory" ||
                gameKey === "sentence_build" ||
                gameKey === "tongue_twister",
            ),
          ) as Record<string, GameModeGameKey>
        : {},
    assignedStageModes:
      candidate.assignedStageModes &&
      typeof candidate.assignedStageModes === "object" &&
      !Array.isArray(candidate.assignedStageModes)
        ? Object.fromEntries(
            Object.entries(candidate.assignedStageModes).filter(
              ([, mode]) => mode === "example" || mode === "tongue",
            ),
          ) as Record<string, "example" | "tongue">
        : {},
    updatedAt: Number(candidate.updatedAt ?? 0) || 0,
  };
}

function getStageProgressKey(stageId: number, nodeId: string) {
  return `${Math.max(1, stageId)}:${nodeId}`;
}

export function getGameModeProgress(): GameModeProgress {
  if (typeof window === "undefined") {
    return { ...DEFAULT_GAME_MODE_PROGRESS };
  }

  try {
    const raw = localStorage.getItem(GAME_MODE_PROGRESS_KEY);
    if (!raw) return { ...DEFAULT_GAME_MODE_PROGRESS };
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GAME_MODE_PROGRESS };
  }
}

export function saveGameModeProgress(progress: GameModeProgress) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    GAME_MODE_PROGRESS_KEY,
    JSON.stringify({
      ...progress,
      updatedAt: Date.now(),
    }),
  );
}

export function setLastVisitedGameModeStage(stageId: number) {
  const current = getGameModeProgress();
  saveGameModeProgress({
    ...current,
    lastVisitedStage: Math.max(1, stageId),
  });
}

export function markGameModeGamePlayed(stageId: number, gameKey: string) {
  const current = getGameModeProgress();
  const playedStageGameKey = `${Math.max(1, stageId)}:${gameKey}`;
  const playedStageGames = current.playedStageGames.includes(playedStageGameKey)
    ? current.playedStageGames
    : [...current.playedStageGames, playedStageGameKey];

  saveGameModeProgress({
    ...current,
    lastVisitedStage: Math.max(1, stageId),
    lastPlayedGameKey: gameKey,
    playedStageGames,
  });
}

export function markGameModeSubstageCleared(
  stageId: number,
  sectionId: string,
  substageId: string,
  gameKey: string,
) {
  const current = getGameModeProgress();
  const clearedKey = `${Math.max(1, stageId)}:${sectionId}:${substageId}`;
  const playedStageGameKey = `${Math.max(1, stageId)}:${gameKey}`;

  saveGameModeProgress({
    ...current,
    lastVisitedStage: Math.max(1, stageId),
    lastPlayedGameKey: gameKey,
    playedStageGames: current.playedStageGames.includes(playedStageGameKey)
      ? current.playedStageGames
      : [...current.playedStageGames, playedStageGameKey],
    clearedSubstages: current.clearedSubstages.includes(clearedKey)
      ? current.clearedSubstages
      : [...current.clearedSubstages, clearedKey],
  });
}

export function getAssignedGameModeStageGame(
  progress: GameModeProgress,
  stageId: number,
  nodeId: string,
) {
  return progress.assignedStageGames[getStageProgressKey(stageId, nodeId)] ?? null;
}

export function assignGameModeStageGame(
  stageId: number,
  nodeId: string,
  candidates: Array<{
    gameKey: GameModeGameKey;
    sentenceMode?: "example" | "tongue";
  }>,
) {
  const current = getGameModeProgress();
  const key = getStageProgressKey(stageId, nodeId);
  const existing = current.assignedStageGames[key];
  if (existing) {
    return {
      gameKey: existing,
      sentenceMode: current.assignedStageModes[key],
    };
  }

  const fallback: Array<{
    gameKey: GameModeGameKey;
    sentenceMode?: "example" | "tongue";
  }> = [{ gameKey: "tetris" }];
  const pool = candidates.length ? candidates : fallback;
  const assigned = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];

  saveGameModeProgress({
    ...current,
    assignedStageGames: {
      ...current.assignedStageGames,
      [key]: assigned.gameKey,
    },
    assignedStageModes: assigned.sentenceMode
      ? {
          ...current.assignedStageModes,
          [key]: assigned.sentenceMode,
        }
      : current.assignedStageModes,
  });

  return assigned;
}

export function getAssignedGameModeStageMode(
  progress: GameModeProgress,
  stageId: number,
  nodeId: string,
) {
  return progress.assignedStageModes[getStageProgressKey(stageId, nodeId)] ?? null;
}

export function hasClearedGameModeStage(
  progress: GameModeProgress,
  stageId: number,
  nodeId: string,
) {
  return progress.clearedStages.includes(getStageProgressKey(stageId, nodeId));
}

export function markGameModeStageCleared(
  stageId: number,
  nodeId: string,
  gameKey: GameModeGameKey,
) {
  const current = getGameModeProgress();
  const stageKey = getStageProgressKey(stageId, nodeId);
  const playedStageGameKey = `${Math.max(1, stageId)}:${gameKey}`;

  saveGameModeProgress({
    ...current,
    lastVisitedStage: Math.max(1, stageId),
    lastPlayedGameKey: gameKey,
    playedStageGames: current.playedStageGames.includes(playedStageGameKey)
      ? current.playedStageGames
      : [...current.playedStageGames, playedStageGameKey],
    assignedStageGames: current.assignedStageGames[stageKey]
      ? current.assignedStageGames
      : {
          ...current.assignedStageGames,
          [stageKey]: gameKey,
        },
    clearedStages: current.clearedStages.includes(stageKey)
      ? current.clearedStages
      : [...current.clearedStages, stageKey],
  });
}

export function unlockGameModeStage(stageId: number) {
  const current = getGameModeProgress();
  saveGameModeProgress({
    ...current,
    unlockedThroughStage: Math.max(current.unlockedThroughStage, stageId),
  });
}

export function resetGameModeProgress() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GAME_MODE_PROGRESS_KEY);
}

export function hasPlayedGameModeStageGame(
  progress: GameModeProgress,
  stageId: number,
  gameKey: string,
) {
  return progress.playedStageGames.includes(`${Math.max(1, stageId)}:${gameKey}`);
}

export function hasClearedGameModeSubstage(
  progress: GameModeProgress,
  stageId: number,
  sectionId: string,
  substageId: string,
) {
  return progress.clearedSubstages.includes(
    `${Math.max(1, stageId)}:${sectionId}:${substageId}`,
  );
}

// ===========================================================================
// 신규 시스템 — 권역·도시·미션 진행 상태
//
// 기존 GameModeProgress 와 충돌하지 않도록 별도 localStorage 키.
// 잠금 해제 룰:
//   - 미션 N 클리어 → N+1 잠금 풀림
//   - 도시의 모든 미션(5개) 클리어 → 같은 권역 다음 도시 풀림
//   - 권역의 모든 도시 클리어 → 다음 권역 풀림
//   - 첫 진입 시 수도권만 자동 해제
// ===========================================================================

const REGION_PROGRESS_KEY = "brainfriends_region_mission_progress";
const REGION_FIRST_HINT_KEY = "brainfriends_region_first_hint_dismissed";

export type RegionMissionProgress = {
  // "regionId/cityId/missionId" 형식의 완료 마커
  completedMissions: string[];
  updatedAt: number;
};

const DEFAULT_REGION_PROGRESS: RegionMissionProgress = {
  completedMissions: [],
  updatedAt: 0,
};

function readRegionProgress(): RegionMissionProgress {
  if (typeof window === "undefined") return { ...DEFAULT_REGION_PROGRESS };
  try {
    const raw = window.localStorage.getItem(REGION_PROGRESS_KEY);
    if (!raw) return { ...DEFAULT_REGION_PROGRESS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_REGION_PROGRESS };
    const completedMissions = Array.isArray((parsed as Record<string, unknown>).completedMissions)
      ? ((parsed as Record<string, unknown>).completedMissions as unknown[]).filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];
    return {
      completedMissions,
      updatedAt: Number((parsed as Record<string, unknown>).updatedAt ?? 0) || 0,
    };
  } catch {
    return { ...DEFAULT_REGION_PROGRESS };
  }
}

function writeRegionProgress(progress: RegionMissionProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REGION_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* quota exceeded 등 무시 */
  }
}

export function getRegionMissionProgress(): RegionMissionProgress {
  return readRegionProgress();
}

export function markRegionMissionCompleted(input: {
  regionId: string;
  cityId: string;
  missionId: string;
}) {
  const key = `${input.regionId}/${input.cityId}/${input.missionId}`;
  const progress = readRegionProgress();
  if (!progress.completedMissions.includes(key)) {
    progress.completedMissions = [...progress.completedMissions, key];
    progress.updatedAt = Date.now();
    writeRegionProgress(progress);
  }
  return progress;
}

export function isRegionMissionCompleted(
  progress: RegionMissionProgress,
  regionId: string,
  cityId: string,
  missionId: string,
): boolean {
  return progress.completedMissions.includes(
    `${regionId}/${cityId}/${missionId}`,
  );
}

/**
 * 미션 잠금 해제 여부.
 * 같은 도시 안에서 order 이전 미션이 모두 완료되었는지 검사.
 */
export function isRegionMissionUnlocked(
  progress: RegionMissionProgress,
  regionId: string,
  cityId: string,
  missionsInCity: Array<{ id: string; order: number }>,
  targetMissionId: string,
): boolean {
  const target = missionsInCity.find((m) => m.id === targetMissionId);
  if (!target) return false;
  if (target.order <= 1) return true; // 첫 미션은 항상 풀림 (도시 자체는 잠금 가능)
  const prerequisites = missionsInCity.filter((m) => m.order < target.order);
  return prerequisites.every((m) =>
    isRegionMissionCompleted(progress, regionId, cityId, m.id),
  );
}

/**
 * 도시 잠금 해제 여부.
 * 같은 권역 안 이전 도시들이 모두 클리어 (= 모든 미션 완료) 됐는지.
 * 권역의 첫 도시는 권역이 풀리면 자동 풀림.
 */
export function isRegionCityUnlocked(
  progress: RegionMissionProgress,
  regionId: string,
  citiesInRegion: Array<{ id: string; missions: Array<{ id: string }> }>,
  targetCityId: string,
): boolean {
  const targetIndex = citiesInRegion.findIndex((c) => c.id === targetCityId);
  if (targetIndex < 0) return false;
  if (targetIndex === 0) return true;
  const previousCities = citiesInRegion.slice(0, targetIndex);
  return previousCities.every((c) => isRegionCityCleared(progress, regionId, c));
}

export function isRegionCityCleared(
  progress: RegionMissionProgress,
  regionId: string,
  city: { id: string; missions: Array<{ id: string }> },
): boolean {
  if (city.missions.length === 0) return false; // 미션 없는 도시는 클리어 판정 X
  return city.missions.every((m) =>
    isRegionMissionCompleted(progress, regionId, city.id, m.id),
  );
}

/**
 * 권역 잠금 해제 여부.
 * 첫 권역(metro=수도권) 은 항상 자동 해제.
 * 나머지는 이전 권역의 모든 도시 클리어 시 풀림.
 */
export function isRegionUnlocked(
  progress: RegionMissionProgress,
  regions: Array<{
    id: string;
    cities: Array<{ id: string; missions: Array<{ id: string }> }>;
  }>,
  targetRegionId: string,
): boolean {
  const targetIndex = regions.findIndex((r) => r.id === targetRegionId);
  if (targetIndex < 0) return false;
  if (targetIndex === 0) return true;
  const previousRegions = regions.slice(0, targetIndex);
  return previousRegions.every((r) => {
    if (r.cities.length === 0) return true; // 빈 권역은 통과
    return r.cities.every((c) => isRegionCityCleared(progress, r.id, c));
  });
}

export function isRegionFirstHintDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(REGION_FIRST_HINT_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissRegionFirstHint() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REGION_FIRST_HINT_KEY, "1");
  } catch {
    /* noop */
  }
}
