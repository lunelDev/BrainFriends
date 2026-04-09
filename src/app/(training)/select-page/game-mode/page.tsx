"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Flag,
  Lock,
  MessageSquareText,
  Swords,
} from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { stopRegisteredMediaStreams } from "@/lib/client/mediaStreamRegistry";
import { gameModeTitleFont } from "@/lib/ui/gameModeFonts";
import { GAME_MODE_ROADMAP, GAME_MODE_ZONE_ORDER } from "@/constants/gameModeRoadmap";
import { getGameModeProgress } from "@/lib/gameModeProgress";
import {
  GAME_MODE_STAGE_NODE_PAYLOADS,
  type GameModeNodeGameType,
} from "@/constants/gameModeStagePayloads";

const CORE_GAME_CARD_CONFIG: Record<
  GameModeNodeGameType,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    borderClass: string;
    labelClass: string;
    chipClass: string;
  }
> = {
  tetris: {
    label: "테트리스",
    description: "도시 단어 블록을 발화로 정리",
    icon: Swords,
    borderClass: "border-[#4ecdc466] bg-[#4ecdc41a]",
    labelClass: "text-[#78ebe3]",
    chipClass: "bg-[#4ecdc433] text-[#89f2eb]",
  },
  memory: {
    label: "말로 열기",
    description: "짧은 핵심어를 말해 카드 해금",
    icon: Brain,
    borderClass: "border-[#ffe66d66] bg-[#ffe66d1a]",
    labelClass: "text-[#ffe66d]",
    chipClass: "bg-[#ffe66d33] text-[#fff0a0]",
  },
  sentence_build: {
    label: "문장 만들기",
    description: "도시 핵심어로 문장을 만들고 읽기",
    icon: MessageSquareText,
    borderClass: "border-[#ff6b6b66] bg-[#ff6b6b1a]",
    labelClass: "text-[#ff8f8f]",
    chipClass: "bg-[#ff6b6b33] text-[#ff9b9b]",
  },
  tongue_twister: {
    label: "잿말놀이",
    description: "도시 잿말 문장으로 속도와 정확도 훈련",
    icon: Lock,
    borderClass: "border-[#f472b666] bg-[#f472b61a]",
    labelClass: "text-[#f9a8d4]",
    chipClass: "bg-[#f472b633] text-[#fbcfe8]",
  },
  balloon: {
    label: "풍선 키우기",
    description: "이벤트 발성 구간을 유지해 풍선 성장",
    icon: Flag,
    borderClass: "border-[#a29bfe66] bg-[#a29bfe1a]",
    labelClass: "text-[#d8d5ff]",
    chipClass: "bg-[#a29bfe33] text-[#e9e7ff]",
  },
};

const LEVEL_EMOJI_BY_ID: Record<number, string> = {
  1: "🏙️",
  2: "⚓",
  3: "🌊",
  4: "🏛️",
  5: "🔥",
  6: "🏘️",
  7: "🎨",
  8: "🌙",
  9: "☕",
  10: "🍗",
  11: "🎭",
  12: "🌋",
};

const LEVEL_CITY_SUBTITLE_BY_ID: Record<number, string> = {
  1: "수도 · 표준어의 본거지 · 튜토리얼 스테이지",
  2: "항구도시 · 차이나타운 · 개항의 도시",
  3: "해양도시 · 영화의 도시 · 대한민국 제2도시",
  4: "천년고도 · 신라의 수도 · 야외박물관",
  5: "분지의 도시 · 치맥의 성지 · 패션의 도시",
  6: "한옥마을 · 맛의 고장 · 전통문화의 수도",
  7: "예술의 도시 · 빛의 도시 · 민주주의의 성지",
  8: "밤바다의 도시 · 엑스포 · 남해안의 보석",
  9: "커피도시 · 단오의 고장 · 동해안의 낭만",
  10: "닭갈비의 도시 · 호반의 도시 · 남이섬",
  11: "유교문화의 본향 · 탈춤의 고장 · 하회마을",
  12: "화산섬 · 유네스코 자연유산 · 대한민국의 보물",
};

function getCompactLevelTitle(title: string) {
  return title.split(" ")[0]?.trim() || title.trim();
}

