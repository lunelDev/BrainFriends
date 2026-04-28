// src/hooks/useRegionMissionMark.ts
//
// 신규 권역/도시/미션 진행률 마킹용 공통 훅.
//
// 사용처: src/components/lingo/*Game.tsx (7개 + 향후 신규 4개)
// 기존 패턴: 게임이 클리어 시 markGameModeStageCleared(...) 호출
//   → 옆에 markCleared() 한 줄만 추가하면 신규 권역 진행률도 마킹됨.
//
// 쿼리 파라미터 (KoreaMapMenu.handleMissionClick 가 세팅):
//   ?regionId=metro&cityId=seoul&missionId=seoul-2
//
// 멱등 보장: useRef 로 한 번만 마킹.
// 쿼리가 비어있으면 (옛날 진입경로) 아무것도 안 함.

"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import { markRegionMissionCompleted } from "@/lib/gameModeProgress";

export function useRegionMissionMark() {
  const searchParams = useSearchParams();
  const regionId = searchParams.get("regionId") ?? "";
  const cityId = searchParams.get("cityId") ?? "";
  const missionId = searchParams.get("missionId") ?? "";
  const markedRef = useRef(false);

  const markCleared = useCallback(() => {
    if (markedRef.current) return;
    if (!regionId || !cityId || !missionId) return;
    markRegionMissionCompleted({ regionId, cityId, missionId });
    markedRef.current = true;
  }, [regionId, cityId, missionId]);

  return {
    regionId,
    cityId,
    missionId,
    isRegionMission: Boolean(regionId && cityId && missionId),
    markCleared,
  };
}
