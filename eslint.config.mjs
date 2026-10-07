import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// Layer map from Harness/architecture.md, top to bottom. A layer may import only from layers
// below it, so each entry lists the folders it must NOT import from.
const APP = "./src/app";
const FEATURES = "./src/features";
const SHARED_UI = "./src/components";
const DATA = ["./src/lib/queries", "./src/lib/actions"];
const STORES = "./src/lib/stores";
const SERVICES = "./src/lib/services";
const FOUNDATION = [
  "./src/lib/market",
  "./src/lib/types",
  "./src/lib/utils",
  "./src/lib/config",
  "./src/lib/db",
];
const FEATURE_DOMAINS = ["stats", "markets", "portfolio", "leaderboard", "admin"];

const forbid = (targets, from, message) =>
  [targets].flat().flatMap((target) => [from].flat().map((f) => ({ target, from: f, message })));

const layerZones = [
  ...forbid(FEATURES, APP, "Features must not import from routes."),
  ...forbid(
    SHARED_UI,
    [APP, FEATURES, ...DATA, STORES, SERVICES],
    "Shared UI may import only from Foundation (arch-2).",
  ),
  ...forbid(
    DATA,
    [APP, FEATURES, SHARED_UI, STORES],
    "The data layer may import only from Services and Foundation.",
  ),
  ...forbid(
    STORES,
    [APP, FEATURES, SHARED_UI, ...DATA, SERVICES],
    "Stores may import only from Foundation (arch-4).",
  ),
  ...forbid(
    SERVICES,
    [APP, FEATURES, SHARED_UI, ...DATA, STORES],
    "Services may import only from Foundation.",
  ),
  ...forbid(
    FOUNDATION,
    [APP, FEATURES, SHARED_UI, ...DATA, STORES, SERVICES],
    "Foundation imports nothing from the layers above it (arch-6 for lib/market).",
  ),
  // No sideways imports between sibling features (arch-1).
  ...FEATURE_DOMAINS.map((domain) => ({
    target: `${FEATURES}/${domain}`,
    from: FEATURES,
    except: [`./${domain}`],
    message: "Features must not import from sibling features (arch-1).",
  })),
];

const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "coverage/**",
      "node_modules/**",
      "next-env.d.ts",
      "data/**",
      "scripts/**",
      "Docs/**",
      "Harness/**",
      ".claude/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      "import/no-restricted-paths": ["error", { zones: layerZones }],
      "import/no-cycle": "error",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          pathGroups: [
            {
              pattern: "{react,react-dom,react-dom/**,next,next/**}",
              group: "builtin",
              position: "before",
            },
            { pattern: "@/lib/**", group: "internal", position: "before" },
            { pattern: "@/features/**", group: "internal" },
            { pattern: "@/components/**", group: "internal", position: "after" },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          distinctGroup: true,
          "newlines-between": "always",
        },
      ],
      "import/no-default-export": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@next/next/no-img-element": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Next.js requires default exports for route files and middleware; tool configs use them too.
    files: [
      "src/app/**/{page,layout,loading,error,not-found,template,default}.tsx",
      "*.config.{ts,mjs}",
      "src/middleware.ts",
    ],
    rules: { "import/no-default-export": "off" },
  },
];

export default config;
