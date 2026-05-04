// SR-AI-EVAL-RUNNER. AI 음성 인식 성능평가 (WER/CER) 결정성 runner.
//
// 식약처 AI 적용 디지털의료기기 가이드라인 PDF #2 §III.2 "성능 검증" 산출물 +
// 제품기획서 "WER 15% 이하" 정량 클레임 (claim-lock §4 → §3 승격 조건) 검증 도구.
//
// 본 모듈은 dry-run 모드 — ground truth 와 사전 수집된 hypothesis (서버 Whisper /
// WASM Whisper / 사람 전사) 를 입력 받아 WER/CER 을 결정성으로 산출한다.
// 실제 STT 호출은 브라우저 (WASM) 또는 서버 (OpenAI) 가 담당.

import {
  aggregateWer,
  calculateWer,
  type WerAggregate,
  type WerResult,
} from "./werCalculator";

export type AgeGroup = "60s" | "70s" | "80s" | "other";
export type NoiseLevel = "low" | "mid" | "high";
export type LightingLevel = "bright" | "normal" | "dim";

export interface WerEvaluationInputRow {
  sampleId: string;
  age: number;
  /** mild | moderate | severe — 자유 문자열 허용 (ground truth label) */
  severity: string;
  deviceType: string;
  noiseLevel: NoiseLevel;
  lighting: LightingLevel;
  reference: string;
  hypothesis: string;
}

export interface WerEvaluationRow extends WerEvaluationInputRow {
  ageGroup: AgeGroup;
  wer: number;
  cer: number;
  passes15: boolean;
}

export interface WerStratifiedSummary {
  overall: WerAggregate;
  byAgeGroup: Record<string, WerAggregate>;
  bySeverity: Record<string, WerAggregate>;
  byNoise: Record<string, WerAggregate>;
  byDevice: Record<string, WerAggregate>;
}

export interface WerEvaluationReport {
  /** ISO 8601, 호출자 제공 (결정성을 위해 외부 주입) */
  generatedAt: string;
  datasetId: string;
  modelId: string;
  rowCount: number;
  rows: WerEvaluationRow[];
  summary: WerStratifiedSummary;
}

/** 60~80대 분포 명시. */
export function classifyAgeGroup(age: number): AgeGroup {
  if (!Number.isFinite(age)) return "other";
  if (age >= 60 && age < 70) return "60s";
  if (age >= 70 && age < 80) return "70s";
  if (age >= 80 && age < 100) return "80s";
  return "other";
}

function isNoiseLevel(value: string): value is NoiseLevel {
  return value === "low" || value === "mid" || value === "high";
}

function isLightingLevel(value: string): value is LightingLevel {
  return value === "bright" || value === "normal" || value === "dim";
}

/**
 * 단일 CSV 라인을 split (RFC 4180 quoted field 지원).
 * 결정성: 동일 라인 → 동일 토큰 배열.
 */
export function splitCsvLine(line: string): string[] {
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

const REQUIRED_COLUMNS = [
  "sample_id",
  "age",
  "severity",
  "device_type",
  "noise",
  "lighting",
  "ground_truth",
  "transcript",
] as const;

export interface ParseCsvResult {
  ok: boolean;
  rows: WerEvaluationInputRow[];
  errors: string[];
}

/**
 * CSV 파싱. 헤더 필수: sample_id, age, severity, device_type, noise, lighting,
 * ground_truth, transcript. 추가 컬럼은 무시. 결정성: 동일 입력 → 동일 출력.
 */
export function parseWerCsv(content: string): ParseCsvResult {
  const errors: string[] = [];
  const rows: WerEvaluationInputRow[] = [];

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { ok: false, rows, errors: ["empty_csv"] };
  }

  const headerTokens = splitCsvLine(lines[0]).map((token) =>
    token.trim().toLowerCase(),
  );
  const indexByCol = new Map<string, number>();
  headerTokens.forEach((col, idx) => indexByCol.set(col, idx));
  for (const required of REQUIRED_COLUMNS) {
    if (!indexByCol.has(required)) {
      errors.push(`missing_column:${required}`);
    }
  }
  if (errors.length > 0) {
    return { ok: false, rows, errors };
  }

  const get = (tokens: string[], col: string): string => {
    const idx = indexByCol.get(col);
    if (idx === undefined || idx >= tokens.length) return "";
    return tokens[idx].trim();
  };

  for (let lineNo = 1; lineNo < lines.length; lineNo++) {
    const tokens = splitCsvLine(lines[lineNo]);
    const sampleId = get(tokens, "sample_id");
    if (!sampleId) {
      errors.push(`line_${lineNo + 1}:missing_sample_id`);
      continue;
    }
    const ageRaw = get(tokens, "age");
    const age = Number.parseInt(ageRaw, 10);
    if (!Number.isFinite(age)) {
      errors.push(`line_${lineNo + 1}:invalid_age:${ageRaw}`);
      continue;
    }
    const noise = get(tokens, "noise").toLowerCase();
    if (!isNoiseLevel(noise)) {
      errors.push(`line_${lineNo + 1}:invalid_noise:${noise}`);
      continue;
    }
    const lighting = get(tokens, "lighting").toLowerCase();
    if (!isLightingLevel(lighting)) {
      errors.push(`line_${lineNo + 1}:invalid_lighting:${lighting}`);
      continue;
    }

    rows.push({
      sampleId,
      age,
      severity: get(tokens, "severity"),
      deviceType: get(tokens, "device_type"),
      noiseLevel: noise,
      lighting,
      reference: get(tokens, "ground_truth"),
      hypothesis: get(tokens, "transcript"),
    });
  }

  // 결정성: sampleId 알파벳 정렬.
  rows.sort((a, b) => a.sampleId.localeCompare(b.sampleId));

  return { ok: errors.length === 0, rows, errors };
}

