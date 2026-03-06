export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "QuotaExceededError" || error.code === 22;
  }
  if (typeof error === "object" && error !== null && "name" in error) {
    return (error as { name?: string }).name === "QuotaExceededError";
  }
  return false;
}

export function getResultSentenceSizeClass(text: string): string {
  const normalizedLength = (text || "").replace(/\s+/g, "").length;
  if (normalizedLength >= 56) return "text-sm md:text-base";
  if (normalizedLength >= 36) return "text-base md:text-lg";
  return "text-lg md:text-xl";
}

export function blendArticulationAccuracy(
  visualAccuracy: number,
  speechAccuracy?: number,
): number {
  if (!Number.isFinite(speechAccuracy) || Number(speechAccuracy) <= 0) {
    return Math.min(100, Math.max(0, visualAccuracy));
  }
  return Math.min(
    100,
    Math.max(0, visualAccuracy * 0.2 + Number(speechAccuracy) * 0.8),
  );
}

export function getSttErrorMessage(reason?: string): string {
  const raw = String(reason || "").trim();
  if (!raw) return "음성 인식에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  if (raw.includes("upstream_429")) {
    return "음성 인식 API 한도(429)로 실패했습니다. 결제/쿼터/요금제를 확인해 주세요.";
  }
  if (raw.includes("missing_api_key")) {
    return "서버 API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.";
  }
  if (raw.includes("upstream_401")) {
    return "API 인증에 실패했습니다(401). 서버 키를 확인해 주세요.";
  }
  if (raw.includes("upstream_403")) {
    return "API 권한 오류(403)입니다. 계정 권한을 확인해 주세요.";
  }
  return `음성 인식 실패(${raw}). 네트워크/마이크 권한을 확인해 주세요.`;
}

function normalizeForSimilarity(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,!?;:'"~`()[\]{}<>\\/\-|_+=*&^%$#@]/g, "")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

export function calculateTextSimilarityScore(reference: string, hypothesis: string): number {
  const ref = normalizeForSimilarity(reference);
  const hyp = normalizeForSimilarity(hypothesis);
  if (!ref && !hyp) return 100;
  if (!ref || !hyp) return 0;
  const distance = levenshteinDistance(ref, hyp);
  const baseLen = Math.max(ref.length, hyp.length, 1);
  const similarity = (1 - distance / baseLen) * 100;
  return Number(Math.max(0, Math.min(100, similarity)).toFixed(1));
}
