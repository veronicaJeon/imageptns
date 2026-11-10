import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "사업자정보·공시사항", description: "이미지파트너스의 사업자정보와 거래 관련 공시사항을 확인하세요.", path: "/business-info" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
