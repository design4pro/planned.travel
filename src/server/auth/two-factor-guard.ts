import { APIError, createAuthMiddleware, getSession } from 'better-auth/api'

/**
 * Re-enrolment would replace a working authenticator and its backup codes.
 * This is a check before the library's write, not an atomic lock against verification in another tab.
 */
export const twoFactorEnableGuard = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/two-factor/enable') return

  // getSessionFromCtx swallows read errors. Read directly so a transient failure cannot
  // fall through to the endpoint's session middleware and succeed on a second read.
  const result = await getSession()({
    ...ctx,
    method: 'GET',
    asResponse: false,
    headers: ctx.headers ?? new Headers(),
    returnHeaders: true,
    returnStatus: false,
    query: { ...ctx.query, disableCookieCache: true },
  })
  result.headers.forEach((value, key) => {
    const name = key.toLowerCase()
    if (name === 'cache-control' || name === 'pragma') return
    if (name === 'set-cookie') ctx.responseHeaders.append(key, value)
    else ctx.responseHeaders.set(key, value)
  })
  ctx.context.session = result.response
  if (!result.response) return

  const userId = result.response.user.id
  const user = await ctx.context.adapter.findOne<{
    twoFactorEnabled?: boolean
  }>({
    model: 'user',
    where: [{ field: 'id', value: userId }],
  })
  const factor = await ctx.context.adapter.findOne<{ verified?: boolean }>({
    model: 'twoFactor',
    where: [{ field: 'userId', value: userId }],
  })
  if (user?.twoFactorEnabled === true || factor?.verified === true) {
    throw APIError.from('BAD_REQUEST', {
      code: 'TWO_FACTOR_ALREADY_ENABLED',
      message: 'Two-factor authentication is already enabled',
    })
  }
})
