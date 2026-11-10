import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { GalleryPreviewView } from './preview'
import { publicationStatus } from './publication-status'
import type { GalleryPublicationState } from './publication-status'
import type {
  GalleryPreviewInput,
  GalleryPreviewResult,
} from '#/server/community/snapshot'
import type { MessageKey } from '#/lib/i18n'

export interface GalleryPublication extends GalleryPublicationState {
  readonly publicTitle: string
  readonly summary: string
  readonly attribution: string
  readonly showDates: boolean
  readonly submittedAt: string | null
  readonly curatorNote?: string | null
  readonly slug: string | null
}
type Failure =
  | 'stale-preview'
  | 'quota-exceeded'
  | 'too-large'
  | 'storage-full'
  | 'preparation-failed'
  | 'unavailable'
export type GalleryActionResult =
  | { readonly status: 'ok'; readonly publication: GalleryPublication }
  | { readonly status: Failure }
export interface GalleryPublishDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly initialFields: Omit<GalleryPreviewInput, 'showDates'> & {
    readonly showDates?: boolean
  }
  /** Undefined requests a load; null means never submitted. */
  readonly publication: GalleryPublication | null | undefined
  readonly canPublish: boolean
  readonly onLoad: () => Promise<GalleryPublication | null>
  readonly onPreview: (
    fields: GalleryPreviewInput,
  ) => Promise<GalleryPreviewResult>
  readonly onSubmit: (
    input: GalleryPreviewInput & { readonly previewId: string },
  ) => Promise<GalleryActionResult>
  readonly onWithdraw: () => Promise<GalleryActionResult>
  readonly onRetry: () => Promise<GalleryActionResult>
}
const failures = {
  'stale-preview': 'trips.gallery.publish.stalePreview',
  'quota-exceeded': 'trips.gallery.publish.quotaExceeded',
  'too-large': 'trips.gallery.publish.tooLarge',
  'storage-full': 'trips.gallery.publish.storageFull',
  'preparation-failed': 'trips.gallery.publish.preparationFailed',
  unavailable: 'trips.gallery.publish.submitFailed',
} as const satisfies Record<Failure, MessageKey>