function getStagePreviewByGame(stageId: number, gameType: GameModeNodeGameType) {
  const nodes = GAME_MODE_STAGE_NODE_PAYLOADS[stageId] ?? [];
  const uniquePreview = new Set<string>();

  for (const node of nodes) {
    if (node.gameType !== gameType) continue;
    for (const item of node.preview) {
      uniquePreview.add(item);
      if (uniquePreview.size >= 4) {
        return Array.from(uniquePreview);
      }
    }
  }

  return Array.from(uniquePreview);
}

function hasPlayedAnyStageGame(stageId: number, playedStageGames: string[]) {
  return playedStageGames.some((entry) => entry.startsWith(`${stageId}:`));
}

export default function SelectGameModePage() {
  const router = useRouter();
  const { patient, ageGroup } = useTrainingSession();
  const [isMounted, setIsMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unlockedThroughStage, setUnlockedThroughStage] = useState(1);
  const [playedStageGames, setPlayedStageGames] = useState<string[]>([]);

  useEffect(() => {
    setIsMounted(true);
    const progress = getGameModeProgress();
    setUnlockedThroughStage(progress.unlockedThroughStage);
    setPlayedStageGames(progress.playedStageGames);
  }, []);

  useEffect(() => {
    stopRegisteredMediaStreams();

    const mediaElements = Array.from(
      document.querySelectorAll("video, audio"),
    ) as Array<HTMLVideoElement | HTMLAudioElement>;

    for (const element of mediaElements) {
      const stream = element.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
        element.srcObject = null;
      }
    }
  }, []);

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace("/");
        return;
      }
      router.replace("/");
    }
  };

  const progressSnapshot = {
    unlockedThroughStage,
    lastVisitedStage: 1,
    lastPlayedGameKey: null,
    playedStageGames,
    updatedAt: 0,
  };

  const levelsByZone = GAME_MODE_ZONE_ORDER.map((zoneLabel) => ({
    zoneLabel,
    levels: GAME_MODE_ROADMAP.filter((level) => level.zoneLabel === zoneLabel),
  }));

  return (
    <div
      className="flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a1a] text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(42,42,90,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(42,42,90,0.4) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <header className="sticky top-0 z-50 border-b border-[#2a2a5a] bg-[#0a0a1a]/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <img
              src="/images/logo/logo.png"
              alt="GOLDEN logo"
              className="h-9 w-9 shrink-0 rounded-xl object-cover sm:h-10 sm:w-10"
            />
            <div className="grid min-w-0 grid-cols-2 items-center gap-x-2 sm:gap-x-3">
              <p className="col-span-2 text-[10px] font-black uppercase tracking-widest leading-none text-[#a29bfe]">
                Active Patient Profile
              </p>
              <h2 className="truncate text-sm font-black leading-none tracking-tight text-white sm:text-lg">
                {isMounted ? (patient?.name ?? "정보 없음") : "정보 없음"}
                <span className="ml-1.5 text-xs font-bold text-slate-400 sm:ml-2 sm:text-sm">
                  {isMounted ? (patient?.age ?? "-") : "-"}세
                </span>
              </h2>
              <span
                className={`mt-1 inline-flex justify-self-start whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black shadow-sm sm:px-2.5 sm:text-[10px] ${
                  ageGroup === "Senior"
                    ? "border-violet-500 bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                    : "border-[#2a2a5a] bg-[#12122a] text-slate-200"
                }`}
              >
                {ageGroup === "Senior" ? "실버 규준 적용" : "일반 규준 적용"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => router.push("/select-page/mode")}
              className="h-8 min-w-[90px] rounded-full border border-[#a29bfe] bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-[11px] font-black text-white shadow-sm transition-all hover:from-violet-700 hover:to-indigo-700 sm:h-9 sm:min-w-[98px] sm:px-4 sm:text-xs"
            >
              활동선택
            </button>
            <button
              type="button"
              onClick={logout}
              className="h-8 min-w-[90px] rounded-full border border-[#2a2a5a] bg-[#12122a] px-3 text-[11px] font-black text-slate-200 shadow-sm transition-all hover:bg-[#1a1a38] sm:h-9 sm:min-w-[98px] sm:px-4 sm:text-xs"
            >
              {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex-1 w-full max-w-[960px] px-5 pb-16 pt-10 sm:px-6 lg:px-8">
        <section className="text-center">
          <p className={`${gameModeTitleFont.className} text-[11px] tracking-[0.38em] text-[#a29bfe]`}>
            BRAINFRIENDS GAME MODE
          </p>
          <div className="mt-4 flex items-start justify-center gap-3 sm:gap-4">
            <span
              className={`${gameModeTitleFont.className} mt-1 text-[10px] tracking-[0.22em] text-white/95 drop-shadow-[0_0_10px_rgba(116,185,255,0.8)] sm:text-[12px]`}
            >
              KR
            </span>
            <h1
              className={`${gameModeTitleFont.className} text-[18px] font-black leading-[1.8] text-white [text-shadow:0_0_10px_rgba(255,255,255,0.95),0_0_26px_rgba(162,155,254,0.95),0_0_56px_rgba(116,185,255,0.5)] sm:text-[22px]`}
            >
              KOREA STYLE ROADMAP
              <br />
              LEVEL SELECT
            </h1>
          </div>
          <p className="mt-4 text-sm tracking-[0.18em] text-slate-400">
            각 레벨은 다른 게임과 다른 난이도로 구성됩니다.
          </p>
        </section>

        <section className="mt-8 flex flex-wrap justify-center gap-3">
          {(["tetris", "memory", "sentence_build", "tongue_twister", "balloon"] as GameModeNodeGameType[]).map(
            (gameType) => {
              const game = CORE_GAME_CARD_CONFIG[gameType];
              return (
                <div
                  key={gameType}
                  className="flex items-center gap-2 text-xs font-bold text-slate-200"
                >
                  <span className={`h-5 w-5 rounded-[4px] border-2 ${game.borderClass}`} />
                  {game.label}
                </div>
              );
            },
          )}
        </section>

        <p
          className={`${gameModeTitleFont.className} mt-6 text-center text-[11px] tracking-[0.24em] text-[#93a7d8] [text-shadow:0_0_10px_rgba(116,185,255,0.45)]`}
        >
          ▼ SCROLL TO EXPLORE ▼
        </p>

        <section className="mt-10 space-y-10">
          {levelsByZone.map(({ zoneLabel, levels }) => (
            <div key={zoneLabel}>
              <div className="relative mb-6 text-center">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-[#2a2a5a]" />
                <span className={`relative bg-[#0a0a1a] px-4 text-[10px] tracking-[0.28em] text-slate-500 ${gameModeTitleFont.className}`}>
                  {zoneLabel}
                </span>
              </div>

              <div className="space-y-8">
                {levels.map((level, index) => {
                  const isUnlocked = level.id <= unlockedThroughStage;
                  const isCleared = hasPlayedAnyStageGame(
                    level.id,
                    progressSnapshot.playedStageGames,
                  );
                  const tetrisPreview = getStagePreviewByGame(level.id, "tetris");
                  const memoryPreview = getStagePreviewByGame(level.id, "memory");
                  const sentenceBuildPreview = getStagePreviewByGame(level.id, "sentence_build");
                  const tonguePreview = getStagePreviewByGame(level.id, "tongue_twister");
                  const balloonPreview = getStagePreviewByGame(level.id, "balloon");

                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => {
                        router.push(`/select-page/game-mode/stage/${level.id}`);
                      }}
                      className="group relative block w-full overflow-hidden rounded-[18px] border-2 border-[#2a2a5a] bg-[#12122a] p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
                      style={{
                        boxShadow: isUnlocked
                          ? "0 10px 30px rgba(0,0,0,0.28)"
                          : "none",
                      }}
                    >
                      <div
                        className="absolute inset-x-0 top-0 h-1"
                        style={{ background: level.accentColor }}
                      />
                      {index < levels.length - 1 ? (
                        <div
                          className="absolute bottom-[-32px] left-12 h-8 w-[2px]"
                          style={{
                            background: `linear-gradient(to bottom, ${level.accentColor}, transparent)`,
                          }}
                        />
                      ) : null}

                      {!isUnlocked ? (
                        <div className="absolute inset-0 bg-[#0a0a1ab8]" />
                      ) : null}

                      <div className="relative flex items-start gap-4">
                        <div
                          className="shrink-0 rounded-[10px] px-3 py-2 font-mono text-[10px] font-black text-black"
                          style={{ background: level.accentColor }}
                        >
                          {level.badge}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-2xl font-black text-white">
                              {getCompactLevelTitle(level.title)}{" "}
                              <span>{LEVEL_EMOJI_BY_ID[level.id] ?? "🎮"}</span>
                            </h2>
                            {level.isBoss ? (
                              <span className="rounded-[4px] bg-[linear-gradient(135deg,#ff6b6b,#ff8e53)] px-2 py-1 font-mono text-[8px] tracking-[0.15em] text-white">
                                {level.bossLabel ?? "BOSS"}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {LEVEL_CITY_SUBTITLE_BY_ID[level.id] ?? level.description}
                          </p>
                        </div>
                        <div className="ml-auto flex items-center gap-3">
                          <div className="text-lg">
                            {"⭐".repeat(level.stars)}
                            <span className="text-slate-700">
                              {"☆".repeat(5 - level.stars)}
                            </span>
                          </div>
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                              isUnlocked
                                ? "border-white/20 bg-white/10 text-white"
                                : "border-slate-600 bg-slate-700/60 text-slate-300"
                            }`}
                          >
                            {isUnlocked ? <Flag className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                          </div>
                        </div>
                      </div>

                      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {(
                          [
                            ["tetris", tetrisPreview],
                            ["memory", memoryPreview],
                            ["sentence_build", sentenceBuildPreview],
                            ["tongue_twister", tonguePreview],
                            ["balloon", balloonPreview],
                          ] as const
                        ).map(([gameType, previewItems]) => {
                          const card = CORE_GAME_CARD_CONFIG[gameType];
                          const Icon = card.icon;
                          return (
                            <div
                              key={`${level.id}-${gameType}`}
                              className={`rounded-[10px] border-2 p-3 ${card.borderClass}`}
                            >
                              <p
                                className={`mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.08em] ${card.labelClass}`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {card.label}
                              </p>
                              <p className="mb-3 text-[11px] leading-5 text-slate-400">
                                {card.description}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {previewItems.map((chip) => (
                                  <span
                                    key={chip}
                                    className={`rounded-[4px] px-2 py-1 text-[11px] font-bold ${card.chipClass}`}
                                  >
                                    {chip}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="relative mt-5 flex min-h-[52px] items-end gap-[3px] border-t border-[#2a2a5a] pt-4">
                        {level.previewHeights.map((height, previewIndex) => (
                          <div
                            key={`${level.id}-preview-${previewIndex}`}
                            className="w-3 rounded-[2px] opacity-85"
                            style={{
                              height,
                              background:
                                previewIndex % 4 === 0
                                  ? "#FF6B6B"
                                  : previewIndex % 4 === 1
                                    ? "#4ECDC4"
                                    : previewIndex % 4 === 2
                                      ? level.accentColor
                                      : "#A29BFE",
                            }}
                          />
                        ))}
                        <span className="ml-auto text-[10px] font-bold text-slate-500">
                          {isCleared ? "기록 완료" : isUnlocked ? "플레이 가능" : "잠김"}
                        </span>
                      </div>

                      {isCleared ? (
                        <div className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#fff4ce] bg-[#ffb300] text-[#5c3a00] shadow-md">
                          <Flag className="h-4 w-4" />
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-[16px] border border-[#2a2a5a] bg-[#12122a] px-6 py-8 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-[#a29bfe]">
            GAME SUMMARY
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-10">
            <div>
              <div className="text-[28px] font-black text-[#74b9ff]">12</div>
              <div className="mt-1 text-[11px] text-slate-500">총 레벨</div>
            </div>
            <div>
              <div className="text-[28px] font-black text-[#ff6b6b]">4</div>
              <div className="mt-1 text-[11px] text-slate-500">ZONE</div>
            </div>
            <div>
              <div className="text-[28px] font-black text-[#ffe66d]">3</div>
              <div className="mt-1 text-[11px] text-slate-500">보스 스테이지</div>
            </div>
            <div>
              <div className="text-[28px] font-black text-[#55efc4]">5</div>
              <div className="mt-1 text-[11px] text-slate-500">코어 게임</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
