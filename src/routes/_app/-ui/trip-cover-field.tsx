/**
 * The cover region of the trip form.
 *
 * One button takes an image three ways: dropped on it, pasted into it (it is focusable, so the paste
 * lands on it), or chosen through the picker it opens. It is a real button, so the keyboard path is
 * the picker - Enter or Space - with no drag involved. A choice previews at once from an object URL
 * and uploads on submit, never here: nothing leaves the machine until the trip exists.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'

import { Button, Progress, focusRing } from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatStorage } from '#/lib/plans'
import { COVER_ACCEPT, isCoverContentType } from '#/lib/trip-cover'
import { useTranslate } from '#/lib/i18n'
import { MAX_FILE_BYTES } from '#/server/fns/file-policy'

/** Why a file cannot be a cover, decided before a byte is sent. */
export type CoverProblem = 'type' | 'size'

/**
 * The browser-side pre-flight. The server decides again (the upload path checks size and the update
 * path checks the type); this is only the reader's early, local answer.
 */
export function coverProblem(file: File): CoverProblem | null {
  if (!isCoverContentType(file.type)) {
    return 'type'
  }
  return file.size > MAX_FILE_BYTES ? 'size' : null
}

export interface TripCoverFieldProps {
  /** The image chosen for this save, or `null`. */
  file: File | null
  /** The cover the trip already has (edit), or `null` for none. */
  currentUrl?: string | null
  /** The reader asked to drop the cover the trip already has. */
  removed?: boolean
  /** `0`-`1` while the chosen file uploads, otherwise `null`. */
  progress: number | null
  /** A save is in flight: the region is shown but cannot be changed. */
  disabled?: boolean
  onChoose: (file: File) => void
  /** Drops the chosen file, or - with none chosen - the cover the trip already has. */
  onRemove: () => void
}

export function TripCoverField({
  file,
  currentUrl = null,
  removed = false,
  progress,
  disabled = false,
  onChoose,
  onRemove,
}: TripCoverFieldProps) {
  const t = useTranslate()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const regionRef = useRef<HTMLButtonElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<{
    kind: CoverProblem
    name: string
  } | null>(null)

  // The preview is the file itself, shown before anything is uploaded; the URL is released with it.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    if (file === null) {
      setPreviewUrl(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  // A file dropped just outside the region would make the browser navigate to it and lose the
  // form. The region handles its own drops; everywhere else a dragged file is simply ignored.
  useEffect(() => {
    const ignoreFiles = (event: DragEvent): void => {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault()
      }
    }
    window.addEventListener('dragover', ignoreFiles)
    window.addEventListener('drop', ignoreFiles)
    return () => {
      window.removeEventListener('dragover', ignoreFiles)
      window.removeEventListener('drop', ignoreFiles)
    }
  }, [])

  const shown = previewUrl ?? (removed ? null : currentUrl)
  const uploading = progress !== null

  function accept(files: ReadonlyArray<File>): void {
    const first = files.at(0)
    if (first === undefined || disabled) {
      return
    }
    const found = coverProblem(first)
    if (found !== null) {
      setProblem({ kind: found, name: first.name })
      return
    }
    setProblem(null)
    onChoose(first)
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={COVER_ACCEPT}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => {
          accept([...(event.target.files ?? [])])
          // Cleared so choosing the same file twice in a row still fires.
          event.target.value = ''
        }}
      />

      <button
        ref={regionRef}
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          accept([...event.dataTransfer.files])
        }}
        onPaste={(event) => {
          const pasted = [...event.clipboardData.files]
          if (pasted.length > 0) {
            event.preventDefault()
            accept(pasted)
          }
        }}
        className={cn(
          'relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed text-center',
          'transition-[background-color,border-color] duration-base ease-out-quint',
          focusRing,
          dragging
            ? 'border-brand bg-brand-subtle'
            : 'border-edge-strong/60 bg-surface-2/40 hover:bg-surface-2',
          'disabled:cursor-not-allowed disabled:opacity-70',
        )}
      >
        {shown === null ? null : (
          <img
            src={shown}
            alt=""
            loading="eager"
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <span
          className={cn(
            'relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-label font-semibold',
            shown === null
              ? 'text-ink-2'
              : 'bg-surface/90 text-ink shadow-card',
          )}
        >
          <ImagePlus aria-hidden className="size-4" />
          {shown === null
            ? t('shell.newTrip.coverChoose')
            : t('shell.newTrip.coverChange')}
        </span>
      </button>

      <p
        id={hintId}
        aria-live="polite"
        className="break-words text-caption text-ink-3"
      >
        {file === null
          ? t('shell.newTrip.coverHint')
          : t('shell.newTrip.coverChosen', { name: file.name })}
      </p>

      {uploading ? (
        <Progress
          value={Math.round(progress * 100)}
          size="sm"
          aria-label={t('shell.newTrip.coverUploading')}
        />
      ) : null}

      {problem === null ? null : (
        <p role="alert" className="break-words text-caption text-danger">
          {problem.kind === 'type'
            ? t('shell.newTrip.coverTypeError', { name: problem.name })
            : t('shell.newTrip.coverSizeError', {
                name: problem.name,
                max: formatStorage(MAX_FILE_BYTES),
              })}
        </p>
      )}

      {file !== null || (currentUrl !== null && !removed) ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="pill"
            disabled={disabled}
            onClick={() => {
              setProblem(null)
              onRemove()
              // The button unmounts with the choice; focus would otherwise fall to the page.
              regionRef.current?.focus()
            }}
          >
            {t('shell.newTrip.coverRemove')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
