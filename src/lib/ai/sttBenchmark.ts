// SR-AI-RTF-RUNNER. STT 성능 벤치마크 (RTF / latency percentile) 결정성 helper.
//
// 식약처 AI 적용 디지털의료기기 가이드라인 PDF #2 §III.2 성능 검증의
// "응답 시간" 산출물 + 제품기획서 "P95 41.5ms" 정량 클레임 검증 도구.
//
// RTF (Real-Time Factor) = processingMs / audioDurationMs.
// RTF < 1.0 = 실시간보다 빠름. RTF ≥ 1.0 = 실시간 대기 시간 증가.
//
// 본 모듈은 dry-run — 실제 측정은 브라우저 (WASM Whisper) 또는 서버 (OpenAI) 가
// 진행하고, 측정 결과 (audioDurationMs, processingMs) 만 CSV 로 입력 받는다.

export type RtfNoiseLevel = "low" | "mid" | "high";
export type RtfAgeGroup = "60s" | "70s" | "80s" | "other";

export interface RtfSampleInput {
  sampleId: string;
  age: number;
  severity: string;
  deviceType: string;
  noiseLevel: RtfNoiseLevel;
  audioDurationMs: number;
  processingMs: number;
}

export interface RtfSample extends RtfSampleInput {
  ageGroup: RtfAgeGroup;
  rtf: number;
  /** P95 41.5ms 클레임의 통과 여부 (processingMs ≤ 41.5). */
  passesP95Target: boolean;
}

export interface LatencyAggregate {
  total: number;
  meanRtf: number;
  meanLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  /** P95 41.5ms 통과율 — claim-lock §4 검증 지표 */
  passRateP95Target: number;
}

export interface RtfStratifiedSummary {
  overall: LatencyAggregate;
  byAgeGroup: Record<string, LatencyAggregate>;
  bySeverity: Record<string, LatencyAggregate>;
  byNoise: Record<string, LatencyAggregate>;
  byDevice: Record<string, LatencyAggregate>;
}

export interface RtfBenchmarkReport {
  generatedAt: string;
  datasetId: string;
  modelId: string;
  /** P95 41.5ms (제품기획서 기준) — 호출자가 override 가능. */
  p95TargetMs: number;
  rowCount: number;
  rows: RtfSample[];
  summary: RtfStratifiedSummary;
}

const DEFAULT_P95_TARGET_MS = 41.5 as const;

function round4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

function isNoiseLevel(value: string): value is RtfNoiseLevel {
  return value === "low" || value === "mid" || value === "high";
}

export function classifyRtfAgeGroup(age: number): RtfAgeGroup {
  if (!Number.isFinite(age)) return "other";
  if (age >= 60 && age < 70) return "60s";
  if (age >= 70 && age < 80) return "70s";
  if (age >= 80 && age < 100) return "80s";
  return "other";
}

/** Linear interpolated percentile. Stable on equal values. */
export function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const clamped = Math.max(0, Math.min(1, p));
  const idx = clamped * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

export function aggregateLatency(
  samples: readonly RtfSample[],
  p95TargetMs: number,
): LatencyAggregate {
  if (samples.length === 0) {
    return {
      total: 0,
      meanRtf: 0,
      meanLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      passRateP95Target: 0,
    };
  }
  const sortedLatency = samples
    .map((s) => s.processingMs)
    .sort((a, b) => a - b);
  const meanRtf = samples.reduce((s, x) => s + x.rtf, 0) / samples.length;
  const meanLatency =
    samples.reduce((s, x) => s + x.processingMs, 0) / samples.length;
  const passing = samples.filter((s) => s.processingMs <= p95TargetMs).length;
  return {
    total: samples.length,
    meanRtf: round4(meanRtf),
    meanLatencyMs: round4(meanLatency),
    p50LatencyMs: round4(percentile(sortedLatency, 0.5)),
    p95LatencyMs: round4(percentile(sortedLatency, 0.95)),
    p99LatencyMs: round4(percentile(sortedLatency, 0.99)),
    passRateP95Target: round4(passing / samples.length),
  };
}

const REQUIRED_COLUMNS = [
  "sample_id",
  "age",
  "severity",
  "device_type",
  "noise",
  "audio_duration_ms",
  "processing_ms",
] as const;

function splitCsvLine(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      tokens.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  tokens.push(current);
  return tokens;
}

export interface ParseRtfCsvResult {
  ok: boolean;
  rows: RtfSampleInput[];
  errors: string[];
}

