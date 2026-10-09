import type { Metadata } from "next";
import type { ReactElement } from "react";

import { EloRatings } from "@/features/stats";

export const metadata: Metadata = {
  title: "ELO ratings",
  description: "ELO from individual games for every ASL player, current and peak.",
};

export default function EloPage(): ReactElement {
  return <EloRatings withQualifiers={false} />;
}
