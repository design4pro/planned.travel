/**
 * Identifiers the demo fixture mints itself, derived rather than drawn.
 *
 * Two places in the seed need a value that a database column will not generate for it: the Better
 * Auth `user` and `account` rows for the three collaborators, and the share token a published
 * journey is read under. Both were `nanoid()` and `crypto.getRandomValues()`, which is right for
 * production and wrong here — a fixture that mints a new value on every run is a fixture whose
 * workspace differs from itself, and the difference lands in URLs a reader may have kept.
 *
 * So they are derived from a namespace and a stable key instead. This is arithmetic, not entropy,
 * and it says so: the only property it claims is that two different keys almost certainly differ and
 * the same key always agrees with itself. That is exactly what a demo workspace on a developer's
 * machine needs, and it is the property the visual gate depends on. Nothing production-facing may
 * use it — a real share token is unguessable, and `publishJourney()`'s other callers mint one from a
 * real random source.
 *
 * FNV-1a, one round per eight hex characters, each round salted with its own index so the rounds do
 * not agree with each other.
 */

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619
const HEX_PER_ROUND = 8

function fnv1a(input: string): number {
  let hash = FNV_OFFSET
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

/**
 * `length` lowercase hex characters, the same ones every time for the same namespace and key.
 *
 * The namespace keeps two unrelated uses of the same key — a person's email as a `user` id and as an
 * `account` id — from colliding on one value.
 */
export function stableId(
  namespace: string,
  key: string,
  length: number,
): string {
  if (!Number.isInteger(length) || length < 1) {
    throw new TypeError(
      `stableId: length must be a positive whole number, received ${String(length)}`,
    )
  }
  let out = ''
  for (let round = 0; out.length < length; round += 1) {
    out += fnv1a(`planned.travel/${namespace}/${String(round)}/${key}`)
      .toString(16)
      .padStart(HEX_PER_ROUND, '0')
  }
  return out.slice(0, length)
}
