#!/usr/bin/env tsx
// scripts/ai-eval-wer-runner.ts
//
// AI STT 성능평가 (WER/CER) CLI runner — SR-AI-EVAL-RUNNER.
// 식약처 AI 적용 디지털의료기기 가이드라인 PDF #2 §III.2 성능 검증 산출물.
//
// 사용법:
//   npm run ai-eval:wer -- --input data/ai-eval/sample-fixture.csv \
//     --dataset ko-aphasia-fixture-v0.1 --model wasm:Xenova/whisper-tiny
//
// 입력 CSV 양식 (UTF-8, RFC 4180 quoted field):
//   sample_id,age,severity,device_type,noise,lighting,ground_truth,transcript
//
// 출력:
//   docs/remediation/03-ai-evaluation/runs/<timestamp>/report.json
//   docs/remediation/03-ai-evaluation/runs/<timestamp>/report.md

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateWerRows,
  parseWerCsv,
  serializeWerReportJson,
  serializeWerReportMarkdown,
} from "@/lib/ai/werRunner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

interface CliArgs {
  input: string | null;
  dataset: string;
  model: string;
  out: string;
  timestamp: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: null,
    dataset: "unspecified-dataset",
    model: "unspecified-model",
    out: "docs/remediation/03-ai-evaluation/runs",
    timestamp: null,
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
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: tsx scripts/ai-eval-wer-runner.ts --input <csv> [--dataset <id>] [--model <id>] [--out <dir>] [--timestamp <iso8601>]",
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

const parse = parseWerCsv(csvContent);
if (!parse.ok) {
  console.error("CSV parse errors:");
  for (const err of parse.errors) console.error(`  - ${err}`);
  process.exit(3);
}
console.log(`Parsed ${parse.rows.length} rows from ${args.input}`);

const generatedAt = args.timestamp ?? new Date().toISOString();
const report = evaluateWerRows({
  rows: parse.rows,
  generatedAt,
  datasetId: args.dataset,
  modelId: args.model,
});

const safeStamp = generatedAt.replace(/[:.]/g, "-");
const outDir = resolve(projectRoot, args.out, safeStamp);
mkdirSync(outDir, { recursive: true });

const jsonPath = join(outDir, "report.json");
const mdPath = join(outDir, "report.md");
writeFileSync(jsonPath, serializeWerReportJson(report), "utf-8");
writeFileSync(mdPath, serializeWerReportMarkdown(report), "utf-8");

const o = report.summary.overall;
console.log("--- Overall ---");
console.log(`  total        : ${o.total}`);
console.log(`  meanWer      : ${o.meanWer}`);
console.log(`  meanCer      : ${o.meanCer}`);
console.log(`  passRateAt15 : ${o.passRateAt15} (claim-lock §4 target: >= 0.85)`);
console.log("");
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
