import type { Metadata } from "next";

const SITE_ORIGIN = "https://www.imagepartners.kr";

export function publicPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = new URL(path, SITE_ORIGIN).toString();
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "Image Partners",
      locale: "ko_KR",
      title,
      description,
      url: canonical,
    },
  };
}
