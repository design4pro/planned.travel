/**
 * The dialog behind the poll board.
 *
 * A poll's options are minted here as a list the traveller can grow and shrink,
 * because two options is the minimum a vote makes sense with and twelve is more
 * than any group needs. Duplicate wording is refused: a tie between two options
 * that say the same thing is not a result.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

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
  SwitchField,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { createPollFn } from '#/server/fns/collab-polls'
import { useAction } from '../shared'
import { pollOptionsError } from './poll-options'

const MAX_OPTIONS = 12

export function PollDialog({
  tripId,
  open,
  onOpenChange,
  turnedOff = false,
  canWrite,
}: {
  tripId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  turnedOff?: boolean
  canWrite: boolean
}) {
  const formId = useId()

  const t = useTranslate()
  const off = useRef(turnedOff)
  off.current = turnedOff

  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<Array<string>>(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setQuestion('')
    setOptions(['', ''])
    setAllowMultiple(false)
    setTouched(false)
  }, [open])

  const create = useAction(createPollFn, {
    success: () =>
      t(
        off.current
          ? 'trips.collab.sections.savedHidden'
          : 'modules.collab.poll.toast.opened',
      ),
    description: () =>
      off.current ? '' : t('modules.collab.poll.toast.openedBody'),
    failure: t('modules.collab.poll.toast.openFailed'),
  })

  const optionsProblem = pollOptionsError(options)
  const optionsError = optionsProblem === null ? undefined : t(optionsProblem)
  const questionError =
    question.trim().length === 0 ? 'Ask the group something.' : undefined
  const canSave =
    canWrite &&
    optionsError === undefined &&
    questionError === undefined &&
    !create.pending

  function setOption(index: number, value: string): void {
    setOptions((current) =>
      current.map((entry, position) => (position === index ? value : entry)),
    )
  }

  async function submit(): Promise<void> {
    if (!canWrite) return
    setTouched(true)
    if (!canSave) {
      return
    }
    const result = await create.run({
      data: {
        tripId,
        question: question.trim(),
        options: options
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
        allowMultiple,
      },
    })
    if (result !== null) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open && canWrite} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('modules.collab.poll.dialog.addTitle')}</DialogTitle>
          <DialogDescription>
            When the group cannot agree on a restaurant, put it to a vote and
            let the answer settle itself.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {turnedOff ? (
            <p className="mb-4 text-caption text-ink-3">
              {t('trips.collab.sections.turnedOff')}
            </p>
          ) : null}
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {create.error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {create.error}
              </Alert>
            )}

            <Field
              label={t('modules.collab.poll.field.question')}
              required
              error={touched ? questionError : undefined}
            >
              <Input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t('modules.collab.poll.field.questionPlaceholder')}
                maxLength={200}
                autoComplete="off"
                required
              />
            </Field>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-label font-medium text-ink">
                {t('modules.collab.poll.field.optionsLegend')}
              </legend>
              <ul className="flex flex-col gap-2">
                {options.map((option, index) => (
                  <li key={index} className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-caption tabular-nums text-ink-4">
                      {index + 1}
                    </span>
                    <Input
                      value={option}
                      onChange={(event) => setOption(index, event.target.value)}
                      placeholder={
                        index === 0
                          ? t('modules.collab.poll.example.first')
                          : index === 1
                            ? t('modules.collab.poll.example.second')
                            : t('modules.collab.poll.example.third')
                      }
                      maxLength={120}
                      autoComplete="off"
                      aria-label={t('modules.collab.poll.field.option', {
                        n: index + 1,
                      })}
                      className="min-w-0 flex-1"
                    />
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      label={t('modules.collab.poll.action.removeOption', {
                        n: index + 1,
                      })}
                      icon={<Trash2 aria-hidden />}
                      disabled={options.length <= 2}
                      onClick={() =>
                        setOptions((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
              {touched && optionsError !== undefined ? (
                <p className="mt-2 text-caption text-danger">{optionsError}</p>
              ) : null}
              <Button
                type="button"
                variant="subtle"
                size="sm"
                shape="pill"
                className="mt-3"
                disabled={options.length >= MAX_OPTIONS}
                onClick={() => setOptions((current) => [...current, ''])}
              >
                <Plus aria-hidden />
                {t('modules.collab.poll.action.addOption')}
              </Button>
            </fieldset>

            <SwitchField
              label={t('modules.collab.poll.field.multi')}
              description={t('modules.collab.poll.field.multiHint')}
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
            />
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            loading={create.pending}
            loadingLabel={t('modules.collab.poll.action.opening')}
          >
            {t('modules.collab.poll.action.open')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
