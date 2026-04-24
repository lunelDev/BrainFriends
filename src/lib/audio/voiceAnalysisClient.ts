// src/lib/audio/voiceAnalysisClient.ts
//
// /api/proxy/voice-analysis 클라이언트 헬퍼.
// step-2 / step-4 / step-5 / sing-training 공통 사용.
// 산출 정의: docs/remediation/01-sw-vnv/parselmouth-requirements.md
// (REQ-ACOUSTIC-001~004)
//
// 목적:
// - 모든 호출 경로에서 응답을 동일한 AcousticSnapshot shape 으로 정규화한다.
// - 네트워크/프록시 실패 시에도 measurement_quality 가 채워진 fallback 을
//   반환해 클라이언트 흐름이 멈추지 않도록 한다.
// - 응답 필드를 typeof === "number" 로 좁혀 타입 안전성을 확보한다.

import type { AcousticSnapshot } from "@/lib/kwab/SessionManager";

// MediaRecorder/Blob.type 매핑. 알 수 없는 mime 은 webm 으로 fallback.
const VOICE_ANALYSIS_MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

function buildFallback(reason: string): AcousticSnapshot {
  return {
    duration_sec: null,
    f0: { mean_hz: null, std_hz: null, min_hz: null, max_hz: null },
    intensity: { mean_db: null, max_db: null },
    voicing_ratio: null,
    jitter_local_pct: null,
    shimmer_local_pct: null,
    hnr_mean_db: null,
    formants: { f1_hz: null, f2_hz: null, mid_frame_time: null },
    measurement_quality: "failed",
    version_snapshot: null,
    fallback: true,
    reason,
  };
}

export async function callVoiceAnalysis(
  audioBlob: Blob,
): Promise<AcousticSnapshot> {
  try {
    const ext = VOICE_ANALYSIS_MIME_EXT[audioBlob.type] || "webm";
    const form = new FormData();
    form.append("audio", audioBlob, `recording.${ext}`);

    const response = await fetch("/api/proxy/voice-analysis", {
      method: "POST",
      body: form,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      return {
        ...buildFallback(
          (data && typeof data.reason === "string" && data.reason) ||
            `http_${response.status}`,
        ),
      };
    }

    if (data.fallback || data.ok === false) {
      return {
        ...buildFallback(
          typeof data.reason === "string" ? data.reason : "upstream_fallback",
        ),
        ...(data.result || {}),
        version_snapshot: data.version_snapshot ?? null,
        fallback: true,
      };
    }

    const result = data.result || {};
    return {
      duration_sec:
        typeof result.duration_sec === "number" ? result.duration_sec : null,
      f0: {
        mean_hz:
          typeof result?.f0?.mean_hz === "number" ? result.f0.mean_hz : null,
        std_hz:
          typeof result?.f0?.std_hz === "number" ? result.f0.std_hz : null,
        min_hz:
          typeof result?.f0?.min_hz === "number" ? result.f0.min_hz : null,
        max_hz:
          typeof result?.f0?.max_hz === "number" ? result.f0.max_hz : null,
      },
      intensity: {
        mean_db:
          typeof result?.intensity?.mean_db === "number"
            ? result.intensity.mean_db
            : null,
        max_db:
          typeof result?.intensity?.max_db === "number"
            ? result.intensity.max_db
            : null,
      },
      voicing_ratio:
        typeof result.voicing_ratio === "number" ? result.voicing_ratio : null,
      jitter_local_pct:
        typeof result.jitter_local_pct === "number"
          ? result.jitter_local_pct
          : null,
      shimmer_local_pct:
        typeof result.shimmer_local_pct === "number"
          ? result.shimmer_local_pct
          : null,
      hnr_mean_db:
        typeof result.hnr_mean_db === "number" ? result.hnr_mean_db : null,
      formants: {
        f1_hz:
          typeof result?.formants?.f1_hz === "number"
            ? result.formants.f1_hz
            : null,
        f2_hz:
          typeof result?.formants?.f2_hz === "number"
            ? result.formants.f2_hz
            : null,
        mid_frame_time:
          typeof result?.formants?.mid_frame_time === "number"
            ? result.formants.mid_frame_time
            : null,
      },
      measurement_quality:
        result.measurement_quality === "measured" ||
        result.measurement_quality === "degraded" ||
        result.measurement_quality === "failed"
          ? result.measurement_quality
          : "failed",
      version_snapshot: data.version_snapshot ?? null,
    };
  } catch (error) {
    return buildFallback(
      error instanceof Error ? `client_${error.message}` : "client_exception",
    );
  }
}
