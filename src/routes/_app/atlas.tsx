import { createFileRoute } from '@tanstack/react-router'

import { AppFrame } from '#/components/layout/app-frame'
import { loadAtlas } from './-server/library'
import {
  AtlasScreen,
  AtlasScreenError,
  AtlasScreenPending,
} from './-ui/atlas-screen'

/**
 * The world tracker.
 *
 * A route module and nothing else: it reads the atlas, hands the payload to
 * `AtlasScreen`, and wraps all three states in `AppFrame bleed` so the map owns
 * its whole viewport slice — no max width, no padding, no bottom gutter. The
 * screen re-supplies the mobile tab bar's clearance itself, because `bleed`
 * deliberately drops it.
 *
 * Pending and error are the same bleed slice as the loaded screen rather than the
 * padded page they used to be, so neither one moves the layout when it resolves.
 */
export const Route = createFileRoute('/_app/atlas')({
  loader: () => loadAtlas(),
  pendingComponent: () => (
    <AppFrame bleed>
      <AtlasScreenPending />
    </AppFrame>
  ),
  errorComponent: ({ error }) => (
    <AppFrame bleed>
      <AtlasScreenError error={error} />
    </AppFrame>
  ),
  component: AtlasRoute,
})

function AtlasRoute() {
  const atlas = Route.useLoaderData()

  return (
    <AppFrame bleed>
      <AtlasScreen atlas={atlas} />
    </AppFrame>
  )
}
