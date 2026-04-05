import type { Metadata } from "next";
import { Epilogue, Inter } from "next/font/google";
import "./globals.css";

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
  title: "Image Partners — The Digital Curator",
  description: "프리미엄 스톡 이미지 플랫폼. 큐레이션된 고품질 이미지를 찾아보세요.",
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
      <body className="min-h-full flex flex-col bg-surface text-on-surface font-body">
        {children}
      </body>
    </html>
  );
}
