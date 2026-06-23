import type { Link } from './schemas/link.schema';

/** The expiry guard — the whole of Tracer's "lifecycle". A link is expired once `expires_at` passes. */
export function isExpired(link: Pick<Link, 'expires_at'>, now: Date = new Date()): boolean {
  if (link.expires_at === null || link.expires_at === undefined) return false;
  return new Date(link.expires_at).getTime() <= now.getTime();
}

/** A link is active (resolvable) until it expires. */
export function isActive(link: Pick<Link, 'expires_at'>, now: Date = new Date()): boolean {
  return !isExpired(link, now);
}
