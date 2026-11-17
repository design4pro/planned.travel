import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DashboardRefreshErrorPanel } from '../dashboard-refresh-error'
import { useDashboardRetryFocus } from '../use-dashboard-retry-focus'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'

vi.mock('#/components/layout/use-open-current-workspace', () => ({
  useOpenCurrentWorkspace: () => ({ open: vi.fn(), opening: false }),
}))
vi.mock('#/components/layout/failure-feedback', () => ({
  FailureFeedback: () => null,
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ to, ...props }: { to: string } & React.ComponentProps<'a'>) => (
    <a href={to} {...props} />
  ),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mountRecovery(empty = false) {
  let resolve = (_ok: boolean) => {}
  const response = new Promise<boolean>((done) => {
    resolve = done
  })
  let commit = () => {}
  let replaceLoader = () => {}
  let switchWorkspace = () => {}
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  function Page() {
    const [recovered, setRecovered] = useState(false)
    const [identity, setIdentity] = useState(() => ({}))
    const [workspaceId, setWorkspaceId] = useState('workspace-a')
    replaceLoader = () => setIdentity({})
    switchWorkspace = () => setWorkspaceId('workspace-b')
    const recovery = useDashboardRetryFocus({
      identity,
      workspaceId,
      recovered,
      onRetry: () => response,
    })
    commit = () => setRecovered(true)
    return (
      <>
        <button>Shell action</button>
        {recovered ? (
          empty ? (
            <a href="/trips" data-dashboard-create-trip="">
              Plan a trip
            </a>
          ) : (
            <button data-dashboard-mascot-launcher="">Open travel chat</button>
          )
        ) : (
          <DashboardRefreshErrorPanel
            error={new Error('refresh failed')}
            onRetry={recovery.retry}
            containerRef={recovery.containerRef}
          />
        )}
      </>
    )
  }
  const view = render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('shell', Shell),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <Page />
    </I18nProvider>,
  )
  const retry = screen.getByRole('button', { name: 'Try again' })
  retry.focus()
  fireEvent.click(retry)
  return {
    resolve: async (ok: boolean) => {
      await act(async () => resolve(ok))
    },
    commit: async () => {
      await act(async () => commit())
    },
    frame: () => {
      act(() => {
        for (const callback of frames.splice(0)) callback(performance.now())
      })
    },
    replaceLoader: async () => {
      await act(async () => replaceLoader())
    },
    switchWorkspace: async () => {
      await act(async () => switchWorkspace())
    },
    unmount: () => {
      act(() => view.unmount())
    },
  }
}

it('restores the named target after a later recovered-view commit', async () => {
  const recovery = mountRecovery()
  await recovery.resolve(true)
  recovery.frame()
  await recovery.commit()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Open travel chat' }),
  )
})

it('does not mistake automatic body focus during removal for a user move', async () => {
  const recovery = mountRecovery()
  await recovery.commit()
  fireEvent.focusIn(document.body)
  await recovery.resolve(true)
  recovery.frame()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Open travel chat' }),
  )
})

it('uses the existing create-trip action when the recovered dashboard is empty', async () => {
  const recovery = mountRecovery(true)
  await recovery.resolve(true)
  recovery.frame()
  await recovery.commit()
  expect(document.activeElement).toBe(
    screen.getByRole('link', { name: 'Plan a trip' }),
  )
})

it('preserves focus explicitly moved to a connected shell control', async () => {
  const recovery = mountRecovery()
  const shell = screen.getByRole('button', { name: 'Shell action' })
  shell.focus()
  await recovery.resolve(true)
  recovery.frame()
  await recovery.commit()
  expect(document.activeElement).toBe(shell)
})

it('preserves an outside pointer action even when it does not move focus', async () => {
  const recovery = mountRecovery()
  fireEvent.pointerDown(document.body)
  await recovery.resolve(true)
  recovery.frame()
  await recovery.commit()
  expect(document.activeElement).not.toBe(
    screen.getByRole('button', { name: 'Open travel chat' }),
  )
})

it('returns to the recovery group after a refused retry', async () => {
  const recovery = mountRecovery()
  await recovery.resolve(false)
  recovery.frame()
  expect(document.activeElement).toBe(
    screen.getByRole('group', { name: 'The dashboard did not load' }),
  )
})

it.each(['replaceLoader', 'switchWorkspace'] as const)(
  'cancels an old retry after %s',
  async (change) => {
    const recovery = mountRecovery()
    await recovery[change]()
    await recovery.commit()
    await recovery.resolve(true)
    recovery.frame()
    expect(document.activeElement).not.toBe(
      screen.getByRole('button', { name: 'Open travel chat' }),
    )
  },
)

it('does not focus a later page after the request owner unmounts', async () => {
  const recovery = mountRecovery()
  recovery.unmount()
  const other = document.createElement('button')
  other.setAttribute('data-dashboard-mascot-launcher', '')
  document.body.appendChild(other)
  try {
    await recovery.resolve(true)
    recovery.frame()
    expect(document.activeElement).not.toBe(other)
  } finally {
    other.remove()
  }
})
