"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationCatalogEntry } from "@/lib/organizations/catalog";
import type { PatientProfile } from "@/lib/patientStorage";

type TherapistOption = {
  therapistUserId: string;
  therapistName: string;
  loginId: string | null;
};

export default function LinkCarePage() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationCatalogEntry[]>([]);
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [selectedOrganization, setSelectedOrganization] =
    useState<OrganizationCatalogEntry | null>(null);
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistOption | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTherapists, setIsLoadingTherapists] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetch("/api/auth/session", { cache: "no-store" }).then((response) =>
        response.json().catch(() => null),
      ),
      fetch("/api/organizations", { cache: "no-store" }).then((response) =>
        response.json().catch(() => null),
      ),
    ])
      .then(([sessionPayload, orgPayload]) => {
        if (cancelled) return;

        if (!sessionPayload?.ok || !sessionPayload?.patient) {
          router.replace("/");
          return;
        }

        setPatient(sessionPayload.patient);
        if (
          sessionPayload.patient.organizationId &&
          sessionPayload.patient.hasAssignedTherapist
        ) {
          router.replace("/select-page/mode");
          return;
        }

        if (orgPayload?.ok && Array.isArray(orgPayload.organizations)) {
          setOrganizations(orgPayload.organizations);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!selectedOrganization?.id) {
      setTherapists([]);
      setSelectedTherapist(null);
      return;
    }

    let cancelled = false;
    setIsLoadingTherapists(true);
    void fetch(
      `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/therapists`,
      { cache: "no-store" },
    )
      .then((response) => response.json().catch(() => null))
      .then((payload) => {
        if (cancelled) return;
        const nextItems =
          payload?.ok && Array.isArray(payload.therapists)
            ? (payload.therapists as TherapistOption[])
            : [];
        setTherapists(nextItems);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTherapists(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedOrganization]);

  const filteredOrganizations = useMemo(() => {
    const query = organizationQuery.trim().toLowerCase();
    if (!query) return organizations;
    return organizations.filter((item) =>
      [item.name, item.code, item.address].join(" ").toLowerCase().includes(query),
    );
  }, [organizationQuery, organizations]);

  const submit = async () => {
    if (!selectedOrganization) {
      setError("기관을 먼저 선택해 주세요.");
      return;
    }
    if (!selectedTherapist) {
      setError("담당 치료사를 선택해 주세요.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/patient/link-care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrganization.id,
          therapistUserId: selectedTherapist.therapistUserId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError(
          payload?.error === "invalid_organization"
            ? "기관 정보를 다시 확인해 주세요."
            : payload?.error === "invalid_therapist"
              ? "치료사 정보를 다시 확인해 주세요."
              : "담당 치료사 연결 요청을 저장하지 못했습니다.",
        );
        return;
      }

      setSuccess("담당 치료사 연결 요청을 저장했습니다. 승인 후 바로 이용할 수 있습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f4f6fb] px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black text-slate-500">연결 정보를 확인하고 있습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">
            Care Link
          </p>
          <h1 className="mt-3 text-3xl font-black text-slate-950">
            기관과 담당 치료사를 연결해 주세요.
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
            {patient?.name ?? "회원"}님은 아직 소속 기관 또는 담당 치료사가 연결되지
            않았습니다. 기관을 선택하고 승인된 치료사를 지정하면 관리자 승인 후
            훈련을 시작할 수 있습니다.
          </p>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">기관 선택</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              가입 후 연결할 병원 또는 기관을 먼저 선택합니다.
            </p>

            <input
              className="mt-5 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
              value={organizationQuery}
              onChange={(event) => setOrganizationQuery(event.target.value)}
              placeholder="기관명, 기관 코드, 주소 검색"
            />

            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
              {filteredOrganizations.length ? (
                filteredOrganizations.map((item) => {
                  const selected = selectedOrganization?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedOrganization(item);
                        setSelectedTherapist(null);
                        setError("");
                      }}
                      className={`mb-2 block w-full rounded-2xl border px-4 py-4 text-left transition last:mb-0 ${
                        selected
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-200 bg-white hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-sm font-black text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.code} · {item.address}
                      </p>
                    </button>
                  );
                })
              ) : (
                <p className="px-4 py-6 text-sm font-semibold text-slate-500">
                  검색 결과가 없습니다.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">담당 치료사 선택</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              선택한 기관에 소속된 승인 완료 치료사만 표시됩니다.
            </p>

            {!selectedOrganization ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                먼저 기관을 선택해 주세요.
              </div>
            ) : isLoadingTherapists ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                치료사 목록을 불러오는 중입니다.
              </div>
            ) : therapists.length ? (
              <div className="mt-5 space-y-3">
                {therapists.map((item) => {
                  const selected =
                    selectedTherapist?.therapistUserId === item.therapistUserId;
                  return (
                    <button
                      key={item.therapistUserId}
                      type="button"
                      onClick={() => {
                        setSelectedTherapist(item);
                        setError("");
                      }}
                      className={`block w-full rounded-2xl border px-4 py-4 text-left transition ${
                        selected
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <p className="text-sm font-black text-slate-900">
                        {item.therapistName}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.loginId ?? "치료사 계정"}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                선택한 기관에 승인된 치료사가 아직 없습니다.
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={isSubmitting}
                className="rounded-2xl bg-[#0b66c3] px-5 py-3 text-sm font-black text-white transition hover:bg-[#08539f] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting ? "요청 저장 중" : "연결 요청 저장"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
