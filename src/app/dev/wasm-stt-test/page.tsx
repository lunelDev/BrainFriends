"use client";

// /dev/wasm-stt-test — 실제 브라우저에서 WASM Whisper-tiny 동작 검증 + RTF 측정.
// dev 환경에서만 사용 (production 에서는 라우팅에서 차단 권장).

import { useCallback, useEffect, useState } from "react";
import {
  isWasmSttAvailable,
  transcribeWithWasmStt,
  WASM_STT_ENGINE_VERSION,
  WASM_STT_MODEL_ID,
  WASM_STT_SAMPLE_RATE,
} from "@/lib/speech/wasmSttAdapter";
import {
  INITIAL_WASM_STT_LOADING_STATE,
  markFailed,
  markReady,
  startLoading,
  type WasmSttLoadingState,
} from "@/lib/speech/wasmSttLoadingState";
import WasmSttLoadingIndicator from "@/components/training/WasmSttLoadingIndicator";

interface TestResult {
  sampleId: string;
  age: number;
  severity: string;
  deviceType: string;
  noise: "low" | "mid" | "high";
  lighting: "bright" | "normal" | "dim";
  groundTruth: string;
  recordedAt: string;
  durationMs: number;
  processingMs: number;
  rtf: number;
  text: string;
  confidence: number;
  engineVersion: string;
}

