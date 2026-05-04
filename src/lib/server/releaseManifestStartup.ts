// src/lib/server/releaseManifestStartup.ts
//
// SI-04 release manifest 의 서버 시작 시 무결성 검증 훅.
// SR-SEC-SI04-MANIFEST 의 런타임 단계.
//
// 본 모듈은 결정성 함수 verifyManifest 와 디스크 I/O / audit 호출을 분리한다.
// 결정성 핵심 함수 (loadManifestFromDisk 의 정규화, evaluateStartupCheck) 는 V&V 대상.
// 실제 fs 는 runStartupCheck 에서만 호출되어 unit 테스트는 fixture 로 검증.

import {
  ReleaseManifest,
  ReleaseManifestComponent,
  ManifestVerificationResult,
  verifyManifest,
} from "./releaseManifest";

export interface StartupCheckInput {
  manifest: ReleaseManifest | null;
  currentComponents: ReleaseManifestComponent[];
  currentProductVersion: string;
  /**
   * 정책: "block" 시 verify 실패하면 시작 차단 (throw).
   *       "warn" 시 audit 로그만 남기고 시작 허용.
   * production 은 "block", staging/dev 는 "warn" 권장.
   */
  policy: "block" | "warn";
}

export interface StartupCheckOutcome {
  /** "skip": manifest 없음 (개발 환경) */
  /** "ok": valid */
  /** "block": breach + policy=block → 시작 차단 */
  /** "warn": breach + policy=warn → 경고만 */
  status: "skip" | "ok" | "block" | "warn";
  result: ManifestVerificationResult | null;
  reason: string;
  /** 감사 로그용 카테고리 — UC-07 audit chain 으로 흘려보낼 때 사용 */
  auditCategory: "release_manifest_ok" | "release_manifest_breach" | "release_manifest_skip";
}

/**
 * 결정성 평가 함수. fs / network 호출 없음. unit 테스트 대상.
 */
export function evaluateStartupCheck(input: StartupCheckInput): StartupCheckOutcome {
  if (!input.manifest) {
    return {
      status: "skip",
      result: null,
      reason: "release manifest not present (개발 환경 또는 빌드 미실행)",
      auditCategory: "release_manifest_skip",
    };
  }
  const result = verifyManifest({
    manifest: input.manifest,
    currentComponents: input.currentComponents,
    currentProductVersion: input.currentProductVersion,
    ignoreExtra: false,
  });
  if (result.valid) {
    return {
      status: "ok",
      result,
      reason: `manifest verified (manifestHash=${input.manifest.manifestHash.slice(0, 16)}…, ${input.manifest.components.length} components)`,
      auditCategory: "release_manifest_ok",
    };
  }
  const breachLine = result.breaches
    .map((b) => `${b.type}${b.componentId ? `:${b.componentId}` : ""}`)
    .join(", ");
  if (input.policy === "block") {
    return {
      status: "block",
      result,
      reason: `manifest verification failed (${result.breaches.length} breach(es): ${breachLine})`,
      auditCategory: "release_manifest_breach",
    };
  }
  return {
    status: "warn",
    result,
    reason: `manifest verification failed in warn mode (${result.breaches.length} breach(es): ${breachLine})`,
    auditCategory: "release_manifest_breach",
  };
}
