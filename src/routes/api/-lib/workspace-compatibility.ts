import {
  isAuthRequirementError,
  verifyWorkspaceCompatibility,
} from '#/server/auth/session'

/** This read is the sole recovery path outside the stale server-function gate. */
export async function serveWorkspaceCompatibility(): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    return Response.json(await verifyWorkspaceCompatibility(), { headers })
  } catch (error) {
    return new Response(null, {
      status: isAuthRequirementError(error) ? error.status : 503,
      headers,
    })
  }
}
