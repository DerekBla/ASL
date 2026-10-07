/** Every TanStack Query key in one place (data-fetching.md). */
export const queryKeys = {
  markets: {
    all: ["markets"] as const,
    detail: (slug: string) => ["markets", slug] as const,
  },
  me: {
    market: (slug: string) => ["me", "market", slug] as const,
  },
} as const;
