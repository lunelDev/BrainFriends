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

  const fallback = [{ gameKey: "tetris" as GameModeGameKey }];
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