function bucketAggregate(
  rows: WerEvaluationRow[],
  keyFn: (row: WerEvaluationRow) => string,
): Record<string, WerAggregate> {
  const buckets = new Map<string, WerResult[]>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push({
      reference: row.reference,
      hypothesis: row.hypothesis,
      wer: row.wer,
      cer: row.cer,
      refWords: 0,
      hypWords: 0,
      refChars: 0,
      hypChars: 0,
      wordEdits: 0,
      charEdits: 0,
    });
  }
  const result: Record<string, WerAggregate> = {};
  for (const key of Array.from(buckets.keys()).sort((a, b) =>
    a.localeCompare(b),
  )) {
    result[key] = aggregateWer(buckets.get(key)!);
  }
  return result;
}

/**
 * Stratified WER/CER 평가. 결정성: 동일 (rows, generatedAt, datasetId, modelId)
 * 입력 → 동일 보고서.
 */
export function evaluateWerRows(params: {
  rows: WerEvaluationInputRow[];
  generatedAt: string;
  datasetId: string;
  modelId: string;
}): WerEvaluationReport {
  const enriched: WerEvaluationRow[] = params.rows
    .map((row) => {
      const wr = calculateWer(row.reference, row.hypothesis);
      return {
        ...row,
        ageGroup: classifyAgeGroup(row.age),
        wer: wr.wer,
        cer: wr.cer,
        passes15: wr.wer <= 0.15,
      };
    })
    .sort((a, b) => a.sampleId.localeCompare(b.sampleId));

  const overallResults: WerResult[] = enriched.map((row) => ({
    reference: row.reference,
    hypothesis: row.hypothesis,
    wer: row.wer,
    cer: row.cer,
    refWords: 0,
    hypWords: 0,
    refChars: 0,
    hypChars: 0,
    wordEdits: 0,
    charEdits: 0,
  }));

  return {
    generatedAt: params.generatedAt,
    datasetId: params.datasetId,
    modelId: params.modelId,
    rowCount: enriched.length,
    rows: enriched,
    summary: {
      overall: aggregateWer(overallResults),
      byAgeGroup: bucketAggregate(enriched, (row) => row.ageGroup),
      bySeverity: bucketAggregate(enriched, (row) => row.severity || "unknown"),
      byNoise: bucketAggregate(enriched, (row) => row.noiseLevel),
      byDevice: bucketAggregate(enriched, (row) => row.deviceType || "unknown"),
    },
  };
}

/**
 * 보고서를 안정 정렬된 JSON 으로 직렬화. 같은 입력 → 같은 문자열.
 */
export function serializeWerReportJson(report: WerEvaluationReport): string {
  // JSON.stringify 의 key 순서는 V8 객체 삽입 순서이므로 명시적으로 sortKeys 한다.
  return JSON.stringify(report, sortKeysReplacer, 2);
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

/**
 * Markdown 리포트 — 사람이 읽기 위한 결정성 출력.
 */
export function serializeWerReportMarkdown(report: WerEvaluationReport): string {
  const lines: string[] = [];
  lines.push(`# AI STT 성능평가 (WER/CER) 리포트`);
  lines.push("");
  lines.push(`- generatedAt: ${report.generatedAt}`);
  lines.push(`- datasetId: ${report.datasetId}`);
  lines.push(`- modelId: ${report.modelId}`);
  lines.push(`- rowCount: ${report.rowCount}`);
  lines.push("");
  lines.push("## Overall");
  lines.push("");
  const o = report.summary.overall;
  lines.push(`| total | meanWer | meanCer | passRateAt15 (WER ≤ 0.15) |`);
  lines.push(`| --- | --- | --- | --- |`);
  lines.push(`| ${o.total} | ${o.meanWer} | ${o.meanCer} | ${o.passRateAt15} |`);
  lines.push("");

  const renderBucket = (
    title: string,
    bucket: Record<string, WerAggregate>,
  ) => {
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(`| key | total | meanWer | meanCer | passRateAt15 |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const key of Object.keys(bucket).sort()) {
      const a = bucket[key];
      lines.push(
        `| ${key} | ${a.total} | ${a.meanWer} | ${a.meanCer} | ${a.passRateAt15} |`,
      );
    }
    lines.push("");
  };

  renderBucket("By Age Group", report.summary.byAgeGroup);
  renderBucket("By Severity", report.summary.bySeverity);
  renderBucket("By Noise Level", report.summary.byNoise);
  renderBucket("By Device", report.summary.byDevice);

  lines.push("## Per-Sample Rows");
  lines.push("");
  lines.push(
    `| sampleId | age | ageGroup | severity | device | noise | lighting | wer | cer | passes15 |`,
  );
  lines.push(
    `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
  );
  for (const row of report.rows) {
    lines.push(
      `| ${row.sampleId} | ${row.age} | ${row.ageGroup} | ${row.severity || "-"} | ${row.deviceType || "-"} | ${row.noiseLevel} | ${row.lighting} | ${row.wer} | ${row.cer} | ${row.passes15 ? "✅" : "✗"} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
