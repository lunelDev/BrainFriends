import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { getAdminDocumentGroup } from "../../_lib/document-groups";

const DOCUMENT_FILE_PATHS: Record<"summary" | "sw-vnv" | "cyber-ai", string[]> = {
  summary: [
    "docs/remediation/00-summary/brainfriends-product-definition-one-pager.md",
    "docs/remediation/00-summary/submission-readiness-summary.md",
    "docs/remediation/00-summary/test-lab-inquiry-one-pager.md",
    "docs/remediation/00-summary/samd-gap-checklist.md",
  ],
  "sw-vnv": [
    "docs/remediation/01-sw-vnv/sw-vnv-submission-outline.md",
    "docs/remediation/01-sw-vnv/sw-vnv-current-test-report.md",
    "docs/remediation/01-sw-vnv/sw-vnv-defect-retest-log.md",
  ],
  "cyber-ai": [
    "docs/remediation/02-cybersecurity/cybersecurity-final-readiness-report.md",
    "docs/remediation/03-ai-evaluation/ai-evaluation-current-report.md",
    "docs/remediation/03-ai-evaluation/ai-evaluation-dataset-definition.md",
  ],
};

type MarkdownInlinePart =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; label: string; href: string };

function extractDocumentTitle(content: string, fallback: string) {
  const firstHeading = content
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("# "));
  return firstHeading ? firstHeading.replace(/^#\s+/, "").trim() : fallback;
}

function normalizeDocumentTitle(title: string) {
  return title.replace(/^BrainFriends\s+/i, "").trim();
}

function renderInlineParts(text: string): MarkdownInlinePart[] {
  const parts: MarkdownInlinePart[] = [];
  const regex = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const token = match[0];
    if (token.startsWith("`")) {
      parts.push({ type: "code", value: token.slice(1, -1) });
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push({ type: "link", label: linkMatch[1], href: linkMatch[2] });
      } else {
        parts.push({ type: "text", value: token });
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = renderInlineParts(text);
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "code") {
          return (
            <code
              key={`${part.type}-${index}`}
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-700"
            >
              {part.value}
            </code>
          );
        }

        if (part.type === "link") {
          const href = part.href.match(/^[A-Za-z]:\//)
            ? `file:///${part.href.replace(/\\/g, "/")}`
            : part.href;
          return (
            <a
              key={`${part.type}-${index}`}
              href={href}
              className="font-semibold text-sky-700 underline decoration-sky-200 underline-offset-2"
            >
              {part.label}
            </a>
          );
        }

        return <span key={`${part.type}-${index}`}>{part.value}</span>;
      })}
    </>
  );
}

function renderMarkdown(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const isTableLine = (line: string) => /^\|.*\|$/.test(line.trim());
  const isTableDivider = (line: string) =>
    /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const fence = line.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      elements.push(
        <div key={`code-${key++}`} className="overflow-hidden rounded-[18px] border border-slate-200 bg-[#111827]">
          {fence ? (
            <div className="border-b border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
              {fence}
            </div>
          ) : null}
          <pre className="overflow-x-auto px-4 py-4 text-sm leading-6 text-slate-100">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>,
      );
      continue;
    }

    if (isTableLine(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i += 1;
      }

      if (tableLines.length >= 2 && isTableDivider(tableLines[1])) {
        const parseCells = (tableLine: string) =>
          tableLine
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim());
        const headers = parseCells(tableLines[0]);
        const rows = tableLines.slice(2).map(parseCells);
        elements.push(
          <div key={`table-${key++}`} className="overflow-hidden rounded-[18px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-700">
                    {headers.map((header, headerIndex) => (
                      <th key={`header-${headerIndex}`} className="px-4 py-3 font-black">
                        <InlineMarkdown text={header} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`cell-${rowIndex}-${cellIndex}`} className="px-4 py-3 font-medium text-slate-700">
                          <InlineMarkdown text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>,
        );
      } else {
        elements.push(
          <div key={`table-fallback-${key++}`} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
            {tableLines.map((tableLine, index) => (
              <p key={`table-line-${index}`} className={index > 0 ? "mt-2" : undefined}>
                {tableLine}
              </p>
            ))}
          </div>,
        );
      }
      continue;
    }

    const headingMatch = rawLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const classes =
        level === 1
          ? "text-2xl font-black text-slate-950"
          : level === 2
            ? "text-xl font-black text-slate-950"
            : "text-base font-black text-slate-900";
      elements.push(
        <div key={`heading-${key++}`} className={level <= 2 ? "pt-2" : undefined}>
          <p className={classes}>
            <InlineMarkdown text={headingText} />
          </p>
        </div>,
      );
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const orderedLines: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        orderedLines.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      elements.push(
        <ol key={`ol-${key++}`} className="list-decimal space-y-2 pl-5 text-sm font-medium leading-7 text-slate-700">
          {orderedLines.map((item, index) => (
            <li key={`ol-item-${index}`}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const bulletLines: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        bulletLines.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      elements.push(
        <ul key={`ul-${key++}`} className="list-disc space-y-2 pl-5 text-sm font-medium leading-7 text-slate-700">
          {bulletLines.map((item, index) => (
            <li key={`ul-item-${index}`}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s+/.test(lines[i].trim()) &&
      !/^```/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !isTableLine(lines[i].trim())
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }

    if (paragraphLines.length) {
      elements.push(
        <p key={`p-${key++}`} className="text-sm font-medium leading-7 text-slate-700">
          <InlineMarkdown text={paragraphLines.join(" ")} />
        </p>,
      );
    }
  }

  return elements;
}

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

  const filePaths = DOCUMENT_FILE_PATHS[group.slug];
  const documents = await Promise.all(
    filePaths.map(async (relativePath) => {
      const absolutePath = path.join(process.cwd(), relativePath);
      const content = await fs.readFile(absolutePath, "utf8");
      return {
        relativePath,
        title: normalizeDocumentTitle(extractDocumentTitle(content, path.basename(relativePath))),
        content,
      };
    }),
  );

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin?section=samd"
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
                Document Reader
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {group.label}
              </h1>
            </div>
          </div>

          <p className="mt-4 text-base font-medium leading-7 text-slate-600">
            {group.description}
          </p>

          <div className="mt-6 space-y-4">
            <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-black text-slate-900">핵심 정리</p>
              <ul className="mt-4 space-y-2 text-sm font-medium leading-7 text-slate-700">
                {group.highlights.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-black text-slate-900">다음 확인 항목</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm font-medium leading-7 text-slate-700">
                {group.nextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </article>
          </div>
        </section>

        <section className="sticky top-4 z-20 rounded-[24px] border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">포함 문서</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  아래 문서를 눌러 바로 해당 본문으로 이동합니다.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                총 {documents.length}개 문서
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="flex min-w-max flex-wrap gap-x-5 gap-y-2 pb-1">
                {documents.map((document) => (
                  <a
                    key={document.relativePath}
                    href={`#${document.relativePath.replace(/[^\w-]+/g, "-")}`}
                    className="shrink-0 text-sm font-black text-sky-700 underline decoration-sky-200 underline-offset-4 transition hover:text-sky-800"
                  >
                    {document.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {documents.map((document) => (
            <article
              key={document.relativePath}
              id={document.relativePath.replace(/[^\w-]+/g, "-")}
              className="scroll-mt-40 rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">{document.title}</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      {document.relativePath}
                    </p>
                  </div>
                  <a
                    href={`file:///${path.join(process.cwd(), document.relativePath).replace(/\\/g, "/")}`}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    원문 열기
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="mt-6 space-y-5">{renderMarkdown(document.content)}</div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
