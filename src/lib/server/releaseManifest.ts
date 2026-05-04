// src/lib/server/releaseManifest.ts
//
// SI-04 (소프트웨어 무결성) — Release manifest 결정성 정규화 + 검증.
// SR-SEC-SI04 대응. 식약처 디지털의료기기 사이버보안 가이드라인 SI-04 + GMP [별표3] 2.3 형상관리.
//
// 목적: 빌드 시점에 (git SHA, npm lock hash, SBOM hash, SOUP hash) 등 형상요소를 단일
// manifest 로 동결하고, 런타임 시작 시 동일 manifest 가 유지되는지 검증한다.
//
// 본 모듈은 결정성 함수만 제공한다. 실제 manifest 생성 (파일 I/O, git 실행) 은 빌드 스크립트
// scripts/generate-release-manifest.mjs 가 담당. 시작 시 검증은
// src/lib/server/releaseManifestStartup.ts 가 담당.

import { createHash } from "node:crypto";

export const RELEASE_MANIFEST_VERSION = 1 as const;

export interface ReleaseManifestComponent {
  /** 형상요소 식별자. 예: "git-sha", "package-lock", "sbom", "soup" */
  id: string;
  /** 사람용 한 줄 설명 */
  description: string;
  /** 형상요소의 결정성 SHA-256 hex (소문자, 길이 64) */
  sha256: string;
  /** 추가 메타. 결정성 비교에는 미포함 (정보용) */
  meta?: Record<string, string | number | boolean | null>;
}

export interface ReleaseManifest {
  manifestVersion: typeof RELEASE_MANIFEST_VERSION;
  productName: string;
  productVersion: string;
  /** 정렬된 components 배열의 SHA-256. integrity 검증의 기준 */
  manifestHash: string;
  /** id 알파벳 정렬된 components */
  components: ReleaseManifestComponent[];
}

export interface BuildManifestInput {
  productName: string;
  productVersion: string;
  components: ReleaseManifestComponent[];
}

/**
 * SHA-256 hex (소문자) 계산. 결정성 입력에 대해 결정성 출력.
 */
export function sha256Hex(input: string | Buffer | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(input as Buffer);
  return hash.digest("hex");
}

/**
 * 컴포넌트 배열을 정규화 한다:
 *   - id 별 마지막 entry 가 우선 (중복 시)
 *   - id 알파벳 오름차순 정렬
 *   - sha256 은 소문자 hex 로 통일, 64자 검증
 *   - meta 가 없으면 omit (동일 결정성을 위해)
 */
export function normalizeComponents(
  components: ReleaseManifestComponent[],
): ReleaseManifestComponent[] {
  const map = new Map<string, ReleaseManifestComponent>();
  for (const raw of components) {
    const id = String(raw.id || "").trim();
    if (!id) continue;
    const sha = String(raw.sha256 || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) {
      throw new Error(
        `[releaseManifest] invalid sha256 for component ${id}: expected 64 hex chars, got "${raw.sha256}"`,
      );
    }
    const description = String(raw.description || "").trim();
    const normalized: ReleaseManifestComponent = {
      id,
      description,
      sha256: sha,
    };
    if (raw.meta && Object.keys(raw.meta).length > 0) {
      // meta 도 결정성 정렬: key 알파벳순.
      const sortedMeta: Record<string, string | number | boolean | null> = {};
      for (const key of Object.keys(raw.meta).sort()) {
        sortedMeta[key] = raw.meta[key] ?? null;
      }
      normalized.meta = sortedMeta;
    }
    map.set(id, normalized);
  }
  const list = Array.from(map.values());
  list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return list;
}

/**
 * components 배열의 결정성 hash. id|sha256 을 \n 으로 join 후 SHA-256.
 * meta 는 결정성 hash 에 포함하지 않는다 (정보용).
 */
export function computeManifestHash(components: ReleaseManifestComponent[]): string {
  const lines = components.map((c) => `${c.id}|${c.sha256}`);
  return sha256Hex(lines.join("\n"));
}

/**
 * 빌드 시점 manifest 생성. 입력이 동일하면 출력 (manifestHash, components) 동일.
 */
export function buildManifest(input: BuildManifestInput): ReleaseManifest {
  const productName = String(input.productName || "").trim();
  const productVersion = String(input.productVersion || "").trim();
  if (!productName) {
    throw new Error("[releaseManifest] productName required");
  }
  if (!productVersion) {
    throw new Error("[releaseManifest] productVersion required");
  }
  const components = normalizeComponents(input.components);
  if (components.length === 0) {
    throw new Error("[releaseManifest] at least one component required");
  }
  const manifestHash = computeManifestHash(components);
  return {
    manifestVersion: RELEASE_MANIFEST_VERSION,
    productName,
    productVersion,
    manifestHash,
    components,
  };
}

