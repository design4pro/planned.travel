import * as React from 'react'
import { cn } from '#/lib/cn'

/** One admission clock per real navigation, shared by pending and loaded views. */
export function PlanReadinessBoundary({
  entryKey,
  loaderReady,
  title,
  children,
}: {
  readonly entryKey: string | null
  readonly loaderReady: boolean
  readonly title: string
  readonly children: React.ReactNode
}) {
  if (entryKey === null) return <>{children}</>
  return (
    <ReadinessSession key={entryKey} loaderReady={loaderReady} title={title}>
      {children}
    </ReadinessSession>
  )
}

function ReadinessSession({
  title,
  children,
  loaderReady,
}: {
  readonly loaderReady: boolean
  readonly title: string
  readonly children: React.ReactNode
}) {
  const root = React.useRef<HTMLDivElement>(null)
  const loader = React.useRef(loaderReady)
  loader.current = loaderReady
  const check = React.useRef<(() => void) | null>(null)
  const [phase, setPhase] = React.useState<
    'waiting' | 'visible' | 'exit' | 'done'
  >('waiting')
  React.useEffect(() => {
    const node = root.current
    if (node === null) return
    let admitted = false
    let finished = false
    let exitTimer: ReturnType<typeof setTimeout> | undefined
    const ready = () => {
      if (node.querySelector('[data-plan-error]') !== null) return true
      if (!loader.current) return false
      const markers = node.querySelectorAll('[data-map-ready]')
      return (
        node.querySelector('[data-plan-loaded]') !== null &&
        markers.length > 0 &&
        [...markers].every(
          (marker) => marker.getAttribute('data-map-ready') !== 'false',
        )
      )
    }
    const settle = () => {
      if (finished || !ready()) return
      finished = true
      clearTimeout(admission)
      if (
        !admitted ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        setPhase('done')
        return
      }
      setPhase('exit')
      exitTimer = setTimeout(() => setPhase('done'), 150)
    }
    const admission = setTimeout(() => {
      if (ready()) {
        finished = true
        setPhase('done')
        return
      }
      admitted = true
      setPhase('visible')
    }, 150)
    check.current = settle
    const observer = new MutationObserver(settle)
    observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-map-ready',
        'data-plan-loaded',
        'data-plan-error',
      ],
    })
    settle()
    return () => {
      check.current = null
      observer.disconnect()
      clearTimeout(admission)
      clearTimeout(exitTimer)
    }
  }, [])
  React.useEffect(() => {
    check.current?.()
  }, [loaderReady])
  return (
    <div
      ref={root}
      aria-busy={phase === 'waiting' || phase === 'visible'}
      className="relative w-full"
    >
      <div className="contents" inert={phase === 'visible' || phase === 'exit'}>
        {children}
      </div>
      {phase === 'done' ? null : (
        <div
          data-workspace-splash={phase}
          aria-hidden="true"
          className={cn(
            'absolute inset-0 z-50 grid place-items-center bg-surface font-display text-title text-ink',
            phase === 'waiting' && 'invisible',
            phase === 'exit' &&
              'opacity-0 transition-opacity duration-150 motion-reduce:transition-none',
          )}
        >
          {title}
        </div>
      )}
    </div>
  )
}
