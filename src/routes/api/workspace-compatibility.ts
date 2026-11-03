import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'

import { serveWorkspaceCompatibility } from './-lib/workspace-compatibility'

export const Route = createFileRoute('/api/workspace-compatibility')({
  server: { handlers: { GET: serveWorkspaceCompatibility } },
})
