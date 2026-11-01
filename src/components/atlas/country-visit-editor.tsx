import * as React from 'react'
import { useRouter } from '@tanstack/react-router'
import { Button, Field, Input, Textarea } from '#/components/ui'
import { useAction } from '#/components/modules/shared'
import { useAtlasI18n } from '#/components/map'
import { cn } from '#/lib/cn'
import { countryVisitEditForToday } from '#/lib/atlas/visit-edit'
import { loadCountryVisitFn, updateCountryVisitFn } from '#/server/fns/atlas'

/** Keyed by country in both hosts, so a late reply cannot cross country boundaries. */
export function CountryVisitEditor({
  countryCode,
  disabled,
  onPendingChange,
}: {
  countryCode: string
  disabled: boolean
  onPendingChange: (pending: boolean) => void
}) {
  const { t } = useAtlasI18n()
  const router = useRouter()
  const trigger = React.useRef<HTMLButtonElement>(null)
  const first = React.useRef<HTMLInputElement>(null)
  const form = React.useRef<HTMLFormElement>(null)
  const alive = React.useRef(true)
  const opening = React.useRef(false)
  const [loading, setLoading] = React.useState(false)
  const [draft, setDraft] = React.useState<{
    firstVisitedOn: string
    lastVisitedOn: string
    note: string
  } | null>(null)
  const [today, setToday] = React.useState('')
  const [error, setError] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [refreshFailed, setRefreshFailed] = React.useState(false)
  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const save = useAction(updateCountryVisitFn, {
    invalidate: false,
    failure: t('atlas.visitEdit.failed'),
    fallback: t('atlas.visitEdit.failed'),
  })
  const pending = loading || save.pending
  React.useEffect(() => {
    onPendingChange(pending)
  }, [pending, onPendingChange])
  React.useEffect(() => () => onPendingChange(false), [onPendingChange])

  const fieldErrors = (issues: Array<{ field: string; reason: string }>) => {
    const next: Record<string, string> = {}
    for (const issue of issues) {
      if (issue.field === 'note') next.note = t('atlas.visitEdit.noteInvalid')
      else if (issue.reason === 'bounds')
        next[issue.field] = t('atlas.visitEdit.bounds')
      else if (issue.reason === 'future')
        next[issue.field] = t('atlas.visitEdit.future')
      else next[issue.field] = t('atlas.visitEdit.dateInvalid')
    }
    setErrors(next)
    requestAnimationFrame(() =>
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus(),
    )
  }
  async function open() {
    if (opening.current || disabled || pending) return
    opening.current = true
    setLoading(true)
    setError('')
    save.reset()
    setErrors({})
    try {
      const result = await loadCountryVisitFn({ data: { countryCode } })
      if (!alive.current) return
      if (!result.country.visit) {
        setError(t('atlas.visitEdit.missing'))
        return
      }
      const visit = result.country.visit
      setToday(result.today)
      setDraft({
        firstVisitedOn: visit.firstVisitedOn ?? '',
        lastVisitedOn: visit.lastVisitedOn ?? '',
        note: visit.note ?? '',
      })
    } catch {
      if (alive.current) setError(t('atlas.list.error.body'))
    } finally {
      opening.current = false
      if (alive.current) {
        setLoading(false)
        requestAnimationFrame(() => (first.current ?? trigger.current)?.focus())
      }
    }
  }
  function close() {
    setDraft(null)
    setErrors({})
    save.reset()
    requestAnimationFrame(() => trigger.current?.focus())
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft || disabled || pending || opening.current) return
    const invalidDay = Array.from(
      form.current?.querySelectorAll<HTMLInputElement>('input[type="date"]') ??
        [],
    ).find((input) => input.validity.badInput)
    if (invalidDay) {
      fieldErrors([{ field: invalidDay.name, reason: 'date' }])
      return
    }
    const values = {
      countryCode,
      firstVisitedOn: draft.firstVisitedOn || null,
      lastVisitedOn: draft.lastVisitedOn || null,
      note: draft.note,
    }
    const parsed = countryVisitEditForToday(today).safeParse(values)
    if (!parsed.success) {
      fieldErrors(
        parsed.error.issues.map((issue) => ({
          field: String(issue.path[0]),
          reason: issue.message,
        })),
      )
      return
    }
    opening.current = true
    setErrors({})
    first.current?.focus()
    const result = await save.run({ data: parsed.data })
    opening.current = false
    if (!result) {
      if (alive.current) first.current?.focus()
      return
    }
    if (result.errors) {
      if (alive.current) fieldErrors(result.errors)
      return
    }
    if (alive.current) close()
    try {
      await router.invalidate()
      if (alive.current) setRefreshFailed(false)
    } catch {
      if (alive.current) setRefreshFailed(true)
    }
  }
  return (
    <section
      data-part="country-visit-editor"
      className={cn('border-t border-edge pt-3')}
    >
      {draft === null ? (
        <Button
          ref={trigger}
          size="sm"
          variant="secondary"
          disabled={disabled}
          loading={loading}
          loadingLabel={t('atlas.visitEdit.loading')}
          onClick={() => {
            void open()
          }}
        >
          {t('atlas.visitEdit.edit')}
        </Button>
      ) : (
        <form
          ref={form}
          noValidate
          onSubmit={(event) => {
            void submit(event)
          }}
          className={cn('flex min-w-0 flex-col gap-3')}
          aria-busy={save.pending}
        >
          <Field
            label={t('atlas.record.firstVisit')}
            error={errors.firstVisitedOn}
          >
            <Input
              ref={first}
              type="date"
              name="firstVisitedOn"
              max={today}
              value={draft.firstVisitedOn}
              readOnly={save.pending}
              onChange={(event) =>
                setDraft({ ...draft, firstVisitedOn: event.target.value })
              }
            />
          </Field>
          <Field
            label={t('atlas.record.lastVisit')}
            error={errors.lastVisitedOn}
          >
            <Input
              type="date"
              name="lastVisitedOn"
              max={today}
              value={draft.lastVisitedOn}
              readOnly={save.pending}
              onChange={(event) =>
                setDraft({ ...draft, lastVisitedOn: event.target.value })
              }
            />
          </Field>
          <Field label={t('atlas.visitEdit.note')} error={errors.note}>
            <Textarea
              value={draft.note}
              readOnly={save.pending}
              rows={3}
              onChange={(event) =>
                setDraft({ ...draft, note: event.target.value })
              }
            />
          </Field>
          <div className={cn('flex flex-wrap gap-2')}>
            <Button
              size="sm"
              type="submit"
              disabled={disabled}
              loading={save.pending}
              loadingLabel={t('atlas.visitEdit.saving')}
            >
              {t('atlas.visitEdit.save')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={save.pending}
              onClick={close}
            >
              {t('atlas.visitEdit.cancel')}
            </Button>
          </div>
        </form>
      )}
      <p
        role={error ? 'status' : undefined}
        className={cn('mt-2 text-caption text-danger')}
      >
        {error || save.error}
      </p>
      {refreshFailed ? (
        <Button
          size="sm"
          onClick={() => {
            void router
              .invalidate()
              .then(() => setRefreshFailed(false))
              .catch(() => {})
          }}
        >
          {t('atlas.visitEdit.reload')}
        </Button>
      ) : null}
    </section>
  )
}
