import * as React from 'react'
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react'
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
import type { AtlasRegionsState } from '#/server/fns/atlas'

export interface RegionRecordProps {
  readonly countryCode: string
  readonly visited: boolean
  readonly headingLevel: 2 | 3 | 4
  readonly disabled: boolean
  readonly onCountChange: (count: number) => void
  readonly onPendingChange: (pending: boolean) => void
}

function RegionRow({ children }: { children: React.ReactNode }) {
  const present = useIsPresent()
  const reduced = useReducedMotion()
  return (
    <motion.li
      inert={!present}
      initial={{ opacity: 0, y: reduced ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : 4 }}
      transition={{ duration: present ? 0.18 : 0.15, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex min-h-11 items-center justify-between gap-2 px-2 text-caption',
      )}
    >
      {children}
    </motion.li>
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
}: RegionRecordProps) {
  const { t } = useAtlasI18n()
  const country = countryName(countryCode)
  // Router invalidation replaces catalogue objects; that must not reload the
  // section and disable the input just as an add restores focus.
  const copyRef = React.useRef(t)
  copyRef.current = t
  const [state, setState] = React.useState<AtlasRegionsState>({
    regions: [],
    total: 0,
  })
  const [loading, setLoading] = React.useState(true)
  const [loadFailed, setLoadFailed] = React.useState(false)
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
    async (restoreFocus = false) => {
      setLoading(true)
      setLoadFailed(false)
      setStatus(copyRef.current('atlas.regions.loading'))
      try {
        const result = await loadCountryRegionsFn({ data: { countryCode } })
        if (!alive.current) return
        setState(result)
        onCountChange(result.regions.length)
        setStatus('')
        if (restoreFocus) requestAnimationFrame(() => input.current?.focus())
      } catch {
        if (alive.current) {
          setLoadFailed(true)
          setStatus(
            copyRef.current('atlas.regions.error.load', {
              country: countryName(countryCode),
            }),
          )
        }
      } finally {
        if (alive.current) setLoading(false)
      }
    },
    [countryCode, onCountChange],
  )
  React.useEffect(() => {
    void load()
  }, [load])

  const addWrite = React.useCallback(
    async (args: Parameters<typeof markRegionVisitedFn>[0]) => {
      try {
        return await markRegionVisitedFn(args)
      } catch {
        throw new Error(t('atlas.regions.error.add', { region: name }))
      }
    },
    [name, t],
  )
  const removeWrite = React.useCallback(
    async (args: Parameters<typeof unmarkRegionVisitedFn>[0]) => {
      try {
        return await unmarkRegionVisitedFn(args)
      } catch {
        throw new Error(
          t('atlas.regions.error.remove', {
            region:
              state.regions.find((row) => row.id === args.data.regionId)
                ?.name ?? '',
          }),
        )
      }
    },
    [state.regions, t],
  )
  const add = useAction(addWrite, {
    failure: t('atlas.regions.error.add', { region: name }),
    fallback: t('atlas.actions.toast.fallback'),
  })
  const remove = useAction(removeWrite, {
    failure: t('atlas.regions.label'),
    fallback: t('atlas.actions.toast.fallback'),
  })
  const pending = add.pending || remove.pending
  React.useEffect(() => {
    onPendingChange(pending)
  }, [pending, onPendingChange])
  React.useEffect(() => () => onPendingChange(false), [onPendingChange])

  function received(result: AtlasRegionsState) {
    setState(result)
    onCountChange(result.regions.length)
  }
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
    setStatus(t('atlas.regions.adding', { region: name }))
    const result = await add.run({ data: { countryCode, regionName: name } })
    writing.current = false
    if (!alive.current) return
    if (result) {
      received(result)
      setName('')
      let key:
        | 'atlas.regions.status.exists'
        | 'atlas.regions.status.added'
        | 'atlas.regions.status.addedCountry' = 'atlas.regions.status.exists'
      if (result.countryCreated) key = 'atlas.regions.status.addedCountry'
      else if (result.created) key = 'atlas.regions.status.added'
      setStatus(t(key, { region: name, country }))
    } else setStatus('')
    input.current?.focus()
  }
  function drop(id: string, region: string) {
    if (writing.current || pending || disabled) return
    writing.current = true
    add.reset()
    remove.reset()
    setFieldError(null)
    setStatus('')
    const index = state.regions.findIndex((row) => row.id === id)
    void overlay.claim([[id, true]], async () => {
      const result = await remove.run({ data: { regionId: id } })
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
              <AnimatePresence initial={false}>
                {state.regions
                  .filter((row) => overlay.get(row.id) !== true)
                  .map((row) => (
                    <RegionRow key={row.id}>
                      <span className={cn('min-w-0 break-words')}>
                        {row.name}
                      </span>
                      <IconButton
                        icon={<X />}
                        data-region-id={row.id}
                        size="sm"
                        label={t('atlas.regions.remove', { region: row.name })}
                        disabled={disabled || pending}
                        onClick={() => drop(row.id, row.name)}
                      />
                    </RegionRow>
                  ))}
              </AnimatePresence>
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
        {status}
      </div>
      <div
        className={cn(
          'min-h-10 text-caption',
          (add.error ?? remove.error) && 'text-danger',
        )}
      >
        {add.error ?? remove.error}
      </div>
      {loadFailed ? (
        <Button
          size="sm"
          onClick={() => {
            void load(true)
          }}
        >
          {t('atlas.regions.reload')}
        </Button>
      ) : null}
    </section>
  )
}
