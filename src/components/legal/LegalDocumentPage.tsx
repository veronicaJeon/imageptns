import { getPublicLegalDocument } from "@/lib/legal/server";
import type { LegalDocumentSlug } from "@/lib/legal/content";

interface LegalDocumentPageProps {
  slug: LegalDocumentSlug;
}

function formatDate(value: string | null) {
  if (!value) return "Initial notice";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export async function LegalDocumentPage({ slug }: LegalDocumentPageProps) {
  const document = await getPublicLegalDocument(slug);

  return (
    <section className="min-h-screen bg-surface px-6 pb-28 pt-36">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Legal Notice</p>
        <h1 className="mt-4 font-headline text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
          {document.title}
        </h1>
        <p className="mt-4 border-b border-outline-variant/30 pb-6 text-sm text-outline">
          Last updated: {formatDate(document.updatedAt ?? document.publishedAt)}
        </p>
        <div className="mt-10 whitespace-pre-wrap text-sm leading-8 text-on-surface-variant md:text-base">
          {document.body}
        </div>
      </div>
    </section>
  );
}
