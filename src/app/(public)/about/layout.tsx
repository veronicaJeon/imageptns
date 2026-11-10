import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "회사 소개", description: "이미지파트너스가 출처와 권리, 프로젝트 적합성을 검토하는 방식을 소개합니다.", path: "/about" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
