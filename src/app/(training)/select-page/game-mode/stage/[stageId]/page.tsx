"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock, LogOut, Map, Play } from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { gameModeTitleFont } from "@/lib/ui/gameModeFonts";
import {
  GAME_MODE_GAMES,
  getGameModeStage,
  getGameModeStageMap,
  type GameModeStageNodeDefinition,
} from "@/constants/gameModeRoadmap";
import {
  GAME_MODE_STAGE_CITY_LABELS,
  getGameModeNodePayload,
} from "@/constants/gameModeStagePayloads";
import {
  assignGameModeStageGame,
  getAssignedGameModeStageGame,
  getGameModeProgress,
  hasClearedGameModeStage,
  setLastVisitedGameModeStage,
  type GameModeProgress,
  unlockGameModeStage,
} from "@/lib/gameModeProgress";

const GAME_BADGE_THEME = {
  association_clear: {
    icon: "🧹",
    label: "연상 매칭",
    badgeClass: "border-[#b388ff55] bg-[#b388ff18] text-[#e8dcff]",
  },
  word_select: {
    icon: "✅",
    label: "단어 선택",
    badgeClass: "border-[#f59e0b55] bg-[#f59e0b18] text-[#ffe8c6]",
  },
  word_assemble: {
    icon: "🔡",
    label: "단어 조합",
    badgeClass: "border-[#34d39955] bg-[#34d39918] text-[#c8ffea]",
  },
  tetris: {
    icon: "🟦",
    label: "단어 폭탄",
    badgeClass: "border-[#4ecdc455] bg-[#4ecdc418] text-[#7ef2ea]",
  },
  memory: {
    icon: "🔑",
    label: "단어 배치",
    badgeClass: "border-[#ffd93d55] bg-[#ffd93d18] text-[#ffe77e]",
  },
  sentence_build: {
    icon: "📝",
    label: "문장 만들기",
    badgeClass: "border-[#ff6b6b55] bg-[#ff6b6b18] text-[#ffadad]",
  },
  tongue_twister: {
    icon: "🗣️",
    label: "잿말놀이",
    badgeClass: "border-[#f472b655] bg-[#f472b618] text-[#f9a8d4]",
  },
  balloon: {
    icon: "🎈",
    label: "풍선 키우기",
    badgeClass: "border-[#a29bfe55] bg-[#a29bfe18] text-[#d8d5ff]",
  },
} as const;

const TIER_META = [
  { key: "low", label: "하", desc: "도시 입문 구간" },
  { key: "mid", label: "중", desc: "도시 확장 구간" },
  { key: "high", label: "상", desc: "도시 심화 구간" },
] as const;

type TierKey = (typeof TIER_META)[number]["key"];

