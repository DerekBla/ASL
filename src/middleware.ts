import { NextResponse } from "next/server";
import type { NextMiddleware } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Portfolio and admin need a signed-in user; stats and market pages stay public (clerk.md).
const isProtected = createRouteMatcher(["/portfolio(.*)", "/admin(.*)"]);

const authEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const withClerk = clerkMiddleware(async (auth, request) => {
  if (isProtected(request)) await auth.protect();
});

// Without Clerk keys the site runs as a stats site; middleware lets everything through.
const middleware: NextMiddleware = authEnabled ? withClerk : () => NextResponse.next();

export default middleware;

export const config = {
  matcher: [
    // Everything except Next.js internals and static files, plus API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
