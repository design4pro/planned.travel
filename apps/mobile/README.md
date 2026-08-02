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
