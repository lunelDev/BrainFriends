// 이 파일은 삭제 예정입니다.
//
// 2026-04-30 PM 결정: app/webxr/_disabled.tsx (구 PoC) 와 함께 정리.
// 사용자 (training)/webxr/page.tsx 는 vanilla WebXR API 만 사용하며 본 컴포넌트를 import 하지 않는다.
//
// 정식 삭제 단계 (사용자 로컬에서 수행):
//   - Windows 탐색기 또는 IDE 에서 src/components/aac/XrAacCanvas.tsx 우클릭 → 삭제
//
// 본 stub 은 의존성 (@react-three/*, three) 이 package.json 에서 제거된 후에도
// 남은 import 가 컴파일 에러를 일으키지 않도록 빈 export 만 둔다.
export {};
