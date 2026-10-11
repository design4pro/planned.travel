/**
 * The wire shape of the library writes, loaded without a Worker: `library.ts` reaches the session
 * and the database client, so a plain Node test could only bind to its validator by a type
 * assertion. This module imports no binding.
 */
import { z } from 'zod'

/**
 * A new collection is always shared with the workspace, so the dialog sends no visibility.
 *
 * `visibility` stays a key only so a tab loaded before the deploy keeps working when it sends the
 * default; `private` and `public` are refused rather than dropped, because dropping them would
 * quietly share a collection its author asked to keep to themselves. Enforcing owner-only access
 * belongs to the sharing-roles stage of the saved-places plan (`docs/plans/08-product-modules.md`).
 */
export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  colour: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/),
  visibility: z.literal('organization').optional(),
})
