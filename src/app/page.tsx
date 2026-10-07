import type { ReactElement } from "react";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config/site";

export default function HomePage(): ReactElement {
  return (
    <>
      <h1>{SITE_NAME}</h1>
      <p>{SITE_DESCRIPTION}</p>
      <p>The stats pages and markets are under construction.</p>
    </>
  );
}
