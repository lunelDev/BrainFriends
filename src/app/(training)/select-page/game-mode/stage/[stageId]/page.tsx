// src/app/(training)/select-page/game-mode/stage/[stageId]/page.tsx
//
// 옛 KOREA STYLE ROADMAP (LV.01 도시별 15노드 지그재그) 진입점.
// 메인 진입점은 KoreaMapMenu (한국 지도 + 권역 핀) 로 교체됨.
//
// 이 라우트는 옛 북마크/링크 / 옛 진행률 시스템에서 들어오는 사용자를 위해
// 보존하되, 서버 사이드 redirect 로 새 메뉴 (KoreaMapMenu) 에 흡수한다.
//
// 결정 근거:
//   - 옛 stage 시스템 진행률(roadmapStage/roadmapNode)은 로컬 스토리지에
//     그대로 남아 있어 데이터 영향 없음.
//   - stageId 가 어떤 값이든 새 권역 메뉴로 보내는 게 안전 (옛 stage→권역 매핑이
//     1:1 이 아니라 선별적 흡수).
//   - 옛 디자인 코드는 git 히스토리에 보존됨 (커밋 1f2735c 기준).

import { redirect } from "next/navigation";

export default function GameModeStageDetailPage() {
  redirect("/select-page/game-mode");
}
