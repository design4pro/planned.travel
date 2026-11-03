# Account session authority inventory

Issue: #1758. Design checkpoint for ADR 0048; not evidence that runtime enforcement is implemented.

## Ownership and public surfaces

| Surface                                  | Current owner                                                                                              | Required integration                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Native HTTP and in-process API           | `auth/index.ts`, Better Auth `api/to-auth-endpoints.mjs`                                                   | One request-local proof boundary covering handler and each `auth.api` entry; no UI-only gate      |
| Server session, SSR, functions           | `auth/session.ts`, native `api/routes/session.mjs`                                                         | Primary authority on acceptance and before refresh/cookie issuance                                |
| Trip-room connect/reconnect              | `routes/api/trip-room/-lib/connect.ts`                                                                     | Same authoritative session read before minting room identity                                      |
| Adapter reads and writes                 | native `db/internal-adapter.mjs`: createSession, findSession, findSessions, updateSession                  | Immutable proof revision; primary check even on KV hit; CAS on write; no revision upgrade         |
| Password login                           | native `api/routes/sign-in.mjs`, two-factor after-hook                                                     | Capture before password proof, propagate to challenge/session; preserve native password checks    |
| Signup and email verification auto-login | native `api/routes/sign-up.mjs`, `email-verification.mjs`                                                  | Capture before proof, bind every created session; do not infer exempt unversioned authority       |
| Password reset/change                    | native `api/routes/password.mjs`, existing room-eviction hooks                                             | Preserve cleanup and password-attempt controls; new sessions/refresh use bound revision           |
| OAuth callbacks                          | native `api/routes/callback.mjs`, `oauth2/*`                                                               | Provider proof and resulting identity/session bind revision; Google/Apple remain TOTP exempt      |
| TOTP and backup challenge                | native `plugins/two-factor/index.mjs`, `verify-two-factor.mjs`, `totp/index.mjs`, `backup-codes/index.mjs` | Persist password-proof revision with challenge; read/consume cannot upgrade; preserve backup CAS  |
| Browser trust read/rotation              | same two-factor plugin, internalAdapter verification functions                                             | Primary trust revision check on cached verification; rotate without upgrading old proof           |
| Passkey verification                     | `auth/passkey/plugin.ts`                                                                                   | Bind account revision before verification and CAS session creation; preserve exemption            |
| Admin create/impersonation/stop          | native admin plugin, `auth/impersonation-expiry.ts`                                                        | Bind every created/recovered session; impersonation never authorizes self-service revocation      |
| Active workspace updates                 | `auth/index.ts` databaseHooks.session.update, `organization-invitations.ts`, native organization plugin    | Preserve immutable account/session proof; workspace role remains separately authoritative         |
| Native deletion and cache purge          | `auth/room-eviction.ts`, `auth/session-blobs.ts`, console session-keys                                     | Reuse exhaustive cleanup; deleting D1 or KV alone is not authority                                |
| Account deletion and erasure             | auth user-delete hooks, `server/erasure`                                                                   | Cascade account metadata without extending erasure's tenant capabilities                          |
| New register/commit/status               | `auth/factor-management.ts`                                                                                | Strict inputs without account selector, origin/CSRF, rate limit, freshness, receipt before commit |
| Durable cleanup and cron                 | `auth/account-security-cleanup.ts`, existing queue/cron                                                    | Stable keyset source, encrypted references, independent retry, durable pending sweep              |

## Installed-library call-site inventory

The following calls were enumerated from the installed `better-auth@1.7.1`, covering the active core, admin, organization and two-factor plugin families. Custom passkey verification is owned by this repository. Plugin families not registered in `auth/index.ts` do not grant a runtime exemption; enabling another plugin requires extending this inventory first.

