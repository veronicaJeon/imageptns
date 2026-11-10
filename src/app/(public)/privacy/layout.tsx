import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "개인정보처리방침", description: "이미지파트너스의 개인정보 수집, 이용, 보유와 파기 기준을 안내합니다.", path: "/privacy" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
