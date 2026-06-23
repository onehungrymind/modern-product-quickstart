import { z } from 'zod';

/**
 * User — the link owner. Public shape only.
 *
 * `password_hash` is deliberately absent: it is `select: false` on the entity and
 * never crosses the wire. Auth concerns live in the API layer, not the shared core.
 */
export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1, 'name must be non-empty').max(120, 'name must be at most 120 characters'),
  created_at: z.iso.datetime({ offset: true }),
});

export type User = z.infer<typeof UserSchema>;
