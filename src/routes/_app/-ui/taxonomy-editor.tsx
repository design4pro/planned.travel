import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  IconButton,
  Input,
} from '#/components/ui'
import { CategoryIcon } from '#/components/map/category-icon'
import { useTranslate } from '#/lib/i18n'
import { readPublicFailure } from '#/lib/errors'
import { hasVisibleCharacter } from '#/lib/workspace-name'
import {
  createCategoryFn,
  deleteCategoryFn,
  moveCategoryFn,
  updateCategoryFn,
} from '#/server/fns/taxonomy'
import { SettingsSection } from './settings-nav'

export interface TaxonomyData {
  readonly categories: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly colour: string
    readonly icon: string
    readonly placeCount: number
  }>
  readonly meter: { readonly used: number; readonly limit: number }
}
type Category = TaxonomyData['categories'][number]
type Run = (
  id: string,
  write: () => Promise<Pick<
    Category,
    'id' | 'name' | 'colour' | 'icon'
  > | void>,
  success: () => void,
  focus?: () => void,
  expected?: Pick<Category, 'name' | 'colour'>,
) => Promise<void>

/** Each mounted workspace owns its requests; draft forms are seeded only when opened. */
export function TaxonomyEditor({
  initial,
  canManage,
  reload,
}: {
  initial: TaxonomyData
  canManage: boolean
  reload: () => Promise<TaxonomyData>
}) {
  const t = useTranslate()
  const [data, setData] = useState(initial)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const active = useRef(new Set<string>())
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(new Set())
  const [notice, setNotice] = useState('')
  const [permissionChanged, setPermissionChanged] = useState(false)
  const [reloadFailed, setReloadFailed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const confirmationStatus = useRef<HTMLParagraphElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const previousPermission = useRef(canManage)
  const alive = useRef(true)
  const readVersion = useRef(0)
  const focusGeneration = useRef(0)
  const focusRequest = useRef<{
    generation: number
    origin: Element | null
    focus?: () => void
  } | null>(null)
  const removedFocus = useRef<string | null>(null)
  const deletionOpener = useRef<HTMLElement | null>(null)
  const deletionSucceeded = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    if (active.current.size === 0) setData(initial)
  }, [initial])
  useEffect(() => {
    if (previousPermission.current && !canManage) {
      setPermissionChanged(true)
      setDeleting(null)
      setNotice('')
      heading.current?.focus()
    }
    previousPermission.current = canManage
  }, [canManage, t])

  useEffect(() => {
    const request = focusRequest.current
    focusRequest.current = null
    if (request?.generation !== focusGeneration.current) return
    const current = document.activeElement
    if (
      current === status.current ||
      current === document.body ||
      current === request.origin
    )
      request.focus?.()
  }, [pending])

  async function reconcile() {
    const version = ++readVersion.current
    const next = await reload()
    if (!alive.current) return
    if (version !== readVersion.current) return
    setData(next)
    setReloadFailed(false)
    return next
  }
  const run: Run = async (id, write, success, focus, expected) => {
    const previousIds = new Set(data.categories.map((row) => row.id))
    if (active.current.has(id) || blocked.has(id)) return
    const generation = ++focusGeneration.current
    const origin = document.activeElement
    readVersion.current++
    active.current.add(id)
    setPending(new Set(active.current))
    setNotice(t('ui.status.working'))
    ;(deleting === null ? status : confirmationStatus).current?.focus()
    let committed = false
    try {
      const result = await write()
      committed = true
      readVersion.current++
      if (!alive.current) return
      if (result)
        setData((previous) => {
          const existing = previous.categories.find(
            (row) => row.id === result.id,
          )
          const next = { ...result, placeCount: existing?.placeCount ?? 0 }
          return {
            categories: existing
              ? previous.categories.map((row) =>
                  row.id === result.id ? next : row,
                )
              : [...previous.categories, next],
            meter: {
              ...previous.meter,
              used: previous.meter.used + (existing ? 0 : 1),
            },
          }
        })
      if (id === 'delete' && deleting)
        setData((previous) => ({
          ...previous,
          categories: previous.categories.filter(
            (row) => row.id !== deleting.id,
          ),
          meter: {
            ...previous.meter,
            used: Math.max(0, previous.meter.used - 1),
          },
        }))
      success()
      setNotice(
        t(
          id === 'delete'
            ? 'settings.taxonomy.deleted'
            : 'settings.taxonomy.saved',
        ),
      )
      await reconcile()
    } catch (cause) {
      if (!alive.current) return
      const failure = readPublicFailure(cause)
      const uncertain =
        committed ||
        (failure.kind === 'unexpected' && failure.code !== 'QUOTA_EXCEEDED')
      if (uncertain) setBlocked((previous) => new Set([...previous, id]))
      setNotice(
        t(
          uncertain
            ? 'settings.taxonomy.unknownOutcome'
            : 'settings.taxonomy.stale',
        ),
      )
      try {
        const current = await reconcile()
        if (!alive.current) return
        const deleted =
          id === 'delete' &&
          deleting !== null &&
          current !== undefined &&
          !current.categories.some((row) => row.id === deleting.id)
        const saved =
          expected !== undefined &&
          current?.categories.some(
            (row) =>
              row.name === expected.name &&
              row.colour.toLowerCase() === expected.colour.toLowerCase() &&
              (id === 'create' ? !previousIds.has(row.id) : row.id === id),
          )
        if (deleted || saved) {
          success()
          setBlocked(
            (previous) => new Set([...previous].filter((key) => key !== id)),
          )
          setNotice(
            t(
              deleted ? 'settings.taxonomy.deleted' : 'settings.taxonomy.saved',
            ),
          )
          return
        }
        setNotice(
          t(uncertain ? 'settings.taxonomy.review' : 'settings.taxonomy.stale'),
        )
      } catch {
        if (!alive.current) return
        setReloadFailed(true)
        setBlocked((previous) => new Set([...previous, id]))
        setNotice(t('settings.taxonomy.reconcileFailed'))
      }
    } finally {
      active.current.delete(id)
      if (alive.current) {
        focusRequest.current = { generation, origin, focus }
        setPending(new Set(active.current))
      }
    }
  }
  const full =
    Number.isFinite(data.meter.limit) && data.meter.used >= data.meter.limit
  const focusRow = (id?: string) => {
    const buttons = root.current?.querySelectorAll<HTMLButtonElement>(
      '[data-part="taxonomy-edit"]',
    )
    const button = Array.from(buttons ?? []).find(
      (item) => item.dataset.categoryId === id,
    )
    ;(button && !button.disabled ? button : heading.current)?.focus()
  }

  return (
    <SettingsSection
      title={t('settings.taxonomy.title')}
      titleRef={heading}
      description={t('settings.taxonomy.description')}
    >
      <div ref={root} className="space-y-5">
        <div>
          <p className="text-caption tabular-nums text-ink-3">
            {Number.isFinite(data.meter.limit)
              ? t('settings.taxonomy.usage', {
                  used: data.meter.used,
                  limit: data.meter.limit,
                })
              : t('settings.taxonomy.unlimited', { used: data.meter.used })}
          </p>
        </div>
        <p
          ref={status}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="text-caption text-ink-2 focus-ring"
        >
          {notice}
        </p>
        {reloadFailed || blocked.size > 0 ? (
          <Alert
            tone="warning"
            actions={
              <Button
                variant="secondary"
                disabled={checking}
                onClick={() => {
                  setChecking(true)
                  status.current?.focus()
                  void reconcile()
                    .then(() => {
                      if (alive.current) {
                        setNotice(t('settings.taxonomy.review'))
                        setBlocked(new Set())
                      }
                    })
                    .catch(() => {
                      if (alive.current) {
                        setReloadFailed(true)
                        setNotice(t('settings.taxonomy.reconcileFailed'))
                      }
                    })
                    .finally(() => {
                      if (alive.current) {
                        setChecking(false)
                        status.current?.focus()
                      }
                    })
                }}
              >
                {t('settings.taxonomy.reload')}
              </Button>
            }
          >
            {t('settings.taxonomy.review')}
          </Alert>
        ) : null}
        {!canManage ? (
          <Alert tone="neutral">
            {t(
              permissionChanged
                ? 'settings.taxonomy.permissionChanged'
                : 'settings.taxonomy.readOnly',
            )}
          </Alert>
        ) : null}
        {data.categories.length === 0 ? (
          <p className="py-6 text-label text-ink-3">
            {t('settings.taxonomy.empty')}
          </p>
        ) : null}
        <ul className="divide-y divide-edge-faint">
          {data.categories.map((category, index) => (
            <TaxonomyRow
              key={category.id}
              category={category}
              canManage={canManage}
              pending={pending.has(category.id)}
              blocked={blocked.has(category.id)}
              first={index === 0}
              last={index === data.categories.length - 1}
              run={run}
              onDelete={() => {
                removedFocus.current =
                  data.categories[index + 1]?.id ??
                  data.categories[index - 1]?.id ??
                  null
                deletionOpener.current =
                  document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null
                deletionSucceeded.current = false
                setNotice('')
                setDeleting(category)
              }}
              focus={() => focusRow(category.id)}
            />
          ))}
        </ul>
        <div hidden={!canManage}>
          {full ? (
            <Alert tone="warning">{t('settings.taxonomy.limitReached')}</Alert>
          ) : null}
          <CategoryForm
            pending={pending.has('create')}
            blocked={blocked.has('create') || full}
            onSubmit={(name, colour, done) => {
              void run(
                'create',
                () => createCategoryFn({ data: { name, colour } }),
                done,
                () => heading.current?.focus(),
                { name, colour },
              )
            }}
          />
        </div>
        <Dialog
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open && !pending.has('delete')) setDeleting(null)
          }}
        >
          <DialogContent
            hideClose
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              if (deletionSucceeded.current)
                focusRow(removedFocus.current ?? undefined)
              else if (deletionOpener.current?.isConnected && canManage)
                deletionOpener.current.focus()
              else heading.current?.focus()
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {t('settings.taxonomy.deleteTitle', {
                  name: deleting?.name ?? '',
                })}
              </DialogTitle>
              <DialogDescription>
                {t('settings.taxonomy.deletePreserves')}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p className="text-label">
                {t('settings.taxonomy.deleteImpact', {
                  count:
                    data.categories.find((row) => row.id === deleting?.id)
                      ?.placeCount ?? 0,
                })}
              </p>
              <p
                ref={confirmationStatus}
                tabIndex={-1}
                role="status"
                className="mt-3 text-caption focus-ring"
              >
                {notice}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="secondary"
                disabled={pending.has('delete')}
                onClick={() => {
                  const id = deleting?.id
                  removedFocus.current = id ?? null
                  setDeleting(null)
                }}
              >
                {t('modules.action.cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={
                  pending.has('delete') || blocked.has('delete') || !canManage
                }
                onClick={() => {
                  if (!deleting) return
                  const categoryId = deleting.id
                  void run(
                    'delete',
                    () => deleteCategoryFn({ data: { categoryId } }),
                    () => {
                      deletionSucceeded.current = true
                      setDeleting(null)
                    },
                  )
                }}
              >
                {t('shell.tripActions.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsSection>
  )
}

function TaxonomyRow({
  category,
  canManage,
  pending,
  blocked,
  first,
  last,
  run,
  onDelete,
  focus,
}: {
  category: Category
  canManage: boolean
  pending: boolean
  blocked: boolean
  first: boolean
  last: boolean
  run: Run
  onDelete: () => void
  focus: () => void
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const session = useRef(0)
  return (
    <li data-part="taxonomy-row" aria-busy={pending} className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="relative grid size-9 shrink-0 place-items-center rounded-lg border border-edge text-ink">
          <CategoryIcon name={category.icon} size={18} />
          <span
            aria-hidden="true"
            className="absolute end-0 bottom-0 size-3 rounded-full border border-edge-strong"
            style={{ backgroundColor: category.colour }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-label font-semibold text-ink">
            {category.name}
          </p>
          <p className="text-caption tabular-nums text-ink-3">
            {t('settings.taxonomy.placeCount', { count: category.placeCount })}
          </p>
        </div>
        {canManage ? (
          <div className="flex w-full flex-wrap justify-end gap-1 sm:w-auto">
            <IconButton
              icon={<Pencil />}
              data-part="taxonomy-edit"
              data-category-id={category.id}
              label={t('settings.taxonomy.rename', { name: category.name })}
              disabled={pending}
              onClick={() => {
                session.current++
                setEditing(true)
              }}
            />
            <IconButton
              icon={<ArrowUp />}
              label={t('settings.taxonomy.moveUp', { name: category.name })}
              disabled={pending || blocked || first}
              onClick={() => {
                void run(
                  category.id,
                  () =>
                    moveCategoryFn({
                      data: { categoryId: category.id, direction: 'up' },
                    }),
                  () => {},
                  focus,
                )
              }}
            />
            <IconButton
              icon={<ArrowDown />}
              label={t('settings.taxonomy.moveDown', { name: category.name })}
              disabled={pending || blocked || last}
              onClick={() => {
                void run(
                  category.id,
                  () =>
                    moveCategoryFn({
                      data: { categoryId: category.id, direction: 'down' },
                    }),
                  () => {},
                  focus,
                )
              }}
            />
            <IconButton
              icon={<Trash2 />}
              data-part="taxonomy-delete"
              label={t('settings.taxonomy.delete', { name: category.name })}
              disabled={pending || blocked}
              onClick={onDelete}
            />
          </div>
        ) : null}
      </div>
      {editing ? (
        <div hidden={!canManage}>
          <CategoryForm
            key={session.current}
            category={category}
            pending={pending}
            blocked={blocked}
            onCancel={() => {
              session.current++
              setEditing(false)
              focus()
            }}
            onSubmit={(name, colour, done) => {
              const started = session.current
              void run(
                category.id,
                () =>
                  updateCategoryFn({
                    data: { categoryId: category.id, name, colour },
                  }),
                () => {
                  if (started === session.current) {
                    done()
                    setEditing(false)
                  }
                },
                focus,
                { name, colour },
              )
            }}
          />
        </div>
      ) : null}
    </li>
  )
}

function CategoryForm({
  category,
  pending,
  blocked,
  onSubmit,
  onCancel,
}: {
  category?: Category
  pending: boolean
  blocked: boolean
  onSubmit: (name: string, colour: string, done: () => void) => void
  onCancel?: () => void
}) {
  const t = useTranslate()
  const [name, setName] = useState(category?.name ?? '')
  const [colour, setColour] = useState(category?.colour ?? '#3b82f6')
  const [touched, setTouched] = useState(false)
  const valid = hasVisibleCharacter(name) && name.trim().length <= 200
  const validColour = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(colour)
  return (
    <form
      className="mt-4 flex flex-wrap items-start gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        setTouched(true)
        if (!valid || !validColour || pending || blocked) return
        onSubmit(name.trim(), colour, () => {
          setName('')
          setTouched(false)
        })
      }}
    >
      <Field
        label={t('modules.field.name')}
        required
        error={
          touched && !valid ? t('shell.validation.visibleName') : undefined
        }
        className="min-w-40 flex-1"
      >
        <Input
          value={name}
          maxLength={200}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
          autoFocus={category !== undefined}
        />
      </Field>
      <Field
        label={t('modules.collections.edit.colour')}
        error={
          touched && !validColour
            ? t('settings.taxonomy.colourInvalid')
            : undefined
        }
        className="w-32"
      >
        <Input
          value={colour}
          disabled={pending}
          onChange={(event) => setColour(event.target.value)}
          maxLength={9}
        />
      </Field>
      <div className="flex gap-2 pt-6">
        <Button type="submit" disabled={pending || blocked}>
          {t(
            category ? 'settings.action.save' : 'settings.taxonomy.addCategory',
          )}
        </Button>
        {onCancel ? (
          <Button variant="secondary" type="button" onClick={onCancel}>
            {t('modules.action.cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
