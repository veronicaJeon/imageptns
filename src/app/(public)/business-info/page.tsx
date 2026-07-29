import Link from "next/link";
import { getPublicBusinessDisclosure } from "@/lib/legal/disclosure-server";
import { publicDisclosureRows } from "@/lib/legal/disclosure";

export const dynamic = "force-dynamic";

export default async function BusinessInfoPage() {
  const disclosure = await getPublicBusinessDisclosure();
  const rows = disclosure ? publicDisclosureRows(disclosure) : [];

  return (
    <section className="min-h-screen bg-surface px-6 pb-28 pt-36">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Business Disclosure</p>
        <h1 className="mt-4 font-headline text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
          사업자정보·공시사항
        </h1>

        {!disclosure ? (
          <div className="mt-10 rounded bg-surface-container-lowest p-8 shadow-ghost">
            <p className="font-bold text-on-surface">공시사항을 준비하고 있습니다.</p>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              현재 공개 연락처는 contact@imagepartners.kr입니다. 이미지 사용과 견적은 문의 페이지에서 접수할 수 있습니다.
            </p>
            <Link href="/contact" className="mt-6 inline-block rounded bg-primary px-6 py-3 text-xs font-bold text-white">
              문의하기
            </Link>
          </div>
        ) : (
          <>
            <dl className="mt-10 divide-y divide-outline-variant/30 bg-surface-container-lowest px-6 shadow-ghost">
              {rows.map(([label, value]) => (
                <div key={label} className="grid gap-2 py-5 sm:grid-cols-[180px_1fr]">
                  <dt className="text-sm font-bold text-outline">{label}</dt>
                  <dd className="text-sm text-on-surface">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 grid gap-6">
              <article className="bg-surface-container-lowest p-6 shadow-ghost">
                <h2 className="font-headline text-lg font-extrabold text-on-surface">취소·환불 정책</h2>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">
                  {disclosure.refund_policy}
                </p>
              </article>
              <article className="bg-surface-container-lowest p-6 shadow-ghost">
                <h2 className="font-headline text-lg font-extrabold text-on-surface">결제 증빙 발급 정책</h2>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">
                  {disclosure.receipt_policy}
                </p>
              </article>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