```text
oauth2/link-account.mjs:268:	const session = await c.context.internalAdapter.createSession(user.id, void 0, void 0, void 0, { deferSecondaryStorageWrites: opts.deferNonDatabaseWrites === true });
api/routes/password.mjs:67:		await ctx.context.internalAdapter.findVerificationValue("dummy-verification-token");
api/routes/password.mjs:76:	await ctx.context.internalAdapter.createVerificationValue({
api/routes/password.mjs:126:	const verification = await ctx.context.internalAdapter.findVerificationValue(`reset-password:${token}`);
api/routes/password.mjs:158:	const verification = await ctx.context.internalAdapter.consumeVerificationValue(id);
api/routes/password.mjs:173:	if (ctx.context.options.emailAndPassword?.revokeSessionsOnPasswordReset) await ctx.context.internalAdapter.deleteUserSessions(userId);
api/routes/sign-up.mjs:264:		const session = await ctx.context.internalAdapter.createSession(createdUser.id, rememberMe === false);
api/routes/sign-up.mjs:266:		await setSessionCookie(ctx, {
api/routes/callback.mjs:248:	await setSessionCookie(c, {
api/routes/update-user.mjs:70:	await setSessionCookie(ctx, {
api/routes/update-user.mjs:182:		await ctx.context.internalAdapter.deleteUserSessions(session.user.id);
api/routes/update-user.mjs:183:		const newSession = await ctx.context.internalAdapter.createSession(session.user.id);
api/routes/update-user.mjs:185:		await setSessionCookie(ctx, {
api/routes/update-user.mjs:319:		await ctx.context.internalAdapter.createVerificationValue({
api/routes/update-user.mjs:343:	await ctx.context.internalAdapter.deleteUserSessions(session.user.id);
api/routes/update-user.mjs:390:	const token = await ctx.context.internalAdapter.consumeVerificationValue(`delete-account-${ctx.query.token}`);
api/routes/update-user.mjs:395:	await ctx.context.internalAdapter.deleteUserSessions(session.user.id);
api/routes/update-user.mjs:472:		await setSessionCookie(ctx, {
api/routes/sign-out.mjs:45:		currentSession = await ctx.context.internalAdapter.findSession(sessionCookieToken);
api/routes/sign-out.mjs:50:		await ctx.context.internalAdapter.deleteSession(sessionCookieToken);
api/routes/email-verification.mjs:216:					const newSession = await ctx.context.internalAdapter.createSession(user.user.id);
api/routes/email-verification.mjs:228:				await setSessionCookie(ctx, {
api/routes/email-verification.mjs:251:					const newSession = await ctx.context.internalAdapter.createSession(user.user.id);
api/routes/email-verification.mjs:269:				await setSessionCookie(ctx, {
api/routes/email-verification.mjs:298:			const session = await ctx.context.internalAdapter.createSession(user.user.id);
api/routes/email-verification.mjs:300:			await setSessionCookie(ctx, {
api/routes/email-verification.mjs:307:		} else await setSessionCookie(ctx, {
api/routes/sign-in.mjs:213:		await setSessionCookie(c, data.data);
api/routes/sign-in.mjs:353:	const session = await ctx.context.internalAdapter.createSession(user.id, ctx.body.rememberMe === false);
api/routes/sign-in.mjs:358:	await setSessionCookie(ctx, {
api/routes/session.mjs:146:		const session = await ctx.context.internalAdapter.findSession(sessionCookieToken);
api/routes/session.mjs:155:				if (!deferSessionRefresh || isPostRequest) await ctx.context.internalAdapter.deleteSession(session.session.token);
api/routes/session.mjs:192:			const updatedSession = await ctx.context.internalAdapter.updateSession(session.session.token, {
api/routes/session.mjs:204:			await setSessionCookie(ctx, {
api/routes/session.mjs:399:	if ((await ctx.context.internalAdapter.findSession(token))?.session.userId === ctx.context.session.user.id) try {
api/routes/session.mjs:400:		await ctx.context.internalAdapter.deleteSession(token);
api/routes/session.mjs:433:		await ctx.context.internalAdapter.deleteUserSessions(ctx.context.session.user.id);
api/routes/session.mjs:470:	await Promise.all(otherSessions.map((session) => ctx.context.internalAdapter.deleteSession(session.token)));
api/routes/update-session.mjs:37:	const updatedSession = await ctx.context.internalAdapter.updateSession(session.session.token, {
api/routes/update-session.mjs:50:	await setSessionCookie(ctx, {
plugins/organization/routes/crud-invites.mjs:318:				await setSessionCookie(ctx, {
plugins/organization/routes/crud-org.mjs:403:			await setSessionCookie(ctx, {
plugins/organization/routes/crud-org.mjs:429:		await setSessionCookie(ctx, {
plugins/organization/routes/crud-team.mjs:417:		await setSessionCookie(ctx, {
plugins/organization/routes/crud-team.mjs:440:	await setSessionCookie(ctx, {
plugins/two-factor/verify-two-factor.mjs:19:		const verificationToken = await ctx.context.internalAdapter.findVerificationValue(signedTwoFactorCookie);
plugins/two-factor/verify-two-factor.mjs:26:				const consumed = await ctx.context.internalAdapter.consumeVerificationValue(signedTwoFactorCookie);
plugins/two-factor/verify-two-factor.mjs:31:				const session = await ctx.context.internalAdapter.createSession(consumed.value, !!dontRememberMe);
plugins/two-factor/verify-two-factor.mjs:36:				await setSessionCookie(ctx, {
plugins/two-factor/verify-two-factor.mjs:51:					await ctx.context.internalAdapter.createVerificationValue({
plugins/two-factor/verify-two-factor.mjs:72:				const consumed = await ctx.context.internalAdapter.consumeVerificationValue(identifier).catch(() => null);
plugins/two-factor/verify-two-factor.mjs:78:						await ctx.context.internalAdapter.consumeVerificationValue(signedTwoFactorCookie);
plugins/two-factor/verify-two-factor.mjs:89:				const rearm = (count) => ctx.context.internalAdapter.createVerificationValue({
plugins/two-factor/totp/index.mjs:209:						await setSessionCookie(ctx, {
plugins/two-factor/totp/index.mjs:210:							session: await ctx.context.internalAdapter.createSession(user.id, false, activeSession),
plugins/two-factor/totp/index.mjs:213:						await ctx.context.internalAdapter.deleteSession(activeSession.token);
plugins/two-factor/index.mjs:118:					await setSessionCookie(ctx, {
plugins/two-factor/index.mjs:119:						session: await ctx.context.internalAdapter.createSession(updatedUser.id, false, ctx.context.session.session),
plugins/two-factor/index.mjs:122:					await ctx.context.internalAdapter.deleteSession(ctx.context.session.session.token);
plugins/two-factor/index.mjs:140:					await setSessionCookie(ctx, {
plugins/two-factor/index.mjs:141:						session: await ctx.context.internalAdapter.createSession(updatedUser.id, false, ctx.context.session.session),
plugins/two-factor/index.mjs:144:					await ctx.context.internalAdapter.deleteSession(ctx.context.session.session.token);
plugins/two-factor/index.mjs:227:				await setSessionCookie(ctx, {
plugins/two-factor/index.mjs:228:					session: await ctx.context.internalAdapter.createSession(updatedUser.id, false, ctx.context.session.session),
plugins/two-factor/index.mjs:231:				await ctx.context.internalAdapter.deleteSession(ctx.context.session.session.token);
plugins/two-factor/index.mjs:257:							const verificationRecord = await ctx.context.internalAdapter.findVerificationValue(trustIdentifier);
plugins/two-factor/index.mjs:262:								await ctx.context.internalAdapter.createVerificationValue({
plugins/two-factor/index.mjs:287:				await ctx.context.internalAdapter.deleteSession(data.session.token);
plugins/two-factor/index.mjs:293:				await ctx.context.internalAdapter.createVerificationValue({
plugins/two-factor/index.mjs:298:				await ctx.context.internalAdapter.createVerificationValue({
plugins/two-factor/otp/index.mjs:104:				await ctx.context.internalAdapter.createVerificationValue({
plugins/two-factor/otp/index.mjs:215:				const consumed = await ctx.context.internalAdapter.consumeVerificationValue(`2fa-otp-${key}`);
plugins/two-factor/otp/index.mjs:227:						const newSession = await ctx.context.internalAdapter.createSession(session.user.id, false, session.session);
plugins/two-factor/otp/index.mjs:228:						await setSessionCookie(ctx, {
plugins/two-factor/otp/index.mjs:232:						await ctx.context.internalAdapter.deleteSession(session.session.token);
plugins/two-factor/otp/index.mjs:240:				await ctx.context.internalAdapter.createVerificationValue({
plugins/organization/adapter.mjs:398:			return await context.internalAdapter.updateSession(sessionToken, { activeOrganizationId: organizationId });
plugins/organization/adapter.mjs:577:			return await context.internalAdapter.updateSession(sessionToken, { activeTeamId: teamId });
plugins/admin/routes.mjs:305:	if (updateData.banned === true) await ctx.context.internalAdapter.deleteUserSessions(ctx.body.userId);
plugins/admin/routes.mjs:540:	await ctx.context.internalAdapter.deleteUserSessions(ctx.body.userId);
plugins/admin/routes.mjs:596:	const session = await ctx.context.internalAdapter.createSession(targetUser.id, true, {
plugins/admin/routes.mjs:606:	await setSessionCookie(ctx, {
plugins/admin/routes.mjs:643:	const adminSession = await ctx.context.internalAdapter.findSession(adminSessionToken);
plugins/admin/routes.mjs:645:	await ctx.context.internalAdapter.deleteSession(session.session.token);
plugins/admin/routes.mjs:646:	await setSessionCookie(ctx, adminSession, !!dontRememberMeCookie);
plugins/admin/routes.mjs:693:	await ctx.context.internalAdapter.deleteSession(ctx.body.sessionToken);
plugins/admin/routes.mjs:736:	await ctx.context.internalAdapter.deleteUserSessions(ctx.body.userId);
plugins/admin/routes.mjs:781:	await ctx.context.internalAdapter.deleteUserSessions(ctx.body.userId);
```

