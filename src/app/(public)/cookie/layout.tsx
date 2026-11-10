import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "쿠키 정책", description: "이미지파트너스의 쿠키 및 유사 기술 이용 기준을 안내합니다.", path: "/cookie" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
