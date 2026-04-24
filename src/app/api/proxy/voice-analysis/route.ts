// src/app/api/proxy/voice-analysis/route.ts
//
// Parselmouth (FastAPI) 음향 분석 프록시.
// REQ-ACOUSTIC-001~004, 010~012, 020/021 (현재) 산출.
// 자세한 역할 분리: docs/remediation/00-summary/whisper-vs-parselmouth-boundary.md
// 산출 지표 정의:    docs/remediation/01-sw-vnv/parselmouth-requirements.md

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

type AcousticEngineSnapshot = {
  parselmouth: string;
  praat_version_date: string;
  python: string;
  numpy: string;
};

type AcousticResult = {
  duration_sec: number | null;
  f0: {
    mean_hz: number | null;
    std_hz: number | null;
    min_hz: number | null;
    max_hz: number | null;
  };
  intensity: {
    mean_db: number | null;
    max_db: number | null;
  };
  voicing_ratio: number | null;
  // REQ-ACOUSTIC-010 / 011 / 012. Praat 기본 파라미터 기준.
  // jitter/shimmer 는 % 단위 (fraction × 100), hnr 은 dB.
  jitter_local_pct: number | null;
  shimmer_local_pct: number | null;
  hnr_mean_db: number | null;
  // REQ-ACOUSTIC-020 / 021. Formant F1/F2 (Hz) + 모음 mid-frame 시각(초).
  // Praat Burg 방식, 성인 기본 파라미터 (max formant = 5500 Hz),
  // voiced run 중 F1 분산 최소 구간의 mid-frame 에서 샘플링.
  formants: {
    f1_hz: number | null;
    f2_hz: number | null;
    mid_frame_time: number | null;
  };
  measurement_quality: "measured" | "degraded" | "failed";
};

type AcousticResponse = {
  ok: boolean;
  result: AcousticResult;
  version_snapshot: AcousticEngineSnapshot | null;
  fallback?: true;
  reason?: string;
};

const NULL_RESULT: AcousticResult = {
  duration_sec: null,
  f0: { mean_hz: null, std_hz: null, min_hz: null, max_hz: null },
  intensity: { mean_db: null, max_db: null },
  voicing_ratio: null,
  jitter_local_pct: null,
  shimmer_local_pct: null,
  hnr_mean_db: null,
  formants: { f1_hz: null, f2_hz: null, mid_frame_time: null },
  measurement_quality: "failed",
};

const makeFallback = (reason: string): AcousticResponse => ({
  ok: false,
  result: NULL_RESULT,
  version_snapshot: null,
  fallback: true,
  reason,
});

// 개발 모드용: 결정론적 더미 응답. 비용/네트워크 0.
const DEV_RESPONSE: AcousticResponse = {
  ok: true,
  result: {
    duration_sec: 1.0,
    f0: {
      mean_hz: 220.0,
      std_hz: 0.5,
      min_hz: 219.5,
      max_hz: 220.5,
    },
    intensity: { mean_db: 70.0, max_db: 72.0 },
    voicing_ratio: 0.95,
    // DEV 더미: 건강한 성인 음성 참고치 기준 대충 잡음.
    jitter_local_pct: 0.35,
    shimmer_local_pct: 2.8,
    hnr_mean_db: 22.0,
    // 성인 남성 "아" 발음 참고치 (REQ-ACOUSTIC-020 / 021).
    formants: { f1_hz: 700, f2_hz: 1200, mid_frame_time: 0.5 },
    measurement_quality: "measured",
  },
  version_snapshot: {
    parselmouth: "dev-mode",
    praat_version_date: "dev-mode",
    python: "dev-mode",
    numpy: "dev-mode",
  },
};

export async function POST(req: Request) {
  try {
    const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

    if (isDevMode) {
      return NextResponse.json(DEV_RESPONSE);
    }

    const baseUrl = (
      process.env.VOICE_ANALYSIS_URL || "http://127.0.0.1:8001"
    ).replace(/\/+$/, "");

    const incoming = await req.formData();
    const file = incoming.get("audio") ?? incoming.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(makeFallback("missing_audio_file"), {
        status: 400,
      });
    }

    const outgoing = new FormData();
    outgoing.append("audio", file, file.name || "recording.webm");

    const upstream = await fetch(`${baseUrl}/analyze`, {
      method: "POST",
      body: outgoing,
    });

    const raw = await upstream.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!upstream.ok || !data?.ok) {
      const reason =
        (typeof data?.error === "string" && data.error) ||
        `upstream_${upstream.status}`;
      console.error("[VoiceAnalysis Proxy] upstream error", {
        status: upstream.status,
        body: data,
      });
      return NextResponse.json(makeFallback(reason), { status: 502 });
    }

    const response: AcousticResponse = {
      ok: true,
      result: data.result as AcousticResult,
      version_snapshot:
        (data.version_snapshot as AcousticEngineSnapshot) ?? null,
    };
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[VoiceAnalysis Proxy] unexpected error", error);
    return NextResponse.json(makeFallback("internal_error"), { status: 500 });
  }
}