## Boundary implementation plan

The auth service owns request-local proof state across both the public handler and every in-process API call. The boundary uses `AsyncLocalStorage.run` with a primary global revocation-fence snapshot before invoking the native handler or any `auth.api` method. Nested calls reuse that snapshot. No request state is written to shared `$context` or shared adapters. Every revocation advances the singleton fence and stores its value on the account in the same gated atomic batch. Identity resolution refuses accounts whose last-revocation fence is greater than the entry snapshot, then binds the observed account revision to the request. Subsequent session insertion compares that exact account revision atomically. It never reads a newer revision to relabel the proof. This protects native paths whose subject becomes known after proof verification. Persisted challenge metadata is loaded before native proof/identity lookups and pins the original account revision; later lookups compare rather than overwrite it. The internal adapter validates authority on session/cache reads and updates, and on verification reads/consumption. It persists the originating proof revision alongside two-factor challenges and trust records. The custom passkey flow explicitly captures before signature verification. Challenge continuation reuses its persisted revision; it never replaces it with a current read. Session-bound rotations inherit the accepted session proof, not a newer account revision.

A session insert and metadata recording must be one batch, with every insert conditional on the proof revision and the winning claim. Refresh similarly requires the existing session's unchanged revision and current account state. Cookie issuance receives only an authoritative accepted session. Native ban, expiry and impersonation checks remain additional constraints, not alternative acceptance paths.

