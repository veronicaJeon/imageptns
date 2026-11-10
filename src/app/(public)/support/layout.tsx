import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = publicPageMetadata({
  title: "고객 지원",
  description: "Image Partners 이용 안내와 자주 묻는 질문을 확인하세요.",
  path: "/support",
});

export default function SupportLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
