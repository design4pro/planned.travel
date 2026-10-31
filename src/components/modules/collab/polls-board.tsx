/** The poll board: an option is a button that casts, moves or withdraws your vote, optimistically. */
import { useEffect, useState } from 'react'
import { Check, Lock, Plus, Trash2, Vote } from 'lucide-react'

import { Badge, Button, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import {
  castVoteFn,
  closePollFn,
  deletePollFn,
} from '#/server/fns/collab-polls'
import {
  ConfirmDialog,
  ModulePanel,
  RowMenu,
  useAction,
  useOptimistic,
} from '../shared'
import { PollDialog } from './poll-dialog'

import type { ConfirmRequest } from '../shared'
import type { PollData } from './types'

export function PollsBoard({
  tripId,
  polls,
  viewerUserId,
  newPollOpen,
  onNewPollOpenChange,
  onDirtyChange,
  turnedOff = false,
  canWrite,
}: {
  tripId: string
  polls: ReadonlyArray<PollData>
  viewerUserId: string
  newPollOpen: boolean
  onNewPollOpenChange: (open: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
  turnedOff?: boolean
  canWrite: boolean
}) {
  const t = useTranslate()
  useEffect(() => {
    onDirtyChange?.(newPollOpen)
  }, [newPollOpen, onDirtyChange])
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  /** Keyed `pollId:optionId` — the viewer's own in-flight choice per option. */
  const votes = useOptimistic<boolean>()

  const vote = useAction(castVoteFn, {
    failure: t('modules.collab.poll.toast.voteFailed'),
    fallback: t('modules.collab.poll.toast.voteFailedBody'),
  })
  const close = useAction(closePollFn, {
    success: t('modules.collab.poll.toast.closed'),
    failure: t('modules.collab.poll.toast.closeFailed'),
  })
  const remove = useAction(deletePollFn, {
    success: t('modules.collab.poll.toast.removed'),
    failure: t('modules.collab.poll.toast.removeFailed'),
    onSuccess: () => setConfirm(null),
  })

  function castVote(poll: PollData, optionId: string, mine: boolean): void {
    if (poll.isClosed) {
      return
    }
    if (!canWrite) return
    const key = `${poll.id}:${optionId}`
    // A single-choice poll moves the vote, so the option being left has to be
    // painted as well as the one being taken.
    const entries: Array<readonly [string, boolean]> = [[key, !mine]]
    if (!poll.allowMultiple && !mine) {
      for (const row of poll.tally) {
        if (row.optionId !== optionId && row.userIds.includes(viewerUserId)) {
          entries.push([`${poll.id}:${row.optionId}`, false])
        }
      }
    }

    void votes.claim(entries, () =>
      vote.run({ data: { tripId, pollId: poll.id, optionId } }),
    )
  }

  return (
    <ModulePanel
      label={t('modules.collab.polls.heading')}
      count={polls.length === 0 ? undefined : String(polls.length)}
      action={
        <Button
          variant="primary"
          size="sm"
          shape="pill"
          disabled={!canWrite}
          onClick={() => onNewPollOpenChange(true)}
        >
          <Plus aria-hidden strokeWidth={2.5} />
          {t('modules.collab.poll.dialog.addTitle')}
        </Button>
      }
    >
      {polls.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Vote />}
          title={t('modules.collab.polls.empty.title')}
          description={t('modules.collab.polls.empty.body')}
          action={
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              disabled={!canWrite}
              onClick={() => onNewPollOpenChange(true)}
            >
              {t('modules.collab.polls.empty.action')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-6">
          {polls.map((poll) => {
            // Recomputed from the overlay, so a tap moves the bar immediately.
            const rows = poll.tally.map((row) => {
              const wasMine = row.userIds.includes(viewerUserId)
              const claimed = votes.get(`${poll.id}:${row.optionId}`)
              const nowMine = claimed ?? wasMine
              const delta = (nowMine ? 1 : 0) - (wasMine ? 1 : 0)
              return {
                ...row,
                mine: nowMine,
                votes: Math.max(row.votes + delta, 0),
              }
            })
            const total = rows.reduce((sum, row) => sum + row.votes, 0)
            const leader = Math.max(...rows.map((row) => row.votes), 0)

            return (
              <li key={poll.id} className="min-w-0">
                <div className="mb-2.5 flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h3 className="min-w-0 flex-1 text-label font-semibold text-ink">
                    {poll.question}
                  </h3>
                  <span className="shrink-0 text-caption tabular-nums text-ink-4">
                    {t('modules.collab.poll.voteCount', { count: total })}
                  </span>
                  {poll.isClosed ? (
                    <Badge tone="neutral" size="sm">
                      {t('modules.collab.badge.closed')}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm" dot>
                      {t('modules.collab.badge.open')}
                    </Badge>
                  )}
                  {poll.allowMultiple ? (
                    <Badge tone="outline" size="sm">
                      {t('modules.collab.badge.multi')}
                    </Badge>
                  ) : null}
                  <RowMenu
                    label={t('modules.collab.poll.actionsFor', {
                      question: poll.question,
                    })}
                    size="sm"
                    items={[
                      {
                        label: t('modules.collab.poll.menu.close'),
                        icon: <Lock aria-hidden />,
                        disabled: !canWrite || poll.isClosed,
                        onSelect: () => {
                          void close.run({ data: { tripId, pollId: poll.id } })
                        },
                      },
                      {
                        disabled: !canWrite,
                        label: t('modules.collab.poll.remove'),
                        icon: <Trash2 aria-hidden />,
                        tone: 'danger',
                        separated: true,
                        onSelect: () =>
                          setConfirm({
                            title: t('modules.collab.poll.removeTitle'),
                            description: t('modules.collab.poll.removeBody', {
                              question: poll.question,
                              count: total,
                            }),
                            confirmLabel: t('modules.collab.poll.remove'),
                            onConfirm: () =>
                              remove.run({ data: { tripId, pollId: poll.id } }),
                          }),
                      },
                    ]}
                  />
                </div>

                <ul className="flex flex-col gap-2">
                  {rows.map((row) => {
                    const share = total === 0 ? 0 : row.votes / total
                    const winning = row.votes > 0 && row.votes === leader
                    return (
                      <li key={row.optionId}>
                        <button
                          type="button"
                          aria-pressed={row.mine}
                          aria-label={t(
                            row.mine
                              ? 'modules.collab.poll.resultMine'
                              : 'modules.collab.poll.result',
                            {
                              label: row.label,
                              votes: row.votes,
                              count: total,
                            },
                          )}
                          disabled={!canWrite || poll.isClosed || vote.pending}
                          onClick={() => castVote(poll, row.optionId, row.mine)}
                          className={cn(
                            'group/option w-full rounded-lg border px-3 py-2 text-start focus-ring',
                            'transition-[border-color,background-color] duration-base ease-out-quint',
                            row.mine
                              ? 'border-brand bg-brand-subtle'
                              : 'border-edge-faint bg-surface-2/50 hover:border-edge-strong',
                            poll.isClosed && 'cursor-default opacity-90',
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className={cn(
                                'grid size-4.5 shrink-0 place-items-center rounded-full border',
                                row.mine
                                  ? 'border-brand bg-brand text-brand-on'
                                  : 'border-edge-strong bg-surface',
                              )}
                            >
                              {row.mine ? (
                                <Check className="size-3" strokeWidth={3} />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-label text-ink">
                              {row.label}
                            </span>
                            {winning && total > 0 ? (
                              <Badge
                                tone="brand"
                                size="sm"
                                className="shrink-0"
                              >
                                {t('modules.collab.badge.leading')}
                              </Badge>
                            ) : null}
                            <span className="shrink-0 text-caption font-semibold tabular-nums text-ink-2">
                              {Math.round(share * 100)}%
                            </span>
                          </span>
                          {/* The tally bar is drawn with spans rather than the
                              `Progress` primitive: a button may only contain
                              phrasing content, and the count is already in the
                              button's accessible name. */}
                          <span
                            aria-hidden
                            className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-surface-inset"
                          >
                            <span
                              className={cn(
                                'block h-full rounded-full transition-[width] duration-slow ease-out-quint',
                                row.mine ? 'bg-brand' : 'bg-accent',
                              )}
                              style={{ width: `${share * 100}%` }}
                            />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      )}

      <PollDialog
        canWrite={canWrite}
        turnedOff={turnedOff}
        tripId={tripId}
        open={newPollOpen}
        onOpenChange={onNewPollOpenChange}
      />

      <ConfirmDialog
        request={canWrite ? confirm : null}
        pending={remove.pending}
        onOpenChange={(next) => {
          if (!next) {
            setConfirm(null)
          }
        }}
      />
    </ModulePanel>
  )
}
