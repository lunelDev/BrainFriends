"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Database,
  Mic,
  Music,
  Printer,
  Sparkles,
  Timer,
} from "lucide-react";
import type { PatientProfile } from "@/lib/patientStorage";
import type { VersionSnapshot } from "@/lib/analysis/versioning";
import { fetchMyHistoryEntries } from "@/lib/client/historyApi";
import { dataUrlToBlob, uploadClinicalMedia } from "@/lib/client/clinicalMediaUpload";
import type { ExportFile } from "@/features/result/types";
import { createZipBlob } from "@/features/result/utils/zipExport";
import {
  appendDossierFiles,
  RESULT_REVIEW_BOUNDARY,
} from "@/features/result/utils/dossierExport";
import {
  SING_TRAINING_ANALYSIS_VERSION,
  SING_TRAINING_CATALOG_VERSION,
  SONGS,
} from "@/features/sing-training/data/songs";
import type { SongKey } from "@/features/sing-training/types";
import { useTrainingSession } from "@/hooks/useTrainingSession";

type SingKeyFrame = {
  dataUrl: string;
  capturedAt: string;
  label: string;
  mediaId?: string | null;
  objectKey?: string | null;
};

export const dynamic = "force-static";

type RankRow = {
  rank?: number;
  name: string;
  score: number;
  region: string;
  me?: boolean;
};

type SingResult = {
  sourceSessionKey?: string;
  persistedSessionId?: string | null;
  persistedResultId?: string | null;
  song: string;
  userName: string;
  score: number;
  scoringVersion?: string;
  scoreReason?: string;
  expectedLyrics?: string;
  finalJitter: string;
  finalSi: string;
  facialResponseDelta?: string;
  rtLatency: string;
  finalConsonant?: string;
  finalVowel?: string;
  lyricAccuracy?: string;
  vocalParticipation?: string;
  lyricTiming?: string;
  voiceFaceSync?: string;
  transcript?: string;
  metricSource?: "measured" | "demo";
  measurementReason?: string | null;
  // 측정 신뢰도 종합 등급 — sing-training/page.tsx 에서 raw 측정값(jitterPct, vocalParticipation)
  // 기반으로 산출되어 sessionStorage 로 전달됨.
  //   high: 정상 범위. 배너 없음.
  //   medium: 환경/발성 이상치 1개 — 노란 배너 + 반복 측정 권장.
  //   low: 환경/발성 이상치 2개 이상 또는 임계치 크게 초과 — 참고 제한 배너.
  measurementReliability?: "high" | "medium" | "low";
  reliabilityReasons?: string[];
  comment: string;
  rankings: RankRow[];
  completedAt: number;
  reviewAudioUrl?: string | null;
  reviewKeyFrames?: SingKeyFrame[];
  reviewAudioMediaId?: string | null;
  reviewAudioObjectKey?: string | null;
  reviewAudioUploadState?:
    | "uploaded"
    | "failed"
    | "not_recorded"
    | "pending_result_sync";
  reviewAudioUploadError?: string | null;
  governance?: {
    catalogVersion: string;
    analysisVersion: string;
    requirementIds: string[];
    failureModes: string[];
  };
  versionSnapshot?: VersionSnapshot;
};

const SING_RESULT_SESSION_KEY = "bf_sing_result_transient";
const SING_LAST_SONG_SESSION_KEY = "bf_sing_song_transient";

type RankingPayload = {
  top5: RankRow[];
  myRank: RankRow | null;
};

type BaselineFaceMetrics = {
  facialSymmetry: number | null;
  trackingQuality: number | null;
};

type PersistDatabaseResult = {
  ranking: RankingPayload | null;
  skipped: boolean;
  ok: boolean;
  error?: string | null;
  nextResult?: SingResult | null;
};

type HistorySingEntry = Awaited<
  ReturnType<typeof fetchMyHistoryEntries>
>["entries"][number];

const EMPTY_RANKINGS: RankRow[] = Array.from({ length: 5 }, (_, index) => ({
  rank: index + 1,
  name: "--",
  region: "--",
  score: 0,
  me: false,
}));

function buildSingSourceSessionKey(song: string, completedAt: number) {
  const normalizedSong = song
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `sing-${normalizedSong || "song"}-${completedAt}`;
}

