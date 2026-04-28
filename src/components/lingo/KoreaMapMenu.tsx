// src/components/lingo/KoreaMapMenu.tsx
//
// 게임 모드 메인 화면. 한국 지도 + 권역 핀 7개 + 도시 사이드 패널.
//
// 구조:
//   - 좌측 70% (모바일 100%): map.png + 권역 핀 (CSS absolute 좌표)
//   - 우측 30% (모바일 하단 시트): 선택된 권역의 도시 카드
//
// 데이터: src/constants/regionMissionsData.ts
// 진행 상태: src/lib/gameModeProgress.ts (신규 헬퍼)

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  REGION_MISSIONS,
  type RegionConfig,
  type CityConfig,
  type MissionConfig,
  type RegionMissionGameType,
} from "@/constants/regionMissionsData";
import {
  getRegionMissionProgress,
  isRegionUnlocked,
  isRegionCityUnlocked,
  isRegionCityCleared,
  isRegionFirstHintDismissed,
  dismissRegionFirstHint,
  isRegionMissionCompleted,
  isRegionMissionUnlocked,
  type RegionMissionProgress,
} from "@/lib/gameModeProgress";

const MAP_IMG_SRC = "/images/game/map.png";

// 게임 종류 → 기존 라우트. 신규 게임 4종은 미구현 → 토스트.
const GAME_ROUTE_MAP: Partial<Record<RegionMissionGameType, string>> = {
  association_clear: "/programs/lingo/association-clear",
  word_select: "/programs/lingo/word-select",
  word_assemble: "/programs/lingo/word-assemble",
  tetris: "/programs/lingo/tetris",
  memory: "/programs/lingo/memory",
  sentence_build: "/programs/lingo/sentence",
  balloon: "/programs/lingo/balloon",
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

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M10 21v-5h4v5" />
    </svg>
  );
}

function LockIcon({ size = 12 }: { size?: number } = {}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

type RegionPinProps = {
  region: RegionConfig;
  state: "active" | "selected" | "locked";
  cityCount: number;
  onClick: () => void;
};

function RegionPin({ region, state, cityCount, onClick }: RegionPinProps) {
  const isLocked = state === "locked";
  const isSelected = state === "selected";

  const baseSize = 52;

  const cssVars = {
    ["--km-region-color" as never]: region.color,
    ["--km-region-color-soft" as never]: `${region.color}33`,
  } as React.CSSProperties;

  // 상태별 시각 스타일을 명확히 분리:
  //   selected → 권역 색 + 흰 테두리 + 강한 글로우 + 펄스
  //   active   → 권역 색 + 흰 테두리 + 중간 글로우 + 부드러운 brightness 펄스
  //   locked   → 어두운 배경(#1a1a36) + 권역 색 테두리 + 약한 글로우 + 흰 자물쇠
  // (이전: 잠금 핀이 너무 투명해서 지도 위에 거의 안 보였음.)
  const backgroundColor = isLocked ? "#1a1a36" : region.color;
  const border = isSelected
    ? "3px solid #FFFFFF"
    : isLocked
      ? `2px solid ${region.color}`
      : "2.5px solid #FFFFFF";
  const boxShadow = isSelected
    ? `0 0 28px ${region.color}, 0 0 56px ${region.color}AA, 0 0 0 8px ${region.color}33`
    : isLocked
      ? `0 0 12px ${region.color}66, 0 0 0 4px #00000066`
      : `0 0 14px ${region.color}, 0 0 28px ${region.color}77`;
  const opacity = isLocked ? 0.85 : 1;
  const animation = isSelected
    ? "km-pulse-glow 1.6s ease-in-out infinite"
    : isLocked
      ? "none"
      : "km-pin-breathe 2.6s ease-in-out infinite";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked && cityCount === 0}
      style={{
        ...cssVars,
        position: "absolute",
        left: `${region.pin.x}%`,
        top: `${region.pin.y}%`,
        transform: "translate(-50%, -50%)",
        width: baseSize,
        height: baseSize,
        borderRadius: "50%",
        backgroundColor,
        border,
        boxShadow,
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: 800,
        // flex 중앙 정렬 — 자물쇠 아이콘 / shortLabel 글자 모두 핀 정중앙에 위치.
        // (기본 button 은 inline-block 이라 SVG 자식이 baseline 기준으로 살짝 위로 뜸.)
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 1,
        cursor: isLocked ? "not-allowed" : "pointer",
        transition: "transform 0.18s, box-shadow 0.18s, opacity 0.18s",
        opacity,
        zIndex: isSelected ? 30 : 20,
        textShadow: isLocked ? "none" : "0 0 6px rgba(0,0,0,0.6)",
        animation,
      }}
      onMouseEnter={(e) => {
        if (!isLocked) {
          e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.14)";
        } else {
          e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.06)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
      }}
      aria-label={`${region.name} 권역${isLocked ? " (잠금)" : ""}`}
    >
      {isLocked ? <LockIcon size={20} /> : region.shortLabel}
    </button>
  );
}

