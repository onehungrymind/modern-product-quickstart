import { z } from 'zod';
import { SLUG_PATTERN } from '../slug';

/**
 * Link — a short slug that redirects to a target URL. The aggregate Tracer is built around.
 *
 * Wire contract (snake_case). A link is "active" unless `expires_at` has passed — there is
 * no lifecycle state machine (the domain doesn't earn one; see ARCHITECTURE.md scaling-down).
 */
export const LinkSchema = z.object({
  id: z.uuid(),
  slug: z.string().regex(SLUG_PATTERN, 'slug must be base32 (no ambiguous chars), 4–32 long'),
  target_url: z.url(),
  title: z.string().max(200).nullable().optional(),
  owner_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
});

export type Link = z.infer<typeof LinkSchema>;

/** Input to create a link. The server mints `id`, `slug` (if omitted), `owner_id`, `created_at`. */
export const CreateLinkSchema = z.object({
  target_url: z.url(),
  title: z.string().max(200).nullable().optional(),
  slug: z.string().regex(SLUG_PATTERN).optional(),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
});

export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;
