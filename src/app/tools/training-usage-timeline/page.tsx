"use client";

import { useEffect, useMemo, useState } from "react";

type TimelineEvent = {
  usageEventId: string;
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
  patient?: {
    name: string;
    age: number;
    birthDate?: string;
  };
  patientPseudonymId?: string;
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

function formatPayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload || {});
  if (!entries.length) {
    return "기록된 추가 데이터 없음";
  }
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

export default function TrainingUsageTimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState<number | null>(null);
  const [patientPseudonymId, setPatientPseudonymId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [trainingTypeFilter, setTrainingTypeFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/training-events?limit=300", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as TimelinePayload | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.ok === false ? "failed_to_load_timeline" : "failed_to_load_timeline");
        }
        if (cancelled) return;
        setEvents(Array.isArray(payload.events) ? payload.events : []);
        setPatientName(payload.patient?.name ?? "");
        setPatientAge(
          Number.isFinite(Number(payload.patient?.age))
            ? Number(payload.patient?.age)
            : null,
        );
        setPatientPseudonymId(payload.patientPseudonymId ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setError("사용 타임라인을 불러오지 못했습니다.");
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

  const eventTypeOptions = useMemo(() => {
    return ["all", ...Array.from(new Set(events.map((event) => event.eventType)))];
  }, [events]);

  const trainingTypeOptions = useMemo(() => {
    return [
      "all",
      ...Array.from(
        new Set(
          events
            .map((event) => event.trainingType || "unknown")
            .filter(Boolean),
        ),
      ),
    ];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesEventType =
        eventTypeFilter === "all" || event.eventType === eventTypeFilter;
      const normalizedTrainingType = event.trainingType || "unknown";
      const matchesTrainingType =
        trainingTypeFilter === "all" ||
        normalizedTrainingType === trainingTypeFilter;
      return matchesEventType && matchesTrainingType;
    });
  }, [eventTypeFilter, events, trainingTypeFilter]);

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
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `training-usage-timeline-${patientName || "patient"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-500">
            Training Usage Timeline
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            사용자 사용 타임라인
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            DB에 저장된 훈련 진입, 중간 저장, 최종 결과 이벤트를 시간순으로 확인합니다.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="사용자명" value={patientName || "-"} />
            <SummaryCard
              label="나이"
              value={patientAge === null ? "-" : `${patientAge}세`}
            />
            <SummaryCard
              label="가명 ID"
              value={patientPseudonymId || "-"}
              mono
            />
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={!filteredEvents.length}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              CSV 다운로드
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm font-bold text-slate-500">
              사용 타임라인을 불러오는 중입니다.
            </p>
          ) : error ? (
            <p className="text-sm font-bold text-red-500">{error}</p>
          ) : !groupedEvents.length ? (
            <p className="text-sm font-bold text-slate-500">
              저장된 사용 이벤트가 없습니다.
            </p>
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
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              {formatEventLabel(event.eventType)}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {formatDateTime(event.createdAt)}
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
                          <p className="break-all">{formatPayload(event.payload)}</p>
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

function SummaryCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-black text-slate-900 ${mono ? "break-all font-mono text-[12px]" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
      {children}
    </span>
  );
}
