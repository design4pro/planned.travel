import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { UserRoundSearch } from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import { PlatformRoleBadge, readConsoleFailure } from '#/components/console'
import { Button, Card, EmptyState } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { loadConsoleAccess } from './-server/access'
import { ConsoleNav } from './-ui/console-nav'

import type { ErrorComponentProps } from '@tanstack/react-router'

/**
 * The platform console's shell: one persistent index of sections on the left, the section itself on
 * the right.
 *
 * `_app` is pathless, so these routes live at `/console`, `/console/users` and
 * `/console/users/$userId` — the same spelling the nav links use, the guard protects and the visual
 * baselines are named after.
 *
 * **The guard is in `beforeLoad`, and it throws.** A child route's `beforeLoad` and `loader` run
 * only once this one has resolved, so an account with no platform standing is turned away before a
 * single console server function is reached. `docs/ACCESS.md` §2.3 decides the refusal from the
 * resolved platform role rather than from a statement — a `user` holds none of the twenty-five, so
 * probing one would only choose an arbitrary statement to be denied by — and §6.4 closes the console
 * to an impersonated session whatever the worn account holds.
 *
 * A refusal is a redirect to `/dashboard` rather than a designed denial screen, because for the role
 * it turns away there is nothing to design: `user` is nearly everybody, the user menu renders no
 * entry for them, and a page explaining a platform console to somebody who has never heard of one
 * would be the only place the product mentions it. The two vetoes above it redirect for a different
 * reason each — a suspended operator has no platform authority to explain, and an operator inside an
 * impersonated session already has a warning bar on screen telling them how to get their own
 * authority back.
 */
export const Route = createFileRoute('/_app/console')({
  beforeLoad: async () => {
    const result = await loadConsoleAccess()
    if (!result.permitted) {
      throw redirect({ to: '/dashboard' })
    }
    return { consoleAccess: result.access }
  },
  notFoundComponent: ConsoleNotFound,
  // A named component rather than an inline arrow, here and on every screen below it: the sentence
  // and the fallback both come from `t()`, and a hook needs a component to be called from.
  errorComponent: ConsoleError,
  component: ConsoleLayout,
})

function ConsoleError({ error }: ErrorComponentProps) {
  const t = useTranslate()
  return (
    <AppFrame>
      <ErrorPanel
        error={readConsoleFailure(error, t('console.failure.fallback'))}
        title={t('console.shell.error.title')}
      />
    </AppFrame>
  )
}

function ConsoleLayout() {
  const t = useTranslate()
  const { consoleAccess } = Route.useRouteContext()

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow={t('console.shell.eyebrow')}
          title={t('console.shell.title')}
          description={t('console.shell.description')}
          actions={
            <span className="flex items-center gap-2 text-caption text-ink-3">
              <span>{t('console.shell.signedInAs')}</span>
              <PlatformRoleBadge role={consoleAccess.role} />
            </span>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-8">
          <ConsoleNav access={consoleAccess} />
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </AppSections>
    </AppFrame>
  )
}

/**
 * The console's own "no such thing", and the reason it is not `NotFoundPanel`.
 *
 * That component is the product's in-app 404 and its copy is written for the product's subject —
 * "the trip it pointed at was moved or deleted", with *All trips* beside *Back to dashboard*. An
 * operator who mistyped an account id is not looking for a trip, and sending them to the trip list
 * from a platform console is the wrong door. This says what was not found and offers the two places
 * the answer actually is.
 *
 * It became reachable when `users.$userId` started answering an unknown id with `notFound()` instead
 * of letting a `409` refusal written for a dialog reach the error boundary as a `500`. Before that
 * this configuration existed and nothing could get to it.
 */
function ConsoleNotFound() {
  const t = useTranslate()
  return (
    <AppFrame>
      <AppSections>
        <Card className="bg-surface-2">
          <EmptyState
            icon={<UserRoundSearch />}
            title={t('console.shell.notFound.title')}
            description={t('console.shell.notFound.body')}
            action={
              <Button asChild variant="primary">
                <Link to="/console/users">
                  {t('console.shell.allAccounts')}
                </Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="secondary">
                <Link to="/console">{t('console.shell.overview')}</Link>
              </Button>
            }
          />
        </Card>
      </AppSections>
    </AppFrame>
  )
}
