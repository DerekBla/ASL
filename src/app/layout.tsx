import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config/site";

import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
};

type Props = {
  children: ReactNode;
};

export default function RootLayout({ children }: Props): ReactElement {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
