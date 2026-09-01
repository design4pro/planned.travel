/**
 * The split editor.
 *
 * Four methods, one control: pick who is in, pick how the amount divides, and the
 * per-person figures update as you type. The running remainder is the point of the
 * whole panel — a split that does not add up is rejected by the repository, and
 * finding that out from a toast after a round trip is a worse experience than
 * never being allowed to submit it.
 *
 * The preview is computed by `splitPreview` in `src/lib/money.ts`, which mirrors
 * the repository's own `computeShares` — including how the rounding remainder is
 * handed out — so the numbers a reader approves are the numbers that get stored.
 */
import { Check, Equal, Percent, PieChart, Scale, Users } from 'lucide-react'

import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Input,
  SectionLabel,
  Tabs,
  TabsList,
  TabsTrigger,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'
import {
  formatMoney,
  isSplitMethod,
  parseMoney,
  parsePercentage,
  parseWeight,
  splitPreview,
  toAmountInput,
} from '#/lib/money'

import type { MessageKey, Translate } from '#/lib/i18n'
import type { ReactNode } from 'react'
import type { SplitMethod, SplitPreview } from '#/lib/money'
import type { CostsPerson } from '#/server/fns/costs'

/** One traveller's row in the editor, in whichever unit the method uses. */
export interface SplitDraftRow {
  readonly userId: string
  readonly included: boolean
  /** Raw field text for `exact`, in major units of the expense currency. */
  readonly exact: string
  /** Raw field text for `shares`. */
  readonly weight: string
  /** Raw field text for `percentage`. */
  readonly percentage: string
}

export interface SplitDraft {
  readonly method: SplitMethod
  readonly rows: ReadonlyArray<SplitDraftRow>
}

const METHODS: ReadonlyArray<{
  readonly value: SplitMethod
  readonly label: MessageKey
  readonly icon: ReactNode
  readonly hint: MessageKey
}> = [
  {
    value: 'equal',
    label: 'costs.split.method.equal',
    icon: <Equal />,
    hint: 'costs.split.method.equalHint',
  },
  {
    value: 'exact',
    label: 'costs.split.method.exact',
    icon: <Scale />,
    hint: 'costs.split.method.exactHint',
  },
  {
    value: 'shares',
    label: 'costs.split.method.shares',
    icon: <PieChart />,
    hint: 'costs.split.method.sharesHint',
  },
  {
    value: 'percentage',
    label: 'costs.split.method.percentage',
    icon: <Percent />,
    hint: 'costs.split.method.percentageHint',
  },
]

/** A blank draft: everyone in, split equally. */
export function emptyDraft(people: ReadonlyArray<CostsPerson>): SplitDraft {
  return {
    method: 'equal',
    rows: people.map((person) => ({
      userId: person.userId,
      included: true,
      exact: '',
      weight: '1',
      percentage: '',
    })),
  }
}

/**
 * The draft for an expense that already exists.
 *
 * The stored `expense_shares` rows carry the *result* of the split, not the input
 * that produced it, so each method's field is seeded from the closest honest
 * reading of that result: exact amounts from the share, weights from the stored
 * weight, percentages from the share's proportion of the total.
 */
export function draftFor(
  people: ReadonlyArray<CostsPerson>,
  amountMinor: number,
  currency: string,
  splitMethod: string,
  shares: ReadonlyArray<{
    readonly userId: string
    readonly shareMinor: number
    readonly weight: number
  }>,
): SplitDraft {
  const byUser = new Map(shares.map((share) => [share.userId, share]))
  return {
    method: isSplitMethod(splitMethod) ? splitMethod : 'equal',
    rows: people.map((person) => {
      const share = byUser.get(person.userId)
      const proportion =
        share === undefined || amountMinor === 0
          ? 0
          : (share.shareMinor / amountMinor) * 100
      return {
        userId: person.userId,
        included: share !== undefined,
        exact:
          share === undefined ? '' : toAmountInput(share.shareMinor, currency),
        weight: share === undefined ? '1' : String(share.weight),
        percentage:
          share === undefined
            ? ''
            : (Math.round(proportion * 100) / 100).toString(),
      }
    }),
  }
}

/**
 * The draft as `splitPreview` wants it: only the included travellers, each with
 * the one unit their method reads.
 */
export function draftToInputs(
  draft: SplitDraft,
  currency: string,
): Array<{
  readonly userId: string
  readonly weight?: number
  readonly shareMinor?: number
  readonly percentage?: number
}> {
  return draft.rows
    .filter((row) => row.included)
    .map((row) => {
      if (draft.method === 'exact') {
        return {
          userId: row.userId,
          shareMinor: exactField(row.exact, currency),
        }
      }
      if (draft.method === 'percentage') {
        return { userId: row.userId, percentage: percentField(row.percentage) }
      }
      if (draft.method === 'shares') {
        return { userId: row.userId, weight: weightField(row.weight) }
      }
      return { userId: row.userId }
    })
}