export interface ManifestVerificationBreach {
  /** "missing" — 현재 환경에 해당 component 자체가 없음. */
  /** "mismatch" — sha256 가 manifest 와 다름. */
  /** "extra" — manifest 에 없는 component 가 현재 환경에 있음. */
  /** "version_mismatch" — productVersion 불일치. */
  /** "manifest_hash" — 전체 manifestHash 재계산 결과가 manifest 와 다름. */
  type:
    | "missing"
    | "mismatch"
    | "extra"
    | "version_mismatch"
    | "manifest_hash";
  componentId?: string;
  expected?: string;
  actual?: string;
  detail?: string;
}

export interface ManifestVerificationResult {
  valid: boolean;
  breaches: ManifestVerificationBreach[];
  /** 검증 시점에 재계산된 manifestHash (디버그/감사용) */
  recomputedManifestHash: string;
}

export interface VerifyManifestInput {
  /** 디스크/네트워크에서 로드한 manifest */
  manifest: ReleaseManifest;
  /** 현재 런타임 환경에서 측정한 component sha256 목록 */
  currentComponents: ReleaseManifestComponent[];
  /** 현재 런타임 productVersion (package.json 기준) */
  currentProductVersion: string;
  /**
   * "extra" 컴포넌트(현재 환경에는 있지만 manifest 에는 없는 항목) 무시 여부.
   * 기본 false — strict.
   */
  ignoreExtra?: boolean;
}

/**
 * 시작 시 manifest 무결성 검증. 결정성: 동일 입력 → 동일 결과.
 */
export function verifyManifest(input: VerifyManifestInput): ManifestVerificationResult {
  const { manifest, currentProductVersion } = input;
  const ignoreExtra = input.ignoreExtra === true;
  const breaches: ManifestVerificationBreach[] = [];

  // 1) productVersion 비교.
  if (manifest.productVersion !== currentProductVersion) {
    breaches.push({
      type: "version_mismatch",
      expected: manifest.productVersion,
      actual: currentProductVersion,
    });
  }

  // 2) manifestHash 재계산 비교.
  const recomputed = computeManifestHash(manifest.components);
  if (recomputed !== manifest.manifestHash) {
    breaches.push({
      type: "manifest_hash",
      expected: manifest.manifestHash,
      actual: recomputed,
      detail: "manifest.components 가 외부에서 변경되었을 수 있음",
    });
  }

  // 3) component-by-component 비교.
  const currentMap = new Map<string, ReleaseManifestComponent>();
  for (const c of normalizeComponents(input.currentComponents)) {
    currentMap.set(c.id, c);
  }
  for (const expected of manifest.components) {
    const actual = currentMap.get(expected.id);
    if (!actual) {
      breaches.push({
        type: "missing",
        componentId: expected.id,
        expected: expected.sha256,
      });
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      breaches.push({
        type: "mismatch",
        componentId: expected.id,
        expected: expected.sha256,
        actual: actual.sha256,
      });
    }
  }

  // 4) extra component (선택).
  if (!ignoreExtra) {
    const expectedIds = new Set(manifest.components.map((c) => c.id));
    for (const id of currentMap.keys()) {
      if (!expectedIds.has(id)) {
        breaches.push({
          type: "extra",
          componentId: id,
          actual: currentMap.get(id)?.sha256,
        });
      }
    }
  }

  return {
    valid: breaches.length === 0,
    breaches,
    recomputedManifestHash: recomputed,
  };
}

/**
 * Manifest 를 JSON 직렬화 (결정성 — key 순서 고정).
 * 빌드 스크립트가 디스크에 쓸 때 이 함수를 사용한다.
 */
export function serializeManifest(manifest: ReleaseManifest): string {
  // JSON.stringify 는 객체 key 삽입 순서를 보존한다 (ES2015+).
  // 명시적으로 동일 순서를 강제한다.
  const ordered = {
    manifestVersion: manifest.manifestVersion,
    productName: manifest.productName,
    productVersion: manifest.productVersion,
    manifestHash: manifest.manifestHash,
    components: manifest.components.map((c) => {
      const base: ReleaseManifestComponent = {
        id: c.id,
        description: c.description,
        sha256: c.sha256,
      };
      if (c.meta) {
        base.meta = c.meta;
      }
      return base;
    }),
  };
  return JSON.stringify(ordered, null, 2) + "\n";
}
