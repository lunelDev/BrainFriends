// src/types/webxr.d.ts
//
// 최소 WebXR 타입 선언.
// XR 프리뷰 페이지(/select-page/xr/*)에서 feature-detect 와 immersive 진입 시도
// 정도만 사용하므로, 전체 WebXR Device API 사양 대신 필요한 부분만 declare 한다.
// @types/webxr 풀 패키지를 도입하기 전 R&D 단계의 임시 stub.

interface XRSession extends EventTarget {
  end(): Promise<void>;
}

type XRSessionMode = "immersive-vr" | "immersive-ar" | "inline";

interface XRSystem {
  isSessionSupported(mode: XRSessionMode): Promise<boolean>;
  requestSession(mode: XRSessionMode, init?: unknown): Promise<XRSession>;
}

interface Navigator {
  xr?: XRSystem;
}
