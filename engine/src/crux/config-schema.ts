import { z } from "zod";

export const PageType = z.enum(["homepage", "checkout", "plp", "pdp"]);
export type PageType = z.infer<typeof PageType>;

export const GroupName = z.enum([
  "walmart_propios",
  "walmart_subsidiarias",
  "otros",
]);
export type GroupName = z.infer<typeof GroupName>;

export const CruxPageEntry = z.object({
  type: PageType,
  url: z.string().url().nullable(),
});

export const CruxSiteConfig = z.object({
  origin: z.string().min(1),
  group: GroupName,
  label: z.string().min(1),
  country: z.string().length(2),
  pages: z.array(CruxPageEntry).min(1),
});

export const CruxPagesConfig = z.object({
  version: z.number().int().positive().default(1),
  sites: z.array(CruxSiteConfig).min(1),
});

export type CruxPageEntryT = z.infer<typeof CruxPageEntry>;
export type CruxSiteConfigT = z.infer<typeof CruxSiteConfig>;
export type CruxPagesConfigT = z.infer<typeof CruxPagesConfig>;