function decodeDataUrlToBytes(dataUrl: string) {
  const normalized = String(dataUrl || "").trim();
  if (!normalized.startsWith("data:")) return null;
  const commaIndex = normalized.indexOf(",");
  if (commaIndex < 0) return null;

  const header = normalized.slice(0, commaIndex);
  const payload = normalized.slice(commaIndex + 1);
  const isBase64 = /;base64(?:;|$)/i.test(header);
  if (!isBase64) {
    return new TextEncoder().encode(decodeURIComponent(payload));
  }

  const binary = window.atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function assetUrlToExportFile(
  name: string,
  assetUrl: string | null | undefined,
): Promise<ExportFile | null> {
  const normalizedUrl = String(assetUrl || "").trim();
  if (!normalizedUrl) return null;

  try {
    if (normalizedUrl.startsWith("data:")) {
      const data = decodeDataUrlToBytes(normalizedUrl);
      return data ? { name, data } : null;
    }

    const requestUrl =
      normalizedUrl.startsWith("blob:") ||
      normalizedUrl.startsWith("http://") ||
      normalizedUrl.startsWith("https://")
        ? normalizedUrl
        : new URL(normalizedUrl, window.location.origin).toString();
    const response = await fetch(requestUrl);
    if (!response.ok) return null;
    return {
      name,
      data: new Uint8Array(await response.arrayBuffer()),
    };
  } catch {
    return null;
  }
}

function getReviewAudioAccessUrl(result: SingResult | null) {
  if (!result) return null;
  if (result.reviewAudioObjectKey && result.reviewAudioUrl?.startsWith("blob:")) {
    return `/api/media/access?objectKey=${encodeURIComponent(result.reviewAudioObjectKey)}`;
  }
  if (result.reviewAudioUrl) return result.reviewAudioUrl;
  if (result.reviewAudioObjectKey) {
    return `/api/media/access?objectKey=${encodeURIComponent(result.reviewAudioObjectKey)}`;
  }
  return null;
}

function parseMeasuredNumber(value: string | null | undefined) {
  if (!value) return null;
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatLatencyLabel(value: string | null | undefined) {
  const numeric = parseMeasuredNumber(value);
  return numeric == null ? "미측정" : `${Math.round(numeric)} ms`;
}

function isMeasuredSingResult(result: SingResult | null) {
  return (
    result?.metricSource === "measured" &&
    parseMeasuredNumber(result.vocalParticipation) != null &&
    parseMeasuredNumber(result.lyricTiming) != null
  );
}

function isDemoSkipSingResult(result: SingResult | null) {
  const reason = String(result?.measurementReason || "");
  const comment = String(result?.comment || "");
  return reason.includes("관리자 skip") || comment.includes("관리자 skip");
}

function getBaselineFaceMetrics(result: SingResult | null | undefined): BaselineFaceMetrics {
  const metadata = result?.versionSnapshot?.measurement_metadata;
  const metadataBaselineFacialSymmetry =
    typeof metadata?.baseline_facial_symmetry === "number"
      ? metadata.baseline_facial_symmetry
      : typeof metadata?.baseline_facial_symmetry === "string"
        ? Number(metadata.baseline_facial_symmetry)
        : null;
  const fallbackFinalSi =
    result?.finalSi && result.finalSi !== "--" ? Number(result.finalSi) : null;
  const baselineTrackingQuality =
    typeof metadata?.baseline_tracking_quality === "number"
      ? metadata.baseline_tracking_quality
      : typeof metadata?.baseline_tracking_quality === "string"
        ? Number(metadata.baseline_tracking_quality)
        : null;

  return {
    facialSymmetry: Number.isFinite(metadataBaselineFacialSymmetry)
      ? metadataBaselineFacialSymmetry
      : Number.isFinite(fallbackFinalSi)
        ? fallbackFinalSi
      : null,
    trackingQuality: Number.isFinite(baselineTrackingQuality)
      ? baselineTrackingQuality
      : null,
  };
}

function findPreviousSingBaseline(
  entries: HistorySingEntry[],
  current: SingResult | null,
): BaselineFaceMetrics {
  if (!current) {
    return { facialSymmetry: null, trackingQuality: null };
  }

  const currentCompletedAt = Number(current.completedAt || 0);
  const currentSong = String(current.song || "");
  const singEntries = entries
    .filter((entry) => entry.trainingMode === "sing" && entry.singResult)
    .filter((entry) => entry.completedAt < currentCompletedAt)
    .sort((a, b) => b.completedAt - a.completedAt);
  const previousEntry =
    singEntries.find((entry) => String(entry.singResult?.song || "") === currentSong) ??
    singEntries[0];

  return getBaselineFaceMetrics(previousEntry?.singResult as SingResult | undefined);
}

function ServerExcludedBadge() {
  return (
    <div className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-700 sm:text-xs">
      서버 저장 제외됨(실측 아님)
    </div>
  );
}

function DemoResultBadge() {
  return (
    <div className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 sm:text-xs">
      시연용 결과
    </div>
  );
}

function buildFallbackSingResult(
  song: SongKey,
  patientName: string,
): SingResult {
  const songMeta = SONGS[song];
  return {
    song,
    userName: patientName || "사용자",
    score: 0,
    scoringVersion: "sing-score-v3-performance-weighted",
    scoreReason: "fallback:not_measured",
    expectedLyrics: songMeta.lyrics.map((line) => line.txt).join(" "),
    finalJitter: "--",
    finalSi: "--",
    facialResponseDelta: "--",
    rtLatency: "-- ms",
    finalConsonant: "--",
    finalVowel: "--",
    lyricAccuracy: "--",
    vocalParticipation: "--",
    lyricTiming: "--",
    voiceFaceSync: "--",
    transcript: "",
    metricSource: "demo",
    measurementReason: "저장된 측정 결과가 없어 화면 확인용 기본 결과를 표시합니다.",
    comment:
      "음성 또는 안면 측정 데이터가 충분하지 않아 치료사 검토용 보조 지표를 산출하지 못했습니다. 화면 확인용 결과만 표시되며 서버 저장은 수행되지 않습니다.",
    rankings: EMPTY_RANKINGS,
    completedAt: Date.now(),
    reviewAudioUrl: null,
    reviewKeyFrames: [],
    reviewAudioMediaId: null,
    reviewAudioObjectKey: null,
    reviewAudioUploadState: "not_recorded",
    reviewAudioUploadError: null,
    governance: {
      catalogVersion:
        songMeta.governance.catalogVersion ?? SING_TRAINING_CATALOG_VERSION,
      analysisVersion:
        songMeta.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
      requirementIds: songMeta.governance.requirementIds,
      failureModes: songMeta.governance.failureModes,
    },
  };
}

function buildSkippedDemoSingResult(
  song: SongKey,
  patientName: string,
): SingResult {
  const songMeta = SONGS[song];
  const demoTranscript = songMeta.lyrics
    .slice(0, 2)
    .map((line) => line.txt)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    song,
    userName: patientName || "관리자",
    score: 72,
    scoringVersion: "sing-score-v3-performance-weighted",
    scoreReason: "demo_skip:not_measured",
    expectedLyrics: songMeta.lyrics.map((line) => line.txt).join(" "),
    finalJitter: "6.4%",
    finalSi: "96.2",
    facialResponseDelta: "3.8",
    rtLatency: "1240 ms",
    finalConsonant: "74.8",
    finalVowel: "77.6",
    lyricAccuracy: "69.4",
    vocalParticipation: "82.0",
    lyricTiming: "78.0",
    voiceFaceSync: "91.0",
    transcript: demoTranscript,
    metricSource: "demo",
    measurementReason: "관리자 skip으로 인해 실측을 수행하지 않았습니다.",
    comment:
      "관리자 skip으로 생성된 화면 확인용 시연 결과입니다. 실측 데이터가 아니므로 서버 저장과 랭킹 반영은 수행되지 않습니다.",
    rankings: EMPTY_RANKINGS,
    completedAt: Date.now(),
    reviewAudioUrl: null,
    reviewKeyFrames: [],
    reviewAudioMediaId: null,
    reviewAudioObjectKey: null,
    reviewAudioUploadState: "not_recorded",
    reviewAudioUploadError: null,
    governance: {
      catalogVersion:
        songMeta.governance.catalogVersion ?? SING_TRAINING_CATALOG_VERSION,
      analysisVersion:
        songMeta.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
      requirementIds: songMeta.governance.requirementIds,
      failureModes: songMeta.governance.failureModes,
    },
  };
}

function buildResultFromHistoryEntry(entry: HistorySingEntry): SingResult {
  const hasMeasuredFromHistory =
    Boolean(entry.singResult?.vocalParticipation && entry.singResult.vocalParticipation !== "--") ||
    Boolean(entry.singResult?.lyricTiming && entry.singResult.lyricTiming !== "--") ||
    entry.singResult?.versionSnapshot?.measurement_metadata?.vocal_participation != null ||
    entry.singResult?.versionSnapshot?.measurement_metadata?.lyric_timing != null;

  return {
    song: entry.singResult?.song || "아리랑",
    userName: entry.patientName,
    score: entry.singResult?.score || 0,
    persistedSessionId: entry.sessionId,
    scoringVersion: entry.singResult?.scoringVersion,
    scoreReason: entry.singResult?.scoreReason,
    expectedLyrics: entry.singResult?.expectedLyrics,
    finalJitter: entry.singResult?.finalJitter || "--",
    finalSi: entry.singResult?.finalSi || "--",
    facialResponseDelta:
      entry.singResult?.facialResponseDelta ??
      (entry.singResult?.versionSnapshot?.measurement_metadata?.facial_response_delta == null
        ? "--"
        : String(entry.singResult.versionSnapshot.measurement_metadata.facial_response_delta)),
    rtLatency: entry.singResult?.rtLatency || "-- ms",
    finalConsonant: entry.singResult?.finalConsonant,
    finalVowel: entry.singResult?.finalVowel,
    lyricAccuracy: entry.singResult?.lyricAccuracy,
    vocalParticipation:
      entry.singResult?.vocalParticipation ??
      (entry.singResult?.versionSnapshot?.measurement_metadata?.vocal_participation == null
        ? undefined
        : String(entry.singResult.versionSnapshot.measurement_metadata.vocal_participation)),
    lyricTiming:
      entry.singResult?.lyricTiming ??
      (entry.singResult?.versionSnapshot?.measurement_metadata?.lyric_timing == null
        ? undefined
        : String(entry.singResult.versionSnapshot.measurement_metadata.lyric_timing)),
    voiceFaceSync:
      entry.singResult?.voiceFaceSync ??
      (entry.singResult?.versionSnapshot?.measurement_metadata?.voice_face_sync == null
        ? undefined
        : String(entry.singResult.versionSnapshot.measurement_metadata.voice_face_sync)),
    transcript: entry.singResult?.transcript,
    metricSource: hasMeasuredFromHistory ? "measured" : "demo",
    comment: entry.singResult?.comment || "",
    measurementReason: entry.singResult?.measurementReason,
    reviewAudioUrl: entry.singResult?.reviewAudioUrl ?? null,
    reviewAudioMediaId: entry.singResult?.reviewAudioMediaId ?? null,
    reviewAudioObjectKey: entry.singResult?.reviewAudioObjectKey ?? null,
    reviewKeyFrames: entry.singResult?.reviewKeyFrames ?? [],
    rankings: entry.singResult?.rankings ?? [],
    completedAt: entry.completedAt,
    reviewAudioUploadState:
      entry.singResult?.reviewAudioUrl || entry.singResult?.reviewAudioObjectKey
      ? "uploaded"
      : "not_recorded",
    governance: entry.singResult?.governance,
    versionSnapshot: entry.singResult?.versionSnapshot,
  };
}

function matchesPersistedSingEntry(
  entry: HistorySingEntry,
  current: SingResult | null,
) {
  if (!current || entry.trainingMode !== "sing") return false;
  if (
    current.persistedSessionId &&
    String(entry.sessionId || "") === String(current.persistedSessionId)
  ) {
    return true;
  }

  const sameSong = String(entry.singResult?.song || "") === String(current.song || "");
  const sameCompletedAt = Number(entry.completedAt || 0) === Number(current.completedAt || 0);
  return sameSong && sameCompletedAt;
}

async function persistToDatabase(
  patient: PatientProfile,
  result: SingResult,
): Promise<PersistDatabaseResult> {
  let nextResult = result;
  const sourceSessionKey =
    result.sourceSessionKey?.trim() ||
    buildSingSourceSessionKey(result.song, result.completedAt);

  if (
    result.reviewAudioUrl &&
    result.reviewAudioUploadState !== "uploaded"
  ) {
    try {
      const reviewAudioBlob = await dataUrlToBlob(result.reviewAudioUrl);
      const uploadedReviewAudio = await uploadClinicalMedia({
        patient,
        sourceSessionKey,
        trainingType: "sing-training",
        mediaType: "audio",
        captureRole: "review-audio",
        labelSegment: result.song,
        blob: reviewAudioBlob,
        fileExtension: reviewAudioBlob.type.includes("mpeg") ? "mp3" : "webm",
      });

      nextResult = {
        ...result,
        reviewAudioMediaId: uploadedReviewAudio.mediaId,
        reviewAudioObjectKey: uploadedReviewAudio.objectKey,
        reviewAudioUploadState: "uploaded",
        reviewAudioUploadError: null,
      };
    } catch (error) {
      return {
        ranking: null,
        skipped: false,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "failed_to_upload_review_audio",
        nextResult: {
          ...result,
          reviewAudioUploadState: "failed",
          reviewAudioUploadError:
            error instanceof Error
              ? error.message
              : "failed_to_upload_review_audio",
        },
      };
    }
  }

  if (Array.isArray(nextResult.reviewKeyFrames) && nextResult.reviewKeyFrames.length > 0) {
    try {
      const uploadedFrames = [] as SingKeyFrame[];
      for (let index = 0; index < nextResult.reviewKeyFrames.length; index += 1) {
        const frame = nextResult.reviewKeyFrames[index];
        const frameBlob = await dataUrlToBlob(frame.dataUrl);
        const uploadedFrame = await uploadClinicalMedia({
          patient,
          sourceSessionKey,
          trainingType: "sing-training",
          mediaType: "image",
          captureRole: `face-keyframe-${index + 1}`,
          labelSegment: `frame-${index + 1}`,
          blob: frameBlob,
          fileExtension: "jpg",
          capturedAt: frame.capturedAt,
        });
        uploadedFrames.push({
          ...frame,
          mediaId: uploadedFrame.mediaId,
          objectKey: uploadedFrame.objectKey,
        });
      }

      nextResult = {
        ...nextResult,
        reviewKeyFrames: uploadedFrames,
      };
    } catch (error) {
      return {
        ranking: null,
        skipped: false,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "failed_to_upload_review_keyframes",
        nextResult,
      };
    }
  }

  try {
    const persistableResult = {
      ...nextResult,
      sourceSessionKey,
      reviewAudioUrl: undefined,
      reviewKeyFrames: Array.isArray(nextResult.reviewKeyFrames)
        ? nextResult.reviewKeyFrames.map((frame) => ({
            capturedAt: frame.capturedAt,
            label: frame.label,
            mediaId: frame.mediaId ?? null,
            objectKey: frame.objectKey ?? null,
          }))
        : [],
    };

    const response = await fetch("/api/sing-results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ patient, result: persistableResult }),
    });

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(() => ({ error: "unknown_error" }));
      return {
        ranking: null,
        skipped: false,
        ok: false,
        error: payload?.error || "failed_to_persist_sing_result",
        nextResult,
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      ranking?: RankingPayload;
      skipped?: boolean;
      saved?: {
        sessionId?: string;
        resultId?: string;
      };
    } | null;

    return {
      ranking: payload?.ranking ?? null,
      skipped: Boolean(payload?.skipped),
      ok: true,
      error: null,
      nextResult: {
        ...nextResult,
        persistedSessionId: payload?.saved?.sessionId ?? nextResult.persistedSessionId ?? null,
        persistedResultId: payload?.saved?.resultId ?? nextResult.persistedResultId ?? null,
      },
    };
  } catch (error) {
    return {
      ranking: null,
      skipped: false,
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "failed_to_persist_sing_result",
      nextResult,
    };
  }
}

