import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { getAdminDocumentGroup } from "../../_lib/document-groups";

export default async function AdminDocumentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = getAdminDocumentGroup(slug);

  if (!group) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            관리자 화면으로
          </Link>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-600" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-600">
                Document Detail
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {group.label}
              </h1>
            </div>
          </div>

          <p className="mt-4 text-base font-medium leading-7 text-slate-600">
            {group.description}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-black text-slate-900">문서 경로</p>
              <p className="mt-3 text-sm font-semibold text-slate-600">{group.path}</p>
            </article>
            <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 md:col-span-2">
              <p className="text-sm font-black text-slate-900">포함 문서</p>
              <ul className="mt-3 space-y-2 text-sm font-medium text-slate-700">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">핵심 정리</h2>
            <ul className="mt-5 space-y-3 text-sm font-medium leading-6 text-slate-700">
              {group.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">다음 확인 항목</h2>
            <ol className="mt-5 space-y-3 text-sm font-medium leading-6 text-slate-700">
              {group.nextSteps.map((item, index) => (
                <li key={item}>
                  {index + 1}. {item}
                </li>
              ))}
            </ol>
          </article>
        </section>
      </div>
    </main>
  );
}
