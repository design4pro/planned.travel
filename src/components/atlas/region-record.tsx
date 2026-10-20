import * as React from 'react'
import { useRouter } from '@tanstack/react-router'
import { X } from 'lucide-react'
import {
  Button,
  Field,
  IconButton,
  Input,
  SectionLabel,
  Skeleton,
} from '#/components/ui'
import { useAction, useOptimistic } from '#/components/modules/shared'
import { useAtlasI18n } from '#/components/map'
import { countryName } from '#/lib/atlas/country-names'
import {
  hasHiddenPlaceCharacters,
  placeNameSchema,
} from '#/lib/atlas/place-name'
import { VISITED_REGIONS_MAX_PER_TRAVELLER } from '#/lib/atlas/limits'
import { cn } from '#/lib/cn'
import {
  loadCountryRegionsFn,
  markRegionVisitedFn,
  unmarkRegionVisitedFn,
} from '#/server/fns/atlas'
import type { AtlasCountryState, AtlasRegionsState } from '#/server/fns/atlas'

export interface RegionRecordProps {
  readonly countryCode: string
  readonly visited: boolean
  readonly headingLevel: 2 | 3 | 4
  readonly disabled: boolean
  readonly onCountChange: (count: number) => void
  readonly onPendingChange: (pending: boolean) => void
  readonly onCountryChange?: (country: AtlasCountryState) => void
}

function RegionRow({
  children,
  exiting,
}: {
  children: React.ReactNode
  exiting: boolean
}) {
  const [gone, setGone] = React.useState(false)
  React.useEffect(() => {
    if (!exiting) {
      setGone(false)
      return
    }
    const timer = window.setTimeout(() => setGone(true), 150)
    return () => window.clearTimeout(timer)
  }, [exiting])
  if (exiting && gone) return null
  return (
    <li
      inert={exiting}
      data-motion-transform=""
      style={{ animationDuration: '180ms' }}
      className={cn(
        'flex min-h-11 items-center justify-between gap-2 px-2 text-caption transition-[opacity,transform] duration-150 ease-out-quint',
        exiting
          ? 'translate-y-1 opacity-0 motion-reduce:translate-y-0'
          : 'animate-rise motion-reduce:animate-none',
      )}
    >
      {children}
    </li>
  )
}