The inventory review must verify that the exact native adapter and endpoint extension points can implement these invariants without a dependency change. A family-level call list alone is not proof that a proposed hook runs before proof verification; installed source and public-handler concurrency tests provide that evidence.

## Proof ordering at native verification points

| Family                          | Before proof                                                                               | Verification point                                                             | Binding and conditional write                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Password                        | Entry fence, then native identity/account lookup with revision capture                     | `api/routes/sign-in.mjs` password.verify after findUserByEmail                 | Exact captured revision at session insert; persist it on pending 2FA challenge                                      |
| OAuth code callback             | Entry fence before native handler starts, while account can be unknown                     | `api/routes/callback.mjs:108` validateAuthorizationCode and `:120` getUserInfo | `oauth2/link-account.mjs:20` identity lookup requires account.lastFence <= entryFence; bind revision and CAS insert |
| Social id-token                 | Entry fence before native API starts                                                       | `api/routes/sign-in.mjs:160` provider token verification                       | Same lastFence check before handleOAuthUserInfo creates authority                                                   |
| Email verification auto-login   | Entry fence before native API starts                                                       | `api/routes/email-verification.mjs:176` jwtVerify                              | Identity lookup at :186 requires lastFence <= entryFence; bind revision before conditional session insert           |
| Passkey                         | Entry fence, credential lookup, capture account revision from record.userId                | `auth/passkey/plugin.ts` verifyAuthentication                                  | Session insert compares that revision; OAuth/passkey remain TOTP exempt                                             |
| TOTP/backup continuation        | Load immutable challenge metadata first and compare it to primary revision                 | Native verify-two-factor/TOTP/backup verification                              | No subsequent lookup can overwrite the original revision; consume/insert compares it                                |
| Trusted-browser bypass/rotation | Password proof uses entry/account fences; trust metadata uses its persisted trust revision | Native two-factor trust verification branch                                    | Primary trust metadata must match before bypass; rotation keeps trust revision, not a freshly stamped value         |
| Session-bound rotation/refresh  | Authoritative acceptance of the existing metadata first                                    | Native update-session/factor/email/workspace paths                             | Inherit accepted revision and CAS; account lookup cannot upgrade it                                                 |
| Admin impersonation             | Entry fence and native admin authorization                                                 | Native impersonate handler before session creation                             | Target account lastFence check and bound revision; impersonated session cannot revoke other devices                 |
| Signup                          | Entry fence before endpoint; newly created account has no earlier authority                | Native signup credential creation                                              | Initial account revision is zero, lastFence no newer than entry; conditional session insert                         |

A revocation after the entry snapshot but before identity lookup causes a lastFence refusal. A revocation after revision capture but before session insertion causes a revision CAS refusal. A revocation after insertion makes that session metadata stale. Global fence exhaustion or missing fence after cutover refuses proof processing. The singleton is a revocation-ordering scalar only; it cannot discover accounts or tenant data.
