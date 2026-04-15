import { promises as fs } from "node:fs";
import path from "node:path";

export interface VnvExecutionCaseRecord {
  testCaseId: string;
  requirementIds: string[];
  area: string;
  passed: boolean;
  inputSummary: string;
  expected: string;
  actual: string;
  detail: string;
  executedAt: string;
}

export interface VnvExecutionLogRecord {
  exportType: "brainfriends-vnv-deterministic-run";
  generatedAt: string;
  runDate: string;
  runTime: string;
  summary: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
  };
  cases: VnvExecutionCaseRecord[];
}

function sanitizeFileToken(value: string) {
  return value.replace(/[:]/g, "-").replace(/[.]/g, "_");
}

export function getVnvExecutionLogRoot() {
  return path.join(process.cwd(), "docs", "remediation", "test-runs");
}

export async function saveVnvExecutionLog(record: VnvExecutionLogRecord) {
  const root = getVnvExecutionLogRoot();
  const dateDir = path.join(root, record.runDate);
  await fs.mkdir(dateDir, { recursive: true });
  const fileName = `${sanitizeFileToken(record.runTime)}-vnv-run.json`;
  const filePath = path.join(dateDir, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return filePath;
}

export async function listSavedVnvExecutionLogs(limit = 10) {
  const root = getVnvExecutionLogRoot();
  try {
    const dateDirs = await fs.readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const dirent of dateDirs) {
      if (!dirent.isDirectory()) continue;
      const dateDir = path.join(root, dirent.name);
      const children = await fs.readdir(dateDir, { withFileTypes: true });
      for (const child of children) {
        if (child.isFile() && child.name.endsWith(".json")) {
          files.push(path.join(dateDir, child.name));
        }
      }
    }
    files.sort((a, b) => b.localeCompare(a));
    const selected = files.slice(0, limit);
    const results: Array<{ path: string; record: VnvExecutionLogRecord }> = [];
    for (const filePath of selected) {
      const raw = await fs.readFile(filePath, "utf8");
      results.push({
        path: filePath,
        record: JSON.parse(raw) as VnvExecutionLogRecord,
      });
    }
    return results;
  } catch {
    return [];
  }
}

export async function getLatestSavedVnvExecutionLog() {
  const logs = await listSavedVnvExecutionLogs(1);
  return logs[0] ?? null;
}