type CityCardProps = {
  region: RegionConfig;
  city: CityConfig;
  cityState: "active" | "cleared" | "locked" | "empty";
  selected: boolean;
  onSelect: (cityId: string) => void;
};

function CityCard({ region, city, cityState, selected, onSelect }: CityCardProps) {
  const isLocked = cityState === "locked";
  const isEmpty = cityState === "empty";
  const isCleared = cityState === "cleared";
  const disabled = isLocked || isEmpty;

  const totalMissions = city.missions.length;
  const completedCount = isCleared ? totalMissions : 0;

  // CSS 변수만 인라인 — 호버/트랜지션은 .km-city-card 규칙에 위임.
  const cssVars = {
    ["--km-region-color" as never]: region.color,
    ["--km-region-color-soft" as never]: `${region.color}22`,
  } as React.CSSProperties;

  // 선택 상태에서는 배경이 권역 색으로 채워져 보라/원색 위에 같은 색 글자가 안 보임.
  // → 선택 시 모든 텍스트 색상을 흰색으로 강제하고 부제는 살짝 밝은 회색으로.
  const titleColor = selected ? "#FFFFFF" : region.color;
  const descColor = selected ? "#FFFFFFCC" : "#AAAAAA";
  const titleShadow = disabled
    ? "none"
    : selected
      ? "0 0 8px #00000055"
      : `0 0 10px ${region.color}77`;

  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: titleColor,
            textShadow: titleShadow,
          }}
        >
          {city.name}
        </span>
        {isEmpty ? (
          <span style={{ fontSize: 10, color: "#888780" }}>준비 중</span>
        ) : isLocked ? (
          <LockIcon />
        ) : isCleared ? (
          <span style={{ fontSize: 12, color: selected ? "#FFEB99" : "#FFD700" }}>★ {completedCount}/{totalMissions}</span>
        ) : (
          <span style={{ fontSize: 11, color: selected ? "#FFFFFF" : "#FAC775" }}>▶ {totalMissions} 미션</span>
        )}
      </div>
      <p style={{ marginTop: 6, fontSize: 11, color: descColor }}>{city.description}</p>
    </>
  );

  if (disabled) {
    return (
      <div className="km-city-card disabled" style={cssVars}>
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(city.id)}
      className={`km-city-card${selected ? " selected" : ""}`}
      style={cssVars}
    >
      {inner}
    </button>
  );
}

type MissionRowProps = {
  region: RegionConfig;
  mission: MissionConfig;
  index: number;
  completed: boolean;
  unlocked: boolean;
  onClick: (mission: MissionConfig) => void;
};

// 도시 진입 후 우측에 스태거(stagger) 등장하는 미션 카드.
// CSS animation-delay 로 카드별 진입 타이밍을 띄움.
function MissionRow({ region, mission, index, completed, unlocked, onClick }: MissionRowProps) {
  const disabled = !unlocked;

  const cssVars = {
    ["--km-region-color" as never]: region.color,
    ["--km-region-color-soft" as never]: `${region.color}22`,
    animationDelay: `${index * 90}ms`,
  } as React.CSSProperties;

  return (
    <button
      type="button"
      onClick={() => !disabled && onClick(mission)}
      disabled={disabled}
      className={`km-mission-card${disabled ? " disabled" : ""}${completed ? " completed" : ""}`}
      style={cssVars}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: disabled ? "#888780" : region.color,
            textShadow: disabled ? "none" : `0 0 8px ${region.color}55`,
          }}
        >
          MISSION {mission.order} · {GAME_LABEL[mission.gameType]}
        </span>
        {completed ? (
          <span style={{ fontSize: 14, color: "#FFD700" }}>★</span>
        ) : disabled ? (
          <span style={{ fontSize: 10, color: "#888780" }}>잠금</span>
        ) : (
          <span style={{ fontSize: 12, color: "#FAC775" }}>▶</span>
        )}
      </div>
      <p style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>
        {mission.title}
      </p>
      <p style={{ marginTop: 3, fontSize: 11, color: "#AAAAAA" }}>{mission.description}</p>
    </button>
  );
}

