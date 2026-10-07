/**
 * Environment variables, validated with Zod (ts-3). Server-side only.
 *
 * Markets and sign-in are optional: without the Neon and Clerk keys the site still builds and
 * serves every stats page, and the market pages say markets aren't switched on yet.
 */
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  DATABASE_URL_TEST: z.string().url().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

function blankToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse({
    DATABASE_URL: blankToUndefined(source.DATABASE_URL),
    DATABASE_URL_UNPOOLED: blankToUndefined(source.DATABASE_URL_UNPOOLED),
    DATABASE_URL_TEST: blankToUndefined(source.DATABASE_URL_TEST),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: blankToUndefined(source.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    CLERK_SECRET_KEY: blankToUndefined(source.CLERK_SECRET_KEY),
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${fields}. See .env.example.`);
  }
  return parsed.data;
}

/** Sign-in works when both Clerk keys are set. */
export function isAuthEnabled(env: Env = readEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
}

/** Markets work when there is a database and sign-in. */
export function isMarketsEnabled(env: Env = readEnv()): boolean {
  return Boolean(env.DATABASE_URL) && isAuthEnabled(env);
}
