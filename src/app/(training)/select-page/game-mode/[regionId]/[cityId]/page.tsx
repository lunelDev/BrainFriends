// src/app/(training)/select-page/game-mode/[regionId]/[cityId]/page.tsx
//
// 도시 미션 5개 화면. 권역 지도에서 도시 클릭 시 진입.
//
// 동작:
//   - 미션을 세로 리스트로 (order 1번부터 5번까지)
//   - 잠금 해제된 미션만 클릭 가능
//   - 클릭 시 해당 게임 라우트로 이동 (?missionId=&cityId=&regionId= 쿼리)
//   - 신규 게임 (dialect_repeat 등) 은 placeholder

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  REGION_MISSIONS,
  type MissionConfig,
  type RegionMissionGameType,
} from "@/constants/regionMissionsData";
import {
  getRegionMissionProgress,
  isRegionMissionCompleted,
  isRegionMissionUnlocked,
  type RegionMissionProgress,
} from "@/lib/gameModeProgress";

// 게임 종류 → 기존 라우트 매핑.
// 신규 게임 4종은 미구현이라 placeholder.
const GAME_ROUTE_MAP: Partial<Record<RegionMissionGameType, string>> = {
  association_clear: "/programs/lingo/association-clear",
  word_select: "/programs/lingo/word-select",
  word_assemble: "/programs/lingo/word-assemble",
  tetris: "/programs/lingo/tetris",
  memory: "/programs/lingo/memory",
  sentence_build: "/programs/lingo/sentence",
  balloon: "/programs/lingo/balloon",
  // 신규 게임 — 곧 구현
  // dialect_repeat / place_name / kkutmal_ittgi / proverb_fill
};

const GAME_LABEL: Record<RegionMissionGameType, string> = {
  association_clear: "연상 매칭",
  word_select: "단어 선택",
  word_assemble: "단어 조합",
  tetris: "단어 폭탄",
  memory: "단어 배치",
  tongue_twister: "잰말놀이",
  sentence_build: "문장 만들기",
  balloon: "풍선 키우기",
  dialect_repeat: "사투리 따라하기",
  place_name: "지명 따라말하기",
  kkutmal_ittgi: "끝말잇기",
  proverb_fill: "속담 완성",
};

export default function CityMissionsPage() {
  const params = useParams<{ regionId: string; cityId: string }>();
  const router = useRouter();
  const [progress, setProgress] = useState<RegionMissionProgress>({
    completedMissions: [],
    updatedAt: 0,
  });
  const [comingSoonNote, setComingSoonNote] = useState<string | null>(null);

  useEffect(() => {
    setProgress(getRegionMissionProgress());
  }, []);

  const region = useMemo(
    () => REGION_MISSIONS.find((r) => r.id === params.regionId) ?? null,
    [params.regionId],
  );
  const city = useMemo(
    () => region?.cities.find((c) => c.id === params.cityId) ?? null,
    [region, params.cityId],
  );

  if (!region || !city) {
    return (
      <main
        className="flex min-h-screen items-center justify-center text-white"
        style={{ backgroundColor: "#090914" }}
      >
        <div className="text-center">
          <p className="text-base font-bold">권역 또는 도시를 찾을 수 없습니다.</p>
          <Link
            href="/select-page/game-mode"
            className="mt-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
          >
            지도로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const completedInCity = city.missions.filter((m) =>
    isRegionMissionCompleted(progress, region.id, city.id, m.id),
  ).length;

  function handleMissionClick(mission: MissionConfig) {
    const route = GAME_ROUTE_MAP[mission.gameType];
    if (!route) {
      setComingSoonNote(`"${GAME_LABEL[mission.gameType]}" 게임은 곧 출시됩니다.`);
      setTimeout(() => setComingSoonNote(null), 2400);
      return;
    }
    const url = new URL(route, window.location.origin);
    url.searchParams.set("missionId", mission.id);
    url.searchParams.set("cityId", city!.id);
    url.searchParams.set("regionId", region!.id);
    router.push(url.pathname + url.search);
  }

  return (
    <main
      className="relative flex min-h-screen flex-col text-white"
      style={{ backgroundColor: "#090914" }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(26,26,54,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,54,0.55) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-3 border-b border-[#1a1a36] bg-[#090914]/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div>
          <Link
            href="/select-page/game-mode"
            className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 hover:text-white"
          >
            ← 지도로 돌아가기
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-base font-black sm:text-lg">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: region.color,
                display: "inline-block",
              }}
            />
            {region.name} · {city.name}
          </h1>
        </div>
        <span className="text-xs text-slate-400">
          {completedInCity} / {city.missions.length} 미션
        </span>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-xs text-slate-400">{city.description}</p>

        {city.missions.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-white/20 p-6 text-center">
            <p className="text-sm font-semibold text-slate-300">
              이 도시는 곧 추가됩니다.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              현재는 데이터가 준비 중입니다. 다른 도시를 선택해 주세요.
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {city.missions
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((mission) => {
                const completed = isRegionMissionCompleted(
                  progress,
                  region.id,
                  city.id,
                  mission.id,
                );
                const unlocked = isRegionMissionUnlocked(
                  progress,
                  region.id,
                  city.id,
                  city.missions,
                  mission.id,
                );
                const disabled = !unlocked;

                return (
                  <li key={mission.id}>
                    <button
                      type="button"
                      onClick={() => !disabled && handleMissionClick(mission)}
                      disabled={disabled}
                      className="block w-full rounded-xl border p-4 text-left transition"
                      style={{
                        backgroundColor: disabled
                          ? "#1a1a36"
                          : completed
                            ? `${region.color}22`
                            : `${region.color}11`,
                        borderColor: disabled
                          ? "#888780"
                          : completed
                            ? `${region.color}AA`
                            : region.color,
                        opacity: disabled ? 0.55 : 1,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-xs font-black uppercase tracking-wider"
                          style={{ color: disabled ? "#888780" : region.color }}
                        >
                          MISSION {mission.order} · {GAME_LABEL[mission.gameType]}
                        </span>
                        {completed ? (
                          <span style={{ color: "#FFD700", fontSize: 14 }}>★</span>
                        ) : disabled ? (
                          <span className="text-[10px] text-slate-500">잠금</span>
                        ) : (
                          <span style={{ color: "#FAC775", fontSize: 12 }}>▶</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-bold text-white">
                        {mission.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {mission.description}
                      </p>
                    </button>
                  </li>
                );
              })}
          </ul>
        )}

        {comingSoonNote ? (
          <div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1a1a36] px-5 py-3 text-sm text-white shadow-lg"
            role="status"
          >
            {comingSoonNote}
          </div>
        ) : null}
      </section>
    </main>
  );
}
