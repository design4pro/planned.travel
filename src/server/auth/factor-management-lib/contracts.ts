import { z } from 'zod'

export const factorKind = z.enum(['enable', 'replace', 'disable', 'backup'])
export const operationKind = z.enum(['revoke-others', ...factorKind.options])
export const possessionProof = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('totp'), code: z.string().regex(/^[0-9]{6}$/) })
    .strict(),
  z
    .object({ kind: z.literal('backup'), code: z.string().min(1).max(64) })
    .strict(),
])
export const factorIntent = z
  .object({
    id: z.string().uuid(),
    intent: z.string().uuid(),
    operation: factorKind,
  })
  .strict()
export const prepareInput = factorIntent.extend({
  operation: z.enum(['enable', 'replace']),
  password: z.string().min(1).max(128),
  proof: possessionProof.optional(),
})
export const commitInput = factorIntent.extend({
  operation: z.enum(['enable', 'replace']),
  confirm: z.literal(true),
  proposalId: z.string().uuid(),
  code: z.string().regex(/^[0-9]{6}$/),
})
export const changeInput = factorIntent.extend({
  confirm: z.literal(true),
  password: z.string().min(1).max(128),
  proof: possessionProof,
})
const reservation = z.object({
  domain: z.enum(['active', 'proposal']),
  version: z.number().int().nonnegative(),
  recoveryAt: z.number().int(),
})
export const proposalPayload = z.object({
  expected: z.object({
    enabled: z.boolean(),
    credential: z
      .object({ id: z.string(), password: z.string().nullable() })
      .nullable(),
    factor: z
      .object({
        id: z.string(),
        userId: z.string(),
        secret: z.string(),
        backupCodes: z.string(),
        verified: z.boolean(),
        failedVerificationCount: z.number(),
        lockedUntil: z.coerce.date().nullable(),
      })
      .nullable(),
  }),
  proposed: z.object({
    id: z.string(),
    secret: z.string(),
    backupCodes: z.string(),
  }),
  reservations: z.array(reservation).max(1),
  replay: z
    .array(
      z.object({ digest: z.string(), step: z.number().int().nonnegative() }),
    )
    .max(1),
})
