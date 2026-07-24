import { AboutPageView } from "@/components/about/AboutPageView";
import { getPublicAboutPageContent } from "@/lib/about/server";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const content = await getPublicAboutPageContent();
  return <AboutPageView content={content} />;
}
