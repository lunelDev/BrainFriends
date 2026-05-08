"use client";

import { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { SONG_KEYS, SONGS } from "@/features/sing-training/data/songs";
import { SongKey } from "@/features/sing-training/types";
import { generateBeatLyrics } from "@/features/sing-training/utils/generateBeatLyrics";

const DEFAULT_LYRICS = `나비야 나비야
이리 날아 오너라
호랑나비 흰나비
춤을 추며 오너라
봄바람에 꽃잎도
방긋 방긋 웃으며
참새도 짹 짹 짹
노래하며 춤춘다`;

const DEFAULT_BEAT_LINES = `둥글게 둥글게|0|0.25
둥글게 둥글게|2.52|0.25
빙글빙글 돌아가며|4.27|0.25`;

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export default function SingSyncManagerPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [songName, setSongName] = useState("나비야");
  const [lyricsText, setLyricsText] = useState(DEFAULT_LYRICS);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLabel, setAudioLabel] = useState("선택된 음원 없음");
  const [marks, setMarks] = useState<number[]>([]);
  const [captureUnit, setCaptureUnit] = useState<"syllable" | "line">("syllable");
  const [captureMode, setCaptureMode] = useState<"start-end" | "start-only">(
    "start-end",
  );
  const [isRecording, setIsRecording] = useState(false);
  const [lastMarkedAt, setLastMarkedAt] = useState<number | null>(null);
  const [spaceDurationMs, setSpaceDurationMs] = useState(100);
  const [lastDurationMs, setLastDurationMs] = useState(800);
  const [copied, setCopied] = useState(false);
  const [beatInput, setBeatInput] = useState(DEFAULT_BEAT_LINES);

  const lyricPresets = useMemo(
    () =>
      SONG_KEYS.map((key) => ({
        key,
        title: key,
        lyricsText: SONGS[key].lyrics.map((line) => line.txt).join("\n"),
      })),
    [],
  );

  const lines = useMemo(
    () =>
      lyricsText
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0),
    [lyricsText],
  );

  const syllableTargets = useMemo(
    () =>
      lines.flatMap((line, lineIndex) =>
        Array.from(line)
          .filter((char) => char !== " ")
          .map((char, charIndex) => ({
            char,
            lineIndex,
            charIndex,
            line,
          })),
      ),
    [lines],
  );

  const lineTargets = useMemo(
    () =>
      lines.map((line, lineIndex) => ({
        char: line,
        lineIndex,
        charIndex: 0,
        line,
      })),
    [lines],
  );

  const tapTargets = captureUnit === "line" ? lineTargets : syllableTargets;

  const markTargetCount =
    captureMode === "start-end" ? tapTargets.length * 2 : tapTargets.length;
  const nextTargetIndex =
    captureMode === "start-end" ? Math.floor(marks.length / 2) : marks.length;
  const nextTarget = tapTargets[nextTargetIndex] ?? null;
  const nextMarkLabel =
    captureMode === "start-end"
      ? marks.length % 2 === 0
        ? "시작"
        : "끝"
      : "시작";

  const output = useMemo(() => {
    let globalMarkIndex = 0;
    const result = lines.map((line) => {
      const chars = Array.from(line);
      const syllables: Array<{ char: string; start: number; duration: number }> =
        [];

      for (let i = 0; i < chars.length; i += 1) {
        const char = chars[i];
        if (char === " ") {
          continue;
        }

        const startMarkIndex =
          captureMode === "start-end" ? globalMarkIndex * 2 : globalMarkIndex;
        const start = marks[startMarkIndex];
        if (typeof start !== "number") {
          globalMarkIndex += 1;
          continue;
        }

        let spaceCountAfter = 0;
        let j = i + 1;
        while (j < chars.length && chars[j] === " ") {
          spaceCountAfter += 1;
          j += 1;
        }

        const explicitEnd =
          captureMode === "start-end" ? marks[startMarkIndex + 1] : undefined;
        const nextStart =
          captureMode === "start-only" ? marks[startMarkIndex + 1] : undefined;
        const reservedGap = spaceCountAfter * spaceDurationMs;
        const duration =
          typeof explicitEnd === "number"
            ? Math.max(50, explicitEnd - start)
            : typeof nextStart === "number"
            ? Math.max(50, nextStart - start - reservedGap)
            : lastDurationMs;

        syllables.push({
          char,
          start,
          duration,
        });

        let blankStart = start + duration;
        for (let k = 0; k < spaceCountAfter; k += 1) {
          syllables.push({
            char: " ",
            start: blankStart,
            duration: spaceDurationMs,
          });
          blankStart += spaceDurationMs;
        }

        globalMarkIndex += 1;
      }

      const first = syllables[0];
      const last = syllables[syllables.length - 1];
      const lineStart = first ? first.start : 0;
      const lineEnd = last ? last.start + last.duration : lineStart;

      return {
        txt: line,
        t: round(lineStart / 1000, 2),
        d: round((lineEnd - lineStart) / 1000, 2),
        cues: syllables.map((item) => ({
          syllable: item.char,
          start: round((item.start - lineStart) / 1000, 2),
          end: round((item.start + item.duration - lineStart) / 1000, 2),
        })),
      };
    });

    return JSON.stringify(result, null, 2);
  }, [captureMode, lastDurationMs, lines, marks, spaceDurationMs]);

  const lineOutput = useMemo(() => {
    const result = lines.map((line, index) => {
      const start = marks[index];
      if (typeof start !== "number") {
        return null;
      }

      const nextStart = marks[index + 1];
      const duration =
        typeof nextStart === "number"
          ? Math.max(50, nextStart - start)
          : lastDurationMs;

      return {
        txt: line,
        t: round(start / 1000, 2),
        d: round(duration / 1000, 2),
      };
    }).filter(Boolean);

    return JSON.stringify(result, null, 2);
  }, [lastDurationMs, lines, marks]);

  const beatOutput = useMemo(() => {
    const parsed = beatInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [text, t, beat] = line.split("|");
        return {
          line: text,
          t: Number(t),
          beat: Number(beat),
        };
      })
      .filter((item) => item.line && Number.isFinite(item.t) && Number.isFinite(item.beat));

    return JSON.stringify(generateBeatLyrics(parsed), null, 2);
  }, [beatInput]);

  const recordMark = () => {
    if (!audioRef.current || !audioUrl) return;
    if (marks.length >= markTargetCount) return;
    const nowMs = Math.round(audioRef.current.currentTime * 1000);
    setMarks((prev) => [...prev, nowMs]);
    setLastMarkedAt(nowMs);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "TEXTAREA"].includes(target.tagName)
      ) {
        return;
      }
      event.preventDefault();
      recordMark();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.load();
  }, [audioUrl]);

  const handleAudioFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setAudioUrl(url);
    setAudioLabel(file.name);
    setMarks([]);
    setIsRecording(false);
  };

  const handlePresetChange = (key: SongKey) => {
    const preset = lyricPresets.find((item) => item.key === key);
    if (!preset) return;
    setSongName(preset.title);
    setLyricsText(preset.lyricsText);
    setMarks([]);
    setIsRecording(false);
    setLastMarkedAt(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleToggleRecording = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isRecording) {
      audio.pause();
      setIsRecording(false);
      return;
    }

    audio.currentTime = 0;
    setMarks([]);
    try {
      await audio.play();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  const handleUndo = () => {
    setMarks((prev) => prev.slice(0, -1));
    setLastMarkedAt(null);
  };

  const handleReset = () => {
    setMarks([]);
    setIsRecording(false);
    setLastMarkedAt(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleLyricsKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.code === "Space" && isRecording) {
      event.preventDefault();
      recordMark();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur xl:order-2">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-emerald-300">
            Sync Manager
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">
            노래 훈련 싱크 매니저
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            음원을 재생한 뒤 음절이 들릴 때마다 <span className="font-black text-white">Space</span> 를 누르세요.
            결과는 현재 앱에서 바로 붙일 수 있는 JSON으로 출력됩니다.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <span className="mb-2 block text-sm font-black text-slate-200">가사 프리셋</span>
              <div className="flex flex-wrap gap-2">
                {lyricPresets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handlePresetChange(preset.key)}
                    className={`rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                      songName === preset.title
                        ? "border-emerald-300 bg-emerald-500 text-white"
                        : "border-white/10 bg-slate-900 text-slate-300"
                    }`}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-200">곡명</span>
              <input
                value={songName}
                onChange={(event) => setSongName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-base font-bold text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-200">가사</span>
              <textarea
                value={lyricsText}
                onChange={(event) => setLyricsText(event.target.value)}
                onKeyDown={handleLyricsKeyDown}
                rows={10}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-base leading-relaxed text-white outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCaptureUnit("line");
                    setMarks([]);
                    setLastMarkedAt(null);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                    captureUnit === "line"
                      ? "border-sky-300 bg-sky-500 text-white"
                      : "border-white/10 bg-slate-900 text-slate-300"
                  }`}
                >
                  문장 단위
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureUnit("syllable");
                    setMarks([]);
                    setLastMarkedAt(null);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                    captureUnit === "syllable"
                      ? "border-sky-300 bg-sky-500 text-white"
                      : "border-white/10 bg-slate-900 text-slate-300"
                  }`}
                >
                  음절 단위
                </button>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCaptureMode("start-end")}
                  disabled={captureUnit === "line"}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                    captureMode === "start-end"
                      ? "border-emerald-300 bg-emerald-500 text-white"
                      : "border-white/10 bg-slate-900 text-slate-300"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  시작/끝 직접 기록
                </button>
                <button
                  type="button"
                  onClick={() => setCaptureMode("start-only")}
                  disabled={captureUnit === "line"}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                    captureMode === "start-only"
                      ? "border-emerald-300 bg-emerald-500 text-white"
                      : "border-white/10 bg-slate-900 text-slate-300"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  시작만 기록
                </button>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-200">공백 길이(ms)</span>
                <input
                  type="number"
                  value={spaceDurationMs}
                  onChange={(event) => setSpaceDurationMs(Number(event.target.value) || 100)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-base font-bold text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-200">마지막 길이(ms)</span>
                <input
                  type="number"
                  value={lastDurationMs}
                  onChange={(event) => setLastDurationMs(Number(event.target.value) || 800)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-base font-bold text-white outline-none"
                />
              </label>
            </div>
          </div>

          <section className="mt-6 rounded-[28px] border border-emerald-400/20 bg-emerald-500/10 p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
              Audio
            </p>
            <h2 className="mt-2 text-xl font-black text-white">음원 파일</h2>
            <label className="mt-4 block">
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.aac,.flac,audio/*"
                onChange={handleAudioFile}
                className="block w-full text-sm text-slate-300"
              />
              <p className="mt-2 text-xs font-semibold text-slate-300">{audioLabel}</p>
            </label>

            <audio
              ref={audioRef}
              src={audioUrl}
              controls
              className="mt-4 w-full"
              onEnded={() => setIsRecording(false)}
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleToggleRecording()}
                disabled={!audioUrl}
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {isRecording ? "재생 중지" : "처음부터 재생 + 기록"}
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={marks.length === 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:text-slate-500"
              >
                마지막 입력 취소
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white"
              >
                초기화
              </button>
            </div>
          </section>

          <button
            type="button"
            onClick={recordMark}
            disabled={!audioUrl || marks.length >= markTargetCount}
            className="mt-5 flex h-28 w-full items-center justify-center rounded-[28px] border border-emerald-300/30 bg-gradient-to-r from-emerald-500 to-emerald-400 text-2xl font-black text-white shadow-[0_24px_50px_rgba(16,185,129,0.35)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-700 disabled:text-slate-400"
          >
            {captureUnit === "line" ? "문장 시작 기록" : `음절 ${nextMarkLabel} 기록`}
          </button>

          <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-300">
            <p className="font-black text-white">사용 방법</p>
            <p className="mt-2">
              1. 음원을 넣고 <span className="font-black text-emerald-300">처음부터 재생 + 기록</span> 을 누릅니다.
            </p>
            <p>
              2. <span className="font-black text-emerald-300">문장 단위</span> 는 각 줄이 시작되는 순간만 누릅니다.
            </p>
            <p>
              3. <span className="font-black text-emerald-300">음절 단위</span> 는 시작/끝 직접 기록 또는 시작만 기록을 선택해 씁니다.
            </p>
            <p>
              4. `공백 길이(ms)` 는 띄어쓰기 칸 길이, `마지막 길이(ms)` 는 마지막 문장/음절 기본 길이입니다.
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
              Recording Status
            </p>
            <p className="mt-3 text-2xl font-black text-white">
              {marks.length} / {markTargetCount}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              마지막 기록:{" "}
              <span className="font-black text-white">
                {lastMarkedAt === null ? "-" : `${lastMarkedAt}ms`}
              </span>
            </p>
            <p className="mt-2 text-sm text-slate-300">
              상태:{" "}
              <span className="font-black text-white">
                {!audioUrl ? "음원 없음" : audioRef.current?.paused ? "일시정지" : "재생 중"}
              </span>
            </p>
            <p className="mt-2 text-sm text-slate-300">
              다음 입력:{" "}
              {nextTarget ? (
                <span className="font-black text-white">
                  {captureUnit === "line" ? nextTarget.line : `${nextTarget.char} ${nextMarkLabel}`} ({nextTarget.lineIndex + 1}번째 줄)
                </span>
              ) : (
                <span className="font-black text-emerald-300">완료</span>
              )}
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur xl:order-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-emerald-300">
                Output
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                `{songName}` JSON
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900"
            >
              {copied ? "복사됨" : "JSON 복사"}
            </button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm font-black text-white">입력된 타임스탬프(ms)</p>
              <div className="mt-3 max-h-[480px] overflow-auto rounded-2xl bg-black/30 p-3 text-sm text-emerald-200">
                {marks.length === 0 ? "아직 입력 없음" : marks.join(", ")}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm font-black text-white">songs.ts 적용용 JSON</p>
              <pre className="mt-3 max-h-[480px] overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-relaxed text-slate-200">
                {captureUnit === "line" ? lineOutput : output}
              </pre>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur xl:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-emerald-300">
            Beat Generator
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            문장 시작 시간 + 박자만으로 JSON 생성
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            형식은 <span className="font-black text-white">문장|시작초|박자초</span> 입니다.
            같은 문장 반복 구간은 이 방식이 훨씬 짧습니다.
          </p>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm font-black text-white">입력</p>
              <textarea
                value={beatInput}
                onChange={(event) => setBeatInput(event.target.value)}
                rows={8}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed text-slate-200 outline-none"
              />
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm font-black text-white">출력 JSON</p>
              <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-relaxed text-slate-200">
                {beatOutput}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
