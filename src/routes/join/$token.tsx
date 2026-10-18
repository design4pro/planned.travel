import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'

import { answerBusy } from './-lib/busy'
import { JOIN_HEADERS, joinHead } from './-lib/head'
import { loadInvite } from './-server/join'
import {
  Arrival,
  JoinCard,
  JoinFrame,
  JoinSkeleton,
  RetryCard,
  UnavailableCard,
} from './-ui/join-card'

/**
 * A budget refusal reaches the document as a 200 view with a note against the request (see
 * `-lib/busy.ts`); this turns it into the 429 the browser, a proxy and a monitor should see.
 */
const busyStatus = createMiddleware({ type: 'request' }).server(
  async ({ next, handlerType, request }) => {
    const result = await next()
    return handlerType === 'router'
      ? { ...result, response: answerBusy(request, result.response) }
      : result
  },
)

export const Route = createFileRoute('/join/$token')({
  server: { middleware: [busyStatus] },
  headers: () => JOIN_HEADERS,
  // Annotated: inferring `matches` from the route tree makes `loaderData` circular, and it widens to `undefined`.
  head: ({ matches }: { matches: Parameters<typeof joinHead>[0] }) =>
    joinHead(matches),
  // The secret is the credential: nothing about this page is kept for the next visit.
  staleTime: 0,
  gcTime: 0,
  loader: async ({ params }) => {
    const view = await loadInvite({ data: { secret: params.token } })
    // Every dead link is the same 404, whoever asks and whatever killed it.
    if (view.state === 'unavailable')
      throw notFound({ data: { signedIn: view.signedIn } })
    return view
  },
  pendingComponent: () => (
    <JoinFrame>
      <JoinSkeleton />
    </JoinFrame>
  ),
  notFoundComponent: JoinUnavailable,
  errorComponent: JoinFailed,
  component: JoinPage,
})

function joinPath(token: string): string {
  return `/join/${encodeURIComponent(token)}`
}

function JoinPage() {
  const view = Route.useLoaderData()
  const { token } = Route.useParams()
  const router = useRouter()
  return (
    <JoinFrame>
      <JoinCard
        view={view}
        path={joinPath(token)}
        onRetry={() => router.invalidate()}
      />
    </JoinFrame>
  )
}

function JoinUnavailable({ data }: { data?: unknown }) {
  const { token } = Route.useParams()
  const signedIn =
    typeof data === 'object' &&
    data !== null &&
    'signedIn' in data &&
    data.signedIn === true
  return (
    <JoinFrame>
      <Arrival>
        <UnavailableCard signedIn={signedIn} path={joinPath(token)} />
      </Arrival>
    </JoinFrame>
  )
}

function JoinFailed() {
  const router = useRouter()
  return (
    <JoinFrame>
      <Arrival>
        <RetryCard busy={false} onRetry={() => router.invalidate()} />
      </Arrival>
    </JoinFrame>
  )
}
