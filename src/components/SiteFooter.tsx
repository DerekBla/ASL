import type { ReactElement } from "react";

import {
  DISCLAIMER,
  LIQUIPEDIA_LICENSE_URL,
  LIQUIPEDIA_URL,
  PLAY_MONEY_NOTICE,
} from "@/lib/config/site";

export function SiteFooter(): ReactElement {
  return (
    <footer className="mt-16 border-t border-line/70">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 px-4 py-8 text-caption text-ink-muted">
        <p>{DISCLAIMER}</p>
        <p>{PLAY_MONEY_NOTICE}</p>
        <p>
          Tournament results are derived from <a href={LIQUIPEDIA_URL}>Liquipedia</a>, licensed
          under <a href={LIQUIPEDIA_LICENSE_URL}>CC-BY-SA 3.0</a>.
        </p>
      </div>
    </footer>
  );
}