/** Mounted with the country as its key: replies for a closed country never repaint the new one. */
export function RegionRecord({
  countryCode,
  visited,
  headingLevel,
  disabled,
  onCountChange,
  onPendingChange,
  onCountryChange,
}: RegionRecordProps) {
  const { t } = useAtlasI18n()
  const router = useRouter()
  const instance = React.useId()
  const loadRevision = React.useRef(0)
  const country = countryName(countryCode)
  // Router invalidation replaces catalogue objects; that must not reload the
  // section and disable the input just as an add restores focus.
  const copyRef = React.useRef(t)
  copyRef.current = t
  const [state, setState] = React.useState<AtlasRegionsState>({
    countryCode,
    regions: [],
    total: 0,
  })
  const [loading, setLoading] = React.useState(true)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [refreshFailed, setRefreshFailed] = React.useState(false)
  const [name, setName] = React.useState('')
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState('')
  const input = React.useRef<HTMLInputElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const alive = React.useRef(true)
  const writing = React.useRef(false)
  const overlay = useOptimistic<boolean>()
  const Heading = ({ 2: 'h2', 3: 'h3', 4: 'h4' } as const)[headingLevel]

  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = React.useCallback(
    async (restoreFocus = false, background = false) => {
      const revision = ++loadRevision.current
      if (!background) {
        setLoading(true)
        setLoadFailed(false)
        setStatus(copyRef.current('atlas.regions.loading'))
      }
      try {
        const result = await loadCountryRegionsFn({ data: { countryCode } })
        if (!alive.current || revision !== loadRevision.current) return
        setState(result)
        onCountChange(result.regions.length)
        setLoadFailed(false)
        if (!background) setStatus('')
        if (restoreFocus) requestAnimationFrame(() => input.current?.focus())
      } catch {
        if (alive.current && revision === loadRevision.current) {
          setLoadFailed(true)
          setStatus(
            copyRef.current('atlas.regions.error.load', {
              country: countryName(countryCode),
            }),
          )
        }
      } finally {
        if (alive.current && revision === loadRevision.current)
          setLoading(false)
      }
    },
    [countryCode, onCountChange],
  )
  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    const changed = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const detail: unknown = event.detail
      if (
        typeof detail !== 'object' ||
        detail === null ||
        !('origin' in detail) ||
        !('countryCode' in detail)
      )
        return
      if (detail.origin === instance || detail.countryCode !== countryCode)
        return
      void load(false, true)
    }
    window.addEventListener('atlas:regions-changed', changed)
    return () => window.removeEventListener('atlas:regions-changed', changed)
  }, [countryCode, instance, load])

  const received = React.useCallback(
    (result: AtlasRegionsState) => {
      loadRevision.current += 1
      setState(result)
      onCountChange(result.regions.length)
      window.dispatchEvent(
        new CustomEvent('atlas:regions-changed', {
          detail: { origin: instance, countryCode },
        }),
      )
    },
    [countryCode, instance, onCountChange],
  )
  const refresh = React.useCallback(async () => {
    try {
      await router.invalidate()
      if (alive.current) setRefreshFailed(false)
    } catch {
      if (alive.current) setRefreshFailed(true)
    }
  }, [router])
  const reconcile = React.useCallback(async () => {
    try {
      const snapshot = await loadCountryRegionsFn({ data: { countryCode } })
      if (alive.current) received(snapshot)
      return snapshot
    } catch {
      if (alive.current) setLoadFailed(true)
      return null
    }
  }, [countryCode, received])
  const addWrite = React.useCallback(
    async (args: Parameters<typeof markRegionVisitedFn>[0]) => {
      let result: Awaited<ReturnType<typeof markRegionVisitedFn>>
      try {
        result = await markRegionVisitedFn(args)
      } catch {
        await reconcile()
        throw new Error(t('atlas.regions.error.uncertain'))
      }
      await refresh()
      return result
    },
    [reconcile, refresh, t],
  )
  const removeWrite = React.useCallback(
    async (
      args: Parameters<typeof unmarkRegionVisitedFn>[0],
    ): Promise<AtlasRegionsState> => {
      let result: AtlasRegionsState
      try {
        result = await unmarkRegionVisitedFn(args)
      } catch {
        const snapshot = await reconcile()
        if (!snapshot) throw new Error(t('atlas.regions.error.uncertain'))
        const remaining = snapshot.regions.find(
          (row) => row.id === args.data.regionId,
        )
        if (remaining)
          throw new Error(
            t('atlas.regions.error.remove', { region: remaining.name }),
          )
        result = snapshot
      }
      await refresh()
      return result
    },
    [reconcile, refresh, t],
  )
  const add = useAction(addWrite, {
    invalidate: false,
    failure: t('atlas.regions.error.add', { region: name }),
    fallback: t('atlas.actions.toast.fallback'),
  })
  const remove = useAction(removeWrite, {
    invalidate: false,
    failure: t('atlas.regions.label'),
    fallback: t('atlas.actions.toast.fallback'),
  })
  const pending = add.pending || remove.pending || overlay.settling
  React.useEffect(() => {
    onPendingChange(pending)
  }, [pending, onPendingChange])
  React.useEffect(() => () => onPendingChange(false), [onPendingChange])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (writing.current || pending || disabled || loading || loadFailed) return
    add.reset()
    remove.reset()
    let error: string | null = null
    if (hasHiddenPlaceCharacters(name)) error = t('atlas.regions.error.hidden')
    else if (!placeNameSchema(120).safeParse(name).success)
      error = t('atlas.regions.error.invalid')
    else if (state.total >= VISITED_REGIONS_MAX_PER_TRAVELLER)
      error = t('atlas.regions.error.full', {
        limit: VISITED_REGIONS_MAX_PER_TRAVELLER,
      })
    setFieldError(error)
    if (error) {
      input.current?.focus()
      return
    }
    writing.current = true
    setRefreshFailed(false)
    setStatus(t('atlas.regions.adding', { region: name }))
    const result = await add.run({ data: { countryCode, regionName: name } })
    writing.current = false
    if (!alive.current) return
    if (result) {
      received(result)
      onCountryChange?.(result.country)
      setName('')
      let key:
        | 'atlas.regions.status.exists'
        | 'atlas.regions.status.added'
        | 'atlas.regions.status.addedCountry' = 'atlas.regions.status.exists'
      if (result.countryRecorded) key = 'atlas.regions.status.addedCountry'
      else if (result.status === 'added') key = 'atlas.regions.status.added'
      setStatus(t(key, { region: name, country }))
    } else setStatus('')
    input.current?.focus()
  }
  function drop(id: string, region: string) {
    if (writing.current || pending || disabled) return
    writing.current = true
    setRefreshFailed(false)
    add.reset()
    remove.reset()
    setFieldError(null)
    setStatus('')
    const index = state.regions.findIndex((row) => row.id === id)
    void overlay.claim([[id, true]], async () => {
      const [result] = await Promise.all([
        remove.run({ data: { regionId: id } }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 150)),
      ])
      writing.current = false
      if (!alive.current) return
      if (result) {
        received(result)
        setStatus(t('atlas.regions.status.removed', { region }))
      }
      requestAnimationFrame(() => {
        const buttons = list.current?.querySelectorAll<HTMLButtonElement>(
          'li:not([inert]) button',
        )
        const target = result
          ? buttons?.[Math.min(index, (buttons?.length ?? 0) - 1)]
          : list.current?.querySelector<HTMLButtonElement>(
              `[data-region-id="${CSS.escape(id)}"]`,
            )
        if (target) target.focus()
        else input.current?.focus()
      })
    })
  }
  let spoken = status
  if (refreshFailed)
    spoken = t('atlas.regions.status.refreshFailed', { result: status })
  if (loadFailed) spoken = t('atlas.regions.error.load', { country })
  const full =
    state.total >= VISITED_REGIONS_MAX_PER_TRAVELLER
      ? t('atlas.regions.error.full', {
          limit: VISITED_REGIONS_MAX_PER_TRAVELLER,
        })
      : null
  return (
    <section
      data-part="country-panel-regions"
      className={cn('flex min-w-0 flex-col gap-2 border-t border-edge pt-3')}
    >
      <SectionLabel as={Heading}>{t('atlas.regions.label')}</SectionLabel>
      <p className={cn('text-caption text-ink-3')}>
        {t('atlas.regions.hint', { country })}
      </p>
      <div className={cn('h-33 overflow-y-auto rounded-md bg-surface-2')}>
        {loading ? (
          <div aria-hidden="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className={cn('flex h-11 items-center px-2')}>
                <Skeleton className={cn('h-4 w-3/4')} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <ul ref={list} className={cn('m-0 list-none p-0')}>
              {state.regions.map((row) => (
                <RegionRow key={row.id} exiting={overlay.get(row.id) === true}>
                  <span className={cn('min-w-0 break-words')}>{row.name}</span>
                  <IconButton
                    icon={<X />}
                    data-region-id={row.id}
                    size="sm"
                    label={t('atlas.regions.remove', { region: row.name })}
                    disabled={disabled || pending || loading || loadFailed}
                    onClick={() => drop(row.id, row.name)}
                  />
                </RegionRow>
              ))}
            </ul>
            {state.regions.length === 0 && !loadFailed ? (
              <div className={cn('p-3 text-caption text-ink-3')}>
                <p>{t('atlas.regions.empty.title')}</p>
                <p>{t('atlas.regions.empty.body', { country })}</p>
              </div>
            ) : null}
          </>
        )}
      </div>
      <form
        onSubmit={(event) => {
          void submit(event)
        }}
        className={cn('flex flex-col gap-2')}
      >
        <Field
          label={t('atlas.regions.input.label', { country })}
          error={fieldError ?? full}
        >
          <Input
            ref={input}
            value={name}
            readOnly={add.pending}
            disabled={disabled || remove.pending || loading || loadFailed}
            placeholder={t('atlas.regions.input.placeholder')}
            onChange={(event) => {
              setName(event.target.value)
              setFieldError(null)
            }}
          />
        </Field>
        <Button
          type="submit"
          size="sm"
          loading={add.pending}
          loadingLabel={t('atlas.regions.adding', { region: name })}
          disabled={disabled || remove.pending || loading || loadFailed}
        >
          {t('atlas.regions.add')}
        </Button>
      </form>
      <p className={cn('min-h-10 text-caption text-ink-3')}>
        {visited
          ? t('atlas.regions.keeps', { country })
          : t('atlas.regions.keeps.unvisited', { country })}
      </p>
      <div
        role="status"
        aria-live="polite"
        className={cn('min-h-10 text-caption text-ink-3')}
      >
        {spoken}
      </div>
      <div
        className={cn(
          'min-h-10 text-caption',
          (add.error ?? remove.error) && 'text-danger',
        )}
      >
        {add.error ?? remove.error}
      </div>
      {loadFailed || refreshFailed || add.error || remove.error ? (
        <Button
          size="sm"
          onClick={() => {
            add.reset()
            remove.reset()
            void refresh().then(() => load(true))
          }}
        >
          {t('atlas.regions.reload')}
        </Button>
      ) : null}
    </section>
  )
}
