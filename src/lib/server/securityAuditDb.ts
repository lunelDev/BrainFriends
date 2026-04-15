import { appendFile, mkdir, readFile } from "fs/promises";
import path from "path";
import type { SecurityAuditEvent } from "@/lib/security/auditLogger";

function getSecurityAuditPath() {
  return path.join(process.cwd(), "data", "security", "security-audit.ndjson");
}

export async function appendSecurityAuditEvent(event: SecurityAuditEvent) {
  const filePath = getSecurityAuditPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
}

export async function listRecentSecurityAuditEvents(limit = 50) {
  try {
    const raw = await readFile(getSecurityAuditPath(), "utf8");
    const rows = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SecurityAuditEvent);

    return rows
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit);
  } catch {
    return [];
  }
}
