import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-6 py-20 text-center">
      <div className="max-w-md">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">404</p>
        <h1 className="mt-4 font-headline text-3xl font-extrabold text-on-surface">페이지를 찾을 수 없습니다.</h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
          주소가 변경되었거나 더 이상 제공되지 않는 페이지입니다. 라이브러리에서 필요한 이미지를 다시 찾아보세요.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/library" className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-white hover:bg-primary/90">
            라이브러리 보기
          </Link>
          <Link href="/contact" className="inline-flex h-11 items-center rounded-full border border-outline-variant px-5 text-sm font-bold text-on-surface hover:bg-surface-container-low">
            문의하기
          </Link>
        </div>
      </div>
    </main>
  );
}
