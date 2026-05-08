"use client";

// /(training)/select-page/xr/model-viewer/page.tsx
//
// XR VR 투어 뷰어 (R&D Preview).
//
// 컨셉:
//   - 360° equirectangular 파노라마 sphere 가 외곽을 감싸고, 중앙에 bugatti.obj
//     3D 모델이 떠있는 가상 전시 공간.
//   - 마우스 드래그로 카메라를 모델 주위로 회전, 휠로 거리 조절.
//   - 사용자가 public/panoramas/scene.jpg (equirectangular 2:1) 를 넣어두면
//     그 이미지를 배경으로 사용 (예: kyuh 사이버홀 360 파노라마).
//   - 이미지가 없으면 프로시저럴 캔버스 그라데이션 + 별/지평선으로 fallback.
//
// 정책:
//   - three.js + OBJLoader 는 CDN 동적 로드 (npm 의존 없음).
//   - 카메라(getUserMedia) 사용 안 함 — 본 페이지는 가상 투어이므로 패스스루 불필요.

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Cuboid,
  Plus,
  Minus,
  Image as ImageIcon,
  Move,
} from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";

// 전역에 노출되는 THREE 를 위한 타입 stub (CDN 로드 후 window.THREE 에 들어감).
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    THREE?: any;
  }
}

type ModelState =
  | { status: "loading-libs" }
  | { status: "loading-model" }
  | { status: "ready" }
  | { status: "error"; reason: string };

type PanoramaSource = "loading" | "image" | "procedural";