/** Unmounted: the caller owns authorization, data loading and all lifecycle operations. */
export function GalleryPublishDialog(props: GalleryPublishDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && (
        <PublishSession key={props.initialFields.tripId} {...props} />
      )}
    </Dialog>
  )
}
function PublishSession(props: GalleryPublishDialogProps) {
  const t = useTranslate()
  const title = useRef<HTMLHeadingElement>(null)
  const notice = useRef<HTMLDivElement>(null)
  const withdrawButton = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const alive = useRef(true)
  const busy = useRef(false)
  const [publication, setPublication] = useState(props.publication ?? null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loading, setLoading] = useState(props.publication === undefined)
  const [loadFailed, setLoadFailed] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<MessageKey | null>(null)
  const [invalidated, invalidate] = useState(0)
  const [editing, setEditing] = useState(
    !props.publication ||
      props.publication.status === 'changes_requested' ||
      props.publication.status === 'withdrawn',
  )
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    if (message) notice.current?.focus()
  }, [message])
  useEffect(() => {
    if (props.publication !== undefined && loadAttempt === 0) return
    let cancelled = false
    busy.current = true
    setLoading(true)
    setLoadFailed(false)
    setMessage(null)
    invalidate((value) => value + 1)
    void props
      .onLoad()
      .then((value) => {
        if (!cancelled) {
          setPublication(value)
          setEditing(
            (current) =>
              current ||
              !value ||
              value.status === 'changes_requested' ||
              value.status === 'withdrawn',
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true)
          setMessage('trips.gallery.publish.loadFailed')
        }
      })
      .finally(() => {
        if (!cancelled) {
          busy.current = false
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [props.onLoad, props.publication, loadAttempt])
  async function action(run: () => Promise<GalleryActionResult>) {
    if (busy.current || !props.canPublish) return
    busy.current = true
    setPending(true)
    setMessage(null)
    try {
      const result = await run()
      if (!alive.current) return
      if (result.status === 'ok') {
        setPublication(result.publication)
        setEditing(result.publication.status === 'withdrawn')
        setMessage('trips.gallery.publish.saved')
      } else {
        setMessage(failures[result.status])
        notice.current?.focus()
        if (result.status === 'stale-preview') invalidate((value) => value + 1)
      }
    } catch {
      if (alive.current) {
        setMessage('trips.gallery.publish.submitFailed')
        notice.current?.focus()
      }
    } finally {
      busy.current = false
      if (alive.current) setPending(false)
    }
  }
  const status = publicationStatus(publication)
  const live =
    publication &&
    publication.status !== 'withdrawn' &&
    publication.slug &&
    publication.liveVersion !== null
  const url = live
    ? `/gallery/${encodeURIComponent(publication.slug ?? '')}`
    : null
  const initialFields = publication
    ? {
        ...props.initialFields,
        publicTitle: publication.publicTitle,
        summary: publication.summary,
        attribution: publication.attribution,
        showDates: publication.showDates,
      }
    : props.initialFields
  return (
    <DialogContent
      size="lg"
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        title.current?.focus()
      }}
    >
      <DialogHeader>
        <DialogTitle ref={title} tabIndex={-1}>
          {t('trips.gallery.publish.dialogTitle')}
        </DialogTitle>
        <DialogDescription>
          {t('trips.gallery.publish.publicFields')}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4 break-words">
        {loading && <p role="status">{t('ui.status.loading')}</p>}
        <div ref={notice} role="status" tabIndex={-1}>
          {message && t(message)}
        </div>
        {loadFailed && (
          <Button onClick={() => setLoadAttempt((value) => value + 1)}>
            {t('trips.gallery.publish.retry')}
          </Button>
        )}
        <div
          hidden={(loading || loadFailed) && !publication}
          className="space-y-4"
        >
          <p>
            {t(status, {
              live: publication?.liveVersion ?? '',
              pending: publication?.version ?? '',
            })}
          </p>
          {publication && (
            <dl className="space-y-2">
              <dt>{t('trips.gallery.publish.publicTitle')}</dt>
              <dd dir="auto">{publication.publicTitle}</dd>
              <dt>{t('shell.newTrip.summary')}</dt>
              <dd dir="auto">{publication.summary}</dd>
              {publication.submittedAt && (
                <>
                  <dt>{t('trips.gallery.publish.submitted')}</dt>
                  <dd>
                    <time dateTime={publication.submittedAt}>
                      {publication.submittedAt}
                    </time>
                  </dd>
                </>
              )}
              {publication.curatorNote && (
                <>
                  <dt>{t('trips.gallery.publish.curatorNote')}</dt>
                  <dd dir="auto">{publication.curatorNote}</dd>
                </>
              )}
            </dl>
          )}
          {url && (
            <div className="flex flex-wrap gap-3">
              <a href={url} className="underline">
                {t('trips.gallery.publish.published')}
              </a>
              <Button
                disabled={pending || loading}
                onClick={async () => {
                  setMessage(null)
                  try {
                    await navigator.clipboard.writeText(
                      new URL(url, window.location.origin).href,
                    )
                    if (alive.current)
                      setMessage('trips.gallery.publish.linkCopied')
                  } catch {
                    if (alive.current)
                      setMessage('trips.gallery.publish.copyFailed')
                  }
                }}
              >
                {t('trips.gallery.publish.copyLink')}
              </Button>
            </div>
          )}
          {publication && (
            <Button
              disabled={pending || loading}
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              {t('modules.files.export.refresh')}
            </Button>
          )}
          {!props.canPublish && (
            <p tabIndex={0}>{t('trips.gallery.publish.adminOnly')}</p>
          )}
          {props.canPublish && (
            <>
              {editing && (
                <GalleryPreviewView
                  initialFields={initialFields}
                  confirmLabel="trips.gallery.publish.submit"
                  onPreview={props.onPreview}
                  disabled={pending || loading}
                  invalidationKey={invalidated}
                  onConfirm={(previewId, fields) =>
                    void action(() => props.onSubmit({ ...fields, previewId }))
                  }
                />
              )}
              {!editing && (
                <Button
                  disabled={pending || loading}
                  onClick={() => setEditing(true)}
                >
                  {t('trips.gallery.publish.update')}
                </Button>
              )}
              {publication?.preparation === 'failed' &&
                publication.status !== 'withdrawn' && (
                  <Button
                    disabled={pending || loading}
                    onClick={() => void action(props.onRetry)}
                  >
                    {t('trips.gallery.publish.retry')}
                  </Button>
                )}
              {publication && publication.status !== 'withdrawn' && (
                <Button
                  ref={withdrawButton}
                  disabled={pending || loading}
                  onClick={() => setConfirmWithdraw(true)}
                >
                  {t('trips.gallery.publish.withdraw')}
                </Button>
              )}
            </>
          )}
          {pending && <p role="status">{t('trips.gallery.publish.saving')}</p>}
        </div>
        <Dialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
          <DialogContent
            size="sm"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              cancel.current?.focus()
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              withdrawButton.current?.focus()
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('trips.gallery.publish.withdraw')}</DialogTitle>
              <DialogDescription>
                {t('trips.gallery.publish.withdrawConfirm')}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <Button ref={cancel} onClick={() => setConfirmWithdraw(false)}>
                {t('trips.gallery.publish.cancel')}
              </Button>
              <Button
                onClick={() => {
                  setConfirmWithdraw(false)
                  void action(props.onWithdraw)
                }}
              >
                {t('trips.gallery.publish.confirmWithdrawal')}
              </Button>
            </DialogBody>
          </DialogContent>
        </Dialog>
      </DialogBody>
    </DialogContent>
  )
}