export default function SingTrainingResultPage() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<SingResult | null>(null);
  const [hasLoadedResult, setHasLoadedResult] = useState(false);
  const [fallbackSong, setFallbackSong] = useState<SongKey | null>(null);
  const [dbSaveState, setDbSaveState] = useState<
    "idle" | "saving" | "saved" | "failed" | "local_only"
  >("idle");
  const [isPlayingReview, setIsPlayingReview] = useState(false);
  const [myRank, setMyRank] = useState<RankRow | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistorySingEntry[]>([]);
  const { patient } = useTrainingSession();
  const lastPersistedKeyRef = useRef<string | null>(null);
  const reviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const localReviewAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (result?.reviewAudioUrl?.startsWith("data:")) {
      localReviewAudioUrlRef.current = result.reviewAudioUrl;
    }
  }, [result?.reviewAudioUrl]);

  const getStableReviewAudioAccessUrl = () =>
    localReviewAudioUrlRef.current ?? getReviewAudioAccessUrl(result);

  const moveToSongSelect = () => {
    if (typeof window === "undefined") return;
    if (reviewAudioRef.current) {
      reviewAudioRef.current.pause();
      reviewAudioRef.current = null;
    }
    window.sessionStorage.removeItem(SING_RESULT_SESSION_KEY);
    window.sessionStorage.removeItem(SING_LAST_SONG_SESSION_KEY);
    window.location.replace("/select-page/sing-training");
  };

  const playReviewAudio = () => {
    const reviewAudioAccessUrl = getStableReviewAudioAccessUrl();
    if (!reviewAudioAccessUrl || isPlayingReview) return;
    if (reviewAudioRef.current) {
      reviewAudioRef.current.pause();
      reviewAudioRef.current = null;
    }
    const audio = new Audio(reviewAudioAccessUrl);
    reviewAudioRef.current = audio;
    setIsPlayingReview(true);
    audio.onended = () => {
      setIsPlayingReview(false);
      if (reviewAudioRef.current === audio) {
        reviewAudioRef.current = null;
      }
    };
    audio.play().catch(() => {
      setIsPlayingReview(false);
      if (reviewAudioRef.current === audio) {
        reviewAudioRef.current = null;
      }
    });
  };

  const handleExportData = async () => {
    if (!result) return;

    const pad2 = (n: number) => String(n).padStart(2, "0");
    const formatExamDateTime = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    };
    const normalizeBirthDate = (raw: any) => {
      const text = String(raw || "").trim();
      const digits = text.replace(/[^\d]/g, "");
      if (digits.length >= 8) return digits.slice(0, 8);
      return "생년월일미입력";
    };
    const sanitizeName = (raw: any) => {
      const text = String(raw || "").trim() || result.userName || "이름미입력";
      return text.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    };
    const sanitizeSong = (raw: string) =>
      String(raw || "song")
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

    const currentHistoryRows = historyEntries
      .filter((entry) => entry.trainingMode === "sing")
      .sort((a, b) => b.completedAt - a.completedAt);
    const reviewAudioExportUrl = getStableReviewAudioAccessUrl();
    const storageSnapshot = {
      transientResult: result,
      historyMatches: currentHistoryRows.filter((entry) =>
        matchesPersistedSingEntry(entry, result),
      ),
      dbSaveState,
      reviewAudioPresent: Boolean(reviewAudioExportUrl),
      reviewKeyFrameCount: result.reviewKeyFrames?.length ?? 0,
    };
    const exportedAt = new Date().toISOString();
    const files: ExportFile[] = [
      {
        name: "result.json",
        data: new TextEncoder().encode(
          JSON.stringify(
            {
              schemaVersion: "bf-result-json-v1",
              exportedAt,
              patient: patient ?? null,
              trainingMode: "sing",
              review: RESULT_REVIEW_BOUNDARY,
              measurementQuality: {
                overall: isMeasuredSingResult(result) ? "measured" : "partial",
                reason:
                  result.measurementReason ??
                  "노래훈련 결과는 발화 참여율, 타이밍, 발성 안정도, 안면-음성 동시성을 치료사가 검토하기 위한 보조 지표입니다.",
              },
              dbSaveState,
              result,
              myRank,
            },
            null,
            2,
          ),
        ),
      },
      {
        name: "history.json",
        data: new TextEncoder().encode(
          JSON.stringify(currentHistoryRows, null, 2),
        ),
      },
      {
        name: "storage-snapshot.json",
        data: new TextEncoder().encode(
          JSON.stringify(storageSnapshot, null, 2),
        ),
      },
      {
        name: "scoring-evidence.json",
        data: new TextEncoder().encode(
          JSON.stringify(
            {
              scoringVersion: result.scoringVersion ?? null,
              scoreReason: result.scoreReason ?? null,
              expectedLyrics: result.expectedLyrics ?? null,
              transcript: result.transcript ?? "",
              score: result.score,
              finalConsonant: result.finalConsonant ?? null,
              finalVowel: result.finalVowel ?? null,
              lyricAccuracy: result.lyricAccuracy ?? null,
              vocalParticipation: result.vocalParticipation ?? null,
              lyricTiming: result.lyricTiming ?? null,
              voiceFaceSync: result.voiceFaceSync ?? null,
              measured: isMeasuredSingResult(result),
              reviewAudioPresent: Boolean(reviewAudioExportUrl),
              reviewAudioMediaId: result.reviewAudioMediaId ?? null,
              reviewAudioObjectKey: result.reviewAudioObjectKey ?? null,
            },
            null,
            2,
          ),
        ),
      },
    ];

    const mediaFiles = await Promise.all([
      assetUrlToExportFile("media/review/recording.webm", reviewAudioExportUrl),
      ...((result.reviewKeyFrames ?? []).map((frame, index) =>
        assetUrlToExportFile(
          `media/review/keyframe-${index + 1}.jpg`,
          frame.dataUrl,
        ),
      )),
    ]);
    const resolvedMediaFiles = mediaFiles.filter((file): file is ExportFile =>
      Boolean(file),
    );
    files.push(...resolvedMediaFiles);
    if (
      reviewAudioExportUrl &&
      !resolvedMediaFiles.some((file) => file.name === "media/review/recording.webm")
    ) {
      files.push({
        name: "media/review/audio-export-warning.txt",
        data: new TextEncoder().encode(
          [
            "녹음 파일 URL은 있었지만 ZIP 생성 시 오디오 파일을 가져오지 못했습니다.",
            "result.json의 reviewAudioUrl/reviewAudioObjectKey와 서버 미디어 접근 권한을 확인하세요.",
          ].join("\n"),
        ),
      });
    }
    if (!reviewAudioExportUrl) {
      files.push({
        name: "media/review/audio-not-recorded.txt",
        data: new TextEncoder().encode(
          [
            "이번 결과 객체에 녹음 원자료 URL이 없습니다.",
            "노래 훈련 화면에서 마이크 권한, MediaRecorder 지원 여부, 녹음 시작 상태를 확인하세요.",
          ].join("\n"),
        ),
      });
    }
    appendDossierFiles(files, {
      mode: "sing-training",
      exportedAt,
      patient: patient ?? null,
      primaryScore: Number(result.score),
      scoreLabel: "노래훈련 수행 보조점수",
      scoreReason:
        result.scoreReason ??
        "노래훈련 총점은 STT 전사 정확도 중심이 아니라 발화 참여율, 타이밍, 발성 안정도, 반응시간, 안면-음성 동시성 중심의 치료사 검토용 보조 지표입니다.",
      taskContext: {
        song: result.song,
        expectedLyrics: result.expectedLyrics ?? null,
        scoringVersion: result.scoringVersion ?? null,
        catalogVersion:
          result.governance?.catalogVersion ?? SING_TRAINING_CATALOG_VERSION,
        analysisVersion:
          result.governance?.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
      },
      measurementQuality: {
        level: isMeasuredSingResult(result) ? "measured" : "partial",
        reason:
          result.measurementReason ??
          (isMeasuredSingResult(result)
            ? "노래훈련 수행 원자료와 보조 지표가 함께 저장되었습니다."
            : "노래훈련 수행 샘플 일부가 부족하여 치료사 검토 시 원자료와 화면 결과를 함께 확인해야 합니다."),
        hasAudio: Boolean(reviewAudioExportUrl),
        hasTranscript: Boolean(result.transcript),
        hasFaceFrames: (result.reviewKeyFrames?.length ?? 0) > 0,
      },
    });

    const zipBlob = createZipBlob(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${normalizeBirthDate((patient as any)?.birthDate)}-${sanitizeName((patient as any)?.name)}-${formatExamDateTime(result.completedAt)}-${sanitizeSong(result.song)}-sing.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    document.querySelectorAll("video").forEach((element) => {
      const video = element as HTMLVideoElement;
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      video.pause();
      video.srcObject = null;
    });

    const raw = window.sessionStorage.getItem(SING_RESULT_SESSION_KEY);
    const isSkipDemo = searchParams.get("demo") === "skip";
    if (!raw) {
      const lastSong =
        window.sessionStorage.getItem(SING_LAST_SONG_SESSION_KEY) ??
        searchParams.get("song");
      if (lastSong && lastSong in SONGS) {
        setFallbackSong(lastSong as SongKey);
        if (isSkipDemo) {
          setResult(
            buildSkippedDemoSingResult(
              lastSong as SongKey,
              patient?.name || "관리자",
            ),
          );
          setMyRank(null);
          setHasLoadedResult(true);
          return;
        }
      } else {
        setFallbackSong(null);
      }
      if (!patient) {
        setHasLoadedResult(true);
      }
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SingResult;
      window.sessionStorage.removeItem(SING_RESULT_SESSION_KEY);
      window.sessionStorage.removeItem(SING_LAST_SONG_SESSION_KEY);
      if (parsed.reviewAudioUrl?.startsWith("data:")) {
        localReviewAudioUrlRef.current = parsed.reviewAudioUrl;
      }
      setFallbackSong(null);
      setResult(parsed);
      const parsedMyRank = parsed.rankings.find(
        (item) => item.me && Number.isFinite(Number(item.rank)),
      );
      setMyRank(parsedMyRank ?? null);
    } catch {
      setResult(null);
      setMyRank(null);
    } finally {
      setHasLoadedResult(true);
    }
  }, [patient, searchParams]);

  useEffect(() => {
    if (!patient) return;
    const isSkipDemo = searchParams.get("demo") === "skip";
    if (isSkipDemo) {
      setDbSaveState("local_only");
      setHasLoadedResult(true);
      return;
    }

    let cancelled = false;
    void fetchMyHistoryEntries()
      .then(({ entries }) => {
        if (cancelled) return;
        setHistoryEntries(entries);
        const needsStoredResultSync = !result || dbSaveState === "local_only";
        const matchedCurrentSing = entries.find((row) => matchesPersistedSingEntry(row, result));
        const latestSing = matchedCurrentSing ?? entries.find((row) => row.trainingMode === "sing");
        if (!latestSing?.singResult) {
          if (!result && fallbackSong) {
            const isSkipDemo = searchParams.get("demo") === "skip";
            setResult(
              isSkipDemo
                ? buildSkippedDemoSingResult(
                    fallbackSong,
                    patient.name || "관리자",
                  )
                : buildFallbackSingResult(fallbackSong, patient.name || "사용자"),
            );
            setMyRank(null);
          }
          setHasLoadedResult(true);
          return;
        }

        if (!needsStoredResultSync) {
          if (matchedCurrentSing?.singResult) {
            setMyRank(
              matchedCurrentSing.singResult.rankings?.find((item) => item.me) ?? null,
            );
            setDbSaveState("saved");
          }
          setHasLoadedResult(true);
          return;
        }

        const nextStoredResult = buildResultFromHistoryEntry(latestSing);
        setResult((prev) => {
          if (!prev) return nextStoredResult;
          if (prev.metricSource !== "measured") return nextStoredResult;
          return latestSing.completedAt >= prev.completedAt ? nextStoredResult : prev;
        });
        setMyRank(
          latestSing.singResult.rankings?.find((item) => item.me) ?? null,
        );
        setDbSaveState("saved");
        setHasLoadedResult(true);
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryEntries([]);
          if (!result && fallbackSong) {
            const isSkipDemo = searchParams.get("demo") === "skip";
            setResult(
              isSkipDemo
                ? buildSkippedDemoSingResult(
                    fallbackSong,
                    patient.name || "관리자",
                  )
                : buildFallbackSingResult(fallbackSong, patient.name || "사용자"),
            );
            setMyRank(null);
          }
          setHasLoadedResult(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dbSaveState, fallbackSong, patient, result, searchParams]);

  useEffect(() => {
    if (result || patient || !fallbackSong) return;
    const isSkipDemo = searchParams.get("demo") === "skip";
    setResult(
      isSkipDemo
        ? buildSkippedDemoSingResult(fallbackSong, "관리자")
        : buildFallbackSingResult(fallbackSong, "사용자"),
    );
    setMyRank(null);
    setHasLoadedResult(true);
  }, [fallbackSong, patient, result, searchParams]);

  useEffect(() => {
    return () => {
      if (reviewAudioRef.current) {
        reviewAudioRef.current.pause();
        reviewAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!patient || !result) return;
    if (!isMeasuredSingResult(result)) {
      setDbSaveState("local_only");
      return;
    }

    const persistKey = `${patient.sessionId}:${result.completedAt}:${result.song}`;
    if (lastPersistedKeyRef.current === persistKey) {
      return;
    }
    lastPersistedKeyRef.current = persistKey;

    let cancelled = false;
    setDbSaveState("saving");

    void persistToDatabase(patient, result).then(
      async ({ ranking, skipped, ok, error, nextResult }) => {
        if (cancelled) {
          return;
        }
        if (nextResult) {
          setResult(nextResult);
        }
        if (!ok) {
          console.error("[sing-result] database persistence failed", error);
          setDbSaveState("failed");
          return;
        }
        if (ranking) {
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  rankings: ranking.top5,
                }
              : prev,
          );
          setMyRank(ranking.myRank);
        }
        setDbSaveState(skipped ? "local_only" : "saved");
        try {
          const { entries } = await fetchMyHistoryEntries();
          if (!cancelled) {
            setHistoryEntries(entries);
          }
        } catch (refreshError) {
          console.error("[sing-result] failed to refresh server history", refreshError);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [patient, result]);

  if (!hasLoadedResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7faf8] px-6">
        <div className="rounded-[28px] border border-emerald-200 bg-white px-8 py-10 text-center shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600">
            Loading Result
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">
            노래 과제 결과를 불러오고 있습니다.
          </h1>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7faf8] px-6">
        <div className="rounded-[28px] border border-emerald-200 bg-white px-8 py-10 text-center shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600">
            No Result
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">
            저장된 노래 과제 결과가 없습니다.
          </h1>
          <button
            type="button"
            onClick={moveToSongSelect}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 font-black text-white"
          >
            곡 선택으로 이동
          </button>
        </div>
      </div>
    );
  }

  const isMeasuredResult = isMeasuredSingResult(result);
  const isDemoSkipResult = isDemoSkipSingResult(result);
  const isServerExcluded = dbSaveState === "local_only";
  const currentBaselineMetrics = getBaselineFaceMetrics(result);
  const previousBaselineMetrics = findPreviousSingBaseline(historyEntries, result);
  const baselineComparisonDelta =
    currentBaselineMetrics.facialSymmetry == null ||
    previousBaselineMetrics.facialSymmetry == null
      ? null
      : Math.abs(
          currentBaselineMetrics.facialSymmetry -
            previousBaselineMetrics.facialSymmetry,
        );
  const jitterScore = parseMeasuredNumber(result.finalJitter);
  const consonantScore = parseMeasuredNumber(result.finalConsonant);
  const vowelScore = parseMeasuredNumber(result.finalVowel);
  const lyricAccuracyScore = parseMeasuredNumber(result.lyricAccuracy);
  const participationScore = parseMeasuredNumber(result.vocalParticipation);
  const timingScore = parseMeasuredNumber(result.lyricTiming);
  const voiceFaceSyncScore = parseMeasuredNumber(result.voiceFaceSync);
  const lipTrackingQualityScore = currentBaselineMetrics.trackingQuality;
  const vitalityComment =
    !isMeasuredResult
      ? result.measurementReason || "측정 데이터가 충분하지 않아 화면 확인용 결과만 표시합니다."
      : result.score >= 90
      ? "목표 가사 대비 발화 보조 지표가 높게 산출되었습니다."
      : "목표 가사 대비 발화 보조 지표가 산출되었습니다.";
  const scoreLabel = isMeasuredResult ? `${result.score}` : "미측정";
  const consonantLabel =
    consonantScore == null ? "미측정" : `${consonantScore.toFixed(1)}점`;
  const vowelLabel =
    vowelScore == null ? "미측정" : `${vowelScore.toFixed(1)}점`;
  const jitterLabel =
    jitterScore == null ? "미측정" : `${jitterScore.toFixed(2)}%`;
  const lyricAccuracyLabel =
    lyricAccuracyScore == null ? "미측정" : `${lyricAccuracyScore.toFixed(1)}점`;
  const participationLabel =
    participationScore == null ? "미측정" : `${participationScore.toFixed(1)}점`;
  const timingLabel =
    timingScore == null ? "미측정" : `${timingScore.toFixed(1)}점`;
  const voiceFaceSyncLabel =
    voiceFaceSyncScore == null ? "미측정" : `${voiceFaceSyncScore.toFixed(1)}점`;
  const lipTrackingQualityLabel =
    lipTrackingQualityScore == null
      ? "미측정"
      : `${lipTrackingQualityScore.toFixed(1)}점`;
  const lipTrackingQualityText =
    lipTrackingQualityScore == null
      ? "입술/안면 추적 품질은 별도로 저장되지 않았습니다."
      : lipTrackingQualityScore >= 70
        ? `입술/안면 추적 품질은 ${lipTrackingQualityLabel}으로 안정 구간입니다. 낮은 결과 점수는 추적 실패가 아니라 발화 참여율·타이밍·음성-안면 동시성 쪽에서 나온 값입니다.`
        : `입술/안면 추적 품질은 ${lipTrackingQualityLabel}으로 낮아 재측정 시 조명과 얼굴 위치를 먼저 확인해야 합니다.`;
  const latencyLabel = formatLatencyLabel(result.rtLatency);
  const isSttReferenceLimited =
    result.measurementReliability === "low" ||
    lyricAccuracyScore == null ||
    lyricAccuracyScore < 40;
  const hasMeasuredPerformance =
    participationScore != null && timingScore != null;
  const performanceMetricRows = [
    { key: "participation", label: "발화 참여율", value: participationScore },
    { key: "timing", label: "타이밍 맞춤률", value: timingScore },
    { key: "stability", label: "발성 안정도", value: jitterScore == null ? null : Math.max(0, 100 - jitterScore * 4) },
    { key: "sync", label: "안면-음성 동시성", value: voiceFaceSyncScore },
  ].filter((row): row is { key: string; label: string; value: number } => row.value != null);
  const weakestPerformanceMetric =
    performanceMetricRows.length > 0
      ? performanceMetricRows.reduce((lowest, row) =>
          row.value < lowest.value ? row : lowest,
        )
      : null;
  const expectedLyricsPreview = String(result.expectedLyrics || "")
    .replace(/\s+/g, " ")
    .trim();
  const transcriptPreview = String(result.transcript || "")
    .replace(/\s+/g, " ")
    .trim();
  const reviewAudioExportUrl = getStableReviewAudioAccessUrl();
  const scoreInterpretationText = !isMeasuredResult
    ? result.measurementReason || "노래 수행 데이터가 부족해 보조 지표를 산출하지 못했습니다."
    : isSttReferenceLimited
      ? "자동 전사 신뢰도가 낮아 가사 기반 지표는 치료사 확인 전까지 참고 제한 상태입니다."
    : weakestPerformanceMetric
      ? `${weakestPerformanceMetric.label}가 상대적으로 낮게 산출되어 반복 확인이 필요합니다.`
      : "노래 구간 대비 발화 수행 보조 지표가 산출되었습니다.";
  const therapistReviewItems = [
    reviewAudioExportUrl ? "녹음 원자료 있음" : "녹음 원자료 확인 필요",
    transcriptPreview ? "자동 전사 있음" : "자동 전사 없음",
    expectedLyricsPreview ? "목표 가사 저장됨" : "목표 가사 없음",
    result.reviewKeyFrames?.length ? `대표 프레임 ${result.reviewKeyFrames.length}장` : "대표 프레임 없음",
  ];
  const nextActionLabel = !isMeasuredResult
    ? "재측정 권장"
    : result.score >= 90
      ? "확장 가능"
      : "반복 권장";
  const nextActionText = !isMeasuredResult
    ? "측정 가능한 환경에서 같은 곡을 다시 진행해 기준 결과를 확보하세요."
    : result.score >= 90
      ? "현재 강점을 유지하면서 새로운 곡으로 확장 훈련을 시도해 보세요."
      : result.score >= 75
        ? "같은 곡을 1회 더 반복해 발화 참여율과 타이밍 맞춤률 변화를 확인해 보세요."
        : "짧은 구간 반복과 천천히 따라 부르기로 노래 구간 대비 발화 참여를 다시 확인하는 것이 좋습니다.";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5fbf8_0%,#eef8f3_100%)] text-slate-900">
      <header className="no-print h-14 sm:h-16 px-4 sm:px-6 border-b border-emerald-100 flex items-center justify-between bg-white sticky top-0 z-40">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between min-w-0">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo/logo.png"
              alt="GOLDEN logo"
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600">
                Report
              </p>
              <h1 className="text-base sm:text-lg md:text-xl font-black flex items-center gap-1.5">
                노래 훈련 결과 리포트
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={handleExportData}
              className="px-3 sm:px-4 py-2 bg-white text-slate-900 border border-emerald-200 rounded-xl text-[11px] sm:text-xs font-bold shadow-sm hover:bg-emerald-50 active:scale-95 transition-all inline-flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              결과 ZIP 다운로드
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 sm:px-4 py-2 bg-emerald-500 text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-sm hover:bg-emerald-600 active:scale-95 transition-all inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              리포트 출력
            </button>
            <button
              type="button"
              onClick={moveToSongSelect}
              aria-label="홈으로 이동"
              title="홈"
              className="w-9 h-9 rounded-xl border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center justify-center"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10.5 12 3l9 7.5"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.5 9.5V21h13V9.5"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 21v-5h4v5"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-[34px] border border-emerald-100 bg-white p-6 shadow-[0_24px_70px_rgba(16,185,129,0.08)] sm:p-8">
          <div className="border-b border-emerald-100 pb-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600">
                    Sing Training Result
                  </p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                    {result.song} 훈련 결과
                  </h1>
                  <p className="mt-2 text-base font-medium text-slate-500">
                    {result.userName}님의 노래 과제 수행 기록 기반 보조 지표입니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${
                      isMeasuredResult
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {isMeasuredResult ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {isMeasuredResult ? "측정 완료" : "측정 부족"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${
                      dbSaveState === "saved"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : dbSaveState === "saving"
                          ? "border-slate-200 bg-slate-50 text-slate-600"
                          : dbSaveState === "failed"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {dbSaveState === "saving" && "결과 저장 중"}
                    {dbSaveState === "saved" && "결과 저장 완료"}
                    {dbSaveState === "local_only" && "서버 반영 제외 · 로컬"}
                    {dbSaveState === "failed" && "서버 저장 실패"}
                    {dbSaveState === "idle" && "결과 저장 대기"}
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 sm:grid-cols-4">
                <div>
                  <dt className="uppercase tracking-[0.14em] text-slate-400">곡</dt>
                  <dd className="mt-0.5 text-sm font-bold text-slate-700">{result.song}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-[0.14em] text-slate-400">측정 일시</dt>
                  <dd className="mt-0.5 text-sm font-bold text-slate-700">
                    {new Date(result.completedAt).toLocaleString("ko-KR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </dd>
                </div>
                {result.governance ? (
                  <>
                    <div>
                      <dt className="uppercase tracking-[0.14em] text-slate-400">Catalog</dt>
                      <dd className="mt-0.5 text-sm font-bold text-slate-700">
                        {result.governance.catalogVersion}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-[0.14em] text-slate-400">Analysis</dt>
                      <dd className="mt-0.5 text-sm font-bold text-slate-700">
                        {result.governance.analysisVersion}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  본 리포트는 치료사 검토용 <b>보조 지표</b>이며, 의학적 진단·처방을 대체하지 않습니다.
                </p>
              </div>

              {/* 측정 신뢰도 안내 배너 — sing-training/page.tsx 에서 raw 측정값 기반 산출.
                  low: 주황 — 자동 전사/가사 지표 참고 제한.
                  medium: 앰버 — 반복 측정 권장.
                  high: 표시 없음. */}
              {result.measurementReliability === "low" ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="space-y-1.5">
                    <p className="font-black">
                      측정 신뢰도가 낮아 자동 전사·가사 기반 지표는 참고 제한 상태입니다
                    </p>
                    {result.reliabilityReasons?.length ? (
                      <ul className="ml-1 list-disc space-y-0.5 pl-4 text-[13px] font-medium text-amber-900">
                        {result.reliabilityReasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="pt-1 text-[12px] font-medium text-amber-800">
                      유선 헤드셋 사용 후 조용한 환경에서 재측정해 주세요. 반주 누설
                      또는 블루투스 SCO 한계가 전사 참고값을 왜곡할 수 있습니다.
                    </p>
                  </div>
                </div>
              ) : result.measurementReliability === "medium" ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="space-y-1">
                    <p className="font-black">
                      측정 신뢰도가 보통 — 반복 측정으로 참고값 확인을 권장합니다
                    </p>
                    {result.reliabilityReasons?.length ? (
                      <ul className="ml-1 list-disc space-y-0.5 pl-4 text-[12px] font-medium text-amber-800">
                        {result.reliabilityReasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {isServerExcluded ? (
                <div className="flex flex-wrap gap-2">
                  {isDemoSkipResult ? <DemoResultBadge /> : null}
                  <ServerExcludedBadge />
                </div>
              ) : null}
            </div>
          </div>

          <section className="mt-6 rounded-[24px] border border-emerald-100 bg-emerald-50/70 px-5 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr_1fr] md:items-center">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  수행 참고지표
                </p>
                <p className="mt-1 text-4xl font-black tracking-tight tabular-nums text-emerald-700">
                  {isMeasuredResult ? `${scoreLabel}` : "미측정"}
                  {isMeasuredResult ? <span className="text-2xl"> / 100</span> : null}
                </p>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700/70">
                  자동 판정 점수 아님
                </p>
              </div>
              <div className="text-sm font-semibold leading-6 text-slate-700">
                {isMeasuredResult
                  ? scoreInterpretationText
                  : result.measurementReason || "측정 데이터가 충분하지 않습니다."}
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {baselineComparisonDelta == null
                    ? "직전 baseline 비교 전"
                    : `baseline 대비 ${baselineComparisonDelta > 0 ? "+" : ""}${baselineComparisonDelta.toFixed(1)}`}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  다음 권장 행동
                </p>
                <p className="mt-1 text-xl font-black text-slate-900">{nextActionLabel}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  {nextActionText}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                  Performance Metrics · 참고 척도
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                  노래 수행 참고 지표
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <ProgressMetricRow
                label="발화 참여율"
                value={participationScore}
                fallbackLabel={participationLabel}
                limited={isSttReferenceLimited}
              />
              <ProgressMetricRow
                label="타이밍 맞춤률"
                value={timingScore}
                fallbackLabel={timingLabel}
                limited={isSttReferenceLimited}
              />
              <ProgressMetricRow
                label="안면-음성 동시성"
                value={voiceFaceSyncScore}
                fallbackLabel={voiceFaceSyncLabel}
              />
            </div>

            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 ${
                lipTrackingQualityScore != null && lipTrackingQualityScore >= 70
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {lipTrackingQualityText}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                자동 전사 참고
              </p>
              <p className="mt-1.5 font-medium text-slate-700">
                {(hasMeasuredPerformance || isDemoSkipResult) && result.transcript?.trim()
                  ? `“${result.transcript}”`
                  : "전사 가능한 발화가 수집되지 않았습니다."}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                노래 음성에서는 자동 전사 정확도가 낮을 수 있어 단독 채점 근거로 사용하지 않습니다.
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                STT 참고값: 자음 {consonantLabel} · 모음 {vowelLabel} · 전사 일치 {lyricAccuracyLabel}
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-[28px] border border-emerald-100 bg-[linear-gradient(180deg,#f7fcfa_0%,#eefbf4_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                  Review Points
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                  결과 해석 포인트
                </h2>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  낮게 나온 이유
                </p>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-800">
                  {scoreInterpretationText}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  우선 확인 지표
                </p>
                <p className="mt-3 text-2xl font-black text-slate-900">
                  {weakestPerformanceMetric
                    ? `${weakestPerformanceMetric.label} ${weakestPerformanceMetric.value.toFixed(1)}점`
                    : "미측정"}
                </p>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                  세 지표 중 가장 낮은 항목입니다. 치료사가 녹음과 전사 결과를 함께 확인합니다.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  검토 원자료
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {therapistReviewItems.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  목표 가사
                </p>
                <p className="mt-2 max-h-24 overflow-auto text-sm font-medium leading-6 text-slate-700">
                  {expectedLyricsPreview || "목표 가사가 저장되지 않았습니다."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  자동 전사 참고값
                </p>
                <p className="mt-2 max-h-24 overflow-auto text-sm font-medium leading-6 text-slate-700">
                  {transcriptPreview || "자동 전사 결과가 없습니다."}
                </p>
              </div>
            </div>
          </section>

          <div className="mt-5 space-y-5">
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                  <Music className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Review
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    재생 및 프레임 확인
                  </h2>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {reviewAudioExportUrl ? (
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                    <button
                      type="button"
                      onClick={playReviewAudio}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-5 font-black text-emerald-700"
                    >
                      <Music className="h-4 w-4" />
                      {isPlayingReview ? "재생 중..." : "내 노래 듣기"}
                    </button>
                    <p className="mt-3 text-sm font-semibold text-slate-500">
                      {result.reviewAudioUploadState === "uploaded" &&
                        "NCP 업로드 및 DB 메타데이터 저장 완료"}
                      {result.reviewAudioUploadState === "pending_result_sync" &&
                        "결과 저장 시 서버 업로드 대기 중"}
                      {result.reviewAudioUploadState === "failed" &&
                        `업로드 실패: ${result.reviewAudioUploadError || "--"}`}
                      {result.reviewAudioUploadState === "not_recorded" &&
                        "녹음 파일이 생성되지 않았습니다."}
                      {!result.reviewAudioUploadState && "로컬 녹음만 생성되었습니다."}
                    </p>
                  </div>
                ) : null}
                {result.reviewKeyFrames?.length ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                      Face Key Frames
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      노래 중 수집한 안면 반응 대표 프레임입니다.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {result.reviewKeyFrames.map((frame, index) => (
                        <div
                          key={`${frame.label}-${frame.capturedAt}-${index}`}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                        >
                          <img
                            src={frame.dataUrl}
                            alt={`노래 훈련 key frame ${index + 1}`}
                            className="h-32 w-full object-cover"
                          />
                          <div className="border-t border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                            {frame.label} · {new Date(frame.capturedAt).toLocaleTimeString("ko-KR")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Acoustic Metrics
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    음향 참고 지표
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <AcousticMetricCard
                  icon={<Timer className="h-4 w-4" />}
                  title="반응 지연 시간"
                  value={latencyLabel}
                  hint="자극 제시 후 첫 발화까지의 지연. 낮을수록 좋습니다."
                />
                <AcousticMetricCard
                  icon={<Mic className="h-4 w-4" />}
                  title="발성 안정 참고값 (Jitter)"
                  value={jitterLabel}
                  hint="정상 발성 0.5~1.5%. 5% 초과 시 측정 환경(반주 누설, 배경 잡음) 영향 가능."
                  qualityBadge={
                    jitterScore == null
                      ? undefined
                      : jitterScore <= 1.5
                        ? { label: "정상 범위", tone: "ok" }
                        : jitterScore <= 5
                          ? { label: "정상 범위 초과", tone: "warn" }
                          : { label: "측정 환경 점검 권장", tone: "bad" }
                  }
                />
              </div>
            </section>

            {baselineComparisonDelta != null ? (
              <section className="rounded-[30px] border border-emerald-100 bg-[#fbfefc] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                      Facial Support Metric
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-slate-900">
                      직전 세션 기준 대비 안면 변화량
                    </h2>
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  <SymmetryRow
                    label="직전 세션 baseline 대비 안면 변화량"
                    delta={baselineComparisonDelta}
                    feedback={`${baselineComparisonDelta.toFixed(1)}점 변화`}
                    tone="emerald"
                  />
                </div>

                <div className="mt-6 rounded-[24px] bg-emerald-50 p-4 text-emerald-900">
                  <p className="text-sm font-black">
                    이번 세션 시작 baseline과 직전 세션 baseline을 비교한 보조 변화값입니다.
                  </p>
                  <p className="mt-2 text-base font-medium text-emerald-800">
                    현재는 입, 눈, 표정 협응을 각각 독립 계측하지 않고 baseline 얼굴 metric 1개만 비교합니다.
                  </p>
                </div>
              </section>
            ) : null}

            <section className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(180deg,#f7fcfa_0%,#eefbf4_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                    Review Memo
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    검토 메모
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-700">
                {result.comment ||
                  (isMeasuredResult
                    ? "전사 가능한 발화가 수집되어 목표 가사 대비 보조 지표를 산출했습니다."
                    : result.measurementReason ||
                      "측정 데이터가 충분하지 않아 치료사 검토용 보조 지표를 산출하지 못했습니다.")}
              </p>
            </section>

            <section className="rounded-[30px] border border-emerald-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                    Next Activity
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    다음 권장 활동
                  </h2>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
                  권장 방향
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {nextActionLabel}
                </p>
                <p className="mt-2 text-base font-medium leading-relaxed text-emerald-900">
                  {nextActionText}
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    우선 확인 지표
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-900">
                    {weakestPerformanceMetric?.label ?? "측정 환경"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    치료사가 녹음과 대표 프레임으로 먼저 확인할 항목입니다.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    같은 곡 기준
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-900">
                    {result.song}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    다음 세션에서 동일 곡 반복 시 변화량 비교에 사용합니다.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    저장 상태
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-900">
                    {dbSaveState === "saving"
                      ? "저장 중"
                      : dbSaveState === "saved"
                        ? "DB 저장 완료"
                        : "로컬/ZIP 확인"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    결과 ZIP과 원자료 포함 여부를 함께 확인하세요.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProgressMetricRow({
  label,
  value,
  fallbackLabel,
  limited = false,
}: {
  label: string;
  value: number | null;
  fallbackLabel: string;
  limited?: boolean;
}) {
  const unmeasured = value == null;
  const clamped = unmeasured ? 0 : Math.max(0, Math.min(100, value ?? 0));
  const fillBackground = unmeasured
    ? "#cbd5e1"
    : clamped >= 75
      ? "linear-gradient(90deg,#10b981 0%,#34d399 100%)"
      : clamped >= 50
        ? "linear-gradient(90deg,#22c55e 0%,#86efac 100%)"
        : clamped >= 25
          ? "linear-gradient(90deg,#f59e0b 0%,#fcd34d 100%)"
          : "linear-gradient(90deg,#f43f5e 0%,#fda4af 100%)";
  const fillWidth = unmeasured ? 4 : Math.max(8, clamped);

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        limited
          ? "border-amber-100 bg-amber-50/50"
          : "border-slate-100 bg-slate-50/60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-black text-slate-800">{label}</p>
        <p
          className={`text-base font-black tabular-nums ${
            limited ? "text-amber-800" : "text-slate-900"
          }`}
        >
          {limited
            ? "참고 제한"
            : unmeasured
              ? fallbackLabel
              : `${clamped.toFixed(1)} / 100`}
        </p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-inner">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${fillWidth}%`,
            background: fillBackground,
            boxShadow: unmeasured
              ? "none"
              : "0 0 10px rgba(16,185,129,0.22)",
          }}
        />
      </div>
      {limited ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-amber-800">
          자동 전사 신뢰가 낮아 치료사 확인 전까지 참고값으로만 봅니다.
        </p>
      ) : null}
    </div>
  );
}

function AcousticMetricCard({
  icon,
  title,
  value,
  hint,
  qualityBadge,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  hint: string;
  qualityBadge?: {
    label: string;
    tone: "ok" | "warn" | "bad";
  };
}) {
  const toneClass =
    qualityBadge?.tone === "ok"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : qualityBadge?.tone === "warn"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : qualityBadge?.tone === "bad"
          ? "bg-rose-100 text-rose-700 border-rose-200"
          : "";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          {icon}
        </span>
        <p className="text-[11px] font-black uppercase tracking-[0.16em]">{title}</p>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight tabular-nums text-slate-900">
        {value}
      </p>
      {qualityBadge ? (
        <p
          className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${toneClass}`}
        >
          {qualityBadge.label}
        </p>
      ) : null}
      <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

function MetricPill({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/14 bg-white/10 px-4 py-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
        {title}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function SymmetryRow({
  label,
  delta,
  feedback,
  tone,
}: {
  label: string;
  delta: number | null;
  feedback: string;
  tone: "slate" | "emerald";
}) {
  const unavailable = delta == null;
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-black text-slate-900">{label}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{feedback}</p>
        </div>
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600">
          {unavailable ? "N/A" : "Change"}
        </p>
      </div>
      {unavailable ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
          안면 반응 변화 측정 데이터가 충분하지 않아 이 보조 지표는 계산하지 않았습니다.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Bar label="기준 대비 변화량" value={delta} tone={tone} />
        </div>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald";
}) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const width = `${Math.max(12, clampedValue)}%`;
  const fillClass =
    tone === "emerald"
      ? "bg-[linear-gradient(90deg,#10b981_0%,#34d399_100%)]"
      : "bg-[linear-gradient(90deg,#94a3b8_0%,#cbd5e1_100%)]";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-bold text-slate-600">
        <span>{label}</span>
        <span>{clampedValue.toFixed(1)}점</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100">
        <div className={`h-3 rounded-full ${fillClass}`} style={{ width }} />
      </div>
    </div>
  );
}
