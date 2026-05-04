// SR-IRT-018. 2PL Item Response Theory + Maximum Fisher Information adaptive testing.
//
// 식약처 디지털의료기기 가이드라인 PDF #2 §III.4 적응형 알고리즘 + 제품기획서
// "Bayesian Adaptive Testing / IRT 핵심 모듈" 클레임 지원.
//
// 본 모듈은 적응형 난이도 조정 (item selection) 과 환자 능력치 (θ) 추정의
// 결정성 알고리즘을 제공한다. UI/세션 통합은 별도 (다음 작업).
//
// 알고리즘:
// - 2PL: P(θ; a, b) = 1 / (1 + exp(-a(θ - b)))
// - 정보량: I(θ; a, b) = a² · P · (1 - P)
// - EAP (Expected A Posteriori): θ_hat = ∫θ·L(θ)·prior(θ)dθ / ∫L(θ)·prior(θ)dθ
// - MFI 문항 선택: argmax_i I(θ_hat; a_i, b_i)

/** Item parameter — 문항별 변별도 (a, discrimination) 와 난이도 (b, difficulty). */
export interface IrtItem {
  /** Stable id, e.g. "step1-word-사과". */
  id: string;
  /** Discrimination parameter — 일반적으로 0.5 ~ 2.5 권장. */
  a: number;
  /** Difficulty parameter — θ 와 동일 척도, 일반적으로 -3 ~ 3. */
  b: number;
  /** 자유 메타. step / category / 임상 라벨 등. */
  metadata?: Record<string, string | number | boolean>;
}

/** 응답 한 건 — itemId 와 정답 여부 (1 = correct, 0 = incorrect). */
export interface IrtResponse {
  itemId: string;
  correct: boolean;
}

/** 사전 분포 (prior) — 정규 분포 (μ, σ) 가정. 임상 시작 시 보통 N(0, 1). */
export interface IrtPrior {
  mean: number;
  sd: number;
}

export const DEFAULT_PRIOR: IrtPrior = { mean: 0, sd: 1 };

/** EAP 적분 quadrature 격자 — fixed 41 points -4 ~ +4 (결정성 보장). */
const QUADRATURE_POINTS = 41 as const;
const QUADRATURE_MIN = -4 as const;
const QUADRATURE_MAX = 4 as const;

function buildQuadrature(): { thetas: number[]; weights: number[] } {
  const step = (QUADRATURE_MAX - QUADRATURE_MIN) / (QUADRATURE_POINTS - 1);
  const thetas: number[] = [];
  for (let i = 0; i < QUADRATURE_POINTS; i++) {
    thetas.push(QUADRATURE_MIN + i * step);
  }
  // Trapezoidal weights (uniform interior + half end-points).
  const weights = thetas.map((_, idx) => {
    if (idx === 0 || idx === thetas.length - 1) return step / 2;
    return step;
  });
  return { thetas, weights };
}

const QUADRATURE = buildQuadrature();