type StageSequenceNode = GameModeStageNodeDefinition & {
  displayId: string;
  mapItem: NonNullable<ReturnType<typeof getGameModeStageMap>>;
  nodeIndex: number;
  sequenceNumber: number;
  alignRight: boolean;
  tier: TierKey;
  tierLabel: string;
  tierDesc: string;
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getNodeUnlocked(
  progress: GameModeProgress,
  stageId: number,
  nodes: GameModeStageNodeDefinition[],
  nodeIndex: number,
) {
  if (nodeIndex === 0) return true;
  const previous = nodes[nodeIndex - 1];
  return hasClearedGameModeStage(progress, stageId, previous.id);
}

export default function GameModeStageDetailPage() {
  const params = useParams<{ stageId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { patient, ageGroup } = useTrainingSession();
  const [isMounted, setIsMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showReturnFx, setShowReturnFx] = useState(false);
  const [progress, setProgress] = useState<GameModeProgress>(() => getGameModeProgress());
  const isAdminAccount =
    patient?.userRole === "admin" || patient?.name === "관리자";

  const stageId = Number(params?.stageId ?? "0");
  const stage = useMemo(() => getGameModeStage(stageId), [stageId]);
  const stageMap = useMemo(() => getGameModeStageMap(stageId), [stageId]);
  const nextStage = useMemo(() => getGameModeStage(stageId + 1), [stageId]);
  const cityTitle = useMemo(() => stage?.title.split(" ")[0]?.trim() ?? "", [stage?.title]);
  const stageSequence = useMemo<StageSequenceNode[]>(() => {
    if (!stageMap) return [];

    const labelSet = GAME_MODE_STAGE_CITY_LABELS[stageId];
    const baseNodes = stageMap.nodes;
    const tiers = TIER_META.flatMap((tierMeta, tierIndex) => {
      const labels = labelSet?.[tierMeta.key] ?? Array.from({ length: 5 }, (_, idx) =>
        idx === 4 ? `${cityTitle} ${tierMeta.label} FINAL` : `${cityTitle} ${tierMeta.label}-${idx + 1}`,
      );

      return labels.map((label, labelIndex) => {
        const baseNode = baseNodes[labelIndex % baseNodes.length];
        const sequenceNumber = tierIndex * 5 + labelIndex + 1;
        const nodeId = `${stageMap.id}-${tierMeta.key}-${labelIndex + 1}`;
        const nodePayload = getGameModeNodePayload(stageMap.id, nodeId);
        const candidateVariants = nodePayload
          ? [{
              gameKey: nodePayload.gameType,
              gameLabel: GAME_BADGE_THEME[nodePayload.gameType].label,
              sentenceMode:
                nodePayload.gameType === "sentence_build"
                  ? ("example" as const)
                  : nodePayload.gameType === "tongue_twister"
                    ? ("tongue" as const)
                    : undefined,
            }]
          : [{ gameKey: "tetris" as const, gameLabel: GAME_BADGE_THEME.tetris.label }];

        return {
          ...baseNode,
          id: nodeId,
          order: sequenceNumber,
          theme: label,
          themeDesc: `${cityTitle} ${tierMeta.desc}`,
          boss: labelIndex === 4,
          candidateVariants,
          displayId: label,
          mapItem: stageMap,
          nodeIndex: sequenceNumber - 1,
          sequenceNumber,
          alignRight: sequenceNumber % 2 === 0,
          tier: tierMeta.key,
          tierLabel: tierMeta.label,
          tierDesc: tierMeta.desc,
        };
      });
    });

    return tiers;
  }, [cityTitle, stageId, stageMap]);
  const focusNodeId = searchParams.get("focusNode") || "";
  const shouldPlayReturnFx = searchParams.get("opened") === "1";

  useEffect(() => {
    setIsMounted(true);
    const current = getGameModeProgress();
    setProgress(current);
    if (stageId >= 1) {
      setLastVisitedGameModeStage(stageId);
    }
  }, [stageId]);

  useEffect(() => {
    if (!shouldPlayReturnFx || !focusNodeId) return;

    setShowReturnFx(true);

    const scrollTimer = window.setTimeout(() => {
      const target = document.getElementById(`stage-node-${focusNodeId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 260);

    const hideTimer = window.setTimeout(() => {
      setShowReturnFx(false);
      window.history.replaceState(
        window.history.state,
        "",
        `/select-page/game-mode/stage/${stageId}`,
      );
    }, 1800);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(hideTimer);
    };
  }, [focusNodeId, shouldPlayReturnFx, stageId]);

  const activeStageMapId = stageMap?.id ?? stageId;
  const clearedCount = stageSequence.filter((node) =>
    hasClearedGameModeStage(progress, activeStageMapId, node.id),
  ).length;
  const allNodesCleared =
    stageSequence.length > 0 &&
    stageSequence.every((node) => hasClearedGameModeStage(progress, activeStageMapId, node.id));

  useEffect(() => {
    if (isAdminAccount || !allNodesCleared || !nextStage) return;
    unlockGameModeStage(nextStage.id);
    setProgress(getGameModeProgress());
  }, [allNodesCleared, isAdminAccount, nextStage]);

  useEffect(() => {
    if (!stageSequence.length || !stageMap) return;

    let changed = false;
    stageSequence.forEach((node, index) => {
      const unlocked =
        isAdminAccount ||
        (progress.unlockedThroughStage >= stageMap.id &&
          getNodeUnlocked(progress, stageMap.id, stageSequence, index));
      const hasAssigned = Boolean(getAssignedGameModeStageGame(progress, stageMap.id, node.id));
      if (!unlocked || hasAssigned) return;

      assignGameModeStageGame(stageMap.id, node.id, node.candidateVariants);
      changed = true;
    });

    if (changed) {
      setProgress(getGameModeProgress());
    }
  }, [isAdminAccount, progress, stageMap, stageSequence]);

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

  if (!stage || !stageMap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090914] px-6 text-white">
        <div className="w-full max-w-xl rounded-[24px] border border-[#1a1a36] bg-[#0f0f22] p-8 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">
            Stage Not Found
          </p>
          <h1 className="mt-3 text-3xl font-black">존재하지 않는 레벨입니다.</h1>
          <button
            type="button"
            onClick={() => router.replace("/select-page/game-mode")}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-black text-slate-900"
          >
            로드맵으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const isLevelUnlocked = isAdminAccount || progress.unlockedThroughStage >= stage.id;

  const handleNodeEnter = (
    levelId: number,
    levelDifficulty: string,
    node: GameModeStageNodeDefinition,
    unlocked: boolean,
  ) => {
    if (!unlocked) return;
    const assignedGameKey = getAssignedGameModeStageGame(progress, levelId, node.id);
    if (!assignedGameKey) return;

    const game = GAME_MODE_GAMES[assignedGameKey];
    const sentenceModeQuery =
      assignedGameKey === "sentence_build"
        ? `&sentenceMode=${encodeURIComponent("example")}`
        : assignedGameKey === "tongue_twister"
          ? `&sentenceMode=${encodeURIComponent("tongue")}`
          : "";
    router.push(
      `${game.href}?roadmapStage=${levelId}&roadmapNode=${encodeURIComponent(node.id)}&difficulty=${encodeURIComponent(levelDifficulty)}&fromStageMap=1${sentenceModeQuery}`,
    );
  };

  const totalNodes = stageSequence.length;
  const progressPct = totalNodes > 0 ? Math.round((clearedCount / totalNodes) * 100) : 0;
  const displayClearedCount = isMounted ? clearedCount : 0;
  const displayProgressPct = isMounted ? progressPct : 0;
  const displayAllNodesCleared = isMounted ? allNodesCleared : false;
  const groupedStageSequence = TIER_META.map((tierMeta) => ({
    ...tierMeta,
    nodes: stageSequence.filter((node) => node.tier === tierMeta.key),
  }));

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#090914] text-white">
      {/* 배경 그리드 */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(26,26,54,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(26,26,54,0.55)_1px,transparent_1px)] bg-[size:36px_36px]" />
      {/* 배경 방사형 글로우 */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.12),transparent)]" />

      {/* ── 헤더 ── */}
      <header className="relative z-10 border-b border-[#1a1a36] bg-[#090914]/92 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4">

          {/* 왼쪽: 로고 + 환자 정보 */}
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/images/logo/logo.png"
              alt="GOLDEN logo"
              className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
            />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.32em] text-violet-400/70">
                Active Patient
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm font-black text-white">
                <span className="truncate">{isMounted ? (patient?.name ?? "정보 없음") : "—"}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 text-[13px]">
                  {isMounted ? (patient?.age ?? "-") : "-"}세
                </span>
                <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[9px] font-black text-violet-300/80">
                  {ageGroup === "Senior" ? "실버" : "일반"}
                </span>
              </div>
            </div>
          </div>

          {/* 오른쪽: 네비 버튼 */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => router.push("/select-page/game-mode")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">레벨 선택</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/select-page/mode")}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/35 bg-violet-500/15 px-3 py-1.5 text-[11px] font-black text-violet-200 transition hover:bg-violet-500/25"
            >
              <Map className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">활동 선택</span>
            </button>
            <div className="mx-1 h-5 w-px bg-white/10" />
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-[11px] font-black text-slate-500 transition hover:bg-white/8 hover:text-slate-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isLoggingOut ? "로그아웃 중..." : "로그아웃"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[820px] px-4 pb-20 pt-10 sm:px-6">
        {!isLevelUnlocked ? (
          <div className="mb-6 rounded-[24px] border border-[#ffe66d55] bg-[#ffe66d12] px-5 py-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ffe66d55] bg-[#ffe66d1f] text-[#ffe66d]">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ffe66d]">
                  Preview Only
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  이 레벨은 아직 잠겨 있습니다.
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  스테이지 구조와 노드는 미리 볼 수 있지만, 실제 게임 시작은 이전 레벨을 완료해야 열립니다.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* 귀환 이펙트 */}
        {showReturnFx ? (
          <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(162,155,254,0.14)_0%,rgba(9,9,20,0.08)_45%,rgba(9,9,20,0.72)_100%)] animate-[fadeOut_1.6s_ease_forwards]" />
            <div className="absolute left-1/2 top-1/2 h-[58vmax] w-[58vmax] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 animate-[ping_1.2s_ease-out]" />
            <div className="absolute left-1/2 top-1/2 h-[36vmax] w-[36vmax] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/30 animate-[ping_1.5s_ease-out]" />
          </div>
        ) : null}

        {/* ── 타이틀 섹션 ── */}
        <section className="text-center">
          <p className={`${gameModeTitleFont.className} text-[10px] tracking-[0.42em] text-violet-400/80`}>
            BRAINFRIENDS · GAME MODE
          </p>
          <h1 className={`${gameModeTitleFont.className} mt-5 text-[22px] font-black leading-[1.75] text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9),0_0_30px_rgba(162,155,254,0.9),0_0_60px_rgba(116,185,255,0.45)] sm:text-[28px]`}>
            {cityTitle} {stageId === 1 ? "🏙️" : ""}
          </h1>
            {/* 진행도 바 */}
          <div className="mx-auto mt-6 max-w-[320px]">
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.24em]">
              <span className="text-slate-500">Progress</span>
              <span className="text-violet-300">{displayClearedCount} / {totalNodes} Cleared</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-400 to-sky-400 transition-all duration-700 shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                style={{ width: `${displayProgressPct}%` }}
              />
            </div>
            {displayAllNodesCleared && (
              <p className="mt-2 text-[10px] font-black tracking-[0.2em] text-emerald-400 [text-shadow:0_0_10px_rgba(52,211,153,0.5)]">
                ✦ ALL CLEAR ✦
              </p>
            )}
          </div>
        </section>

        {/* 스크롤 힌트 */}
        <p className={`${gameModeTitleFont.className} mt-7 text-center text-[10px] tracking-[0.26em] text-slate-600`}>
          ▼ SCROLL TO EXPLORE ▼
        </p>

        {/* ── 로드맵 섹션 ── */}
        <section className="relative mt-8 overflow-hidden rounded-[32px] border border-[#2a2a5a]/80 bg-[radial-gradient(ellipse_at_top,#1a1a48_0%,#111130_40%,#09090f_100%)] shadow-[0_32px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
          {/* 섹션 배경 글로우 */}
          <div className="pointer-events-none absolute -left-20 top-12 h-64 w-64 rounded-full bg-[#74b9ff18] blur-[80px]" />
          <div className="pointer-events-none absolute right-0 top-1/3 h-72 w-72 rounded-full bg-[#a29bfe14] blur-[80px]" />
          <div className="pointer-events-none absolute bottom-10 left-1/3 h-56 w-56 rounded-full bg-[#4ecdc418] blur-[80px]" />

          <div className="relative px-4 py-8 sm:px-8 sm:py-10">
            <div className="relative mx-auto max-w-[680px]">

              {/* 중앙 연결선 */}
              <div
                className="pointer-events-none absolute left-1/2 top-14 h-[calc(100%-7rem)] w-[3px] -translate-x-1/2 rounded-full"
                style={{
                  background: "linear-gradient(180deg, rgba(162,155,254,0.9) 0%, rgba(116,185,255,0.7) 50%, rgba(78,205,196,0.6) 100%)",
                  boxShadow: "0 0 18px rgba(162,155,254,0.35), 0 0 40px rgba(116,185,255,0.15)",
                }}
              />

              {/* 노드 목록 */}
              <div className="space-y-10">
                {groupedStageSequence.map((tierGroup) => (
                  <div key={tierGroup.key}>
                    <div className="mb-5 text-center">
                      <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                        <span className={`${gameModeTitleFont.className} text-[10px] tracking-[0.22em] text-violet-300`}>
                          {tierGroup.label}
                        </span>
                        <span className="text-[11px] font-black text-slate-400">
                          {tierGroup.desc}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {tierGroup.nodes.map((node, index) => {
                  const unlocked =
                    isAdminAccount ||
                    (progress.unlockedThroughStage >= node.mapItem.id &&
                      getNodeUnlocked(progress, node.mapItem.id, stageSequence, node.nodeIndex));
                  const cleared = hasClearedGameModeStage(progress, node.mapItem.id, node.id);
                  const assignedGameKey = getAssignedGameModeStageGame(progress, node.mapItem.id, node.id);
                  const badgeTheme = assignedGameKey ? GAME_BADGE_THEME[assignedGameKey] : null;
                  const assignedLabel =
                    assignedGameKey ? GAME_BADGE_THEME[assignedGameKey].label : null;
                  const accent = node.mapItem.accentColor;

                  const cardStyle = unlocked
                    ? {
                        borderColor: cleared ? hexToRgba(accent, 0.75) : hexToRgba(accent, 0.42),
                        background: `linear-gradient(135deg, ${hexToRgba(accent, cleared ? 0.18 : 0.10)} 0%, rgba(16,16,38,0.97) 55%, rgba(11,11,24,0.99) 100%)`,
                        boxShadow: cleared
                          ? `0 16px 40px ${hexToRgba(accent, 0.22)}, 0 0 0 1px ${hexToRgba(accent, 0.12)}, inset 0 1px 0 rgba(255,255,255,0.07)`
                          : `0 10px 28px ${hexToRgba(accent, 0.14)}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                      }
                    : {
                        borderColor: "rgba(255,255,255,0.08)",
                        background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(14,14,30,0.97) 70%, rgba(10,10,20,0.99) 100%)",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
                      };

                  const numberStyle = {
                    color: unlocked ? accent : "rgba(255,255,255,0.25)",
                    textShadow: unlocked ? `0 0 24px ${hexToRgba(accent, 0.5)}, 0 0 48px ${hexToRgba(accent, 0.2)}` : "none",
                  };

                  const buttonStyle = unlocked
                    ? {
                        background: `linear-gradient(135deg, ${hexToRgba(accent, 1)} 0%, ${hexToRgba(accent, 0.78)} 100%)`,
                        color: "#030d14",
                        boxShadow: `0 6px 18px ${hexToRgba(accent, 0.38)}, 0 0 0 1px ${hexToRgba(accent, 0.25)}`,
                      }
                    : undefined;

                  const connectorColor = unlocked ? hexToRgba(accent, 0.55) : "rgba(255,255,255,0.1)";

                        return (
                    <div
                      key={node.id}
                      id={`stage-node-${node.id}`}
                      data-stage-node={node.id}
                      className={`relative flex ${node.alignRight ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`relative z-10 w-full max-w-[340px] ${
                          focusNodeId === node.id && shouldPlayReturnFx
                            ? "animate-[pulse_1.6s_ease-in-out_2]"
                            : ""
                        }`}
                      >
                        <div
                          className="min-w-0 rounded-[22px] border px-5 py-4 backdrop-blur-sm transition-transform hover:scale-[1.015]"
                          style={cardStyle}
                        >
                          {/* 상단: 번호 + 테마명 + 클리어 뱃지 */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-baseline gap-2">
                              <span
                                className="text-[38px] font-black leading-none tabular-nums"
                                style={numberStyle}
                              >
                                {node.sequenceNumber}
                              </span>
                              <span
                                className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70"
                                style={{ color: unlocked ? accent : "rgba(255,255,255,0.3)" }}
                              >
                                LV
                              </span>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 text-right">
                              <span className="text-[12px] font-black leading-snug text-white/90 max-w-[180px]">
                                {node.displayId}
                              </span>
                              {cleared && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-emerald-400 ring-1 ring-emerald-500/30">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  CLEARED
                                </span>
                              )}
                              {!unlocked && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-black text-white/30 ring-1 ring-white/8">
                                  <Lock className="h-2.5 w-2.5" />
                                  LOCKED
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 구분선 */}
                          <div
                            className="my-3 h-px w-full rounded-full"
                            style={{
                              background: unlocked
                                ? `linear-gradient(90deg, ${hexToRgba(accent, 0.5)}, transparent)`
                                : "rgba(255,255,255,0.06)",
                            }}
                          />

                          {/* 하단: 게임 뱃지 + 시작 버튼 */}
                          <div className="flex items-center justify-between gap-2">
                            {badgeTheme && assignedLabel ? (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black whitespace-nowrap ${badgeTheme.badgeClass}`}>
                                <span className="text-[11px]">{badgeTheme.icon}</span>
                                {assignedLabel}
                              </span>
                            ) : (
                              <span className="text-[9px] font-black text-white/25">— 미정 —</span>
                            )}

                            <button
                              type="button"
                              disabled={!unlocked}
                              onClick={() =>
                                handleNodeEnter(
                                  node.mapItem.id,
                                  node.mapItem.difficulty,
                                  node,
                                  unlocked,
                                )
                              }
                              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[10px] font-black whitespace-nowrap transition-all ${
                                unlocked
                                  ? "hover:brightness-115 active:scale-95"
                                  : "cursor-not-allowed opacity-40"
                              }`}
                              style={buttonStyle}
                            >
                              {unlocked
                                ? <Play className="h-3 w-3" />
                                : <Lock className="h-3 w-3" />}
                              {cleared ? "재도전" : "시작"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 지그재그 연결 커넥터 */}
                      {index < tierGroup.nodes.length - 1 ? (
                        <div
                          className={`pointer-events-none absolute top-[62px] h-9 w-9 rounded-none ${
                            node.alignRight
                              ? "left-1/2 -translate-x-[calc(100%-13px)] rounded-bl-[20px] border-b-[4px] border-l-[4px] border-r-0 border-t-0"
                              : "left-1/2 -translate-x-[13px] rounded-br-[20px] border-b-[4px] border-l-0 border-r-[4px] border-t-0"
                          }`}
                          style={{ borderColor: connectorColor, filter: `drop-shadow(0 0 6px ${hexToRgba(accent, unlocked ? 0.4 : 0.1)})` }}
                        />
                      ) : null}
                    </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* 완주 마커 */}
              {displayAllNodesCleared && (
                <div className="mt-8 flex flex-col items-center gap-2">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                    style={{
                      background: "linear-gradient(135deg, #ffd700, #ff9f0a)",
                      boxShadow: "0 0 30px rgba(255,215,0,0.4), 0 0 60px rgba(255,215,0,0.15)",
                    }}
                  >
                    🏆
                  </div>
                  <p className={`${gameModeTitleFont.className} text-[10px] tracking-[0.3em] text-amber-400 [text-shadow:0_0_12px_rgba(255,215,0,0.5)]`}>
                    STAGE COMPLETE
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
