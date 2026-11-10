import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({ title: "이미지 라이브러리", description: "검토된 이미지를 주제, 방향, 사용 조건에 따라 검색하고 라이선스를 확인하세요.", path: "/library" });

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
