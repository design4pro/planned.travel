import { BriefcaseBusiness, CircleHelp, Cross, Sun } from 'lucide-react'
import { cn } from '#/lib/cn'
import type { ButtonHTMLAttributes, Ref } from 'react'
import type { EntryKind } from '#/lib/vacay/entry-kinds'

const GLYPHS = {
  sick: Cross,
  remote: BriefcaseBusiness,
  holiday: Sun,
  other: CircleHelp,
}
export function KindCue({ kind }: { kind: EntryKind }) {
  if (kind === 'vacation')
    return <span aria-hidden className="size-2 rounded-sm bg-current" />
  if (kind === 'half_day')
    return (
      <span
        aria-hidden
        className="size-2 border border-current bg-linear-to-b from-current from-50% to-transparent to-50%"
      />
    )
  const Icon = GLYPHS[kind]
  return <Icon aria-hidden className="size-2.5" />
}
export function DayCell({
  day,
  kind,
  companyHoliday,
  other,
  busy,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>
  day: number
  kind?: EntryKind
  companyHoliday: boolean
  other: boolean
  busy: boolean
}) {
  return (
    <button
      {...props}
      type="button"
      aria-busy={busy || undefined}
      className={cn(
        'relative flex min-h-7 w-full scroll-mt-40 scroll-mb-80 items-center justify-center rounded-md text-caption tabular-nums hover:brightness-90 active:scale-95 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current [@media(pointer:coarse)]:min-h-10',
        companyHoliday && 'border border-dashed border-current',
        busy && 'opacity-60',
        props.className,
      )}
    >
      {day}
      {kind ? (
        <span className="absolute end-0 top-0">
          <KindCue kind={kind} />
        </span>
      ) : null}
      {other ? (
        <span
          aria-hidden
          className="absolute bottom-0 inset-x-2 h-0.5 bg-current"
        />
      ) : null}
    </button>
  )
}
