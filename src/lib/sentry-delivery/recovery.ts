import { makeFetchTransport } from '@sentry/react'
import { z } from 'zod'
import {
  MAX_TRANSACTION_ATTEMPTS,
  readTransaction,
  transactionBackoff,
  TRANSACTION_LIFETIME,
} from './transaction'
import type { TransportOptions } from './transaction'

export const TRANSACTION_STORAGE_KEY = 'planned.sentry.transactions.v1'
const MAX_STORE_BYTES = 2 * 1024 * 1024
const MAX_RECORDS = 40
const RETRY_DELAY = 5000
const RESPONSE_DEADLINE = 12000
const scopeSchema = z
  .string()
  .refine((value) => value === 'anonymous' || /^[a-f0-9]{64}$/.test(value))
const recordSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{32}$/),
    body: z.string().max(512 * 1024),
    createdAt: z.number().int().nonnegative(),
    attempts: z.number().int().min(0).max(MAX_TRANSACTION_ATTEMPTS),
    nextAttemptAt: z.number().int().nonnegative(),
  })
  .strict()
const storeSchema = z
  .object({
    version: z.literal(1),
    scope: scopeSchema,
    project: z.string().max(1024),
    notBefore: z.number().finite().nonnegative(),
    entries: z.array(recordSchema).max(MAX_RECORDS),
  })
  .strict()
type StoredRecord = z.infer<typeof recordSchema>
type Store = z.infer<typeof storeSchema>
export type DeliverySender = (
  id: string,
  body: string,
  signal: AbortSignal,
) => Promise<Response>
export interface RecoveryPorts {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  scope: string | null
  project: string
  send: DeliverySender
  ready?: () => Promise<void>
  activated?: () => boolean
  initializing?: () => boolean
  cancelInitialization?: () => void
  eligible?: () => boolean
  nativeFetch: typeof fetch
  leaving: () => boolean
}

