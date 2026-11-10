import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "이용약관", description: "이미지파트너스 서비스 이용약관입니다.", path: "/terms" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
