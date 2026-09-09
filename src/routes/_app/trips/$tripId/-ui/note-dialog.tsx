/**
 * The note editor.
 *
 * One dialog for both writes, because a note is four fields and the only difference
 * between adding and changing one is which sentence the header carries.
 *
 * Two things here are not free choices. The **picker** is a radio group rather than
 * nineteen buttons, so the whole vocabulary is one tab stop with arrow-key movement — a
 * toolbar of nineteen tab stops in the middle of a form is a keyboard trap in all but
 * name. And each swatch's tooltip is anchored to a **wrapper** rather than to the radio
 * itself: `Tooltip` renders its trigger `asChild`, so a radio used *as* the trigger has
 * the tooltip's `data-state="closed"` merged over its own `checked` — and swatch styling
 * keyed on `data-[state=checked]` then draws the chosen glyph exactly like the eighteen
 * that are not chosen. That cost a previous attempt at this dialog a full iteration.
 *
 * The write pane and the preview sit side by side where there is room and behind two
 * tabs where there is not, which is a designed 360px layout rather than two crushed
 * panes. Both render the same `Markdown` the row does, so what the writer sees while
 * typing is what the day will show.
 */
import * as React from 'react'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'

import { cn } from '#/lib/cn'
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
  Input,
  RadioGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipProvider,
  focusRing,
  transitionBase,
} from '#/components/ui'
import {
  DAY_NOTE_ICONS,
  DEFAULT_DAY_NOTE_ICON,
  dayNoteIcon,
  dayNoteIconGlyph,
  dayNoteIconLabel,
} from '#/components/planner'
import { useTranslate } from '#/lib/i18n'
import { Markdown } from '#/lib/markdown/render'

import type { DayNoteIcon } from '#/components/planner'
import type { PlanNote } from '../-server/day-notes'

/** What the editor holds while it is open. Blank means absent, never unchanged. */
export interface NoteDraft {
  readonly body: string
  readonly detail: string
  /** `HH:MM`, or `''`. */
  readonly time: string
  readonly icon: DayNoteIcon
}

export const emptyNote: NoteDraft = {
  body: '',
  detail: '',
  time: '',
  icon: DEFAULT_DAY_NOTE_ICON,
}

/** A stored note, as the editor opens on it. */
export function draftFromNote(note: PlanNote): NoteDraft {
  return {
    body: note.body,
    detail: note.detail ?? '',
    // What D1 hands back is what was stored, which may carry seconds. An
    // `<input type="time">` takes `HH:MM` and silently ignores anything longer.
    time: note.time === null ? '' : note.time.slice(0, 5),
    // A name written before `01-S2b` narrowed the vocabulary still has to select
    // something in the picker, and the row already draws it as the sticky note.
    icon: dayNoteIcon(note.icon),
  }
}

export interface NoteDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly mode: 'create' | 'edit'
  readonly initial: NoteDraft
  readonly saving: boolean
  readonly error: string | null
  readonly onSubmit: (values: NoteDraft) => void
}

/**
 * True where the write pane and the preview both fit.
 *
 * A real media-query read rather than two CSS-hidden copies: the tabbed layout owns a
 * `Tabs` value, and mounting both layouts would put two textareas holding the same
 * draft on the page at once.
 */
function useTwoPane(): boolean {
  const [wide, setWide] = React.useState(true)

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)')
    const read = (): void => setWide(query.matches)
    read()
    query.addEventListener('change', read)
    return () => {
      query.removeEventListener('change', read)
    }
  }, [])

  return wide
}

