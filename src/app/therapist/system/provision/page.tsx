"use client";

import { useState } from "react";
import Link from "next/link";
import { createTherapistAccount } from "@/lib/client/adminTherapistApi";

type TherapistProvisionForm = {
  loginId: string;
  name: string;
  birthDate: string;
  phoneLast4: string;
  password: string;
  confirmPassword: string;
};

export default function TherapistProvisionPage() {
  const [form, setForm] = useState<TherapistProvisionForm>({
    loginId: "",
    name: "",
    birthDate: "",
    phoneLast4: "",
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const updateField = (key: keyof TherapistProvisionForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setError("");
    setSuccessMessage("");

    if (
      !form.loginId.trim() ||
      !form.name.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate) ||
      !/^\d{4}$/.test(form.phoneLast4) ||
      form.password.length < 6 ||
      form.password !== form.confirmPassword
    ) {
      setError("Check the therapist account fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createTherapistAccount({
        loginId: form.loginId.trim().toLowerCase(),
        name: form.name.trim(),
        birthDate: form.birthDate,
        phoneLast4: form.phoneLast4,
        password: form.password,
      });
      setSuccessMessage("Therapist account created.");
      setForm({
        loginId: "",
        name: "",
        birthDate: "",
        phoneLast4: "",
        password: "",
        confirmPassword: "",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create therapist account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-600">
              Provision
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              Create therapist accounts from an admin session.
            </h2>
          </div>
          <Link
            href="/therapist/system"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Back to system
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Login ID">
            <input
              className="input-style"
              value={form.loginId}
              onChange={(event) =>
                updateField("loginId", event.target.value.replace(/\s/g, ""))
              }
              placeholder="therapist01"
            />
          </Field>
          <Field label="Name">
            <input
              className="input-style"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Therapist name"
            />
          </Field>
          <Field label="Birth Date">
            <input
              className="input-style"
              value={form.birthDate}
              onChange={(event) => updateField("birthDate", event.target.value)}
              placeholder="1990-01-15"
            />
          </Field>
          <Field label="Phone Last 4">
            <input
              className="input-style"
              value={form.phoneLast4}
              onChange={(event) =>
                updateField(
                  "phoneLast4",
                  event.target.value.replace(/\D/g, "").slice(0, 4),
                )
              }
              placeholder="1234"
            />
          </Field>
          <Field label="Password">
            <input
              className="input-style"
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="6 characters or more"
            />
          </Field>
          <Field label="Confirm Password">
            <input
              className="input-style"
              type="password"
              value={form.confirmPassword}
              onChange={(event) =>
                updateField("confirmPassword", event.target.value)
              }
              placeholder="Repeat password"
            />
          </Field>
        </div>

        {error ? (
          <p className="mt-4 text-sm font-bold text-red-500">{error}</p>
        ) : null}
        {successMessage ? (
          <p className="mt-4 text-sm font-bold text-emerald-600">
            {successMessage}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="mt-6 rounded-full bg-amber-600 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "Creating..." : "Create therapist account"}
        </button>
      </article>

      <aside className="rounded-[32px] border border-slate-200 bg-amber-50 p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
          Notes
        </p>
        <ul className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-700">
          <li>Only admin sessions can provision therapist accounts</li>
          <li>Therapist accounts use the same auth/session infrastructure</li>
          <li>Current UI opens the therapist console after login through role-based routes</li>
          <li>Later this can move into a dedicated admin settings area</li>
        </ul>
      </aside>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
