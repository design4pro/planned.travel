# apps/mobile

The Expo mobile app is the native client foundation for planned.travel.

When we build it:

- **Stack:** Expo + React Native + **Uniwind** (Tailwind v4).
- **Shared:** design tokens from `@planned/ui-tokens`, business logic + zod
  schemas from `@planned/shared`, and the typed API client from
  `@planned/api-client`.
- **Auth:** Better Auth via `@better-auth/expo` + the server bearer plugin;
  session tokens are stored in **Expo SecureStore** and attached by the shared
  API client.
- **Offline-first:** local SQLite + background sync against the Cloudflare API.

The web app defines the API contract this app consumes. Set
`EXPO_PUBLIC_API_URL` for a non-production Worker URL before starting Expo.

## E2E

The trip smoke flow uses [Maestro](https://maestro.mobile.dev/) against the
native Expo app. Install Maestro, build/install the app with `pnpm ios` or
`pnpm android`, then provide credentials for a seeded test account:

```bash
export E2E_EMAIL='mobile-e2e@example.com'
export E2E_PASSWORD='…'
export E2E_TRIP_TITLE="Mobile E2E $(date +%s)"
pnpm --filter @planned/mobile e2e
```

The flow covers sign-in, trip creation, opening the workspace, map-first
presentation, and adding an itinerary note. It expects the API URL from
`EXPO_PUBLIC_API_URL` (or the production default).