function round6(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * 2PL 정답 확률.
 * 결정성: 동일 (theta, a, b) → 동일 확률.
 */
export function probabilityCorrect(theta: number, a: number, b: number): number {
  const z = a * (theta - b);
  // Clamp z to avoid Infinity in exp.
  const clamped = Math.max(-50, Math.min(50, z));
  return 1 / (1 + Math.exp(-clamped));
}

/**
 * Fisher Information at θ for a 2PL item.
 * I(θ) = a² · P · (1 - P)
 */
export function fisherInformation(
  theta: number,
  a: number,
  b: number,
): number {
  const p = probabilityCorrect(theta, a, b);
  return round6(a * a * p * (1 - p));
}

/** Standard normal PDF — quadrature 가중에 사용. */
function normalPdf(x: number, mean: number, sd: number): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/**
 * EAP 능력치 추정 — 사전 prior + 응답 likelihood 의 사후 평균.
 * 결정성: 동일 (responses, items, prior) → 동일 θ_hat.
 *
 * 응답 없거나 모든 itemId 가 item bank 에 없으면 prior.mean 반환.
 */
export function estimateAbilityEap(params: {
  items: readonly IrtItem[];
  responses: readonly IrtResponse[];
  prior?: IrtPrior;
}): { theta: number; sd: number; usedResponses: number } {
  const prior = params.prior ?? DEFAULT_PRIOR;
  const itemMap = new Map<string, IrtItem>();
  for (const item of params.items) itemMap.set(item.id, item);

  // Filter responses to those whose items exist in bank.
  const used: { item: IrtItem; correct: boolean }[] = [];
  for (const r of params.responses) {
    const item = itemMap.get(r.itemId);
    if (item) used.push({ item, correct: r.correct });
  }

  if (used.length === 0) {
    return { theta: prior.mean, sd: prior.sd, usedResponses: 0 };
  }

  // Posterior at each quadrature point: prior * likelihood.
  const posterior: number[] = QUADRATURE.thetas.map((theta) => {
    let logLik = 0;
    for (const { item, correct } of used) {
      const p = probabilityCorrect(theta, item.a, item.b);
      // Avoid log(0).
      const safe = Math.max(1e-12, Math.min(1 - 1e-12, p));
      logLik += correct ? Math.log(safe) : Math.log(1 - safe);
    }
    return Math.exp(logLik) * normalPdf(theta, prior.mean, prior.sd);
  });

  // Normalize.
  let denom = 0;
  for (let i = 0; i < posterior.length; i++) {
    denom += posterior[i] * QUADRATURE.weights[i];
  }
  if (denom === 0 || !Number.isFinite(denom)) {
    return { theta: prior.mean, sd: prior.sd, usedResponses: used.length };
  }

  let mean = 0;
  for (let i = 0; i < posterior.length; i++) {
    mean +=
      QUADRATURE.thetas[i] * (posterior[i] * QUADRATURE.weights[i]) / denom;
  }

  let variance = 0;
  for (let i = 0; i < posterior.length; i++) {
    const diff = QUADRATURE.thetas[i] - mean;
    variance +=
      diff * diff * (posterior[i] * QUADRATURE.weights[i]) / denom;
  }

  return {
    theta: round6(mean),
    sd: round6(Math.sqrt(Math.max(0, variance))),
    usedResponses: used.length,
  };
}

/** MFI 문항 선택 결과. */
export interface PickNextItemResult {
  selected: IrtItem | null;
  candidates: Array<{ itemId: string; information: number }>;
  reason: "selected" | "no_items" | "all_used";
}

/**
 * 다음 문항 선택 — Maximum Fisher Information.
 * 이미 응답한 itemId 는 제외. 동률일 경우 itemId 알파벳 정렬 첫 번째 (결정성).
 */
export function pickNextItem(params: {
  items: readonly IrtItem[];
  theta: number;
  excludeItemIds?: readonly string[];
}): PickNextItemResult {
  const exclude = new Set(params.excludeItemIds ?? []);
  const eligible = params.items.filter((item) => !exclude.has(item.id));
  if (params.items.length === 0) {
    return { selected: null, candidates: [], reason: "no_items" };
  }
  if (eligible.length === 0) {
    return { selected: null, candidates: [], reason: "all_used" };
  }

  const scored = eligible.map((item) => ({
    item,
    information: fisherInformation(params.theta, item.a, item.b),
  }));

  // Sort descending by information; tie-break by itemId asc (결정성).
  scored.sort((a, b) => {
    if (b.information !== a.information) return b.information - a.information;
    return a.item.id.localeCompare(b.item.id);
  });

  return {
    selected: scored[0].item,
    candidates: scored.map((s) => ({
      itemId: s.item.id,
      information: s.information,
    })),
    reason: "selected",
  };
}

/**
 * 적응형 시퀀스 평가 — 고정 응답 시퀀스 (시뮬레이션) 로 θ 수렴 결정성 검증용.
 * 매 단계: pickNextItem → 응답 가져옴 → estimateAbilityEap 갱신.
 */
export interface AdaptiveSimStep {
  step: number;
  selectedItemId: string;
  thetaBefore: number;
  thetaAfter: number;
  sdAfter: number;
  correct: boolean;
}

export interface AdaptiveSimResult {
  steps: AdaptiveSimStep[];
  finalTheta: number;
  finalSd: number;
  used: string[];
}

export function simulateAdaptiveSession(params: {
  items: readonly IrtItem[];
  /** 시뮬레이션용 — itemId → correct 응답 매핑. */
  responseOracle: Record<string, boolean>;
  /** 최대 문항 수. */
  maxItems: number;
  prior?: IrtPrior;
}): AdaptiveSimResult {
  const prior = params.prior ?? DEFAULT_PRIOR;
  const responses: IrtResponse[] = [];
  const steps: AdaptiveSimStep[] = [];
  let theta = prior.mean;
  let sd = prior.sd;

  for (let step = 0; step < params.maxItems; step++) {
    const pick = pickNextItem({
      items: params.items,
      theta,
      excludeItemIds: responses.map((r) => r.itemId),
    });
    if (pick.reason !== "selected" || !pick.selected) break;

    const correct = params.responseOracle[pick.selected.id] ?? false;
    const thetaBefore = theta;
    responses.push({ itemId: pick.selected.id, correct });
    const eap = estimateAbilityEap({
      items: params.items,
      responses,
      prior,
    });
    theta = eap.theta;
    sd = eap.sd;
    steps.push({
      step: step + 1,
      selectedItemId: pick.selected.id,
      thetaBefore: round6(thetaBefore),
      thetaAfter: round6(theta),
      sdAfter: round6(sd),
      correct,
    });
  }

  return {
    steps,
    finalTheta: round6(theta),
    finalSd: round6(sd),
    used: responses.map((r) => r.itemId),
  };
}

/**
 * 클레임 매핑: 본 모듈의 적용 범위.
 * - claim-lock §4 "적응형 난이도" 행: IRT 구현 ✅ → "Bayesian Adaptive Testing 적용"
 *   클레임이 §4 조건부에서 §3 사용 가능으로 승격 가능 (단, 임상 검증 후).
 * - claim-lock §5 "Bayesian Adaptive Testing / IRT 적용했다" 금지 클레임:
 *   현재 구현은 코드 수준이며 임상 calibration (item bank 의 a/b 추정) 후
 *   완전 해제. v0.1 은 "IRT 코드 구현 완료, 임상 calibration 진행 중" 으로 표현.
 * - 제품제안서 "핵심 모듈" 클레임 방어 가능.
 */
export const IRT_VERSION = "irt:2pl-mfi:v0.1" as const;
