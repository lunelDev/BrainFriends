// src/app/api/therapist/system/iec62304-traceability/route.ts
//
// IEC 62304 별지 제2호 추적성 매트릭스 export.
// SR-RISK-012 / SR-CHANGE-016 / GMP [별표3] 1.1.1 대응. 식약처 인허가 제출 양식.
//
// 쿼리 파라미터:
//   ?format=json (기본) — JSON 패키지
//   ?format=md          — Markdown
//   ?format=csv         — CSV (별지 제2호 표 형태)

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAuthenticatedSessionContext } from "@/lib/server/accountAuth";
import { SOFTWARE_REQUIREMENTS } from "@/lib/vnv/requirements";
import { TRACEABILITY_MATRIX } from "@/lib/vnv/traceability";
import { buildDeterministicExecutionLogRecord } from "@/lib/vnv/runDeterministicChecks";
import {
  buildIec62304TraceabilityMatrix,
  serializeIec62304Markdown,
  serializeIec62304Csv,
  type Iec62304HazardLink,
  type Iec62304TestResult,
} from "@/lib/vnv/iec62304Export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canAccessTherapistConsole(role: string | null | undefined) {
  return role === "admin" || role === "therapist";
}

/**
 * 위해 통제 ↔ SR 매핑 (정적 정의). risk-management-file.md 작성 시 갱신.
 * 결정성: 동일 모듈 → 동일 출력.
 */
const HAZARD_LINKS: Iec62304HazardLink[] = [
  // RM-* 식별자는 docs/regulatory/risk-management-file.md 와 동일.
  // v0.3 기준: 기존 RM-001/009/010/016/017/019 + 신규 RM-021 (DoS) 통합.
  {
    hazardId: "RM-001",
    description: "STT 전사 오류로 잘못된 K-WAB 점수 산출",
    controlledByRequirementIds: ["SR-STT-009", "SR-AI-EVAL-014", "SR-MEASURE-006"],
  },
  {
    hazardId: "RM-009",
    description: "보호자 동의 만료 후 리포트 노출",
    controlledByRequirementIds: ["SR-CONSENT-015", "SR-GUARDIAN-010"],
  },
  {
    hazardId: "RM-010",
    description: "비인가 사용자의 환자 데이터 접근",
    controlledByRequirementIds: ["SR-PERMISSION-002", "SR-SEC-IA05", "SR-SEC-IA07", "SR-SEC-UC03"],
  },
  {
    hazardId: "RM-016",
    description: "감사로그 위변조 / 추적성 손실",
    controlledByRequirementIds: ["SR-SEC-UC07", "SR-SEC-TRE01", "SR-SEC-SI04-MANIFEST"],
  },
  {
    hazardId: "RM-017",
    description: "PHI 외부 노출 (감사로그/리포트/export)",
    controlledByRequirementIds: ["SR-PHI-013", "SR-SEC-UC07", "SR-SEC-SI04-MANIFEST"],
  },
  {
    hazardId: "RM-019",
    description: "AI 모델/의존성 변경 미통보로 성능 저하",
    controlledByRequirementIds: ["SR-CHANGE-016", "SR-SEC-SI04-SOUP", "SR-SEC-SI04-MANIFEST"],
  },
  {
    hazardId: "RM-021",
    description: "서비스 거부 (DoS) 로 인한 진료 차단",
    controlledByRequirementIds: ["SR-SEC-RA01"],
  },
];

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const context = await getAuthenticatedSessionContext(token);
  if (!context) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canAccessTherapistConsole(context.userRole)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";

  // 결정성 V&V 실행 결과를 IEC 62304 시험결과로 변환.
  const detRun = await buildDeterministicExecutionLogRecord();
  const testResults: Iec62304TestResult[] = detRun.cases.map((c) => ({
    testCaseId: c.testCaseId,
    passed: c.passed,
    executedAt: c.executedAt,
    inputSummary: c.inputSummary,
    expected: c.expected,
    actual: c.actual,
  }));

  const pkg = buildIec62304TraceabilityMatrix({
    requirements: [...SOFTWARE_REQUIREMENTS],
    traceability: [...TRACEABILITY_MATRIX],
    testResults,
    hazardLinks: HAZARD_LINKS,
    productName: "BrainFriends",
    productVersion: "0.1.0",
    generatedAt: new Date().toISOString(),
  });

  if (format === "md") {
    const md = serializeIec62304Markdown(pkg);
    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="brainfriends-iec62304-traceability.md"',
      },
    });
  }

  if (format === "csv") {
    const csv = serializeIec62304Csv(pkg);
    // BOM 포함 — 한글 Excel 호환.
    return new NextResponse("﻿" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="brainfriends-iec62304-traceability.csv"',
      },
    });
  }

  return new NextResponse(JSON.stringify(pkg, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="brainfriends-iec62304-traceability.json"',
    },
  });
}
