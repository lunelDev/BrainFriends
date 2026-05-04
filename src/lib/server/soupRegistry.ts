// src/lib/server/soupRegistry.ts
//
// SI-04 (소프트웨어 무결성) + GMP [별표3] 2.3 형상관리 — SOUP (Software of Unknown Provenance) 목록 정규화.
// SR-SEC-SI04-SOUP.
//
// IEC 62304 정의: 의료기기 제조사가 직접 개발하지 않은 모든 소프트웨어 컴포넌트.
// 식약처 디지털의료기기 GMP [별첨4] 양식 매핑:
//   - id (SOUP ID, 형상관리 식별자)
//   - name (패키지명)
//   - version (고정 버전, semver)
//   - license (라이선스)
//   - sourceType ("npm" | "pypi" | "system" | "model")
//   - purpose (사용 목적 한 줄 요약)
//   - riskCategory (A/B/C — 환자 위해도. 외부 모델/AI 는 B 이상)
//   - changeControl (변경 통제 트리거 — security_scan / version_pin / model_eval)
//
// 본 모듈은 결정성 함수만 제공. 실제 SOUP 목록 생성 (package.json 파싱) 은 scripts/generate-soup-list.mjs.
// V&V 결정성 테스트는 본 모듈의 normalize / build 함수를 대상으로 한다.

export type SoupSourceType = "npm" | "pypi" | "system" | "model";
export type SoupRiskCategory = "A" | "B" | "C";

export interface SoupEntry {
  id: string;
  name: string;
  version: string;
  license: string | null;
  sourceType: SoupSourceType;
  purpose: string;
  riskCategory: SoupRiskCategory;
  changeControl: string[];
}

export interface RawPackageEntry {
  name: string;
  version: string;
  license?: string | null;
  sourceType: SoupSourceType;
  purpose?: string;
  /** 위험도 힌트. 없으면 sourceType 기반으로 자동 부여. */
  riskCategory?: SoupRiskCategory;
}

const PURPOSE_DEFAULTS: Record<SoupSourceType, string> = {
  npm: "Web/Node 런타임 라이브러리",
  pypi: "Python 음향 분석 의존",
  system: "OS 또는 시스템 패키지",
  model: "외부 AI 모델",
};

const RISK_DEFAULTS: Record<SoupSourceType, SoupRiskCategory> = {
  npm: "A",
  pypi: "B",
  system: "B",
  model: "C",
};

/** name 으로 SOUP id 결정성 생성. 알파벳 / 숫자 / 하이픈만, 충돌 시 sourceType 접미사. */
function buildSoupId(name: string, sourceType: SoupSourceType): string {
  const safe = name
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_");
  return `SOUP-${sourceType.toUpperCase()}-${safe}`;
}

export function normalizeSoupEntry(raw: RawPackageEntry): SoupEntry {
  const sourceType = raw.sourceType;
  const riskCategory = raw.riskCategory ?? RISK_DEFAULTS[sourceType];
  const baseChange =
    sourceType === "model"
      ? ["model_eval", "version_pin", "security_scan"]
      : ["security_scan", "version_pin"];
  return {
    id: buildSoupId(raw.name, sourceType),
    name: raw.name,
    version: String(raw.version || "").trim(),
    license: raw.license ?? null,
    sourceType,
    purpose: raw.purpose?.trim() || PURPOSE_DEFAULTS[sourceType],
    riskCategory,
    changeControl: baseChange,
  };
}

/**
 * 입력 패키지 목록을 정규화 + 정렬 + 중복 제거 → SOUP 목록.
 * 결정성: 동일 입력 → 동일 순서/내용. 정렬 키는 (sourceType, name).
 */
export function buildSoupList(packages: RawPackageEntry[]): SoupEntry[] {
  const seen = new Set<string>();
  const list: SoupEntry[] = [];
  for (const pkg of packages) {
    const entry = normalizeSoupEntry(pkg);
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    list.push(entry);
  }
  list.sort((a, b) => {
    if (a.sourceType !== b.sourceType) {
      return a.sourceType < b.sourceType ? -1 : 1;
    }
    if (a.name !== b.name) {
      return a.name < b.name ? -1 : 1;
    }
    return 0;
  });
  return list;
}

export interface SoupListSummary {
  total: number;
  byRisk: Record<SoupRiskCategory, number>;
  bySource: Record<SoupSourceType, number>;
}

export function summarizeSoupList(list: SoupEntry[]): SoupListSummary {
  const summary: SoupListSummary = {
    total: list.length,
    byRisk: { A: 0, B: 0, C: 0 },
    bySource: { npm: 0, pypi: 0, system: 0, model: 0 },
  };
  for (const entry of list) {
    summary.byRisk[entry.riskCategory] += 1;
    summary.bySource[entry.sourceType] += 1;
  }
  return summary;
}
