import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

/**
 * The accounts half of the console, and the guard both screens under it share.
 *
 * `user:list`, `user:ban`, `user:impersonate` and every `session:*` statement sit in the `admin`
 * column alone (`docs/ACCESS.md` §2.1, §2.2), so a `curator` has no accounts surface at all. The
 * refusal lives here rather than on each screen for the reason `docs/SPEC.md` §8 gives about
 * concepts with more than one home: two copies of "may a curator be here" is two places for the
 * answer to drift, and the one that drifts is the one nobody re-read.
 *
 * A curator is sent to `/console`, which is the half of the console that *is* theirs, rather than to
 * `/dashboard`: they hold platform standing, they simply hold it somewhere else.
 *
 * This route renders nothing of its own. The console shell above it already owns the page frame and
 * the section index; adding a second frame here would put a card inside a card.
 */
export const Route = createFileRoute('/_app/console/users')({
  beforeLoad: ({ context }) => {
    if (!context.consoleAccess.canManageUsers) {
      throw redirect({ to: '/console' })
    }
  },
  component: Outlet,
})
