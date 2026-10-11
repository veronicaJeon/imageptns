import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityTracker } from "@/components/analytics/ActivityTracker";
import { LangHydrator } from "@/components/i18n/LangHydrator";
import "./globals.css";

// Material Symbols는 globals.css에서 @import 또는 head link로 추가

export const metadata: Metadata = {
  title: "Image Partners",
  description: "프리미엄 스톡 이미지 플랫폼. 큐레이션된 고품질 이미지를 찾아보세요.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        {/* 한글 본문·제목 서체: Pretendard (한글 글리프 포함, 사용 글자 단위로 나눠 받는 dynamic subset) */}
        <link
          rel="stylesheet"
          crossOrigin=""
          href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-on-surface font-body">
        <LangHydrator />
        <Suspense fallback={null}>
          <ActivityTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
