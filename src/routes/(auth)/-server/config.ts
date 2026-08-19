/**
 * What the sign-in screens need to know before they render.
 *
 * Social buttons are the reason this exists: which providers are configured is a
 * function of the Worker's secrets, so the answer can only come from the server.
 * Resolving it in a loader (rather than probing on the client) means the buttons
 * are in the first paint and never pop in afterwards.
 */
import { createServerFn } from '@tanstack/react-start'

import { enabledSocialProviders } from '#/server/auth'
import { getSession } from '#/server/auth/session'

export type SocialProviderId = 'google' | 'apple'

export interface AuthScreenConfig {
  /** Providers with credentials in this environment, in display order. */
  readonly socialProviders: ReadonlyArray<SocialProviderId>
  /** True when a session already exists, so the screen can offer a way onward. */
  readonly signedIn: boolean
  /** The signed-in address, for "not you?" affordances. */
  readonly email: string | null
}

export const loadAuthConfig = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthScreenConfig> => {
    const session = await getSession()
    return {
      socialProviders: enabledSocialProviders(),
      signedIn: session !== null,
      email: session?.user.email ?? null,
    }
  },
)

/** Email-confirmation state, for the screen that chases an unverified address. */
export interface VerificationState {
  readonly signedIn: boolean
  readonly verified: boolean
  readonly email: string | null
}

export const loadVerificationState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<VerificationState> => {
    const session = await getSession()
    return {
      signedIn: session !== null,
      verified: session?.user.emailVerified ?? false,
      email: session?.user.email ?? null,
    }
  },
)