const THREE_VERSION = "0.128.0";
const THREE_CDN = `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`;
const OBJLOADER_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/js/loaders/OBJLoader.js`;
const OBJ_PATH = "/models/bugatti.obj";
const PANORAMA_PATH = "/panoramas/scene.jpg";

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("document undefined"));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-xr-cdn="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.xrCdn = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () =>
      reject(new Error(`Failed to load ${src}`)),
    );
    document.head.appendChild(script);
  });
}

// 프로시저럴 360° 파노라마 — equirectangular 2:1 캔버스에 그라데이션 + 별 + 지평선.
// 사용자가 public/panoramas/scene.jpg 를 넣지 않은 경우 fallback 으로 사용.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createProceduralPanorama(THREE: any) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 수직 그라디언트 — 천장→지평선→바닥.
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, "#0e1230");
  grad.addColorStop(0.4, "#1d2356");
  grad.addColorStop(0.5, "#3d4080");
  grad.addColorStop(0.55, "#1a1f4a");
  grad.addColorStop(1, "#06091c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 1024);

  // 별
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 480;
    const r = Math.random() * 1.6 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 경도 라인 (방향감)
  ctx.strokeStyle = "rgba(167, 139, 250, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 24) * 2048, 0);
    ctx.lineTo((i / 24) * 2048, 1024);
    ctx.stroke();
  }

  // 지평선 강조 라인
  ctx.strokeStyle = "rgba(96, 165, 250, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(2048, 512);
  ctx.stroke();

  // 빛나는 글로우 (천장 한 점)
  const glow = ctx.createRadialGradient(1024, 200, 0, 1024, 200, 360);
  glow.addColorStop(0, "rgba(167, 139, 250, 0.55)");
  glow.addColorStop(1, "rgba(167, 139, 250, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 2048, 1024);

  return new THREE.CanvasTexture(canvas);
}

export default function XrModelViewerPage() {
  const router = useRouter();
  const { patient, isLoading } = useTrainingSession();

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<ModelState>({ status: "loading-libs" });
  const [panoramaSrc, setPanoramaSrc] = useState<PanoramaSource>("loading");
  const [autoRotate, setAutoRotate] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5 ~ 2.5

  // animate() 안에서 항상 최신값 읽도록 ref mirror.
  const autoRotateRef = useRef(autoRotate);
  const zoomRef = useRef(zoomLevel);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);
  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    if (!isLoading && !patient) router.replace("/");
  }, [isLoading, patient, router]);

  // ─────────────────────────────────────────────
  // three.js 초기화 + 파노라마 + OBJ + 마우스 드래그 컨트롤
  // ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any = null;
    let cleanupListeners: (() => void) | null = null;

    const init = async () => {
      try {
        setModel({ status: "loading-libs" });
        await loadScriptOnce(THREE_CDN);
        await loadScriptOnce(OBJLOADER_CDN);
        if (cancelled) return;

        const THREE = window.THREE;
        if (!THREE) throw new Error("THREE 글로벌 초기화 실패");
        if (!THREE.OBJLoader) throw new Error("OBJLoader 초기화 실패");

        const container = canvasContainerRef.current;
        if (!container) throw new Error("렌더 컨테이너 마운트 실패");
        const w = container.clientWidth;
        const h = container.clientHeight;

        const scene = new THREE.Scene();

        // 카메라 — orbit 방식: 원점(=bugatti) 주변을 마우스 드래그로 회전.
        const camera3d = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // ─────────────────────────────────────
        // 360° 파노라마 sphere (skybox)
        // ─────────────────────────────────────
        const panoGeo = new THREE.SphereGeometry(500, 60, 40);
        // 내부에서 보이도록 normals 뒤집기.
        panoGeo.scale(-1, 1, 1);
        const panoMat = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
        const panoMesh = new THREE.Mesh(panoGeo, panoMat);
        scene.add(panoMesh);

        const applyPanoramaTexture = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tex: any,
          source: PanoramaSource,
        ) => {
          if (!tex) return;
          // equirectangular: ColorSpace 보정 (three r128 은 sRGBEncoding).
          tex.encoding = THREE.sRGBEncoding ?? tex.encoding;
          panoMat.map = tex;
          panoMat.needsUpdate = true;
          setPanoramaSrc(source);
        };

        const texLoader = new THREE.TextureLoader();
        texLoader.load(
          PANORAMA_PATH,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tex: any) => {
            if (cancelled) return;
            applyPanoramaTexture(tex, "image");
          },
          undefined,
          () => {
            if (cancelled) return;
            // Fallback — 프로시저럴
            const procedural = createProceduralPanorama(THREE);
            applyPanoramaTexture(procedural, "procedural");
          },
        );

        // ─────────────────────────────────────
        // 조명
        // ─────────────────────────────────────
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1.0);
        key.position.set(5, 8, 5);
        scene.add(key);
        const rimViolet = new THREE.DirectionalLight(0xa78bfa, 0.6);
        rimViolet.position.set(-6, 3, -4);
        scene.add(rimViolet);
        const rimSky = new THREE.DirectionalLight(0x60a5fa, 0.4);
        rimSky.position.set(4, -2, -6);
        scene.add(rimSky);

        // ─────────────────────────────────────
        // OBJ 모델 (bugatti)
        // ─────────────────────────────────────
        setModel({ status: "loading-model" });
        const loader = new THREE.OBJLoader();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let modelGroup: any = null;
        loader.load(
          OBJ_PATH,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (obj: any) => {
            if (cancelled) return;
            const box = new THREE.Box3().setFromObject(obj);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const targetSize = 4;
            const s = targetSize / maxDim;
            obj.scale.setScalar(s);
            obj.position.set(-center.x * s, -center.y * s, -center.z * s);

            // 머티리얼 fallback
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            obj.traverse((child: any) => {
              if (child.isMesh) {
                const hasMat =
                  child.material &&
                  !(Array.isArray(child.material) && child.material.length === 0);
                if (!hasMat || child.material?.isMeshBasicMaterial) {
                  child.material = new THREE.MeshStandardMaterial({
                    color: 0x9aa6d6,
                    metalness: 0.65,
                    roughness: 0.32,
                  });
                }
              }
            });

            scene.add(obj);
            modelGroup = obj;
            setModel({ status: "ready" });
          },
          undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: any) => {
            if (cancelled) return;
            setModel({
              status: "error",
              reason: `OBJ 로드 실패: ${(err as Error)?.message ?? "네트워크/경로 확인"}`,
            });
          },
        );

        // ─────────────────────────────────────
        // 카메라 orbit 컨트롤 (마우스/터치 드래그 + 휠 줌)
        // ─────────────────────────────────────
        let cameraTheta = Math.PI / 4; // 시야 방향 yaw (radians)
        let cameraPhi = Math.PI / 2 - 0.15; // polar (위에서 내려다보기 살짝)
        // cameraR 은 zoomLevel 에 의해 제어 — animate() 안에서 매번 갱신.

        const updateCameraPos = () => {
          const r = 6 / Math.max(0.5, zoomRef.current);
          camera3d.position.x = r * Math.sin(cameraPhi) * Math.cos(cameraTheta);
          camera3d.position.y = r * Math.cos(cameraPhi);
          camera3d.position.z = r * Math.sin(cameraPhi) * Math.sin(cameraTheta);
          camera3d.lookAt(0, 0, 0);
        };
        updateCameraPos();

        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        const onPointerDown = (e: PointerEvent) => {
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
        };
        const onPointerMove = (e: PointerEvent) => {
          if (!dragging) return;
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
          // 자동 회전 중이면 사용자가 드래그 시 일시 중단.
          if (autoRotateRef.current) {
            autoRotateRef.current = false;
            setAutoRotate(false);
          }
          cameraTheta -= dx * 0.005;
          cameraPhi = Math.max(0.15, Math.min(Math.PI - 0.15, cameraPhi - dy * 0.005));
          updateCameraPos();
        };
        const onPointerUp = (e: PointerEvent) => {
          dragging = false;
          (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const delta = e.deltaY * 0.0015;
          const next = Math.max(0.5, Math.min(2.5, zoomRef.current - delta));
          zoomRef.current = next;
          setZoomLevel(Number(next.toFixed(2)));
          updateCameraPos();
        };

        const dom = renderer.domElement as HTMLCanvasElement;
        dom.style.cursor = "grab";
        dom.addEventListener("pointerdown", onPointerDown);
        dom.addEventListener("pointermove", onPointerMove);
        dom.addEventListener("pointerup", onPointerUp);
        dom.addEventListener("pointercancel", onPointerUp);
        dom.addEventListener("pointerleave", onPointerUp);
        dom.addEventListener("wheel", onWheel, { passive: false });

        // ─────────────────────────────────────
        // 애니메이션 루프
        // ─────────────────────────────────────
        const animate = () => {
          if (cancelled) return;
          // 자동 회전 — yaw 슬로우
          if (autoRotateRef.current) {
            cameraTheta += 0.0025;
            updateCameraPos();
          }
          // 모델 자체도 살짝 떠있는 느낌
          if (modelGroup) {
            modelGroup.position.y = Math.sin(performance.now() * 0.001) * 0.08;
            modelGroup.rotation.y += 0.002;
          }
          renderer.render(scene, camera3d);
          raf = requestAnimationFrame(animate);
        };
        animate();

        // ─────────────────────────────────────
        // 리사이즈
        // ─────────────────────────────────────
        const onResize = () => {
          const newW = container.clientWidth;
          const newH = container.clientHeight;
          if (newW <= 0 || newH <= 0) return;
          camera3d.aspect = newW / newH;
          camera3d.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        };
        window.addEventListener("resize", onResize);

        cleanupListeners = () => {
          window.removeEventListener("resize", onResize);
          dom.removeEventListener("pointerdown", onPointerDown);
          dom.removeEventListener("pointermove", onPointerMove);
          dom.removeEventListener("pointerup", onPointerUp);
          dom.removeEventListener("pointercancel", onPointerUp);
          dom.removeEventListener("pointerleave", onPointerUp);
          dom.removeEventListener("wheel", onWheel);
        };
      } catch (err) {
        if (cancelled) return;
        setModel({
          status: "error",
          reason: (err as Error).message ?? "초기화 실패",
        });
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      cleanupListeners?.();
      if (renderer) {
        try {
          renderer.dispose();
        } catch {
          /* noop */
        }
        if (renderer.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_30%_-10%,#7c3aed30,transparent_55%),linear-gradient(180deg,#06091c_0%,#0c1130_55%,#06091c_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#06091c]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.push("/select-page/xr")}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/5 transition hover:bg-white/10"
              aria-label="XR 컨셉으로 돌아가기"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">
                XR VR Tour
              </p>
              <h1 className="mt-1 truncate text-lg font-black tracking-tight sm:text-xl">
                360° 가상 전시 공간
              </h1>
              <p className="text-xs font-medium text-violet-200/75">
                {patient?.name ?? "사용자"}님 · 마우스 드래그로 둘러보기
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRotate((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${
                autoRotate
                  ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {autoRotate ? "자동 회전 ON" : "자동 회전 OFF"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        {/* 상태 표시 */}
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-violet-100/90">
          <PanoramaStatusBadge state={panoramaSrc} />
          <ModelStatusBadge state={model} />
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200">
            <Cuboid className="h-3.5 w-3.5" /> ZOOM {zoomLevel.toFixed(2)}x
          </span>
          <button
            onClick={() => setZoomLevel((v) => Math.max(0.5, +(v - 0.1).toFixed(2)))}
            className="rounded-full border border-white/15 bg-white/5 p-1.5 text-white hover:bg-white/10"
            aria-label="줌 아웃"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((v) => Math.min(2.5, +(v + 0.1).toFixed(2)))}
            className="rounded-full border border-white/15 bg-white/5 p-1.5 text-white hover:bg-white/10"
            aria-label="줌 인"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black text-white hover:bg-white/10"
          >
            리셋
          </button>
        </section>

        {/* 3D 스테이지 */}
        <section
          className="relative overflow-hidden rounded-[36px] border border-white/10 shadow-[0_30px_80px_-30px_rgba(124,58,237,0.55)]"
          style={{ height: "min(70vh, 720px)", minHeight: "560px" }}
        >
          <div
            ref={canvasContainerRef}
            className="absolute inset-0"
            style={{ touchAction: "none" }}
          />

          {/* 모델 로딩/에러 오버레이 */}
          {model.status !== "ready" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="rounded-3xl border border-white/15 bg-black/55 px-6 py-5 text-center backdrop-blur">
                {model.status === "loading-libs" ? (
                  <>
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-300" />
                    <p className="mt-3 text-sm font-black text-violet-100">
                      three.js 라이브러리 로드 중...
                    </p>
                  </>
                ) : model.status === "loading-model" ? (
                  <>
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-300" />
                    <p className="mt-3 text-sm font-black text-violet-100">
                      bugatti.obj 모델 로드 중...
                    </p>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="mx-auto h-6 w-6 text-rose-300" />
                    <p className="mt-3 text-sm font-black text-rose-200">
                      모델 로드 실패
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-rose-100/85">
                      {model.reason}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* 조작 안내 */}
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/45 px-4 py-3 text-xs font-medium text-violet-100/90 backdrop-blur">
            <span className="inline-flex items-center gap-2">
              <Move className="h-3.5 w-3.5" />
              드래그로 둘러보기 · 휠로 줌 · 자동 회전은 헤더에서 토글
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-violet-300">
              VR TOUR + 3D MODEL
            </span>
          </div>
        </section>

        {/* 정보 카드 */}
        <section className="grid gap-4 sm:grid-cols-2">
          <SpecCard label="배경 (파노라마)">
            {panoramaSrc === "image" ? (
              <>
                <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
                  public/panoramas/scene.jpg
                </code>{" "}
                — equirectangular 360° 이미지 사용 중
              </>
            ) : panoramaSrc === "procedural" ? (
              <>
                프로시저럴 그라데이션 fallback 사용 중. 실제 공간 파노라마를 사용하려면{" "}
                <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
                  public/panoramas/scene.jpg
                </code>{" "}
                에 equirectangular 2:1 이미지 (예: 4096×2048) 를 저장하세요.
              </>
            ) : (
              "파노라마 로드 중..."
            )}
          </SpecCard>
          <SpecCard label="3D 모델">
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              public/models/bugatti.obj
            </code>{" "}
            — Wavefront OBJ, three.js OBJLoader 로 렌더
          </SpecCard>
          <SpecCard label="조작">
            마우스 드래그 = 카메라 회전 (yaw/pitch) · 마우스 휠 = 줌 ·{" "}
            <kbd className="rounded bg-black/30 px-1 py-0.5 text-[10px]">자동 회전</kbd>{" "}
            토글로 슬로우 회전 ON/OFF
          </SpecCard>
          <SpecCard label="다음 스텝">
            kyuh 사이버홀 같은 실제 공간 파노라마는 운영자에게 equirectangular
            JPG 받아 저장하면 그대로 사용 가능. 다중 씬은 추후 scene picker 추가.
          </SpecCard>
        </section>

        {/* 면책 */}
        <section className="rounded-3xl border border-amber-300/30 bg-amber-400/5 p-5 text-amber-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
            <div className="text-sm leading-6">
              <p className="font-black text-amber-200">XR Preview 안내</p>
              <p className="mt-1">
                360° VR 투어 + 3D 모델 결합 데모. 정식 SaMD 품목 범위 외 R&amp;D
                프리뷰이며, 임상 데이터 채널과 분리되어 있어 환자 기록에 반영되지
                않습니다.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PanoramaStatusBadge({ state }: { state: PanoramaSource }) {
  if (state === "image") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
        <ImageIcon className="h-3.5 w-3.5" /> 파노라마 IMAGE
      </span>
    );
  }
  if (state === "procedural") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
        <ImageIcon className="h-3.5 w-3.5" /> 파노라마 PROCEDURAL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> 파노라마 로드 중
    </span>
  );
}

function ModelStatusBadge({ state }: { state: ModelState }) {
  if (state.status === "ready") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
        <Cuboid className="h-3.5 w-3.5" /> 모델 LOADED
      </span>
    );
  }
  if (state.status === "loading-libs") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> three.js 로드 중
      </span>
    );
  }
  if (state.status === "loading-model") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> OBJ 로드 중
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-200">
      <ShieldAlert className="h-3.5 w-3.5" /> 모델 오류
    </span>
  );
}

function SpecCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-300">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-violet-100/85">
        {children}
      </p>
    </div>
  );
}
