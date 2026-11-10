import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "이용 가격", description: "이미지 사용권과 이용 조건별 가격 안내를 확인하세요.", path: "/pricing" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
