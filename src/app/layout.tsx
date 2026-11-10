import type { Metadata } from "next";
import { Epilogue, Inter } from "next/font/google";
import { Suspense } from "react";
import { ActivityTracker } from "@/components/analytics/ActivityTracker";
import { LangHydrator } from "@/components/i18n/LangHydrator";
import "./globals.css";

// Material Symbols는 globals.css에서 @import 또는 head link로 추가

const epilogue = Epilogue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.imagepartners.kr"),
  title: {
    default: "Image Partners — The Digital Curator",
    template: "%s | Image Partners",
  },
  description: "프리미엄 스톡 이미지 플랫폼. 큐레이션된 고품질 이미지를 찾아보세요.",
  applicationName: "Image Partners",
  keywords: ["이미지파트너스", "스톡 이미지", "에디토리얼 이미지", "이미지 라이선스", "사진 라이브러리"],
  openGraph: {
    type: "website",
    siteName: "Image Partners",
    locale: "ko_KR",
    title: "Image Partners — The Digital Curator",
    description: "출처와 권리를 검토한 이미지를 검색하고 프로젝트에 맞는 사용권을 확인하세요.",
    url: "https://www.imagepartners.kr",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "Image Partners" }],
  },
  twitter: {
    card: "summary",
    title: "Image Partners — The Digital Curator",
    description: "출처와 권리를 검토한 이미지 라이브러리",
    images: ["/icon.png"],
  },
  robots: { index: true, follow: true },
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
      className={`${epilogue.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
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
