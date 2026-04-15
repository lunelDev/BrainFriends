import Link from "next/link";

const DASHBOARD_CARDS = [
  {
    title: "Patient lookup",
    body: "Open patient reports and move from timeline review to patient-level analysis.",
    href: "/therapist/patients",
    cta: "Go to patients",
  },
  {
    title: "Clinical results",
    body: "Review saved result history, measured quality, and V&V-linked output paths.",
    href: "/therapist/results",
    cta: "Go to results",
  },
  {
    title: "System follow-up",
    body: "Track usage events, failed saves, and admin-side operational checks.",
    href: "/therapist/system",
    cta: "Go to system",
  },
];

export default function TherapistOverviewPage() {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
          Clinical Workflow
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
          Therapist UI should stay focused on interpretation and traceability.
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {DASHBOARD_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
            >
              <h3 className="text-lg font-black text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                {card.body}
              </p>
              <span className="mt-5 inline-flex text-sm font-black text-sky-700">
                {card.cta}
              </span>
            </Link>
          ))}
        </div>
      </article>

      <aside className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-300">
          Scope
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight">
          What this shell owns now
        </h2>
        <ul className="mt-5 space-y-3 text-sm font-medium leading-6 text-slate-200">
          <li>Patient search and report entry points</li>
          <li>Saved-result review and measured-quality visibility</li>
          <li>Usage timeline, failed-save follow-up, and admin routing</li>
          <li>Future home for therapist-only charts, notes, and exports</li>
        </ul>
        <div className="mt-6 rounded-[24px] bg-white/10 p-4">
          <p className="text-sm font-black text-white">Current implementation note</p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-200">
            This is a shell layer. Existing operational pages still live under
            <span className="mx-1 rounded bg-white/10 px-2 py-0.5 font-mono text-xs">
              /tools/*
            </span>
            and are linked from here until dedicated therapist screens replace them.
          </p>
        </div>
      </aside>
    </section>
  );
}
