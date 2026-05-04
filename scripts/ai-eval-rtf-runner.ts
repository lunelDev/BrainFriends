#!/usr/bin/env tsx
// scripts/ai-eval-rtf-runner.ts
//
// STT 성능 벤치마크 (RTF / latency percentile) CLI runner — SR-AI-RTF-RUNNER.
// 식약처 AI 적용 디지털의료기기 가이드라인 PDF #2 §III.2 성능 검증 산출물.
//
// 사용법:
//   npm run ai-eval:rtf -- --input data/ai-eval/sample-rtf-fixture.csv \
//     --dataset rtf-fixture-v0.1 --model wasm:Xenova/whisper-tiny --p95-target-ms 41.5
//
// 입력 CSV 양식 (UTF-8):
//   sample_id,age,severity,device_type,noise,audio_duration_ms,processing_ms
//
// 출력:
//   docs/remediation/03-ai-evaluation/runs/rtf-<timestamp>/report.json
//   docs/remediation/03-ai-evaluation/runs/rtf-<timestamp>/report.md

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateRtfRows,
  parseRtfCsv,
  serializeRtfReportJson,
  serializeRtfReportMarkdown,
} from "@/lib/ai/sttBenchmark";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

interface CliArgs {
  input: string | null;
  dataset: string;
  model: string;
  out: string;
  timestamp: string | null;
  p95TargetMs: number | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: null,
    dataset: "unspecified-dataset",
    model: "unspecified-model",
    out: "docs/remediation/03-ai-evaluation/runs",
    timestamp: null,
    p95TargetMs: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--input" && next) {
      args.input = next;
      i++;
    } else if (a === "--dataset" && next) {
      args.dataset = next;
      i++;
    } else if (a === "--model" && next) {
      args.model = next;
      i++;
    } else if (a === "--out" && next) {
      args.out = next;
      i++;
    } else if (a === "--timestamp" && next) {
      args.timestamp = next;
      i++;
    } else if (a === "--p95-target-ms" && next) {
      const parsed = Number.parseFloat(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.p95TargetMs = parsed;
      }
      i++;
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: tsx scripts/ai-eval-rtf-runner.ts --input <csv> [--dataset <id>] [--model <id>] [--out <dir>] [--timestamp <iso8601>] [--p95-target-ms <num>]",
      );
      process.exit(0);
    }
  }
  if (!args.input) {
    console.error("ERROR: --input <csv path> is required");
    process.exit(2);
  }
  return args;
}

const args = parseArgs(process.argv);
const csvPath = resolve(projectRoot, args.input!);
const csvContent = readFileSync(csvPath, "utf-8");

const parse = parseRtfCsv(csvContent);
if (!parse.ok) {
  console.error("CSV parse errors:");
  for (const err of parse.errors) console.error(`  - ${err}`);
  process.exit(3);
}
console.log(`Parsed ${parse.rows.length} rows from ${args.input}`);

const generatedAt = args.timestamp ?? new Date().toISOString();
const report = evaluateRtfRows({
  rows: parse.rows,
  generatedAt,
  datasetId: args.dataset,
  modelId: args.model,
  p95TargetMs: args.p95TargetMs ?? undefined,
});

const safeStamp = generatedAt.replace(/[:.]/g, "-");
const outDir = resolve(projectRoot, args.out, `rtf-${safeStamp}`);
mkdirSync(outDir, { recursive: true });

const jsonPath = join(outDir, "report.json");
const mdPath = join(outDir, "report.md");
writeFileSync(jsonPath, serializeRtfReportJson(report), "utf-8");
writeFileSync(mdPath, serializeRtfReportMarkdown(report), "utf-8");

const o = report.summary.overall;
console.log("--- Overall ---");
console.log(`  total              : ${o.total}`);
console.log(`  meanRtf            : ${o.meanRtf}`);
console.log(`  meanLatencyMs      : ${o.meanLatencyMs}`);
console.log(`  p50LatencyMs       : ${o.p50LatencyMs}`);
console.log(`  p95LatencyMs       : ${o.p95LatencyMs}`);
console.log(`  p99LatencyMs       : ${o.p99LatencyMs}`);
console.log(`  passRateP95Target  : ${o.passRateP95Target} (target ${report.p95TargetMs}ms, claim-lock §4)`);
console.log("");
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
