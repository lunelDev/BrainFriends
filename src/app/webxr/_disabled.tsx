// 이 파일은 삭제 예정입니다.
//
// 2026-04-30 PM 결정: app/webxr/page.tsx (Three.js + @react-three/xr 기반 PoC) 는
// 사용자가 별도로 만든 app/(training)/webxr/page.tsx (vanilla WebXR API 기반) 와
// /webxr URL 충돌을 일으켜서 삭제. (training)/webxr/page.tsx 가 정식 운영본.
//
// 정식 삭제 단계 (사용자 로컬에서 수행):
//   - Windows 탐색기 또는 IDE 에서 src/app/webxr/ 디렉토리 우클릭 → 삭제
//   - 또는: rmdir /s /q src\app\webxr   (PowerShell)
//
// 의존성도 함께 제거됨 (package.json):
//   @react-three/drei, @react-three/fiber, @react-three/xr, three, @types/three
//
// 삭제 후 npm install 로 node_modules 정리 권장.
//
// _disabled.tsx 라는 underscore prefix 파일명은 Next.js App Router 가 page 로
// 인식하지 않기 때문에 (training)/webxr/page.tsx 와 충돌하지 않는다.
export {};
