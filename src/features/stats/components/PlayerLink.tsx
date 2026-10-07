import Link from "next/link";
import type { ReactElement } from "react";

import { playerSlug } from "@/lib/services/stats";

type Props = {
  name: string;
};

export function PlayerLink({ name }: Props): ReactElement {
  return (
    <Link href={`/players/${playerSlug(name)}`} className="font-medium">
      {name}
    </Link>
  );
}