/** Retention is admission, not acknowledgement. The installed SDK still owns send/flush/backoff. */
export function createRecoveryTransport(
  options: TransportOptions,
  ports: RecoveryPorts,
) {
  const counts: Record<string, number> = {}
  const count = (reason: string) => {
    counts[reason] = (counts[reason] ?? 0) + 1
  }
  let scope = scopeSchema.safeParse(ports.scope).success ? ports.scope : null
  let generation = 0
  let disposed = false
  let state: Store = {
    version: 1,
    scope: scope ?? 'anonymous',
    project: ports.project,
    notBefore: 0,
    entries: [],
  }
  const active = new Map<
    string,
    { controller: AbortController; promise: Promise<Response> }
  >()
  const unavailable = () => {
    count('recovery_unavailable')
  }
  const clearStorage = () => {
    try {
      ports.storage?.removeItem(TRANSACTION_STORAGE_KEY)
    } catch {
      count('cleanup_failed')
    }
  }
  const write = (next: Store, probe = false): boolean => {
    try {
      if (!ports.storage || scope === null) return false
      const { entries, ...header } = next
      const prefix = JSON.stringify(header).slice(0, -1) + ',"entries":['
      let length = prefix.length + 2
      const rows: string[] = []
      for (const entry of entries) {
        const row = JSON.stringify(entry)
        length += row.length + (rows.length > 0 ? 1 : 0)
        if (length * 2 > MAX_STORE_BYTES) return false
        rows.push(row)
      }
      const raw = prefix + rows.join(',') + ']}'
      if (next.entries.length === 0 && next.notBefore <= Date.now()) {
        if (probe) ports.storage.setItem(TRANSACTION_STORAGE_KEY, raw)
        ports.storage.removeItem(TRANSACTION_STORAGE_KEY)
      } else ports.storage.setItem(TRANSACTION_STORAGE_KEY, raw)
      state = next
      return true
    } catch {
      return false
    }
  }
  const remove = (id: string) => {
    if (
      !write({
        ...state,
        entries: state.entries.filter((entry) => entry.id !== id),
      })
    )
      count('cleanup_failed')
  }
  const prune = () => {
    const now = Date.now()
    const entries = state.entries.filter((entry) => {
      if (
        entry.createdAt > now ||
        now - entry.createdAt >= TRANSACTION_LIFETIME
      ) {
        count('expired')
        return false
      }
      return true
    })
    if (entries.length !== state.entries.length) {
      const next = { ...state, entries }
      if (!write(next)) {
        state = next
        count('cleanup_failed')
      }
    }
  }
  try {
    const raw = ports.storage?.getItem(TRANSACTION_STORAGE_KEY)
    if (raw) {
      if (raw.length * 2 > MAX_STORE_BYTES)
        throw new Error('Invalid transaction store')
      const parsed = storeSchema.parse(JSON.parse(raw))
      if (
        scope === null ||
        parsed.scope !== scope ||
        parsed.project !== ports.project
      )
        throw new Error('Stale transaction scope')
      if (
        new Set(parsed.entries.map((entry) => entry.id)).size !==
        parsed.entries.length
      )
        throw new Error('Duplicate transaction records')
      for (const entry of parsed.entries) {
        const transaction = readTransaction(entry.body)
        if (!transaction || transaction.id !== entry.id)
          throw new Error('Invalid stored transaction')
        entry.body = transaction.body
        if (entry.nextAttemptAt > entry.createdAt + TRANSACTION_LIFETIME)
          throw new Error('Invalid retry deadline')
      }
      state = parsed
      prune()
    }
  } catch {
    count('invalid_store')
    clearStorage()
  }
  if (scope === null) clearStorage()

  const deferredForDeparture = () =>
    ports.leaving() && ports.activated?.() !== true
  const cannotAwaitReadiness = () =>
    deferredForDeparture() && ports.initializing?.() !== true
  const ineligible = () => ports.eligible?.() === false
  const initializeEmpty = () => {
    if (
      disposed ||
      scope === null ||
      !ports.storage ||
      ports.leaving() ||
      ineligible()
    )
      return
    // This bounded write probes actual storage capability without admitting or sending a payload.
    if (!write(state, true)) {
      count('initialization_unavailable')
      return
    }
    void ports.ready?.().catch(() => count('initialization_failed'))
  }
  const start = (entry: StoredRecord): Promise<Response> => {
    const existing = active.get(entry.id)
    if (existing) return existing.promise
    const controller = new AbortController()
    const captured = generation
    let deadline: ReturnType<typeof setTimeout>
    const aborted = new Promise<never>((_, reject) => {
      const fail = () =>
        reject(new DOMException('Transaction delivery ended', 'AbortError'))
      controller.signal.addEventListener('abort', fail, { once: true })
      deadline = setTimeout(() => controller.abort(), RESPONSE_DEADLINE)
    })
    const perform = async () => {
      if (
        disposed ||
        scope === null ||
        captured !== generation ||
        controller.signal.aborted ||
        ineligible() ||
        cannotAwaitReadiness()
      )
        throw new Error('Transaction dispatch deferred')
      await ports.ready?.()
      if (
        disposed ||
        scope === null ||
        captured !== generation ||
        controller.signal.aborted ||
        deferredForDeparture() ||
        ineligible()
      )
        throw new Error('Transaction dispatch deferred')
      const current = state.entries.find((item) => item.id === entry.id)
      if (
        !current ||
        current.nextAttemptAt > Date.now() ||
        Date.now() - current.createdAt >= TRANSACTION_LIFETIME
      )
        throw new Error('Transaction expired')
      if (state.notBefore > Date.now()) throw new Error('Transaction backoff')
      if (current.attempts >= MAX_TRANSACTION_ATTEMPTS) {
        remove(entry.id)
        count('attempts_exhausted')
        throw new Error('Transaction attempts exhausted')
      }
      const next = {
        ...current,
        attempts: current.attempts + 1,
        nextAttemptAt: Math.min(
          current.createdAt + TRANSACTION_LIFETIME,
          Date.now() + RESPONSE_DEADLINE,
        ),
      }
      if (
        !write({
          ...state,
          entries: state.entries.map((item) =>
            item.id === entry.id ? next : item,
          ),
        })
      ) {
        count('attempt_persist_failed')
        throw new Error('Transaction attempt unavailable')
      }
      count('dispatch')
      const response = await ports.send(
        crypto.randomUUID(),
        next.body,
        controller.signal,
      )
      if (captured !== generation || controller.signal.aborted)
        throw new DOMException('Transaction retired', 'AbortError')
      if (
        !Number.isInteger(response.status) ||
        response.status < 200 ||
        response.status > 599
      )
        throw new Error('Invalid delivery response')
      const until = Math.max(
        state.notBefore,
        transactionBackoff(response, Date.now()),
      )
      if (
        !write({
          ...state,
          notBefore: until,
          entries: state.entries.filter((item) => item.id !== entry.id),
        })
      ) {
        count('cleanup_failed')
        clearStorage()
        state = {
          ...state,
          notBefore: until,
          entries: state.entries.filter((item) => item.id !== entry.id),
        }
      }
      count('response')
      return response
    }
    const promise = Promise.race([perform(), aborted])
      .catch((error: unknown) => {
        if (captured === generation) count('unknown_response')
        throw error
      })
      .finally(() => {
        clearTimeout(deadline)
        if (active.get(entry.id)?.controller === controller)
          active.delete(entry.id)
      })
    active.set(entry.id, { controller, promise })
    return promise
  }
  const transport = makeFetchTransport(options, (url, init) => {
    const transaction = readTransaction(init?.body)
    if (!transaction) return ports.nativeFetch(url, init)
    prune()
    let entry = state.entries.find((item) => item.id === transaction.id)
    if (entry && entry.body !== transaction.body)
      return Promise.reject(new Error('Conflicting transaction identity'))
    if (!entry) {
      if (
        disposed ||
        scope === null ||
        ineligible() ||
        !ports.storage ||
        state.entries.length >= MAX_RECORDS
      ) {
        unavailable()
        return ports.nativeFetch(url, init)
      }
      entry = {
        id: transaction.id,
        body: transaction.body,
        createdAt: Date.now(),
        attempts: 0,
        nextAttemptAt: Date.now(),
      }
      if (!write({ ...state, scope, entries: [...state.entries, entry] })) {
        unavailable()
        return ports.nativeFetch(url, init)
      }
      count('admitted')
    }
    if (cannotAwaitReadiness()) {
      count('deferred')
      return new Promise<Response>((_, reject) => {
        const pending = {
          timer: setTimeout(() => {
            deferred.delete(pending)
            reject(new Error('Transaction awaits successor document'))
          }, RESPONSE_DEADLINE),
          reject,
        }
        deferred.add(pending)
      })
    }
    return start(entry)
  })
  const deferred = new Set<{
    timer: ReturnType<typeof setTimeout>
    reject: (error: Error) => void
  }>()
  let recovering = false
  const recover = async () => {
    if (disposed) return
    prune()
    if (recovering || scope === null || deferredForDeparture() || ineligible())
      return
    recovering = true
    try {
      if (state.notBefore > Date.now()) return
      await Promise.all(
        state.entries.slice().map(async (entry) => {
          if (active.has(entry.id) || entry.nextAttemptAt > Date.now()) return
          if (entry.attempts >= MAX_TRANSACTION_ATTEMPTS) {
            remove(entry.id)
            count('attempts_exhausted')
            return
          }
          const transaction = readTransaction(entry.body)
          if (!transaction) {
            remove(entry.id)
            count('invalid_transaction')
            return
          }
          try {
            const result = await transport.send(transaction.envelope)
            // No executor means the SDK filtered this retry (backoff/buffer), not an ingestion success.
            if (result.statusCode === undefined && !active.has(entry.id)) {
              remove(entry.id)
              count('sdk_filtered')
            }
          } catch {
            /* The retained record remains an explicitly unknown outcome. */
          }
        }),
      )
    } finally {
      recovering = false
    }
  }
  const retryTimer = setInterval(() => {
    void recover()
  }, RETRY_DELAY)
  const initialTimer = setTimeout(() => {
    void recover()
  }, 0)
  const settleActive = () => {
    for (const request of active.values()) request.controller.abort()
    for (const pending of deferred) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Transaction recovery retired'))
    }
    deferred.clear()
    active.clear()
  }
  const retire = () => {
    generation++
    scope = null
    ports.cancelInitialization?.()
    settleActive()
    state = { ...state, entries: [], notBefore: 0 }
    clearStorage()
    count('retired')
  }
  const confirmScope = (next: string | null) => {
    if (!scopeSchema.safeParse(next).success) {
      retire()
      return
    }
    if (next !== scope) {
      retire()
      scope = next
      state = {
        version: 1,
        scope: next ?? 'anonymous',
        project: ports.project,
        notBefore: 0,
        entries: [],
      }
    }
    initializeEmpty()
  }
  const dispose = ({ preserve = false }: { preserve?: boolean } = {}) => {
    disposed = true
    ports.cancelInitialization?.()
    generation++
    clearInterval(retryTimer)
    clearTimeout(initialTimer)
    settleActive()
    if (!preserve) clearStorage()
  }
  initializeEmpty()
  return { transport, recover, retire, confirmScope, dispose, counts }
}