/**
 * A half-typed field reads as zero rather than as "leave this traveller out".
 *
 * Dropping the row instead would make the remainder jump to the full amount on
 * every keystroke that cleared a field, and the reader would be chasing a target
 * that moves while they aim at it.
 */
function exactField(text: string, currency: string): number {
  return parseMoney(text, currency) ?? 0
}

function percentField(text: string): number {
  return parsePercentage(text) ?? 0
}

function weightField(text: string): number {
  return parseWeight(text) ?? 0
}

/** The preview for a draft, ready for both the editor and the submit path. */
export function previewFor(
  draft: SplitDraft,
  amountMinor: number,
  currency: string,
): SplitPreview {
  return splitPreview(amountMinor, draft.method, draftToInputs(draft, currency))
}

export interface SplitEditorProps {
  readonly people: ReadonlyArray<CostsPerson>
  readonly viewerUserId: string
  readonly draft: SplitDraft
  readonly onDraftChange: (next: SplitDraft) => void
  readonly amountMinor: number
  readonly currency: string
  readonly preview: SplitPreview
  readonly disabled?: boolean
}

export function SplitEditor({
  people,
  viewerUserId,
  draft,
  onDraftChange,
  amountMinor,
  currency,
  preview,
  disabled = false,
}: SplitEditorProps) {
  const t = useTranslate()
  const locale = useLocale()
  const included = draft.rows.filter((row) => row.included).length
  const shareOf = new Map(
    preview.rows.map((row) => [row.userId, row.shareMinor]),
  )
  const method =
    METHODS.find((entry) => entry.value === draft.method) ?? METHODS[0]

  const setRow = (userId: string, patch: Partial<SplitDraftRow>): void => {
    onDraftChange({
      ...draft,
      rows: draft.rows.map((row) =>
        row.userId === userId ? { ...row, ...patch } : row,
      ),
    })
  }

  const setAll = (next: boolean): void => {
    onDraftChange({
      ...draft,
      rows: draft.rows.map((row) => ({ ...row, included: next })),
    })
  }

  /**
   * Switching method keeps the membership but re-seeds the unit fields from the
   * split that is on screen, so the reader lands on the figures they were already
   * looking at instead of on an empty column.
   */
  const setMethod = (next: string): void => {
    if (!isSplitMethod(next) || next === draft.method) {
      return
    }
    const count = Math.max(included, 1)
    onDraftChange({
      method: next,
      rows: draft.rows.map((row) => {
        if (!row.included) {
          return row
        }
        const current = shareOf.get(row.userId) ?? 0
        if (next === 'exact') {
          return { ...row, exact: toAmountInput(current, currency) }
        }
        if (next === 'percentage') {
          // Two decimal places, which is as fine as the field lets anyone type and
          // fine enough for 100 ÷ 3 to still add up once the remainder is placed.
          const share =
            amountMinor === 0
              ? Math.round((100 / count) * 100) / 100
              : Math.round((current / amountMinor) * 10_000) / 100
          return { ...row, percentage: String(share) }
        }
        if (next === 'shares') {
          return { ...row, weight: row.weight.trim() === '' ? '1' : row.weight }
        }
        return row
      }),
    })
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-edge-faint bg-surface-2 p-4"
      aria-label={t('costs.split.section')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel icon={<Users />} as="h3">
          {t('costs.split.label')}
        </SectionLabel>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="pill"
            disabled={disabled || included === draft.rows.length}
            onClick={() => setAll(true)}
          >
            {t('costs.split.everyone')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="pill"
            disabled={disabled || included === 0}
            onClick={() => setAll(false)}
          >
            {t('costs.split.nobody')}
          </Button>
        </div>
      </div>

      <Tabs
        value={draft.method}
        onValueChange={setMethod}
        variant="segmented"
        size="sm"
      >
        <TabsList aria-label={t('costs.split.how')}>
          {METHODS.map((entry) => (
            <TabsTrigger
              key={entry.value}
              value={entry.value}
              icon={entry.icon}
              disabled={disabled}
            >
              {t(entry.label)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <p className="text-caption text-ink-3">{t(method.hint)}</p>

      <ul className="flex flex-col divide-y divide-edge-faint">
        {people.map((person) => {
          const row = draft.rows.find((entry) => entry.userId === person.userId)
          if (row === undefined) {
            return null
          }
          const share = row.included ? (shareOf.get(person.userId) ?? 0) : 0
          return (
            // The unit field and the computed share travel together in their own
            // group, so on a phone they wrap to a second line and stay
            // right-aligned instead of squeezing the traveller's name to nothing.
            <li
              key={person.userId}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
            >
              <Checkbox
                size="sm"
                checked={row.included}
                disabled={disabled}
                onCheckedChange={(next) =>
                  setRow(person.userId, { included: next === true })
                }
                aria-label={`Include ${person.name} in this split`}
              />
              <Avatar name={person.name} src={person.image} size="xs" />
              <span className="min-w-0 flex-1 basis-32 truncate text-caption font-medium text-ink">
                {person.userId === viewerUserId ? 'You' : person.name}
              </span>

              <span className="ms-auto flex shrink-0 items-center gap-3">
                {row.included && draft.method !== 'equal' ? (
                  <Input
                    size="sm"
                    className="w-24 text-end tabular-nums"
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={disabled}
                    aria-label={unitLabel(t, draft.method, person.name)}
                    trailing={draft.method === 'percentage' ? '%' : undefined}
                    value={fieldValue(draft.method, row)}
                    onChange={(event) =>
                      setRow(
                        person.userId,
                        fieldPatch(draft.method, event.target.value),
                      )
                    }
                  />
                ) : null}

                <span
                  className={cn(
                    'w-24 shrink-0 text-end text-caption font-semibold tabular-nums',
                    row.included ? 'text-ink' : 'text-ink-4',
                  )}
                >
                  {row.included ? formatMoney(share, currency, locale) : '—'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <RemainderBar
        preview={preview}
        amountMinor={amountMinor}
        currency={currency}
      />
    </section>
  )
}

/** The accessible name on one traveller's number field. */
function unitLabel(t: Translate, method: SplitMethod, name: string): string {
  if (method === 'exact') {
    return t('costs.split.exactFor', { name })
  }
  if (method === 'percentage') {
    return t('costs.split.percentFor', { name })
  }
  return t('costs.split.sharesFor', { name })
}

function fieldValue(method: SplitMethod, row: SplitDraftRow): string {
  if (method === 'exact') {
    return row.exact
  }
  if (method === 'percentage') {
    return row.percentage
  }
  return row.weight
}

function fieldPatch(
  method: SplitMethod,
  value: string,
): Partial<SplitDraftRow> {
  if (method === 'exact') {
    return { exact: value }
  }
  if (method === 'percentage') {
    return { percentage: value }
  }
  return { weight: value }
}

/**
 * The running total, and how far it is from the expense.
 *
 * The badge is the gate on the save button made visible: green means the split is
 * settled, amber means there is money left to place, red means the split has
 * over-committed. The bar underneath makes the same statement without relying on
 * hue alone.
 */
function RemainderBar({
  preview,
  amountMinor,
  currency,
}: {
  preview: SplitPreview
  amountMinor: number
  currency: string
}) {
  const t = useTranslate()
  const locale = useLocale()
  const ratio =
    amountMinor === 0
      ? 0
      : Math.min(Math.abs(preview.allocatedMinor) / amountMinor, 1)
  const over = preview.remainderMinor < 0
  const tone = preview.balanced ? 'success' : over ? 'danger' : 'warning'

  return (
    <div className="flex flex-col gap-2 border-t border-edge-faint pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-caption text-ink-3">
          <span className="font-semibold tabular-nums text-ink">
            {t('costs.split.allocated', {
              allocated: formatMoney(preview.allocatedMinor, currency, locale),
              total: formatMoney(amountMinor, currency, locale),
            })}
          </span>
        </p>
        <Badge
          tone={tone}
          size="md"
          icon={preview.balanced ? <Check /> : undefined}
        >
          {preview.balanced
            ? t('costs.split.balanced')
            : over
              ? t('costs.split.over', {
                  amount: formatMoney(
                    -preview.remainderMinor,
                    currency,
                    locale,
                  ),
                })
              : t('costs.split.left', {
                  amount: formatMoney(preview.remainderMinor, currency, locale),
                })}
        </Badge>
      </div>
      {/* `origin-left` on the fill has no logical spelling — `transform-origin`
          takes physical keywords only — so the track turns round instead and the
          bar grows from wherever the reader starts. Same device as
          `ui/progress.tsx`. */}
      <div
        aria-hidden
        className="h-1.5 overflow-hidden rounded-full bg-surface-inset rtl:-scale-x-100"
      >
        <span
          className={cn(
            'block h-full origin-left rounded-full transition-[scale] duration-base ease-out-quint',
            preview.balanced ? 'bg-success' : over ? 'bg-danger' : 'bg-warning',
          )}
          /*
            `scale`, not `transform`, and no `data-motion-transform`.
            This bar's width *is* the number — how much of the expense is
            claimed — so it is a value, not motion. It carried the attribute,
            and the reduced-motion block resets `transform: none !important` on
            anything that does, which drew every split as fully claimed for the
            readers who asked for less movement. `scale` is a separate property
            the reset does not touch, and the global `transition-duration`
            collapse still removes the animation. `progress.tsx` reads the same
            way for the same reason.
          */
          style={{ scale: `${ratio} 1` }}
        />
      </div>
      {preview.error === null ? null : (
        <p role="status" className="text-caption font-medium text-warning">
          {preview.error}
        </p>
      )}
    </div>
  )
}
