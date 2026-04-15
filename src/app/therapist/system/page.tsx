import Link from "next/link";

const SYSTEM_LINKS = [
  {
    title: "Training Usage Admin",
    href: "/tools/training-usage-admin",
    body: "All-patient event monitoring, search, filtering, and CSV export.",
  },
  {
    title: "Training Usage Timeline",
    href: "/tools/training-usage-timeline",
    body: "Single-patient event history for follow-up on failed or skipped operations.",
  },
];

export default function TherapistSystemPage() {
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-600">
          System
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
          Therapist-side operations need a clear handoff into admin tools.
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
          This route is for save-state checks, timeline review, and later audit
          tooling. For now it links directly to the operational pages that
          already exist in the project.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {SYSTEM_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 transition hover:bg-white hover:shadow-sm"
            >
              <h3 className="text-lg font-black text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                {item.body}
              </p>
              <span className="mt-5 inline-flex text-sm font-black text-amber-700">
                Open page
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-[24px] border border-amber-200 bg-white p-5">
          <p className="text-sm font-black text-slate-900">
            Admin-only therapist provisioning
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
            Use the provisioning screen to create therapist accounts without
            exposing role selection in the public signup flow.
          </p>
          <Link
            href="/therapist/system/provision"
            className="mt-4 inline-flex rounded-full bg-amber-600 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-700"
          >
            Open provisioning
          </Link>
        </div>
      </article>

      <aside className="rounded-[32px] border border-slate-200 bg-amber-50 p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
          Later
        </p>
        <ul className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-700">
          <li>Save-failure queue and retry actions</li>
          <li>Audit log search by patient, session, or event type</li>
          <li>Security-policy exceptions and blocked storage attempts</li>
          <li>Evaluation-sample ingestion and dataset monitoring</li>
        </ul>
      </aside>
    </section>
  );
}
