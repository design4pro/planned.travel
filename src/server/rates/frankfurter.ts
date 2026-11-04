import { z } from 'zod'
import { MIN_EXCHANGE_RATE, MAX_EXCHANGE_RATE } from '#/lib/money'
import { ECB_REFERENCE_CURRENCIES } from '#/lib/currency-list'

export const PUBLIC_RATES_URL =
  'https://api.frankfurter.dev/v2/providers/ecb/rates?base=EUR'

const rate = z.number().finite().min(MIN_EXCHANGE_RATE).max(MAX_EXCHANGE_RATE)
const date = z.iso.date()
export const snapshotSchema = z.strictObject({
  version: z.literal(1),
  provider: z.literal('frankfurter-ecb'),
  source: z.literal('ECB'),
  base: z.literal('EUR'),
  effectiveOn: date,
  fetchedAt: z.number().int().nonnegative().safe(),
  rates: z
    .partialRecord(z.enum(ECB_REFERENCE_CURRENCIES), rate)
    .refine((values) => values.EUR === 1),
})
export type PublicSnapshot = z.infer<typeof snapshotSchema>
const rowsSchema = z
  .array(
    z.object({
      date,
      base: z.literal('EUR'),
      quote: z.string().regex(/^[A-Z]{3}$/),
      rate,
    }),
  )
  .min(1)
  .max(64)

export class PublicProviderError extends Error {
  constructor(readonly retryAfter: string | null = null) {
    super('Public rate provider failed')
  }
}

export function validSnapshot(value: unknown, now: number): PublicSnapshot {
  const parsed = snapshotSchema.parse(value)
  if (
    parsed.effectiveOn > new Date(now).toISOString().slice(0, 10) ||
    parsed.fetchedAt > now
  )
    throw new PublicProviderError()
  return parsed
}

export async function fetchPublicSnapshot(
  fetcher: typeof fetch,
  now: () => number,
): Promise<PublicSnapshot> {
  const response = await fetcher(PUBLIC_RATES_URL, {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
    headers: { 'User-Agent': 'planned.travel (https://planned.travel)' },
  })
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw new PublicProviderError(response.headers.get('Retry-After'))
  }
  const reader = response.body?.getReader()
  if (!reader) throw new PublicProviderError()
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 65536) throw new PublicProviderError()
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  const rows = rowsSchema.parse(JSON.parse(new TextDecoder().decode(body)))
  const first = rows[0]
  if (!first) throw new PublicProviderError()
  const seen = new Set<string>()
  const rates: Record<string, number> = {}
  for (const row of rows) {
    if (row.date !== first.date || seen.has(row.quote))
      throw new PublicProviderError()
    seen.add(row.quote)
    if ((ECB_REFERENCE_CURRENCIES as readonly string[]).includes(row.quote))
      rates[row.quote] = row.rate
  }
  return validSnapshot(
    {
      version: 1,
      provider: 'frankfurter-ecb',
      source: 'ECB',
      base: 'EUR',
      effectiveOn: first.date,
      fetchedAt: now(),
      rates,
    },
    now(),
  )
}
