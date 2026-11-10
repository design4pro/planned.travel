import { useEffect, useId, useRef, useState } from 'react'
import { Button, Checkbox, Field, Input } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { galleryPreviewInput } from '#/server/community/snapshot'
import type {
  GalleryPreview,
  GalleryPreviewInput,
  GalleryPreviewResult,
  GallerySnapshot,
} from '#/server/community/snapshot'
import type { MessageKey } from '#/lib/i18n'

interface GalleryPreviewProps {
  readonly initialFields: Omit<GalleryPreviewInput, 'showDates'> & {
    readonly showDates?: boolean
  }
  readonly onPreview: (
    fields: GalleryPreviewInput,
  ) => Promise<GalleryPreviewResult>
  readonly onConfirm: (previewId: string) => void
}

/** Unmounted consent view. The caller owns any later submission; this module never fetches. */
export function GalleryPreviewView(props: GalleryPreviewProps) {
  return <PreviewSession key={props.initialFields.tripId} {...props} />
}

function PreviewSession({
  initialFields,
  onPreview,
  onConfirm,
}: GalleryPreviewProps) {
  const t = useTranslate()
  const headingId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const request = useRef(0)
  const status = useRef<HTMLDivElement>(null)
  const [fields, setFields] = useState<GalleryPreviewInput>(() => ({
    ...initialFields,
    showDates: initialFields.showDates ?? false,
  }))
  const [preview, setPreview] = useState<GalleryPreview | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [expired, setExpired] = useState(false)
  useEffect(
    () => () => {
      request.current += 1
    },
    [],
  )
  useEffect(() => {
    if (error || expired) status.current?.focus()
  }, [error, expired])
  useEffect(() => {
    if (!preview) return
    const timer = window.setTimeout(
      () => {
        setExpired(true)
        heading.current?.focus()
      },
      Math.max(0, preview.expiresAt - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [preview])
  function change(patch: Partial<GalleryPreviewInput>) {
    request.current += 1
    setFields((current) => ({ ...current, ...patch }))
    setPreview(null)
    setPending(false)
    setError(null)
    setExpired(false)
  }
  function fieldError(
    field: 'publicTitle' | 'summary' | 'attribution',
    maximum: number,
  ) {
    if (
      !error ||
      galleryPreviewInput.shape[field].safeParse(fields[field]).success
    )
      return undefined
    if (fields[field].trim().length > maximum)
      return t('auth.validation.passwordLong', {
        count: maximum,
        value: maximum,
      })
    return t('trips.gallery.publish.captureFailed')
  }
  async function capture() {
    const generation = ++request.current
    setPreview(null)
    setError(null)
    setExpired(false)
    const parsed = galleryPreviewInput.safeParse(fields)
    if (!parsed.success) {
      setError('trips.gallery.publish.captureFailed')
      heading.current?.focus()
      return
    }
    setPending(true)
    heading.current?.focus()
    try {
      const result = await onPreview(parsed.data)
      if (generation !== request.current) return
      if (result.status === 'ready') {
        setPreview(result)
        setExpired(result.expiresAt <= Date.now())
      } else {
        setError(
          result.status === 'too-large'
            ? 'trips.gallery.publish.tooLarge'
            : 'trips.gallery.publish.captureFailed',
        )
      }
    } catch {
      if (generation === request.current)
        setError('trips.gallery.publish.captureFailed')
    } finally {
      if (generation === request.current) {
        setPending(false)
        heading.current?.focus()
      }
    }
  }
  return (
    <section className="space-y-4">
      <h2
        id={headingId}
        ref={heading}
        tabIndex={-1}
        className="text-lg font-semibold"
      >
        {t('trips.gallery.publish.title')}
      </h2>
      <p>{t('trips.gallery.publish.publicFields')}</p>
      <p>{t('trips.gallery.publish.privateFields')}</p>
      <p>{t('trips.gallery.publish.freeTextWarning')}</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void capture()
        }}
        className="space-y-3"
      >
        <Field
          label={t('trips.gallery.publish.publicTitle')}
          hint={t('auth.validation.passwordLong', { count: 120, value: 120 })}
          error={fieldError('publicTitle', 120)}
        >
          <Input
            required
            maxLength={120}
            value={fields.publicTitle}
            onChange={(event) => change({ publicTitle: event.target.value })}
          />
        </Field>
        <Field
          label={t('shell.newTrip.summary')}
          hint={t('auth.validation.passwordLong', { count: 280, value: 280 })}
          error={fieldError('summary', 280)}
        >
          <Input
            required
            maxLength={280}
            value={fields.summary}
            onChange={(event) => change({ summary: event.target.value })}
          />
        </Field>
        <Field
          label={t('trips.gallery.publish.attribution')}
          hint={t('auth.validation.passwordLong', { count: 80, value: 80 })}
          error={fieldError('attribution', 80)}
        >
          <Input
            required
            maxLength={80}
            value={fields.attribution}
            onChange={(event) => change({ attribution: event.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={fields.showDates}
            onCheckedChange={(checked) =>
              change({ showDates: checked === true })
            }
          />
          {t('trips.gallery.publish.showDates')}
        </label>
        <Button type="submit" disabled={pending}>
          {pending
            ? t('ui.status.loading')
            : t('trips.gallery.publish.preview')}
        </Button>
      </form>
      <div
        ref={status}
        role="status"
        aria-labelledby={headingId}
        aria-live="polite"
        tabIndex={-1}
      >
        {error && t(error)}
        {expired && t('trips.gallery.publish.expired')}
      </div>
      {preview && (
        <>
          <div
            role="region"
            aria-labelledby={headingId}
            tabIndex={0}
            className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border p-4"
          >
            <GallerySnapshotContent document={preview.document} />
          </div>
          <Button
            disabled={pending || expired}
            onClick={() => {
              if (preview.expiresAt <= Date.now()) {
                setExpired(true)
                heading.current?.focus()
                return
              }
              heading.current?.focus()
              onConfirm(preview.previewId)
            }}
          >
            {t('trips.gallery.publish.confirm')}
          </Button>
        </>
      )}
    </section>
  )
}

/** Every schema member is rendered, including version, ordering, nulls and empty arrays. */
function GallerySnapshotContent({
  document,
}: {
  readonly document: GallerySnapshot
}) {
  const t = useTranslate()
  const empty = t('trips.gallery.publish.empty')
  function value(label: MessageKey, item: string | number | null) {
    return (
      <div>
        <dt className="font-medium">{t(label)}</dt>
        <dd dir="auto">
          {item === null || item === '' ? empty : String(item)}
        </dd>
      </div>
    )
  }
  return (
    <>
      <dl className="space-y-2">
        {value('trips.gallery.publish.version', document.version)}
        {value('trips.gallery.publish.publicTitle', document.publicTitle)}
        {value('shell.newTrip.summary', document.summary)}
        {value('trips.gallery.publish.attribution', document.attribution)}
        {value(
          'trips.gallery.publish.showDates',
          t(
            document.showDates
              ? 'trips.gallery.publish.yes'
              : 'trips.gallery.publish.no',
          ),
        )}
      </dl>
      <h3 className="mt-4 font-semibold">
        {t('trips.gallery.publish.countries')}
      </h3>
      {document.countryCodes.length ? (
        <ul>
          {document.countryCodes.map((code, index) => (
            <li key={index} dir="auto">
              {code}
            </li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
      <h3 className="mt-4 font-semibold">{t('trips.gallery.publish.days')}</h3>
      {!document.days.length && <p>{empty}</p>}
      {document.days.map((day, index) => (
        <section key={index} className="mt-4 space-y-2 border-t pt-4">
          <h4 className="font-semibold">
            {t('trips.plan.editor.dayNumber', { day: day.order })}
          </h4>
          <dl>
            {value('trips.gallery.publish.order', day.order)}
            {day.title !== undefined && (
              <div>
                <dt className="sr-only">
                  {t('trips.plan.editor.dayNumber', { day: day.order })}
                </dt>
                <dd dir="auto">{day.title || empty}</dd>
              </div>
            )}
            {day.date !== undefined &&
              value('modules.transports.field.date', day.date)}
          </dl>
          <h5 className="font-semibold">{t('trips.gallery.publish.places')}</h5>
          {!day.places.length && <p>{empty}</p>}
          {day.places.map((place, placeIndex) => (
            <dl key={placeIndex} className="space-y-2 border-s ps-3">
              {value('modules.field.name', place.name)}
              {value('modules.field.category', place.category)}
              {value('trips.gallery.publish.order', place.order)}
              {place.coordinates && (
                <>
                  {value('trips.plan.editor.latitude', place.coordinates.lat)}
                  {value('trips.plan.editor.longitude', place.coordinates.lng)}
                </>
              )}
            </dl>
          ))}
        </section>
      ))}
    </>
  )
}
