"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Box,
  Camera,
  CheckCircle2,
  Mic,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { useRouter } from "next/navigation";

type XrSupport = "checking" | "supported" | "unsupported";

type MinimalXrSession = EventTarget & {
  end: () => Promise<void>;
};

type MinimalXrSessionInit = {
  optionalFeatures?: string[];
};

type WebXrNavigator = Navigator & {
  xr?: {
    isSessionSupported?: (mode: "immersive-vr" | "immersive-ar") => Promise<boolean>;
    requestSession?: (
      mode: "immersive-vr" | "immersive-ar",
      options?: MinimalXrSessionInit,
    ) => Promise<MinimalXrSession>;
  };
};

type SpeechRecognitionResultLike = {
  transcript: string;
};

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};

type SpeechRecognitionLike = EventTarget & {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "카메라 권한이 차단되었습니다. 주소창 권한에서 카메라를 허용해 주세요.";
    }
    if (error.name === "NotFoundError") {
      return "사용 가능한 카메라를 찾지 못했습니다.";
    }
    if (error.name === "NotReadableError") {
      return "다른 앱이 카메라를 사용 중입니다.";
    }
    if (error.name === "OverconstrainedError") {
      return "요청한 카메라 조건을 만족하지 못해 기본 카메라로 다시 시도합니다.";
    }
    return `카메라 오류: ${error.name}`;
  }
  return "카메라를 시작하지 못했습니다.";
}

const XR_TARGETS = [
  {
    id: "apple",
    label: "사과",
    prompt: "사과",
    visual: "사과",
    colorClass: "from-red-400 to-orange-500",
    aliases: ["사과", "사 과"],
  },
  {
    id: "cup",
    label: "컵",
    prompt: "컵",
    visual: "컵",
    colorClass: "from-sky-400 to-blue-600",
    aliases: ["컵", "커피컵", "잔"],
  },
  {
    id: "book",
    label: "책",
    prompt: "책",
    visual: "책",
    colorClass: "from-emerald-400 to-teal-600",
    aliases: ["책", "도서", "책자"],
  },
  {
    id: "key",
    label: "열쇠",
    prompt: "열쇠",
    visual: "열쇠",
    colorClass: "from-amber-300 to-yellow-600",
    aliases: ["열쇠", "키"],
  },
  {
    id: "clock",
    label: "시계",
    prompt: "시계",
    visual: "시계",
    colorClass: "from-violet-400 to-indigo-600",
    aliases: ["시계"],
  },
] as const;

function normalizeSpeech(text: string) {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^가-힣a-z0-9]/g, "");
}

