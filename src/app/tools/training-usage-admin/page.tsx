"use client";

import { useEffect, useMemo, useState } from "react";

type TimelineEvent = {
  usageEventId: string;
  patientName?: string;
  patientCode?: string;
  loginId?: string | null;
  patientPseudonymId?: string;
  eventType: string;
  eventStatus: "success" | "failed" | "skipped" | "rejected";
  trainingType: string | null;
  stepNo: number | null;
  pagePath: string | null;
  sessionId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

type TimelinePayload = {
  ok: boolean;
  requestedBy?: {
    patientName?: string;
  };
  events?: TimelineEvent[];
};

const EVENT_LABELS: Record<string, string> = {
  training_step_viewed: "훈련 step 진입",
  sing_training_viewed: "노래 훈련 진입",
  training_draft_updated: "중간 저장 갱신",
  training_draft_deleted: "중간 저장 삭제",
  clinical_result_persisted: "임상 결과 저장",
  sing_result_persisted: "노래 결과 저장",
};

function formatEventLabel(eventType: string) {
  return EVENT_LABELS[eventType] ?? eventType;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export default function TrainingUsageAdminPage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isForbidden, setIsForbidden] = useState(false);
  const [search, setSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [trainingTypeFilter, setTrainingTypeFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/training-events?scope=all&limit=1000", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as TimelinePayload | null;
        if (!response.ok || !payload?.ok) {
          if (response.status === 403) {
            throw new Error("forbidden");
          }
          throw new Error("failed_to_load_admin_timeline");
        }
        if (!cancelled) {
          setEvents(Array.isArray(payload.events) ? payload.events : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          if (error instanceof Error && error.message === "forbidden") {
            setIsForbidden(true);
          } else {
            setError("전체 사용자 타임라인을 불러오지 못했습니다.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const eventTypeOptions = useMemo(
    () => ["all", ...Array.from(new Set(events.map((event) => event.eventType)))],
    [events],
  );

  const trainingTypeOptions = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(events.map((event) => event.trainingType || "unknown")),
      ),
    ],
    [events],
  );

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesEventType =
        eventTypeFilter === "all" || event.eventType === eventTypeFilter;
      const matchesTrainingType =
        trainingTypeFilter === "all" ||
        (event.trainingType || "unknown") === trainingTypeFilter;
      const matchesSearch =
        !query ||
        [event.patientName, event.loginId, event.patientCode, event.patientPseudonymId]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesEventType && matchesTrainingType && matchesSearch;
    });
  }, [eventTypeFilter, events, search, trainingTypeFilter]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, TimelineEvent[]>();
    for (const event of filteredEvents) {
      const dateKey = event.createdAt.slice(0, 10);
      const existing = groups.get(dateKey) ?? [];
      existing.push(event);
      groups.set(dateKey, existing);
    }
    return Array.from(groups.entries());
  }, [filteredEvents]);

  const downloadCsv = () => {
    const header = [
      "created_at",
      "patient_name",
      "login_id",
      "patient_code",
      "patient_pseudonym_id",
      "event_type",
      "event_status",
      "training_type",
      "step_no",
      "page_path",
      "session_id",
      "payload",
    ];
    const rows = filteredEvents.map((event) => [
      event.createdAt,
      event.patientName ?? "",
      event.loginId ?? "",
      event.patientCode ?? "",
      event.patientPseudonymId ?? "",
      event.eventType,
      event.eventStatus,
      event.trainingType ?? "",
      event.stepNo ?? "",
      event.pagePath ?? "",
      event.sessionId ?? "",
      JSON.stringify(event.payload ?? {}),
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "training-usage-all-patients.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-500">
            Admin Timeline
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            전체 사용자 사용 타임라인
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            로그인된 내부 사용자가 모든 사용자의 훈련 이벤트를 사용자명/아이디 기준으로 검색합니다.
          </p>
        </section>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(0,0.7fr))_auto]">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="사용자명, login_id, patient_code, 가명 ID"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Event Type
              </span>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"
              >
                {eventTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "전체 이벤트" : formatEventLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Training Type
              </span>
              <select
                value={trainingTypeFilter}
                onChange={(e) => setTrainingTypeFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"
              >
                {trainingTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "전체 훈련" : option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={!filteredEvents.length}
              className="inline-flex h-12 items-center justify-center self-end rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              CSV 다운로드
            </button>
          </div>

          {isForbidden ? (
            <p className="text-sm font-bold text-slate-500">관리자 계정만 접근할 수 있습니다.</p>
          ) : isLoading ? (
            <p className="text-sm font-bold text-slate-500">전체 사용자 타임라인을 불러오는 중입니다.</p>
          ) : error ? (
            <p className="text-sm font-bold text-red-500">{error}</p>
          ) : !groupedEvents.length ? (
            <p className="text-sm font-bold text-slate-500">조건에 맞는 이벤트가 없습니다.</p>
          ) : (
            <div className="space-y-8">
              {groupedEvents.map(([dateKey, rows]) => (
                <section key={dateKey}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                      {dateKey}
                    </p>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="space-y-3">
                    {rows.map((event) => (
                      <article
                        key={event.usageEventId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-black text-slate-900">
                              {event.patientName ?? "-"} · {formatEventLabel(event.eventType)}
                            </p>
                            <p className="text-xs font-bold text-slate-500">
                              {formatDateTime(event.createdAt)}
                            </p>
                            <p className="text-xs font-semibold text-slate-600">
                              login_id: {event.loginId ?? "-"} · patient_code: {event.patientCode ?? "-"}
                            </p>
                            <p className="break-all text-xs font-semibold text-slate-600">
                              pseudonym: {event.patientPseudonymId ?? "-"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-black">
                            <Badge>{event.trainingType ?? "unknown"}</Badge>
                            <Badge>{event.stepNo ? `step ${event.stepNo}` : "step -"}</Badge>
                            <Badge>{event.eventStatus}</Badge>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1 text-xs font-semibold text-slate-600">
                          <p>page: {event.pagePath ?? "-"}</p>
                          <p className="break-all">session: {event.sessionId ?? "-"}</p>
                          <p className="break-all">
                            {Object.entries(event.payload || {}).length
                              ? Object.entries(event.payload)
                                  .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
                                  .join(" · ")
                              : "기록된 추가 데이터 없음"}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
      {children}
    </span>
  );
}
