import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { getMapBySlug, getMaps, mapSlug } from "@/lib/services/stats";

import { MapDetail } from "@/features/stats";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return getMaps().map((m) => ({ slug: mapSlug(m.map) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const map = getMapBySlug((await params).slug);
  if (!map) return {};
  return {
    title: map.map,
    description: `${map.map} in the ASL: ${map.games} games, race against race and every player's record.`,
  };
}

export default async function MapPage({ params }: Props): Promise<ReactElement> {
  const map = getMapBySlug((await params).slug);
  if (!map) notFound();
  return (
    <div className="flex flex-col gap-6">
      <h1>{map.map}</h1>
      <MapDetail map={map} />
    </div>
  );
}
