/** screp-js ships no types. This covers the one call the site makes. */
declare module "screp-js" {
  import type { ParsedReplay } from "@/lib/replay/readReplay";

  const Screp: {
    parseBuffer(bytes: Uint8Array, options?: { cmds?: boolean }): Promise<ParsedReplay>;
  };
  // eslint-disable-next-line import/no-default-export -- the package exports it this way
  export default Screp;
}
