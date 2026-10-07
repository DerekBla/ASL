import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import { ClerkProvider } from "@clerk/nextjs";

import { isAuthEnabled } from "@/lib/config/env";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config/site";
import { QueryProvider } from "@/lib/queries/QueryProvider";

import { AccountMenu } from "@/features/markets/components/AccountMenu";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
};

type Props = {
  children: ReactNode;
};

export default function RootLayout({ children }: Props): ReactElement {
  const auth = isAuthEnabled();
  const page = (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <QueryProvider>
          <SiteHeader account={auth ? <AccountMenu /> : null} />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
          <SiteFooter />
        </QueryProvider>
      </body>
    </html>
  );
  // Without Clerk keys the site runs as a stats site, so the provider is only added with them.
  return auth ? <ClerkProvider signInUrl="/sign-in">{page}</ClerkProvider> : page;
}