const DEFAULT_SAMPLE_PREFIX = "BF-STT";

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toWerCsv(results: TestResult[]): string {
  const rows = [
    [
      "sample_id",
      "age",
      "severity",
      "device_type",
      "noise",
      "lighting",
      "ground_truth",
      "transcript",
    ],
    ...results
      .slice()
      .reverse()
      .map((r) => [
        r.sampleId,
        r.age,
        r.severity,
        r.deviceType,
        r.noise,
        r.lighting,
        r.groundTruth,
        r.text,
      ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function toRtfCsv(results: TestResult[]): string {
  const rows = [
    [
      "sample_id",
      "age",
      "severity",
      "device_type",
      "noise",
      "audio_duration_ms",
      "processing_ms",
    ],
    ...results
      .slice()
      .reverse()
      .map((r) => [
        r.sampleId,
        r.age,
        r.severity,
        r.deviceType,
        r.noise,
        r.durationMs,
        r.processingMs,
      ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export default function WasmSttTestPage() {
  const [loadingState, setLoadingState] = useState<WasmSttLoadingState>(
    INITIAL_WASM_STT_LOADING_STATE,
  );
  const [wasmAvailable, setWasmAvailable] = useState<boolean | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [recording, setRecording] = useState(false);
  const [sampleId, setSampleId] = useState(`${DEFAULT_SAMPLE_PREFIX}-001`);
  const [age, setAge] = useState(70);
  const [severity, setSeverity] = useState("moderate");
  const [deviceType, setDeviceType] = useState("desktop-chrome");
  const [noise, setNoise] = useState<"low" | "mid" | "high">("low");
  const [lighting, setLighting] = useState<"bright" | "normal" | "dim">(
    "normal",
  );
  const [groundTruth, setGroundTruth] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(3);

  useEffect(() => {
    setWasmAvailable(isWasmSttAvailable());
  }, []);

  const canRun =
    !recording &&
    sampleId.trim().length > 0 &&
    groundTruth.trim().length > 0 &&
    Number.isFinite(age) &&
    age > 0;

  const incrementSampleId = useCallback(() => {
    const match = sampleId.match(/^(.*?)(\d+)$/);
    if (!match) return;
    const [, prefix, rawNumber] = match;
    const nextNumber = String(Number.parseInt(rawNumber, 10) + 1).padStart(
      rawNumber.length,
      "0",
    );
    setSampleId(`${prefix}${nextNumber}`);
  }, [sampleId]);

  const runTest = useCallback(async () => {
    if (!canRun) return;
    if (!isWasmSttAvailable()) {
      setLoadingState((prev) =>
        markFailed(
          startLoading(prev, {
            modelId: WASM_STT_MODEL_ID,
            startedAtMs: Date.now(),
          }),
          {
            errorCode: "wasm_stt_unavailable",
            finishedAtMs: Date.now(),
          },
        ),
      );
      return;
    }
    const currentSample = {
      sampleId: sampleId.trim(),
      age,
      severity: severity.trim() || "unknown",
      deviceType: deviceType.trim() || "unknown",
      noise,
      lighting,
      groundTruth: groundTruth.trim(),
      durationMs: recordingSeconds * 1000,
    };
    setRecording(true);
    setLoadingState((prev) =>
      startLoading(prev, {
        modelId: WASM_STT_MODEL_ID,
        startedAtMs: Date.now(),
      }),
    );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      const stopPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: "audio/webm" }));
        };
      });
      recorder.start();
      await new Promise((r) => setTimeout(r, currentSample.durationMs));
      recorder.stop();
      const blob = await stopPromise;

      const tStart = performance.now();
      const result = await transcribeWithWasmStt(blob, {
        useCase: "daily_training",
      });
      const tEnd = performance.now();
      const processingMs = tEnd - tStart;

      setResults((prev) => [
        {
          ...currentSample,
          recordedAt: new Date().toISOString(),
          processingMs: Math.round(processingMs * 10) / 10,
          rtf:
            Math.round((processingMs / currentSample.durationMs) * 10000) /
            10000,
          text: result.text,
          confidence: result.confidence,
          engineVersion: result.engineVersion,
        },
        ...prev,
      ]);

      setLoadingState((prev) => markReady(prev, { finishedAtMs: Date.now() }));
      incrementSampleId();
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown_error";
      setLoadingState((prev) =>
        markFailed(prev, { errorCode: code, finishedAtMs: Date.now() }),
      );
    } finally {
      setRecording(false);
    }
  }, [
    age,
    canRun,
    deviceType,
    groundTruth,
    incrementSampleId,
    lighting,
    noise,
    recordingSeconds,
    sampleId,
    severity,
  ]);

  const downloadWerCsv = useCallback(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`brainfriends-wasm-stt-wer-${stamp}.csv`, toWerCsv(results));
  }, [results]);

  const downloadRtfCsv = useCallback(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`brainfriends-wasm-stt-rtf-${stamp}.csv`, toRtfCsv(results));
  }, [results]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-2 text-2xl font-bold">WASM STT 검증 페이지 (DEV)</h1>
      <p className="mb-4 text-sm text-gray-600">
        모델: <code>{WASM_STT_MODEL_ID}</code> · sampleRate{" "}
        {WASM_STT_SAMPLE_RATE}Hz · engine{" "}
        <code className="text-xs">{WASM_STT_ENGINE_VERSION}</code>
      </p>
      <p className="mb-4 text-sm text-gray-600">
        isWasmSttAvailable():{" "}
        <strong>{wasmAvailable === null ? "확인 중" : String(wasmAvailable)}</strong>
      </p>

      <section className="mb-4 grid gap-3 rounded border border-gray-200 p-4 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">sample_id</span>
          <input
            value={sampleId}
            onChange={(e) => setSampleId(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">age</span>
          <input
            type="number"
            min={1}
            value={age}
            onChange={(e) => setAge(Number.parseInt(e.target.value, 10) || 0)}
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">severity</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="mild">mild</option>
            <option value="moderate">moderate</option>
            <option value="severe">severe</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">device_type</span>
          <input
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">noise</span>
          <select
            value={noise}
            onChange={(e) =>
              setNoise(e.target.value as "low" | "mid" | "high")
            }
            className="w-full rounded border px-3 py-2"
          >
            <option value="low">low</option>
            <option value="mid">mid</option>
            <option value="high">high</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">lighting</span>
          <select
            value={lighting}
            onChange={(e) =>
              setLighting(e.target.value as "bright" | "normal" | "dim")
            }
            className="w-full rounded border px-3 py-2"
          >
            <option value="bright">bright</option>
            <option value="normal">normal</option>
            <option value="dim">dim</option>
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block font-medium">ground_truth</span>
          <input
            value={groundTruth}
            onChange={(e) => setGroundTruth(e.target.value)}
            placeholder="예: 오늘 날씨가 좋네요"
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">recording seconds</span>
          <select
            value={recordingSeconds}
            onChange={(e) =>
              setRecordingSeconds(Number.parseInt(e.target.value, 10))
            }
            className="w-full rounded border px-3 py-2"
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </label>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runTest}
          disabled={!canRun}
          className="rounded bg-indigo-600 px-4 py-2 text-white disabled:bg-gray-400"
        >
          {recording ? `녹음 중 (${recordingSeconds}초)…` : "녹음 + 전사"}
        </button>
        <button
          type="button"
          onClick={downloadWerCsv}
          disabled={results.length === 0}
          className="rounded border border-gray-300 px-4 py-2 disabled:text-gray-400"
        >
          WER/CER CSV 다운로드
        </button>
        <button
          type="button"
          onClick={downloadRtfCsv}
          disabled={results.length === 0}
          className="rounded border border-gray-300 px-4 py-2 disabled:text-gray-400"
        >
          RTF CSV 다운로드
        </button>
        <button
          type="button"
          onClick={() => setResults([])}
          disabled={results.length === 0 || recording}
          className="rounded border border-gray-300 px-4 py-2 disabled:text-gray-400"
        >
          결과 비우기
        </button>
      </div>

      <WasmSttLoadingIndicator
        state={loadingState}
        onRetry={() => setLoadingState(INITIAL_WASM_STT_LOADING_STATE)}
        className="mb-4"
      />

      <h2 className="mb-2 text-lg font-bold">최근 결과</h2>
      {results.length === 0 ? (
        <p className="text-sm text-gray-500">아직 결과가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-2">sample</th>
                <th className="p-2">시각</th>
                <th className="p-2">ground truth</th>
                <th className="p-2">transcript</th>
                <th className="p-2">duration ms</th>
                <th className="p-2">processing ms</th>
                <th className="p-2">RTF</th>
                <th className="p-2">meta</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.sampleId}</td>
                  <td className="p-2 text-xs">
                    {r.recordedAt.slice(11, 19)}
                  </td>
                  <td className="p-2">{r.groundTruth}</td>
                  <td className="p-2">{r.text || <em>(빈 결과)</em>}</td>
                  <td className="p-2">{r.durationMs}</td>
                  <td className="p-2">{r.processingMs}</td>
                  <td className="p-2">{r.rtf}</td>
                  <td className="p-2 text-xs text-gray-600">
                    {r.age} / {r.severity} / {r.noise} / {r.lighting}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
