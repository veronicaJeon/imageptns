import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "문의·이미지 요청", description: "원하는 이미지, 견적과 라이선스 이용 조건을 이미지파트너스에 문의하세요.", path: "/contact" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