export default function KoreaMapMenu() {
  const router = useRouter();
  const [selectedRegionId, setSelectedRegionId] = useState<string>("metro");
  // 도시 선택 시 우측 패널이 미션 카드 5개로 전환된다 (페이지 이동 X).
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [progress, setProgress] = useState<RegionMissionProgress>({
    completedMissions: [],
    updatedAt: 0,
  });
  const [showHint, setShowHint] = useState(false);
  const [comingSoonNote, setComingSoonNote] = useState<string | null>(null);

  useEffect(() => {
    setProgress(getRegionMissionProgress());
    setShowHint(!isRegionFirstHintDismissed());
  }, []);

  const selectedRegion = useMemo(
    () => REGION_MISSIONS.find((r) => r.id === selectedRegionId) ?? REGION_MISSIONS[0],
    [selectedRegionId],
  );

  const selectedCity = useMemo(
    () => selectedRegion.cities.find((c) => c.id === selectedCityId) ?? null,
    [selectedRegion, selectedCityId],
  );

  const totalMissions = useMemo(
    () =>
      REGION_MISSIONS.reduce(
        (sum, r) => sum + r.cities.reduce((s, c) => s + c.missions.length, 0),
        0,
      ),
    [],
  );
  const completedCount = progress.completedMissions.length;

  function handleRegionClick(regionId: string) {
    if (showHint) {
      dismissRegionFirstHint();
      setShowHint(false);
    }
    setSelectedRegionId(regionId);
    // 권역을 바꾸면 미션 보기를 닫고 도시 리스트로 복귀.
    setSelectedCityId(null);
  }

  function handleCitySelect(cityId: string) {
    setSelectedCityId((prev) => (prev === cityId ? null : cityId));
  }

  function handleMissionClick(mission: MissionConfig) {
    if (!selectedCity) return;
    const route = GAME_ROUTE_MAP[mission.gameType];
    if (!route) {
      setComingSoonNote(`"${GAME_LABEL[mission.gameType]}" 게임은 곧 출시됩니다.`);
      window.setTimeout(() => setComingSoonNote(null), 2400);
      return;
    }
    const url = new URL(route, window.location.origin);
    url.searchParams.set("missionId", mission.id);
    url.searchParams.set("cityId", selectedCity.id);
    url.searchParams.set("regionId", selectedRegion.id);
    router.push(url.pathname + url.search);
  }

  return (
    <main
      className="lingo-game-shell relative flex min-h-screen flex-col overflow-hidden text-white"
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
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 40% 35%, rgba(127,119,221,0.18), transparent 55%), radial-gradient(ellipse at 70% 75%, rgba(151,196,89,0.12), transparent 55%)",
        }}
      />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#1a1a36] bg-[#090914]/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div>
          <span
            className="block text-[10px] font-black uppercase leading-none tracking-[0.28em]"
            style={{ color: "#7F77DD" }}
          >
            KR · BRAINFRIENDS
          </span>
          <h1
            className="mt-1 text-base font-black tracking-tight text-white sm:text-lg"
            style={{ textShadow: "0 0 8px #FFFFFF55, 0 0 18px #7F77DD66" }}
          >
            전국 한바퀴 — 게임 모드
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {completedCount} / {totalMissions} 미션
          </span>
          <Link
            href="/select-page/mode"
            className="flex items-center gap-1 rounded-full border border-[#1a1a36] bg-[#0E0E1F] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-[#16162A]"
          >
            <HomeIcon />
            홈으로
          </Link>
        </div>
      </header>

      {/*
        3열 layout — SOUTH KOREA 인포그래픽 톤.
        - 좌측(km-intro): 큰 제목 + 게임 종류 + 핀 범례
        - 가운데(km-map-section): 지도 + 핀
        - 우측(km-side): 선택 권역 도시 카드
        모바일/태블릿: column (intro → map → side 순서)
        lg(1024+): 240px / 1fr / 360px 3열
      */}
      <style>{`
        @keyframes km-pulse-glow {
          0%, 100% { box-shadow: 0 0 14px var(--km-region-color), 0 0 0 6px var(--km-region-color-soft); }
          50% { box-shadow: 0 0 28px var(--km-region-color), 0 0 44px var(--km-region-color), 0 0 0 8px var(--km-region-color-soft); }
        }
        /* 활성(unlocked, not selected) 핀이 항상 부드럽게 발광 — 사용자 시선 유도 */
        @keyframes km-pin-breathe {
          0%, 100% { box-shadow: 0 0 14px var(--km-region-color), 0 0 26px var(--km-region-color-soft); }
          50% { box-shadow: 0 0 22px var(--km-region-color), 0 0 40px var(--km-region-color), 0 0 0 4px var(--km-region-color-soft); }
        }
        @keyframes km-card-zoom {
          0% { transform: scale(1); opacity: 1; }
          60% { transform: scale(1.06); opacity: 0.95; box-shadow: 0 0 40px var(--km-region-color); }
          100% { transform: scale(1.5); opacity: 0; }
        }
        /* 도시 카드 — 호버·진입 효과 */
        .km-city-card {
          display: block;
          width: 100%;
          text-align: left;
          padding: 14px 16px;
          border-radius: 12px;
          color: #FFFFFF;
          background-color: var(--km-region-color-soft);
          border: 1px solid var(--km-region-color);
          box-shadow: 0 0 12px var(--km-region-color-soft);
          cursor: pointer;
          transform: scale(1);
          opacity: 1;
          transition: box-shadow 0.2s, transform 0.4s ease-out, opacity 0.4s ease-out, background-color 0.15s;
        }
        .km-city-card:hover {
          box-shadow: 0 0 24px var(--km-region-color), 0 0 0 3px var(--km-region-color-soft);
          background-color: var(--km-region-color-soft);
          transform: translateY(-1px);
        }
        .km-city-card.selected {
          background-color: var(--km-region-color);
          box-shadow: 0 0 28px var(--km-region-color), 0 0 0 3px var(--km-region-color-soft);
          transform: translateY(-1px);
        }
        .km-city-card.disabled {
          cursor: not-allowed;
          opacity: 0.5;
          box-shadow: none;
        }
        .km-city-card.disabled:hover {
          transform: none;
          box-shadow: none;
        }

        /* 미션 카드 — 도시 선택 후 우측에서 한 장씩 슬라이드-인. */
        @keyframes km-mission-in {
          from { opacity: 0; transform: translateX(36px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .km-mission-card {
          display: block;
          width: 100%;
          text-align: left;
          padding: 12px 14px;
          border-radius: 10px;
          color: #FFFFFF;
          background-color: var(--km-region-color-soft);
          border: 1px solid var(--km-region-color);
          box-shadow: 0 0 10px var(--km-region-color-soft);
          cursor: pointer;
          opacity: 0;
          transform: translateX(36px);
          animation: km-mission-in 0.45s ease-out forwards;
          transition: box-shadow 0.18s, background-color 0.15s, border-color 0.15s;
        }
        .km-mission-card:hover {
          box-shadow: 0 0 22px var(--km-region-color), 0 0 0 2px var(--km-region-color-soft);
        }
        .km-mission-card.completed {
          border-color: #FFD700AA;
          box-shadow: 0 0 14px #FFD70044;
        }
        .km-mission-card.disabled {
          cursor: not-allowed;
          background-color: #1a1a36;
          border-color: #888780;
          opacity: 0.55;
          box-shadow: none;
        }
        .km-mission-card.disabled:hover { box-shadow: none; }

        /* 지도 좌측 시프트 — 도시 선택 시 캔버스가 좌측으로 크게 밀려나
           우측에 미션 오버레이 공간을 만든다. 모바일은 시프트 없음 (세로 스택). */
        .km-map-canvas {
          transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .km-map-canvas.shifted { transform: translateX(0); }

        /* 미션 오버레이 — 지도 섹션 안의 우측 영역에 뜸.
           모바일/태블릿: 지도 아래에 세로 스택.
           lg+: 지도 섹션 우측에 absolute 오버레이. */
        .km-missions-overlay {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px 8px 0;
          z-index: 5;
        }
        .km-missions-overlay-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-bottom: 8px;
          border-bottom: 1px solid #1a1a36;
          margin-bottom: 4px;
        }
        .km-missions-empty {
          padding: 16px;
          background: #1a1a36;
          border-radius: 8px;
          text-align: center;
          font-size: 12px;
          color: #888780;
        }

        /* 미션 보기 헤더의 뒤로가기 버튼. */
        .km-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          color: #888780;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          text-transform: uppercase;
        }
        .km-back-btn:hover { color: #FFFFFF; }
        @keyframes km-title-flicker {
          0%, 100% { text-shadow: 0 0 8px #7F77DD, 0 0 18px #7F77DD66; }
          50% { text-shadow: 0 0 12px #7F77DD, 0 0 28px #7F77DD88, 0 0 48px #7F77DD44; }
        }
        @keyframes km-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .km-body { position: relative; z-index: 10; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
        .km-intro {
          padding: 20px 20px 8px;
          color: #FFFFFF;
        }
        .km-intro h2 {
          font-size: 32px;
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: #FFFFFF;
          margin: 0;
          text-shadow: 0 0 10px #7F77DDAA, 0 0 22px #7F77DD55;
          animation: km-title-flicker 3.4s ease-in-out infinite;
        }
        .km-intro h2 span { display: block; }
        .km-intro p.lead {
          margin-top: 12px;
          font-size: 12px;
          line-height: 1.6;
          color: #AAAAAA;
        }
        .km-divider {
          height: 1px;
          background: #1a1a36;
          margin: 16px 0;
        }
        .km-section-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          color: #D4537E;
          margin: 0 0 8px;
          text-transform: uppercase;
        }
        .km-progress-num {
          font-size: 26px;
          font-weight: 800;
          color: #FFFFFF;
        }
        .km-progress-cap {
          font-size: 11px;
          color: #888780;
          margin-top: 2px;
        }
        .km-game-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          font-size: 11px;
          color: #CCCCCC;
        }
        .km-game-chip {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .km-legend-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 3px 0;
          font-size: 11px;
          color: #AAAAAA;
        }
        .km-legend-pin {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          flex-shrink: 0;
          background: #7F77DD;
          border: 2px solid #FFFFFF;
        }
        .km-legend-pin.locked { background: #88878033; border-color: #88878066; }
        .km-legend-pin.cleared { background: #97C459; border-color: #FFFFFF; }
        .km-map-section { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; min-height: 0; }
        .km-map-canvas { position: relative; width: min(100%, 420px); aspect-ratio: 3 / 4; max-height: calc(100vh - 200px); }
        .km-side {
          position: relative;
          background: #0E0E1F;
          border-top: 1px solid #1a1a36;
          padding: 16px;
          flex-shrink: 0;
        }
        @media (min-width: 1024px) {
          .km-body {
            display: grid;
            /* 좌우 대칭 — 지도 섹션 중앙이 페이지 중앙과 일치하도록 */
            grid-template-columns: 300px minmax(0, 1fr) 300px;
            grid-template-rows: minmax(0, 1fr);
          }
          .km-intro {
            padding: 28px 24px;
            border-right: 1px solid #1a1a36;
            overflow-y: auto;
          }
          .km-map-section { padding: 24px; flex-direction: row; }
          .km-map-canvas { width: min(100%, 460px); margin: 0 auto; }
          /* 도시 선택 시 지도를 좌측으로 살짝만 — 너무 밀면 좁은 뷰포트에서 화면 밖으로 나감.
             clamp 로 뷰포트 폭에 비례시키되 최소 -60, 최대 -110 으로 캡. */
          .km-map-canvas.shifted { transform: translateX(clamp(-110px, -7vw, -60px)); }
          /* 미션 오버레이: 지도 섹션의 우측 영역에 absolute 로 떠 있음 */
          .km-missions-overlay {
            position: absolute;
            top: 24px;
            bottom: 24px;
            right: 24px;
            width: 300px;
            padding: 0;
            overflow-y: auto;
          }
          .km-side {
            width: 300px;
            border-top: none;
            border-left: 1px solid #1a1a36;
            overflow-y: auto;
            padding: 20px;
          }
        }
      `}</style>
      <div className="km-body">
        <aside className="km-intro">
          <h2>
            <span>KOREA</span>
            <span>ROADMAP</span>
          </h2>
          <p className="lead">
            전국을 따라 한바퀴. 지역마다 다른 미션과 단어로 발화 훈련을 이어갑니다.
          </p>

          <div className="km-divider" />

          <p className="km-section-label">진행률</p>
          <div className="km-progress-num">
            {completedCount} / {totalMissions}
          </div>
          <div className="km-progress-cap">완료한 미션 / 전체 미션</div>

          <div className="km-divider" />

          <p className="km-section-label">미션 게임</p>
          <div className="km-game-row">
            <span className="km-game-chip" style={{ background: "#7F77DD" }} />
            연상 매칭
          </div>
          <div className="km-game-row">
            <span className="km-game-chip" style={{ background: "#EF9F27" }} />
            단어 선택
          </div>
          <div className="km-game-row">
            <span className="km-game-chip" style={{ background: "#97C459" }} />
            단어 조합
          </div>
          <div className="km-game-row">
            <span className="km-game-chip" style={{ background: "#5DCAA5" }} />
            단어 폭탄
          </div>
          <div className="km-game-row">
            <span className="km-game-chip" style={{ background: "#FAC775" }} />
            단어 배치
          </div>
          <div className="km-game-row">
            <span className="km-game-chip" style={{ background: "#D4537E" }} />
            문장 만들기
          </div>
          <div className="km-game-row">
            <span className="km-game-chip" style={{ background: "#85B7EB" }} />
            풍선 키우기
          </div>
          <div className="km-game-row" style={{ color: "#666" }}>
            <span className="km-game-chip" style={{ background: "#444", border: "1px dashed #888" }} />
            사투리·끝말잇기·속담 (곧 출시)
          </div>

          <div className="km-divider" />

          <p className="km-section-label">핀 범례</p>
          <div className="km-legend-row">
            <span className="km-legend-pin" />진행 가능
          </div>
          <div className="km-legend-row">
            <span className="km-legend-pin cleared" />클리어
          </div>
          <div className="km-legend-row">
            <span className="km-legend-pin locked" />잠금
          </div>
        </aside>

        <section className="km-map-section">
          <div className={`km-map-canvas${selectedCity ? " shifted" : ""}`}>
            <img
              src={MAP_IMG_SRC}
              alt="대한민국 지도"
              className="select-none"
              draggable={false}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />

            {REGION_MISSIONS.map((region) => {
              const unlocked = isRegionUnlocked(progress, REGION_MISSIONS, region.id);
              const cityCount = region.cities.length;
              const state: "active" | "selected" | "locked" =
                !unlocked
                  ? "locked"
                  : region.id === selectedRegionId
                    ? "selected"
                    : "active";
              return (
                <RegionPin
                  key={region.id}
                  region={region}
                  state={state}
                  cityCount={cityCount}
                  onClick={() => handleRegionClick(region.id)}
                />
              );
            })}

            {showHint ? (
              <div
                style={{
                  position: "absolute",
                  left: `${REGION_MISSIONS[0].pin.x}%`,
                  top: `${REGION_MISSIONS[0].pin.y - 10}%`,
                  transform: "translate(-50%, -100%)",
                  zIndex: 40,
                  backgroundColor: "#7F77DD",
                  color: "#FFFFFF",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 16px rgba(127,119,221,0.5)",
                }}
              >
                여기서 시작 ↓
              </div>
            ) : null}
          </div>

          {/*
            미션 오버레이 — 도시 선택 시 지도 섹션의 우측 영역에 뜸.
            key 에 cityId 를 포함시켜 도시 변경마다 entrance 애니메이션 재트리거.
          */}
          {selectedCity ? (
            <div className="km-missions-overlay" key={selectedCity.id}>
              <div className="km-missions-overlay-header">
                <button
                  type="button"
                  className="km-back-btn"
                  onClick={() => setSelectedCityId(null)}
                >
                  ← 도시 목록
                </button>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: selectedRegion.color,
                      display: "inline-block",
                      boxShadow: `0 0 10px ${selectedRegion.color}`,
                    }}
                  />
                  <h2 className="text-base font-black text-white">
                    {selectedRegion.name} · {selectedCity.name}
                  </h2>
                </div>
                <p className="text-xs text-slate-400">{selectedCity.description}</p>
                <p className="text-[11px] text-slate-500">
                  {selectedCity.missions.length} 미션 · 1번부터 순서대로 진행
                </p>
              </div>

              {selectedCity.missions.length === 0 ? (
                <div className="km-missions-empty">이 도시는 곧 추가됩니다.</div>
              ) : (
                selectedCity.missions
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((mission, idx) => {
                    const completed = isRegionMissionCompleted(
                      progress,
                      selectedRegion.id,
                      selectedCity.id,
                      mission.id,
                    );
                    const unlocked = isRegionMissionUnlocked(
                      progress,
                      selectedRegion.id,
                      selectedCity.id,
                      selectedCity.missions,
                      mission.id,
                    );
                    return (
                      <MissionRow
                        key={mission.id}
                        region={selectedRegion}
                        mission={mission}
                        index={idx}
                        completed={completed}
                        unlocked={unlocked}
                        onClick={handleMissionClick}
                      />
                    );
                  })
              )}
            </div>
          ) : null}
        </section>

        <aside className="km-side">
          {/* km-side 는 항상 도시 리스트. 미션은 지도 섹션의 km-missions-overlay 가 담당.
              현재 선택된 도시는 CityCard 의 selected prop 으로 시각적 강조. */}
          <div className="flex items-center gap-2">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: selectedRegion.color,
                display: "inline-block",
              }}
            />
            <h2 className="text-base font-black text-white">{selectedRegion.name}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">{selectedRegion.description}</p>
          <p className="mt-2 text-[11px] text-slate-500">
            {selectedRegion.cities.length} 도시 · 클릭해서 미션 시작
          </p>

          <div className="mt-5 space-y-3">
            {selectedRegion.cities.length === 0 ? (
              <p className="rounded-lg bg-[#1a1a36] p-4 text-center text-xs text-slate-400">
                이 권역은 곧 추가됩니다.
              </p>
            ) : (
              selectedRegion.cities.map((city) => {
                // 권역 자체가 잠금이면 그 안의 모든 도시도 잠금으로 표시.
                // (이전 버그: 경상남 권역이 잠금이어도 첫 도시 부산이 풀려 보였음)
                const regionUnlocked = isRegionUnlocked(
                  progress,
                  REGION_MISSIONS,
                  selectedRegion.id,
                );
                const cityUnlockedInRegion = isRegionCityUnlocked(
                  progress,
                  selectedRegion.id,
                  selectedRegion.cities,
                  city.id,
                );
                const unlocked = regionUnlocked && cityUnlockedInRegion;
                const cleared = isRegionCityCleared(progress, selectedRegion.id, city);
                const isEmpty = city.missions.length === 0;
                const cityState: "active" | "cleared" | "locked" | "empty" = isEmpty
                  ? "empty"
                  : !unlocked
                    ? "locked"
                    : cleared
                      ? "cleared"
                      : "active";
                return (
                  <CityCard
                    key={city.id}
                    region={selectedRegion}
                    city={city}
                    cityState={cityState}
                    selected={selectedCityId === city.id}
                    onSelect={handleCitySelect}
                  />
                );
              })
            )}
          </div>

          <div className="mt-6 rounded-lg border border-[#1a1a36] bg-[#0a0a18] p-3 text-[11px] text-slate-400">
            <p className="font-bold text-slate-300">진행 룰</p>
            <p className="mt-1">미션 1번부터 순서대로 잠금 해제</p>
            <p className="mt-1">도시 모든 미션 완료 → 다음 도시</p>
            <p className="mt-1">권역 모든 도시 완료 → 다음 권역</p>
          </div>
        </aside>
      </div>

      {comingSoonNote ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1a1a36] px-5 py-3 text-sm text-white shadow-lg"
        >
          {comingSoonNote}
        </div>
      ) : null}
    </main>
  );
}