function isTargetMatched(transcript: string, target: (typeof XR_TARGETS)[number]) {
  const normalizedTranscript = normalizeSpeech(transcript);
  return target.aliases.some((alias) =>
    normalizedTranscript.includes(normalizeSpeech(alias)),
  );
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = createShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec3 aPosition;
      attribute vec3 aColor;
      uniform float uTime;
      uniform vec2 uResolution;
      varying vec3 vColor;
      void main() {
        float c = cos(uTime);
        float s = sin(uTime);
        vec3 p = aPosition;
        float x = p.x * c - p.z * s;
        float z = p.x * s + p.z * c + 4.0;
        float y = p.y + sin(uTime * 1.7 + p.x * 2.0) * 0.08;
        float perspective = 1.8 / z;
        gl_Position = vec4(x * perspective, y * perspective * (uResolution.x / uResolution.y), 0.2, 1.0);
        vColor = aColor;
      }
    `,
  );
  const fragment = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
  );
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function buildSceneVertices() {
  const vertices: number[] = [];
  const addTriangle = (
    p1: number[],
    p2: number[],
    p3: number[],
    color: number[],
  ) => {
    vertices.push(...p1, ...color, ...p2, ...color, ...p3, ...color);
  };
  const colors = {
    blue: [0.18, 0.44, 0.95],
    teal: [0.02, 0.65, 0.72],
    orange: [0.96, 0.45, 0.12],
    slate: [0.18, 0.22, 0.32],
    green: [0.12, 0.66, 0.32],
  };

  addTriangle([-1.1, -0.6, -0.4], [0.4, -0.6, -0.4], [-0.35, 0.55, -0.4], colors.blue);
  addTriangle([0.55, -0.52, 0.1], [1.35, -0.52, 0.1], [0.95, 0.5, 0.1], colors.orange);
  addTriangle([-0.18, -0.1, 0.55], [0.38, -0.1, 0.55], [0.1, 0.64, 0.55], colors.teal);

  for (let i = 0; i < 14; i += 1) {
    const x = -1.5 + i * 0.23;
    const z = -0.7 + (i % 5) * 0.34;
    addTriangle(
      [x, -0.95, z],
      [x + 0.08, -0.95, z],
      [x + 0.04, -0.82 - (i % 3) * 0.03, z],
      i % 2 === 0 ? colors.green : colors.slate,
    );
  }

  return new Float32Array(vertices);
}

export default function WebXrPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const xrSessionRef = useRef<MinimalXrSession | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [xrSupport, setXrSupport] = useState<XrSupport>("checking");
  const [isXrRunning, setIsXrRunning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("카메라를 켜면 실제 공간 위에 물체가 뜹니다.");
  const [cameraResolution, setCameraResolution] = useState("");
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [collectedIds, setCollectedIds] = useState<string[]>([]);
  const [transcript, setTranscript] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("물체 이름을 말하면 획득합니다.");
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const activeTarget = XR_TARGETS[targetIndex % XR_TARGETS.length];

  useEffect(() => {
    let cancelled = false;
    const xr = (navigator as WebXrNavigator).xr;
    if (!xr?.isSessionSupported) {
      setXrSupport("unsupported");
      return;
    }
    xr.isSessionSupported("immersive-ar")
      .then((supported) => {
        if (!cancelled) setXrSupport(supported ? "supported" : "unsupported");
      })
      .catch(() => {
        if (!cancelled) setXrSupport("unsupported");
      });
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    setSpeechAvailable(Boolean(SpeechRecognitionCtor));
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const collectTarget = (spokenText: string) => {
    const matched = isTargetMatched(spokenText, activeTarget);
    setTranscript(spokenText);
    if (!matched) {
      setSpeechStatus(`다시 시도: "${activeTarget.prompt}"`);
      return;
    }
    setCollectedIds((prev) =>
      prev.includes(activeTarget.id) ? prev : [...prev, activeTarget.id],
    );
    setSpeechStatus(`${activeTarget.label} 획득`);
    setTargetIndex((prev) => (prev + 1) % XR_TARGETS.length);
    setTypedAnswer("");
  };

  const startListening = () => {
    const SpeechRecognitionCtor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor || isListening) return;
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsListening(true);
      setSpeechStatus("듣는 중");
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setSpeechStatus("마이크 권한 또는 음성 인식 오류");
    };
    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || "";
      collectTarget(spoken);
    };
    recognition.start();
  };

  const resetSession = () => {
    recognitionRef.current?.abort();
    setTargetIndex(0);
    setCollectedIds([]);
    setTranscript("");
    setTypedAnswer("");
    setIsListening(false);
    setSpeechStatus("물체 이름을 말하면 획득합니다.");
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) return;
    const program = createProgram(gl);
    if (!program) return;
    const buffer = gl.createBuffer();
    const vertices = buildSceneVertices();
    const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const colorLocation = gl.getAttribLocation(program, "aColor");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const resolutionLocation = gl.getUniformLocation(program, "uResolution");

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(
      colorLocation,
      3,
      gl.FLOAT,
      false,
      stride,
      3 * Float32Array.BYTES_PER_ELEMENT,
    );

    const render = (timeMs: number) => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      const height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(timeLocation, timeMs * 0.001);
      gl.uniform2f(resolutionLocation, width, height);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
      animationRef.current = window.requestAnimationFrame(render);
    };
    animationRef.current = window.requestAnimationFrame(render);
    return () => {
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  const startXr = async () => {
    const xr = (navigator as WebXrNavigator).xr;
    if (!xr?.requestSession || xrSupport !== "supported") return;
    const session = await xr.requestSession("immersive-ar", {
      optionalFeatures: ["local-floor", "bounded-floor", "dom-overlay"],
    });
    xrSessionRef.current = session;
    setIsXrRunning(true);
    session.addEventListener("end", () => {
      xrSessionRef.current = null;
      setIsXrRunning(false);
    });
  };

  const stopXr = async () => {
    await xrSessionRef.current?.end();
  };

  const startCamera = async () => {
    if (cameraStarting || cameraActive) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("이 브라우저에서는 카메라를 사용할 수 없습니다.");
      return;
    }
    setCameraStarting(true);
    setCameraBlocked(false);
    setCameraStatus("카메라를 여는 중입니다.");
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (primaryError) {
        setCameraStatus(getCameraErrorMessage(primaryError));
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
        const { videoWidth, videoHeight } = videoRef.current;
        setCameraResolution(
          videoWidth && videoHeight ? `${videoWidth}×${videoHeight}` : "stream active",
        );
      }
      setCameraActive(true);
      setCameraBlocked(false);
      setCameraStatus("카메라 공간 위에 물체를 배치했습니다.");
    } catch (error) {
      setCameraActive(false);
      setCameraBlocked(error instanceof DOMException && error.name === "NotAllowedError");
      setCameraStatus(getCameraErrorMessage(error));
    } finally {
      setCameraStarting(false);
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraBlocked(false);
    setCameraStarting(false);
    setCameraResolution("");
    setCameraStatus("카메라를 켜면 실제 공간 위에 물체가 뜹니다.");
  };

  return (
    <main className="min-h-full overflow-hidden bg-[#f5f8fc] text-slate-950">
      <header className="relative z-10 border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/select-page/mode")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="사용자 홈으로 이동"
            title="뒤로"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-500">
              WebXR Lab
            </p>
            <h1 className="mt-1 truncate text-xl font-black tracking-tight sm:text-2xl">
              XR 훈련 공간
            </h1>
          </div>
          <button
            type="button"
            onClick={isXrRunning ? stopXr : startXr}
            disabled={xrSupport !== "supported"}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
              xrSupport === "supported"
                ? "bg-slate-900 text-white hover:bg-indigo-600"
                : "border border-slate-200 bg-slate-100 text-slate-400"
            }`}
          >
            {isXrRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isXrRunning ? "AR 종료" : "AR 시작"}
          </button>
        </div>
      </header>

      <section
        className="relative isolate overflow-hidden bg-slate-950"
        style={{ height: "calc(100vh - 73px)", minHeight: 560 }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setCameraResolution(
              video.videoWidth && video.videoHeight
                ? `${video.videoWidth}×${video.videoHeight}`
                : "stream active",
            );
          }}
          onPlaying={(event) => {
            const video = event.currentTarget;
            setCameraActive(true);
            setCameraResolution(
              video.videoWidth && video.videoHeight
                ? `${video.videoWidth}×${video.videoHeight}`
                : "stream active",
            );
          }}
          className={`absolute left-1/2 top-1/2 z-10 aspect-video w-[min(1180px,calc(100vw-320px))] min-w-[640px] -translate-x-1/2 -translate-y-1/2 scale-x-[-1] rounded-[28px] border border-white/25 bg-black object-cover shadow-2xl transition-opacity ${
            cameraActive ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-0 z-0 transition-opacity ${
            cameraActive ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,#dbeafe_0%,#eff6ff_34%,#e2e8f0_100%)]" />
          <div className="absolute left-1/2 top-[17%] h-28 w-[min(620px,80vw)] -translate-x-1/2 rounded-full bg-white/70 blur-2xl" />
          <div className="absolute bottom-0 left-1/2 h-[48%] w-[150%] -translate-x-1/2 origin-bottom rotate-x-[64deg] bg-[linear-gradient(rgba(99,102,241,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.2)_1px,transparent_1px)] bg-[size:44px_44px]" />
          <div className="absolute bottom-[28%] left-1/2 h-px w-[80%] -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-300 to-transparent" />
        </div>
        {cameraActive ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 aspect-video w-[min(1180px,calc(100vw-320px))] min-w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]" />
        ) : null}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 z-20 h-full w-full transition-opacity ${
            cameraBlocked ? "opacity-15" : "opacity-100"
          }`}
        />
        {cameraBlocked ? (
          <div className="absolute inset-0 z-[45] flex items-center justify-center px-4">
            <div className="max-w-lg rounded-[24px] border border-amber-200 bg-white/94 p-6 text-center shadow-2xl backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">
                Camera Permission
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                카메라 권한이 차단되어 있습니다.
              </h2>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                주소창 왼쪽의 사이트 정보 또는 카메라 아이콘을 눌러
                localhost:3000의 카메라 권한을 허용한 뒤 새로고침해 주세요.
              </p>
            </div>
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,transparent_42%,rgba(15,23,42,0.16)_100%)]" />
        <div className="absolute inset-0 z-40 flex items-center justify-center px-4 pb-20 pt-24">
          <div className="relative flex h-[min(30vw,260px)] w-[min(30vw,260px)] min-w-[170px] min-h-[170px] translate-y-8 items-center justify-center">
            <div className="absolute -bottom-10 left-1/2 h-10 w-56 -translate-x-1/2 rounded-full bg-slate-900/20 blur-xl" />
            <div className="absolute inset-[-22px] rounded-full border border-white/80" />
            <div className="absolute inset-[-44px] rounded-full border border-indigo-200/70" />
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-br ${activeTarget.colorClass} opacity-25 blur-2xl`}
            />
            <div
              className={`relative flex h-full w-full flex-col items-center justify-center rounded-full border border-white/70 bg-gradient-to-br ${activeTarget.colorClass} text-white shadow-2xl`}
            >
              <div className="text-[clamp(42px,8vw,88px)] font-black drop-shadow-sm">
                {activeTarget.visual}
              </div>
              <div className="mt-3 rounded-full bg-white/20 px-5 py-2 text-xl font-black backdrop-blur">
                {activeTarget.label}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute left-3 top-4 z-50 w-[min(250px,calc(100%-24px))] rounded-[18px] border border-white/70 bg-white/88 p-3 shadow-sm backdrop-blur sm:left-5 sm:top-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Box className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                상태
              </p>
              <p className="text-sm font-black text-slate-900">
                {cameraBlocked
                  ? "카메라 권한 차단"
                  : xrSupport === "checking"
                  ? "확인 중"
                  : xrSupport === "supported"
                    ? "WebXR AR 가능"
                    : cameraActive
                      ? "카메라 AR 보기"
                      : "가상 공간 보기"}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] font-bold leading-5 text-slate-600">
            {cameraStatus}
            {cameraResolution ? ` (${cameraResolution})` : ""}
          </p>
          <button
            type="button"
            onPointerDown={() => {
              if (!cameraActive) void startCamera();
            }}
            onClick={() => {
              if (cameraActive) {
                stopCamera();
                return;
              }
              void startCamera();
            }}
            disabled={cameraStarting}
            className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
              cameraActive
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : cameraStarting
                  ? "bg-slate-200 text-slate-500"
                : "bg-slate-900 text-white hover:bg-indigo-600"
            }`}
          >
            <Camera className="h-4 w-4" />
            {cameraActive ? "카메라 끄기" : cameraStarting ? "카메라 여는 중" : "AR 카메라 켜기"}
          </button>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white px-2 py-2">
              <p className="text-[10px] font-black text-slate-500">GET</p>
              <p className="text-lg font-black text-indigo-600">
                {collectedIds.length}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-2 py-2">
              <p className="text-[10px] font-black text-slate-500">TARGET</p>
              <p className="text-lg font-black text-emerald-600">
                {targetIndex + 1}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-2 py-2">
              <p className="text-[10px] font-black text-slate-500">TOTAL</p>
              <p className="text-lg font-black text-orange-600">
                {XR_TARGETS.length}
              </p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-5 right-5 z-50 w-[min(430px,calc(100%-32px))] rounded-[22px] border border-white/80 bg-white/94 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">
                따라 말하기
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                {activeTarget.prompt}
              </h2>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-600">
                {speechStatus}
                {transcript ? ` · 인식: ${transcript}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={startListening}
                disabled={!speechAvailable || isListening}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black transition ${
                  speechAvailable && !isListening
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <Mic className="h-4 w-4" />
                {isListening ? "듣는 중" : "말하기"}
              </button>
              <button
                type="button"
                onClick={resetSession}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                초기화
              </button>
            </div>
          </div>
          {!speechAvailable ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={typedAnswer}
                onChange={(event) => setTypedAnswer(event.target.value)}
                className="min-h-11 flex-1 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-indigo-300"
                placeholder={`${activeTarget.prompt} 입력`}
              />
              <button
                type="button"
                onClick={() => collectTarget(typedAnswer)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                <CheckCircle2 className="h-4 w-4" />
                확인
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