export function NoteDialog({
  open,
  onOpenChange,
  mode,
  initial,
  saving,
  error,
  onSubmit,
}: NoteDialogProps) {
  const t = useTranslate()
  const twoPane = useTwoPane()
  const [draft, setDraft] = React.useState(initial)

  React.useEffect(() => {
    if (open) setDraft(initial)
  }, [initial, open])

  const complete = draft.body.trim().length > 0

  const detailField = (
    <Field
      label={t('trips.plan.note.field.detail')}
      hint={t('trips.plan.note.field.detailHint')}
    >
      <Textarea
        value={draft.detail}
        onChange={(event) => setDraft({ ...draft, detail: event.target.value })}
        rows={8}
        maxLength={20_000}
      />
    </Field>
  )

  const preview =
    draft.detail.trim().length === 0 ? (
      <p className="text-caption text-ink-4">
        {t('trips.plan.note.previewEmpty')}
      </p>
    ) : (
      <Markdown text={draft.detail} />
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('trips.plan.note.dialog.createTitle')
              : t('trips.plan.note.dialog.editTitle')}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form
            id="note-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (complete && !saving) onSubmit(draft)
            }}
          >
            {error === null ? null : (
              <Alert tone="danger" title={t('trips.plan.note.error.save')}>
                {error}
              </Alert>
            )}

            <Field
              label={t('trips.plan.note.field.body')}
              hint={t('trips.plan.note.field.bodyHint')}
              required
            >
              <Input
                value={draft.body}
                onChange={(event) =>
                  setDraft({ ...draft, body: event.target.value })
                }
                maxLength={20_000}
                autoFocus
              />
            </Field>

            {twoPane ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {detailField}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-label font-medium text-ink-2">
                    {t('trips.plan.note.tab.preview')}
                  </span>
                  <div className="min-h-40 flex-1 overflow-y-auto rounded-lg bg-surface-2 px-3.5 py-3">
                    {preview}
                  </div>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="write" variant="segmented" size="sm">
                <TabsList>
                  <TabsTrigger value="write">
                    {t('trips.plan.note.tab.write')}
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    {t('trips.plan.note.tab.preview')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="write">{detailField}</TabsContent>
                <TabsContent value="preview">
                  <div className="min-h-40 overflow-y-auto rounded-lg bg-surface-2 px-3.5 py-3">
                    {preview}
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('trips.plan.note.field.time')}
                hint={t('trips.plan.note.field.timeHint')}
              >
                <Input
                  type="time"
                  value={draft.time}
                  onChange={(event) =>
                    setDraft({ ...draft, time: event.target.value })
                  }
                  className="tabular-nums"
                />
              </Field>

              <Field label={t('trips.plan.note.field.icon')}>
                <IconPicker
                  value={draft.icon}
                  onValueChange={(icon) => setDraft({ ...draft, icon })}
                />
              </Field>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('trips.plan.note.cancel')}
          </Button>
          <Button
            type="submit"
            form="note-form"
            variant="primary"
            shape="pill"
            disabled={!complete || saving}
            loading={saving}
            loadingLabel={t('trips.plan.note.save')}
          >
            {t('trips.plan.note.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface IconPickerProps {
  readonly value: DayNoteIcon
  readonly onValueChange: (value: DayNoteIcon) => void
}

/**
 * The nineteen names, as one arrow-navigable group.
 *
 * The group is the shipped `RadioGroup` — Radix's roving focus, so the picker takes one
 * tab stop — and each swatch is a radio item styled here rather than in
 * `src/components/ui`, because a glyph tile is this dialog's shape and not a design-system
 * primitive. Every swatch carries the icon's name: the glyph alone is not a label.
 */
function IconPicker({ value, onValueChange }: IconPickerProps) {
  const t = useTranslate()

  return (
    <TooltipProvider>
      <RadioGroup
        value={value}
        onValueChange={(next) => onValueChange(next as DayNoteIcon)}
        className="grid-cols-7 gap-1.5 sm:grid-cols-8"
      >
        {DAY_NOTE_ICONS.map((icon) => {
          const Glyph = dayNoteIconGlyph(icon)
          const name = t(dayNoteIconLabel(icon))
          return (
            // The tooltip hangs off this wrapper. Anchored to the radio itself it would
            // merge its own `data-state` over the radio's and erase the chosen state.
            <Tooltip key={icon} content={name}>
              {/* A real box, not `display: contents`: the tooltip is positioned
                  against this element, and a box-less trigger has no rectangle. */}
              <span className="grid aspect-square">
                <RadioGroupPrimitive.Item
                  value={icon}
                  aria-label={name}
                  className={cn(
                    'grid size-full place-items-center rounded-md',
                    'border border-edge bg-surface text-ink-3',
                    transitionBase,
                    focusRing,
                    'hover:border-edge-strong hover:bg-surface-2 hover:text-ink',
                    'data-[state=checked]:border-brand data-[state=checked]:bg-brand',
                    'data-[state=checked]:text-brand-on',
                  )}
                >
                  <Glyph size={14} strokeWidth={2} aria-hidden="true" />
                </RadioGroupPrimitive.Item>
              </span>
            </Tooltip>
          )
        })}
      </RadioGroup>
    </TooltipProvider>
  )
}

export interface NoteDeleteDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly saving: boolean
  readonly error: string | null
  readonly onConfirm: () => void
}

/**
 * The question in front of a delete.
 *
 * A note carries prose somebody wrote and there is no undo, so it goes behind a
 * question rather than behind a toast with a five-second window. `Cancel` holds the
 * initial focus: this dialog is not a place to lose a paragraph by pressing Enter.
 */
export function NoteDeleteDialog({
  open,
  onOpenChange,
  saving,
  error,
  onConfirm,
}: NoteDeleteDialogProps) {
  const t = useTranslate()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('trips.plan.note.confirmDelete')}</DialogTitle>
          <DialogDescription>
            {t('trips.plan.note.confirmDeleteBody')}
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <DialogBody>
            <Alert tone="danger" title={t('trips.plan.note.error.delete')}>
              {error}
            </Alert>
          </DialogBody>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            shape="pill"
            autoFocus
            onClick={() => onOpenChange(false)}
          >
            {t('trips.plan.note.cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            shape="pill"
            loading={saving}
            loadingLabel={t('trips.plan.note.delete')}
            onClick={onConfirm}
          >
            {t('trips.plan.note.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
