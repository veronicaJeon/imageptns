import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "라이선스 안내", description: "이미지별 저작자 표시, 상업 이용과 변경 가능 여부를 확인하세요.", path: "/license-guide" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
