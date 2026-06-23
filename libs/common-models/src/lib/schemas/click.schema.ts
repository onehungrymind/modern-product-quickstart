import { z } from 'zod';

/**
 * Click — one resolution of a link's hot path (`GET /:slug`). Append-only analytics record.
 *
 * The IP is stored hashed (`ip_hash`), never raw — a privacy default carried into the seed.
 */
export const ClickSchema = z.object({
  id: z.uuid(),
  link_id: z.uuid(),
  occurred_at: z.iso.datetime({ offset: true }),
  ip_hash: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

export type Click = z.infer<typeof ClickSchema>;

/** Aggregated analytics for a link's detail view. */
export const ClickStatsSchema = z.object({
  link_id: z.uuid(),
  total: z.number().int().nonnegative(),
  recent: z.array(ClickSchema),
});

export type ClickStats = z.infer<typeof ClickStatsSchema>;