export function parseRtfCsv(content: string): ParseRtfCsvResult {
  const errors: string[] = [];
  const rows: RtfSampleInput[] = [];
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { ok: false, rows, errors: ["empty_csv"] };
  }
  const header = splitCsvLine(lines[0]).map((t) => t.trim().toLowerCase());
  const indexByCol = new Map<string, number>();
  header.forEach((c, i) => indexByCol.set(c, i));
  for (const required of REQUIRED_COLUMNS) {
    if (!indexByCol.has(required)) errors.push(`missing_column:${required}`);
  }
  if (errors.length > 0) return { ok: false, rows, errors };

  const get = (toks: string[], col: string): string => {
    const idx = indexByCol.get(col);
    if (idx === undefined || idx >= toks.length) return "";
    return toks[idx].trim();
  };

  for (let i = 1; i < lines.length; i++) {
    const toks = splitCsvLine(lines[i]);
    const sampleId = get(toks, "sample_id");
    if (!sampleId) {
      errors.push(`line_${i + 1}:missing_sample_id`);
      continue;
    }
    const age = Number.parseInt(get(toks, "age"), 10);
    if (!Number.isFinite(age)) {
      errors.push(`line_${i + 1}:invalid_age`);
      continue;
    }
    const audioDurationMs = Number.parseFloat(get(toks, "audio_duration_ms"));
    const processingMs = Number.parseFloat(get(toks, "processing_ms"));
    if (!Number.isFinite(audioDurationMs) || audioDurationMs <= 0) {
      errors.push(`line_${i + 1}:invalid_audio_duration_ms`);
      continue;
    }
    if (!Number.isFinite(processingMs) || processingMs < 0) {
      errors.push(`line_${i + 1}:invalid_processing_ms`);
      continue;
    }
    const noise = get(toks, "noise").toLowerCase();
    if (!isNoiseLevel(noise)) {
      errors.push(`line_${i + 1}:invalid_noise:${noise}`);
      continue;
    }
    rows.push({
      sampleId,
      age,
      severity: get(toks, "severity"),
      deviceType: get(toks, "device_type"),
      noiseLevel: noise,
      audioDurationMs,
      processingMs,
    });
  }
  rows.sort((a, b) => a.sampleId.localeCompare(b.sampleId));
  return { ok: errors.length === 0, rows, errors };
}

function bucketAggregate(
  rows: readonly RtfSample[],
  keyFn: (row: RtfSample) => string,
  p95TargetMs: number,
): Record<string, LatencyAggregate> {
  const buckets = new Map<string, RtfSample[]>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }
  const result: Record<string, LatencyAggregate> = {};
  for (const key of Array.from(buckets.keys()).sort((a, b) =>
    a.localeCompare(b),
  )) {
    result[key] = aggregateLatency(buckets.get(key)!, p95TargetMs);
  }
  return result;
}

export function evaluateRtfRows(params: {
  rows: RtfSampleInput[];
  generatedAt: string;
  datasetId: string;
  modelId: string;
  p95TargetMs?: number;
}): RtfBenchmarkReport {
  const target = params.p95TargetMs ?? DEFAULT_P95_TARGET_MS;
  const enriched: RtfSample[] = params.rows
    .map((row) => ({
      ...row,
      ageGroup: classifyRtfAgeGroup(row.age),
      rtf: round4(row.processingMs / row.audioDurationMs),
      passesP95Target: row.processingMs <= target,
    }))
    .sort((a, b) => a.sampleId.localeCompare(b.sampleId));
  return {
    generatedAt: params.generatedAt,
    datasetId: params.datasetId,
    modelId: params.modelId,
    p95TargetMs: target,
    rowCount: enriched.length,
    rows: enriched,
    summary: {
      overall: aggregateLatency(enriched, target),
      byAgeGroup: bucketAggregate(enriched, (r) => r.ageGroup, target),
      bySeverity: bucketAggregate(
        enriched,
        (r) => r.severity || "unknown",
        target,
      ),
      byNoise: bucketAggregate(enriched, (r) => r.noiseLevel, target),
      byDevice: bucketAggregate(
        enriched,
        (r) => r.deviceType || "unknown",
        target,
      ),
    },
  };
}

function sortKeysReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

export function serializeRtfReportJson(report: RtfBenchmarkReport): string {
  return JSON.stringify(report, sortKeysReplacer, 2);
}

export function serializeRtfReportMarkdown(report: RtfBenchmarkReport): string {
  const lines: string[] = [];
  lines.push("# STT 성능 벤치마크 (RTF / latency) 리포트");
  lines.push("");
  lines.push(`- generatedAt: ${report.generatedAt}`);
  lines.push(`- datasetId: ${report.datasetId}`);
  lines.push(`- modelId: ${report.modelId}`);
  lines.push(`- p95TargetMs: ${report.p95TargetMs}`);
  lines.push(`- rowCount: ${report.rowCount}`);
  lines.push("");
  lines.push("## Overall");
  lines.push("");
  const o = report.summary.overall;
  lines.push(
    "| total | meanRtf | meanMs | p50Ms | p95Ms | p99Ms | passRateP95Target |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  lines.push(
    `| ${o.total} | ${o.meanRtf} | ${o.meanLatencyMs} | ${o.p50LatencyMs} | ${o.p95LatencyMs} | ${o.p99LatencyMs} | ${o.passRateP95Target} |`,
  );
  lines.push("");
  const renderBucket = (
    title: string,
    bucket: Record<string, LatencyAggregate>,
  ) => {
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(
      "| key | total | meanRtf | meanMs | p50Ms | p95Ms | p99Ms | passRateP95Target |",
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const k of Object.keys(bucket).sort()) {
      const a = bucket[k];
      lines.push(
        `| ${k} | ${a.total} | ${a.meanRtf} | ${a.meanLatencyMs} | ${a.p50LatencyMs} | ${a.p95LatencyMs} | ${a.p99LatencyMs} | ${a.passRateP95Target} |`,
      );
    }
    lines.push("");
  };
  renderBucket("By Age Group", report.summary.byAgeGroup);
  renderBucket("By Severity", report.summary.bySeverity);
  renderBucket("By Noise Level", report.summary.byNoise);
  renderBucket("By Device", report.summary.byDevice);
  return lines.join("\n");
}
