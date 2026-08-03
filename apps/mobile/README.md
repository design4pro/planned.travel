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
export E2E_MEMBER_EMAIL='mobile-member@example.com'
export E2E_MEMBER_PASSWORD='…'
export E2E_TRIP_TITLE="Mobile E2E $(date +%s)"
export E2E_COLLAB_TRIP_TITLE="Mobile collaboration E2E $(date +%s)"
export E2E_REALTIME_TRIP_TITLE="Mobile realtime E2E $(date +%s)"
export E2E_MAP_TRIP_TITLE="Mobile map E2E $(date +%s)"
export E2E_DEVICE_ID="$(xcrun simctl list devices booted | sed -n 's/.*(\([^)]*\)).*/\1/p' | head -1)"
pnpm --filter @planned/mobile e2e
```

The suite covers sign-in, trip creation/opening, editor and viewer
permissions, member invitations, realtime connection/presence, map-first
presentation, and itinerary mutations. Use a Pro test account or reset the
test account between runs because the flows create separate trips. It expects
the API URL from `EXPO_PUBLIC_API_URL` and refuses to run against production.
For the current staging deployment use
`https://planned-travel-web-staging.design4pro.workers.dev`.
