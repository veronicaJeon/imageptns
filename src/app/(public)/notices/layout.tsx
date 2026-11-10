import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "공지사항", description: "이미지파트너스 서비스 운영과 변경 사항을 확인하세요.", path: "/notices" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
