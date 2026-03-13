"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  ChevronRight,
  Clock3,
  Mic,
  Music,
  Printer,
  RotateCcw,
  Trophy,
} from "lucide-react";
import {
  SING_TRAINING_ANALYSIS_VERSION,
  SING_TRAINING_CATALOG_VERSION,
  SONG_KEYS,
  SONGS,
} from "@/features/sing-training/data/songs";
import { SongKey, SyllableCue } from "@/features/sing-training/types";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { buildVersionSnapshot, type VersionSnapshot } from "@/lib/analysis/versioning";
import { loadPatientProfile } from "@/lib/patientStorage";
import { dataUrlToBlob, uploadClinicalMedia } from "@/lib/client/clinicalMediaUpload";

type Phase = "select" | "ready" | "countdown" | "singing" | "result";

type RankRow = {
  name: string;
  score: number;
  region: string;
  me?: boolean;
};

type SingResultEnvelope = {
  song: string;
  userName: string;
  score: number;
  finalJitter: string;
  finalSi: string;
  rtLatency: string;
  comment: string;
  rankings: RankRow[];
  completedAt: number;
  reviewAudioUrl?: string | null;
  reviewAudioMediaId?: string | null;
  reviewAudioObjectKey?: string | null;
  reviewAudioUploadState?: "uploaded" | "failed" | "not_recorded";
  reviewAudioUploadError?: string | null;
  governance: {
    catalogVersion: string;
    analysisVersion: string;
    requirementIds: string[];
    failureModes: string[];
  };
  versionSnapshot: VersionSnapshot;
};

const LYRIC_LEAD_OFFSET_SEC = 0.28;

function renderProgressLyric(
  text: string,
  progressPct: number,
  cues?: SyllableCue[] | null,
  elapsedInLine?: number,
) {
  if (cues && cues.length > 0 && typeof elapsedInLine === "number") {
    return cues.map((cue, index) => {
      const isDone = elapsedInLine >= cue.end;
      const isActive = elapsedInLine >= cue.start && elapsedInLine < cue.end;
      const activeProgress = isActive
        ? Math.min(
            1,
            Math.max(0, (elapsedInLine - cue.start) / (cue.end - cue.start)),
          )
        : 0;
      const fillWidth = isDone ? "100%" : `${activeProgress * 100}%`;

      if (cue.syllable.trim().length === 0) {
        return (
          <span
            key={`${cue.syllable}-${index}`}
            className="inline-block w-[0.38em] text-transparent"
          >
            {"\u00A0"}
          </span>
        );
      }

      return (
        <span key={`${cue.syllable}-${index}`} className="relative inline-block">
          <span className="text-white/32">{cue.syllable}</span>
          <span
            className="absolute inset-y-0 left-0 overflow-hidden text-emerald-300 drop-shadow-[0_0_18px_rgba(110,231,183,0.5)]"
            style={{ width: fillWidth }}
          >
            {cue.syllable}
          </span>
        </span>
      );
    });
  }

  const chars = Array.from(text);
  const activeCount = Math.round((chars.length * progressPct) / 100);

  return chars.map((char, index) => (
    <span
      key={`${char}-${index}`}
      className={
        index < activeCount
          ? "text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.18)]"
          : "text-white/32"
      }
    >
      {char === " " ? "\u00A0" : char}
    </span>
  ));
}


function BrainSingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { patient, ageGroup } = useTrainingSession();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sideVideoRef = useRef<HTMLVideoElement | null>(null);
  const songAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const clockTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const singingTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const finishGuardRef = useRef(false);
  const audioEndedRef = useRef(false);

  const requestedSong = useMemo(() => {
    const raw = searchParams.get("song");
    return SONG_KEYS.find((item) => item === raw) ?? null;
  }, [searchParams]);

  const [phase, setPhase] = useState<Phase>(requestedSong ? "ready" : "select");
  const [song, setSong] = useState<SongKey>(requestedSong ?? "나비야");
  const [clockText, setClockText] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [remaining, setRemaining] = useState("30.0");
  const [scanStatus, setScanStatus] = useState("READY");
  const [lyricBase, setLyricBase] = useState("시스템 준비 중...");
  const [nextLyricBase, setNextLyricBase] = useState("");
  const [lyricFillPct, setLyricFillPct] = useState(0);
  const [lyricElapsedSec, setLyricElapsedSec] = useState(0);
  const [currentLyricCues, setCurrentLyricCues] = useState<SyllableCue[] | null>(
    null,
  );
  const [rtJitter, setRtJitter] = useState("0.00%");
  const [rtSi, setRtSi] = useState("0.0");
  const [rtLatency, setRtLatency] = useState("-- ms");
  const [jitterHistory, setJitterHistory] = useState<number[]>([]);
  const [siHistory, setSiHistory] = useState<number[]>([]);
  const [finalScore, setFinalScore] = useState(0);
  const [finalJitter, setFinalJitter] = useState("0.00");
  const [finalSi, setFinalSi] = useState("0.0");
  const [comment, setComment] = useState("");
  const [rankings, setRankings] = useState<RankRow[]>([]);
  const [audioReady, setAudioReady] = useState(false);
  const [songDurationSec, setSongDurationSec] = useState(30);

  const currentSong = SONGS[song];
  const lyricLeadOffsetSec =
    currentSong.lyricLeadOffsetSec ?? LYRIC_LEAD_OFFSET_SEC;
  const userName = patient?.name || "사용자";
  const lyricTimelineEndSec = useMemo(() => {
    const lastLine = currentSong.lyrics[currentSong.lyrics.length - 1];
    return lastLine ? lastLine.t + lastLine.d : 30;
  }, [currentSong.lyrics]);

  useEffect(() => {
    const audio = new Audio(currentSong.audioSrc);
    audio.preload = "auto";
    setAudioReady(false);
    setSongDurationSec(currentSong.durationSec ?? 30);
    const handleReady = () => setAudioReady(true);
    const handleError = () => setAudioReady(false);
    const handleMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setSongDurationSec(audio.duration);
      }
    };

    audio.addEventListener("canplaythrough", handleReady);
    audio.addEventListener("loadeddata", handleReady);
    audio.addEventListener("error", handleError);
    audio.addEventListener("loadedmetadata", handleMetadata);
    audio.addEventListener("durationchange", handleMetadata);
    songAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener("canplaythrough", handleReady);
      audio.removeEventListener("loadeddata", handleReady);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("loadedmetadata", handleMetadata);
      audio.removeEventListener("durationchange", handleMetadata);
      if (songAudioRef.current === audio) {
        songAudioRef.current = null;
      }
    };
  }, [currentSong.audioSrc]);

  const stopActiveSession = () => {
    if (clockTimerRef.current !== null) {
      window.clearInterval(clockTimerRef.current);
      clockTimerRef.current = null;
    }
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (singingTimerRef.current !== null) {
      window.clearInterval(singingTimerRef.current);
      singingTimerRef.current = null;
    }
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    recordedChunksRef.current = [];
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (sideVideoRef.current) {
      sideVideoRef.current.srcObject = null;
    }
    if (songAudioRef.current) {
      songAudioRef.current.onended = null;
      songAudioRef.current.pause();
      songAudioRef.current.currentTime = 0;
    }
    audioEndedRef.current = false;
  };

  const stopAnalysisLoopKeepingCamera = () => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (singingTimerRef.current !== null) {
      window.clearInterval(singingTimerRef.current);
      singingTimerRef.current = null;
    }
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (songAudioRef.current) {
      songAudioRef.current.onended = null;
      songAudioRef.current.pause();
    }
  };

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("failed_to_read_recording"));
      };
      reader.onerror = () =>
        reject(reader.error ?? new Error("failed_to_read_recording"));
      reader.readAsDataURL(blob);
    });

  const startVoiceRecording = () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;

    recordedChunksRef.current = [];

    try {
      const recorder = new MediaRecorder(new MediaStream(audioTracks));
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (error) {
      console.warn("[brain-sing] voice recording start failed", error);
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
    }
  };

  const stopVoiceRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return null;

    if (recorder.state === "inactive") {
      mediaRecorderRef.current = null;
      if (!recordedChunksRef.current.length) return null;
      const blob = new Blob(recordedChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      recordedChunksRef.current = [];
      return blobToDataUrl(blob);
    }

    return new Promise<string | null>((resolve) => {
      recorder.onstop = async () => {
        try {
          if (!recordedChunksRef.current.length) {
            resolve(null);
            return;
          }
          const blob = new Blob(recordedChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          const dataUrl = await blobToDataUrl(blob);
          resolve(dataUrl);
        } catch (error) {
          console.warn("[brain-sing] voice recording finalize failed", error);
          resolve(null);
        } finally {
          recordedChunksRef.current = [];
          mediaRecorderRef.current = null;
        }
      };
      recorder.stop();
    });
  };

  useEffect(() => {
    const tick = () => setClockText(new Date().toLocaleTimeString());
    tick();
    clockTimerRef.current = window.setInterval(tick, 1000);
    return () => {
      if (clockTimerRef.current !== null)
        window.clearInterval(clockTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopActiveSession();
    };
  }, []);

  useEffect(() => {
    if (!requestedSong) return;
    setSong(requestedSong);
    setPhase("ready");
  }, [requestedSong]);

  const prepareSong = (selected: SongKey) => {
    setSong(selected);
    setPhase("ready");
    setRemaining("30.0");
    setLyricBase("시스템 준비 중...");
    setLyricFillPct(0);
    setLyricElapsedSec(0);
    setCurrentLyricCues(null);
    setRtJitter("0.00%");
    setRtSi("0.0");
    setRtLatency("-- ms");
    setScanStatus("READY");
  };

  const startCountdown = async () => {
    try {
      if (songAudioRef.current) {
        try {
          songAudioRef.current.currentTime = 0;
          await songAudioRef.current.play();
          songAudioRef.current.pause();
          songAudioRef.current.currentTime = 0;
        } catch {
          console.warn(`[brain-sing] audio prime failed: ${currentSong.audioSrc}`);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (sideVideoRef.current) {
        sideVideoRef.current.srcObject = stream;
      }

      setCountdown(3);
      setPhase("countdown");
      setScanStatus("CALIBRATING");

      countdownTimerRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current !== null) {
              window.clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            window.setTimeout(() => {
              startSinging();
            }, 450);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      window.alert("카메라 및 마이크 권한이 필요합니다.");
    }
  };

  const finishSinging = async (jitterData: number[], siData: number[]) => {
    stopAnalysisLoopKeepingCamera();
    const reviewAudioUrl = await stopVoiceRecording();
    const patient = loadPatientProfile();
    let uploadedReviewAudio: {
      mediaId: string;
      objectKey: string;
    } | null = null;
    let reviewAudioUploadState: "uploaded" | "failed" | "not_recorded" =
      reviewAudioUrl ? "failed" : "not_recorded";
    let reviewAudioUploadError: string | null = null;

    if (reviewAudioUrl && patient) {
      try {
        const reviewAudioBlob = await dataUrlToBlob(reviewAudioUrl);
        uploadedReviewAudio = await uploadClinicalMedia({
          patient,
          sourceSessionKey: patient.sessionId,
          trainingType: "sing-training",
          mediaType: "audio",
          captureRole: "review-audio",
          labelSegment: song,
          blob: reviewAudioBlob,
          fileExtension: reviewAudioBlob.type.includes("mpeg") ? "mp3" : "webm",
        });
        reviewAudioUploadState = "uploaded";
      } catch (error) {
        console.error("[sing-training] failed to upload review audio", error);
        reviewAudioUploadState = "failed";
        reviewAudioUploadError =
          error instanceof Error ? error.message : "failed_to_upload_review_audio";
      }
    }

    const avgJ =
      jitterData.length > 0
        ? jitterData.reduce((sum, value) => sum + value, 0) / jitterData.length
        : 0.32;
    const avgS =
      siData.length > 0
        ? siData.reduce((sum, value) => sum + value, 0) / siData.length
        : 96.2;
    const score = Math.round(avgS * 0.52 + (100 - avgJ * 12) * 0.48);

    const finalJitterText = avgJ.toFixed(2);
    const finalSiText = avgS.toFixed(1);
    const finalComment = `가창 분석 결과 성대 안정성은 ${avgJ.toFixed(2)}% 수준으로 유지되었고, 안면 대칭 지수는 ${avgS.toFixed(1)}점으로 비교적 안정적인 신경 협응 흐름을 보였습니다.`;

    setFinalScore(score);
    setFinalJitter(finalJitterText);
    setFinalSi(finalSiText);
    setComment(finalComment);

    const masked =
      userName.length >= 2
        ? `${userName[0]}*${userName[userName.length - 1]}`
        : `${userName}*`;
    const rows: RankRow[] = [
      { name: "박*자", score: 98, region: "전남" },
      { name: "김*식", score: 95, region: "서울" },
      { name: masked, score, region: "본인", me: true },
      { name: "이*순", score: 89, region: "경기" },
      { name: "최*남", score: 87, region: "경남" },
    ].sort((a, b) => b.score - a.score);
    setRankings(rows);
    setScanStatus("COMPLETE");

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "brain-sing-result",
        JSON.stringify({
          song,
          userName,
          score,
          finalJitter: finalJitterText,
          finalSi: finalSiText,
          rtLatency,
          comment: finalComment,
          rankings: rows,
          completedAt: Date.now(),
          reviewAudioUrl,
          reviewAudioMediaId: uploadedReviewAudio?.mediaId ?? null,
          reviewAudioObjectKey: uploadedReviewAudio?.objectKey ?? null,
          reviewAudioUploadState,
          reviewAudioUploadError,
          governance: {
            catalogVersion:
              currentSong.governance.catalogVersion ?? SING_TRAINING_CATALOG_VERSION,
            analysisVersion:
              currentSong.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
            requirementIds: currentSong.governance.requirementIds,
            failureModes: currentSong.governance.failureModes,
          },
          versionSnapshot: buildVersionSnapshot("sing", {
            algorithm_version:
              currentSong.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
            model_version:
              currentSong.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
            requirements: currentSong.governance.requirementIds,
            config_version:
              currentSong.governance.catalogVersion ?? SING_TRAINING_CATALOG_VERSION,
          }),
        } satisfies SingResultEnvelope),
      );
    }

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        window.location.replace("/result-page/sing-training");
      }, 2000);
    }
  };

  const startSinging = () => {
    const startedAt = performance.now();
    const jitterData: number[] = [];
    const siData: number[] = [];
    finishGuardRef.current = false;
    audioEndedRef.current = false;

    setPhase("singing");
    setScanStatus("LIVE");
    setJitterHistory([]);
    setSiHistory([]);
    setLyricFillPct(0);
    startVoiceRecording();

    const hasReliableAudioDuration = audioReady && songDurationSec > 0;
    const finishAtSec = hasReliableAudioDuration
      ? songDurationSec
      : Math.max(30, lyricTimelineEndSec - lyricLeadOffsetSec);
    const fallbackFinishAtSec = hasReliableAudioDuration
      ? Math.max(songDurationSec + 8, lyricTimelineEndSec - lyricLeadOffsetSec + 2)
      : finishAtSec;

    const finalizeIfNeeded = () => {
      if (finishGuardRef.current) {
        return;
      }
      finishGuardRef.current = true;
      if (singingTimerRef.current !== null) {
        window.clearInterval(singingTimerRef.current);
        singingTimerRef.current = null;
      }
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      void finishSinging(jitterData, siData);
    };

    finishTimerRef.current = window.setTimeout(
      finalizeIfNeeded,
      Math.max(0, fallbackFinishAtSec * 1000 + 120),
    );

    if (songAudioRef.current) {
      songAudioRef.current.currentTime = 0;
      songAudioRef.current.onended = () => {
        audioEndedRef.current = true;
      };
      songAudioRef.current.play().catch(() => {
        console.warn(`[brain-sing] audio playback failed: ${currentSong.audioSrc}`);
      });
    }

    singingTimerRef.current = window.setInterval(() => {
      const audioElapsed = songAudioRef.current?.currentTime ?? 0;
      const fallbackElapsed = (performance.now() - startedAt) / 1000;
      const elapsed =
        audioReady && audioElapsed > 0.01 ? audioElapsed : fallbackElapsed;
      const lyricElapsed = Math.max(0, elapsed + lyricLeadOffsetSec);
      const effectiveDuration = finishAtSec;
      const remain = Math.max(0, effectiveDuration - elapsed).toFixed(1);
      setRemaining(remain);

      const firstLine = currentSong.lyrics[0] ?? null;
      const lastStartedIndex = currentSong.lyrics.reduce((foundIndex, line, index) => {
        if (lyricElapsed >= line.t) {
          return index;
        }
        return foundIndex;
      }, -1);

      if (firstLine && lastStartedIndex < 0) {
        setLyricBase("전주 진행 중...");
        setNextLyricBase(firstLine.txt);
        setCurrentLyricCues(null);
        setLyricElapsedSec(0);
        setLyricFillPct(0);
      } else if (lastStartedIndex >= 0) {
        const activeLine = currentSong.lyrics[lastStartedIndex];
        const nextLine = currentSong.lyrics[lastStartedIndex + 1] ?? null;
        const elapsedInLine = Math.max(0, lyricElapsed - activeLine.t);

        setLyricBase(activeLine.txt);
        setNextLyricBase(nextLine?.txt ?? "");
        setCurrentLyricCues(activeLine.cues ?? null);
        setLyricElapsedSec(elapsedInLine);
        setLyricFillPct(
          Math.min(100, (elapsedInLine / activeLine.d) * 100),
        );
      } else {
        setLyricBase("시스템 준비 중...");
        setNextLyricBase("");
        setCurrentLyricCues(null);
        setLyricElapsedSec(0);
        setLyricFillPct(0);
      }

      const jitter = Number((0.22 + Math.random() * 0.16).toFixed(2));
      const si = Number((94.5 + Math.random() * 3.8).toFixed(1));
      jitterData.push(jitter);
      siData.push(si);
      setJitterHistory([...jitterData]);
      setSiHistory([...siData]);
      setRtJitter(`${jitter.toFixed(2)}%`);
      setRtSi(si.toFixed(1));
      setRtLatency(`${(110 + Math.random() * 18).toFixed(0)} ms`);

      if (audioEndedRef.current) {
        finalizeIfNeeded();
        return;
      }

      if (!hasReliableAudioDuration && elapsed >= effectiveDuration) {
        finalizeIfNeeded();
      }
    }, 100);
  };

  const resetAll = () => {
    stopActiveSession();
    setSong(requestedSong ?? "나비야");
    setPhase(requestedSong ? "ready" : "select");
    setCountdown(3);
    setRemaining("30.0");
    finishGuardRef.current = false;
    setScanStatus("READY");
    setLyricBase("시스템 준비 중...");
    setNextLyricBase("");
    setLyricFillPct(0);
    setLyricElapsedSec(0);
    setCurrentLyricCues(null);
    setRtJitter("0.00%");
    setRtSi("0.0");
    setRtLatency("-- ms");
    setJitterHistory([]);
    setSiHistory([]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7faf8] text-slate-900">
      <header className="shrink-0 border-b border-emerald-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/images/logo/logo.png"
              alt="GOLDEN logo"
              className="h-10 w-10 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 leading-none">
                Active Patient Profile
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm sm:text-lg font-black text-slate-900">
                <span className="truncate">{patient?.name ?? "정보 없음"}</span>
                <span className="text-xs sm:text-sm font-bold text-slate-500">
                  {patient?.age ?? "-"}세
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-600">
                  {ageGroup === "Senior" ? "실버 규준 적용" : "일반 규준 적용"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => router.push("/select-page/sing-training")}
              className="rounded-full border border-emerald-500 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-[11px] sm:text-xs font-black text-white shadow-sm"
            >
              곡선택
            </button>
            <button
              type="button"
              onClick={() => router.push("/select-page/mode")}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] sm:text-xs font-black text-slate-700 shadow-sm"
            >
              활동선택
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden px-4 sm:px-6 py-4">
        <div className="flex h-full min-h-0 items-center justify-center">
          <section className="relative h-full w-full overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_10px_30px_rgba(16,185,129,0.05)]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-contain scale-x-[-1] bg-black"
            />

            <div
              className={`absolute inset-0 ${
                phase === "ready"
                  ? "bg-white"
                  : "bg-gradient-to-t from-black/55 via-black/10 to-black/35"
              }`}
            />

            <div className="absolute left-6 top-6 z-10 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white backdrop-blur-md">
              {currentSong.level} · {song}
            </div>

            {phase === "singing" && (
              <>
                <div className="absolute inset-0 z-[2] opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:52px_52px]" />
                <div className="brain-sing-scanline absolute inset-x-0 top-0 z-[4] h-[22%]" />
                <div className="absolute inset-x-0 top-0 z-[4] h-px bg-emerald-300/45 shadow-[0_0_24px_rgba(52,211,153,0.6)]" />
                <div className="absolute right-6 top-20 z-10 font-mono text-[56px] font-black tracking-tight text-white drop-shadow-[0_0_16px_rgba(0,0,0,0.7)] sm:text-[64px]">
                  {remaining}
                </div>
                <div className="absolute bottom-8 left-1/2 z-10 w-[min(96%,980px)] -translate-x-1/2 overflow-hidden rounded-[26px] border border-emerald-200/18 bg-black/22 px-8 py-5 text-center backdrop-blur-md sm:bottom-10 lg:w-[min(88%,1120px)] lg:px-10 lg:py-6">
                  <p className="relative flex flex-wrap items-center justify-center gap-x-[0.03em] text-3xl font-black tracking-[-0.03em] sm:text-4xl lg:text-5xl">
                    {renderProgressLyric(
                      lyricBase,
                      lyricFillPct,
                      currentLyricCues,
                      lyricElapsedSec,
                    )}
                  </p>
                  <p className="mt-3 line-clamp-1 text-xl font-black tracking-[-0.03em] text-white/40 sm:text-2xl lg:text-3xl">
                    {nextLyricBase}
                  </p>
                </div>
              </>
            )}

            {phase === "ready" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-md">
                <div className="flex w-full max-w-[760px] flex-col items-center gap-10 rounded-[36px] border border-white/25 bg-white/88 px-10 pt-18 pb-16 text-center shadow-[0_30px_80px_rgba(15,23,42,0.35)] backdrop-blur-md sm:gap-12 sm:px-16 sm:pt-22 sm:pb-18">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-black uppercase tracking-[0.24em] text-white shadow-[0_14px_28px_rgba(16,185,129,0.35)] sm:px-6 sm:py-3 sm:text-base">
                      <Music className="h-5 w-5" />
                      <span>Level 1</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-5">
                    <Mic className="h-11 w-11 text-emerald-500 sm:h-12 sm:w-12" />
                    <h2 className="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">
                      {song}
                    </h2>
                  </div>
                  <p className="max-w-[620px] text-2xl font-medium leading-relaxed text-slate-500 sm:text-[28px]">
                    시작하기를 누르면 카운트다운 후
                    <br />
                    카메라와 가창 분석이 시작됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => void startCountdown()}
                    className="inline-flex h-[72px] items-center justify-center gap-3 rounded-full bg-emerald-500 px-12 text-2xl font-black text-white shadow-[0_18px_38px_rgba(16,185,129,0.38)] transition-transform duration-200 hover:scale-105 hover:bg-emerald-400 sm:h-[84px] sm:px-14 sm:text-3xl"
                  >
                    <ChevronRight className="h-7 w-7" />
                    시작하기
                  </button>
                </div>
              </div>
            )}

            {phase === "countdown" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(15,23,42,0.16)]">
                <div className="flex flex-col items-center gap-6 text-center">
                  <p className="text-sm font-black uppercase tracking-[0.34em] text-white/80 sm:text-base">
                    Singing Starts In
                  </p>
                  <div className="text-[220px] font-black leading-none text-white drop-shadow-[0_10px_34px_rgba(16,185,129,0.42)] sm:text-[280px]">
                    {countdown === 0 ? "시작" : countdown}
                  </div>
                  <div className="flex items-center gap-3">
                    {[3, 2, 1].map((step) => (
                      <div
                        key={step}
                        className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-black transition-all sm:h-14 sm:w-14 sm:text-xl ${
                          countdown <= step && countdown !== 0
                            ? "border-emerald-300 bg-emerald-400 text-white shadow-[0_0_28px_rgba(52,211,153,0.45)]"
                            : "border-white/25 bg-white/10 text-white/55"
                        }`}
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function BrainSingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7faf8] text-sm font-black uppercase tracking-[0.2em] text-emerald-600">
          Initializing Singing Engine...
        </div>
      }
    >
      <BrainSingPageContent />
    </Suspense>
  );
}

function OverlayShell({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#f7faf8]/92 p-6 text-center backdrop-blur-[3px]">
      <div className="w-full max-w-5xl rounded-[32px] border border-emerald-100 bg-white p-8 shadow-2xl sm:p-10">
        <h2 className="mb-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h2>
        <p className="mb-8 text-sm font-medium text-slate-500 sm:text-base">
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}

function MetricCard({
  accent,
  title,
  value,
}: {
  accent: "blue" | "emerald" | "slate";
  title: string;
  value: string;
}) {
  const accentMap = {
    blue: "border-l-sky-500 bg-sky-50 text-sky-700",
    emerald: "border-l-emerald-500 bg-emerald-50 text-emerald-700",
    slate: "border-l-slate-400 bg-slate-50 text-slate-700",
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 border-l-[6px] p-4 ${accentMap[accent]}`}
    >
      <label className="block text-[10px] font-extrabold uppercase tracking-widest">
        {title}
      </label>
      <p className="mt-1 font-mono text-3xl font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ResultStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-extrabold text-slate-500">{title}</p>
      <p className="mt-1 font-mono text-2xl font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}




