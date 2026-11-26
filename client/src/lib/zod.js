import { z } from 'zod';

/**
 * Zod without its eval-based fast path: the production Content-Security-Policy
 * forbids eval, and Zod would otherwise probe for it (a CSP violation report on
 * every page that validates a form). Our forms are small, so nothing is lost.
 */
z.config({ jitless: true });

export { z };
