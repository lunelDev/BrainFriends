// src/app/(training)/select-page/game-mode/page.tsx
//
// 게임 모드 메인 화면 — 한국 지도 + 권역 핀 7개 + 도시 사이드 패널.
//
// 이 화면이 진입점이 되고, 권역 → 도시 클릭 시
// /select-page/game-mode/[regionId]/[cityId] 로 이동.
//
// 기존 KOREA STYLE ROADMAP (LV.01 서울 ...) 화면은 KoreaMapMenu 로 교체됨.
// 이전 디자인은 git 히스토리에 보존 (커밋 1f2735c 기준).

"use client";

import KoreaMapMenu from "@/components/lingo/KoreaMapMenu";

export default function GameModePage() {
  return <KoreaMapMenu />;
}
