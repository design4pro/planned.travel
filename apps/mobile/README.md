# apps/mobile (future)

The Expo mobile app is **Phase 4** (see ../../PLANS.md). It is intentionally
not scaffolded yet.

When we build it:

- **Stack:** Expo (React Native 0.81+) + **NativeWind v5** (Tailwind v4) +
  **react-native-reusables** (shadcn-model components) + **maplibre-react-native**
  (Expo Development Build, not Expo Go).
- **Shared:** design tokens from `@planned/ui-tokens`, business logic + zod
  schemas from `@planned/shared`, and the typed API client from
  `@planned/api-client`.
- **Auth:** Better Auth via `@better-auth/expo` + the **bearer** plugin; store
  the session token in **Expo SecureStore**.
- **Offline-first:** local SQLite + background sync against the Cloudflare API.

The web app (`apps/web`) is built first and defines the API contract this app
will consume.
