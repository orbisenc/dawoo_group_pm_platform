import { notFound } from "next/navigation";

import { SectionContent } from "../../components/dashboard/section-content";
import { getNavigationItem, sectionSlugs } from "../../lib/navigation";

export function generateStaticParams() {
  return sectionSlugs.map((section) => ({ section }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = getNavigationItem(section);
  return { title: item ? `${item.label} | 다우그룹 PROJECT HUB` : "다우그룹 PROJECT HUB" };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sectionSlugs.includes(section)) notFound();
  return <SectionContent slug={section} />;
}
