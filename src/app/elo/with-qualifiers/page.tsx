import type { Metadata } from "next";
import type { ReactElement } from "react";

import { EloRatings } from "@/features/stats";

export const metadata: Metadata = {
  title: "ELO ratings with qualifiers",
  description: "ELO from individual games for every ASL player, with qualifier games counted.",
};

export default function EloWithQualifiersPage(): ReactElement {
  return <EloRatings withQualifiers />;
}
