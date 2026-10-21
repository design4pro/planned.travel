/**
 * Everything the authentication screens say, in the source locale.
 *
 * `docs/SPEC.md` §8 fixes the shape: one flat object of keys, default-exported,
 * at `messages/<locale>/<namespace>.ts`. A screen reads a key as
 * `t('auth.<key>')`, and `../../types.ts` derives the key union from this file,
 * so a typo is a compile error at the call site rather than English leaking onto
 * an Arabic screen (§8.2 bans the silent fallback outright).
 *
 * **Why this namespace matters more than its size suggests.** These are the only
 * screens a traveller can reach with no session, so their language comes purely
 * from `Accept-Language` - there is no stored preference to correct a bad guess
 * with. They are also where copy hides longest: two thirds of the keys below are
 * validation messages and failure alerts that only appear once something has
 * gone wrong, which is exactly when a reader can least afford a sentence in a
 * language they do not read.
 *
 * **What is here.** Every visible word of the seven screens - login, register,
 * forgot-password, reset-password, two-factor, verify-email and
 * accept-invitation - plus their shell, their Zod validation messages, and every
 * failure the auth API can surface. Nothing in `src/routes/(auth)/**` may hold
 * an English literal, which is what `-lib/__tests__/copy-rules.test.ts` reads
 * off the shipped sources. Passkey security notice copy also lives here and is
 * read by `src/server/auth/email.ts`; transactional email currently renders in English.
 *
 * **What is deliberately not here.**
 *
 * - *Input masks.* `000000` for an authenticator code and `xxxxx-xxxxx` for a
 *   backup code are pictures of the characters a field takes, in the same class
 *   as an ISO currency code: the same string in every language, and a
 *   translation byte-identical to English is what `__tests__/parity.test.ts`
 *   calls untranslated copy. They stay literal in the route.
 * - *Provider names.* `Google` and `Apple` are trademarks, so they are data in
 *   `-ui/form.tsx` and arrive here as the `{provider}` of a translated sentence.
 * - *Our own wordmark.* `planned.travel` is rendered by `Wordmark`, and where it
 *   appears inside a sentence it is written out rather than interpolated,
 *   because several languages inflect around it.
 * - *Dates.* An invitation's expiry is formatted by `src/lib/format.ts`, frozen
 *   against the workerd/WebKit divergence §8.5 calls a defect. No key below
 *   names a month.
 *
 * **Numbers.** §8's rule: `count` picks the CLDR plural branch and is never
 * rendered. A number a reader sees arrives as `{value}`, already grouped for the
 * locale by `formatNumber` - a raw substitution prints `1234` with no separator
 * in all twenty-three. Where a number is part of the prose rather than a value
 * that can change - "six digits", "30 seconds" - it is spelled out in the
 * sentence, so a translator writes it the way their language says it.
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* ------------------------------------------------------------------ shell */
  /** Accessible name of the wordmark, which links back to the marketing site. */
  'shell.home': 'planned.travel home',
  /** The standing notice under every card. The legal pages are English (§8.8). */
  'shell.legal':
    'By continuing you agree to the planned.travel terms of service and privacy notice.',

  /** The poster panel beside the form on wide viewports. */
  'panel.eyebrow': 'Plan together',
  'panel.heading': 'Every trip, from the first pin to the last postcard.',
  'panel.body':
    'Shared itineraries on a real map, budgets that actually balance, packing lists that remember, and a journal worth keeping.',
  'panel.map.title': 'One map, one plan',
  'panel.map.detail': 'Every stop, stay and transfer on a single itinerary.',
  'panel.group.title': 'Everyone in step',
  'panel.group.detail':
    'Edits, votes and comments land live for the whole group.',
  'panel.costs.title': 'Costs that add up',
  'panel.costs.detail': 'Shared budgets, settled balances, no spreadsheet.',

  /* ------------------------------------------------------------ form pieces */
  /** The word set into the hairline that separates two ways of signing in. */
  'divider.or': 'or',
  'divider.orEmail': 'or use your email',

  /** Social sign-in. `{provider}` is a trademark and is never translated. */
  'social.continue': 'Continue with {provider}',
  'social.signUp': 'Sign up with {provider}',
  'social.opening': 'Opening {provider}',

  'passkey.action': 'Sign in with a passkey',
  'passkey.waiting': 'Waiting for your device',

  /**
   * The reveal control on a password field. Six keys rather than a verb glued
   * to a field name: several languages inflect the noun after "show", and a
   * sentence assembled from two catalogue entries cannot express that.
   */
  'password.show': 'Show password',
  'password.hide': 'Hide password',
  'password.showNew': 'Show new password',
  'password.hideNew': 'Hide new password',
  'password.showConfirm': 'Show password confirmation',
  'password.hideConfirm': 'Hide password confirmation',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Email address',
  /** An example address. Localise the local part; the domain is reserved. */
  'field.email.placeholder': 'you@example.com',
  'field.password': 'Password',
  'field.password.placeholder': 'Your password',
  'field.newPassword': 'New password',
  'field.newPassword.placeholder': 'A phrase you will remember',
  'field.confirmPassword': 'Confirm password',
  'field.confirmNewPassword': 'Confirm new password',
  'field.confirmPassword.placeholder': 'Type it once more',
  'field.name': 'Your name',
  'field.name.hint': 'Shown to the people you plan trips with.',
  /** An example name. Use one that reads as a person's name in this language. */
  'field.name.placeholder': 'Alex Moreau',

  /* ------------------------------------------------------------- validation */
  /**
   * Every Zod message on these screens. They are built by
   * `-lib/schemas.ts`'s factory rather than written into the schema, so the
   * inline message under a field is in the reader's language on the very first
   * keystroke - `docs/SPEC.md` §8.6 covers a validation message exactly as it
   * covers a heading.
   */
  'validation.emailRequired': 'Enter your email address.',
  'validation.emailTooLong': 'That email address is too long.',
  'validation.emailInvalid': 'That does not look like an email address.',
  'validation.passwordRequired': 'Enter your password.',
  /** `{value}` is the minimum, already formatted; `count` picks the branch. */
  'validation.passwordShort': {
    one: 'Use at least {value} character — a short phrase beats a clever word.',
    other:
      'Use at least {value} characters — a short phrase beats a clever word.',
  },
  'validation.passwordLong': {
    one: 'Keep it under {value} character.',
    other: 'Keep it under {value} characters.',
  },
  'validation.passwordMismatch': 'Those passwords do not match.',
  'validation.nameShort': 'Enter your name, so trip-mates know who you are.',
  'validation.nameTooLong': 'That name is too long.',
  'validation.termsRequired': 'Please accept the terms to continue.',
  'validation.codeLength': 'Authenticator codes are six digits.',
  'validation.codeDigits': 'Authenticator codes are digits only.',
  'validation.backupShort': 'That backup code looks too short.',
  'validation.backupLong': 'That backup code looks too long.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Welcome back',
  'login.heading': 'Sign in to planned.travel',
  'login.description':
    'Pick up your itineraries, budgets and lists exactly where you left them.',
  'login.newHere': 'New here?',
  'login.createAccount': 'Create an account',
  'login.forgot': 'Forgot password?',
  'login.remember': 'Keep me signed in on this device',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing you in',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Create your account',
  'register.heading': 'Start planning in a couple of minutes',
  'register.description':
    'One account covers every trip, every travelling companion and every list.',
  'register.haveAccount': 'Already have an account?',
  'register.signIn': 'Sign in',
  'register.terms': 'I agree to the terms of service and the privacy notice.',
  'register.submit': 'Create account',
  'register.submitting': 'Creating your account',

  /**
   * The password meter. It never blocks a submit - the schema owns the rule -
   * it only tells the reader where they stand, so each rung is a full sentence
   * rather than a label glued to a word.
   */
  'strength.hint': {
    one: 'At least {value} character. A short phrase beats a clever word.',
    other: 'At least {value} characters. A short phrase beats a clever word.',
  },
  'strength.tooShort': 'Strength: Too short',
  'strength.weak': 'Strength: Weak',
  'strength.fair': 'Strength: Fair',
  'strength.strong': 'Strength: Strong',
  'strength.excellent': 'Strength: Excellent',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Password help',
  'forgot.heading': 'Reset your password',
  'forgot.description':
    'Tell us the address on your account and we will email you a link to set a new password.',
  'forgot.submit': 'Email me a reset link',
  'forgot.submitting': 'Sending your link',
  'forgot.back': 'Back to sign in',
  'forgot.sent.eyebrow': 'Check your inbox',
  'forgot.sent.heading': 'Your reset link is on its way',
  /** `{email}` is the address the reader typed, emphasised in place. */
  'forgot.sent.description':
    'If an account uses {email}, a link to choose a new password is in that inbox now.',
  'forgot.sent.title': 'The link works once, for one hour',
  'forgot.sent.body':
    'Nothing arrived? Check spam, then send it again. Requesting a new link quietly retires the previous one.',
  'forgot.sent.resend': 'Send it again',
  'forgot.sent.resending': 'Sending again',
  'forgot.sent.change': 'Use a different email',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Password reset',
  'reset.heading': 'Choose a new password',
  /** `{value}` is the minimum length, already formatted. */
  'reset.description': {
    one: 'Pick something at least {value} character long. A short phrase is easier to remember and harder to guess.',
    other:
      'Pick something at least {value} characters long. A short phrase is easier to remember and harder to guess.',
  },
  'reset.submit': 'Set new password',
  'reset.submitting': 'Saving your password',
  'reset.back': 'Back to sign in',
  'reset.stale.heading': 'That link cannot be used',
  'reset.stale.description':
    'Reset links expire after an hour and work only once — the safest possible trade.',
  'reset.stale.action': 'Request a new link',
  'reset.done.heading': 'Your new password is set',
  'reset.done.description':
    'Every other session has been signed out, so anyone who had the old password no longer has a way in.',
  'reset.done.title': 'Signed out everywhere else',
  'reset.done.body': 'Sign in with your new password to carry on planning.',
  'reset.done.action': 'Sign in',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Two-factor verification',
  'twoFactor.heading': 'Confirm it is you',
  'twoFactor.description':
    'Your account is protected by a second factor. Enter the current code from your authenticator app.',
  'twoFactor.back': 'Start again from sign in',
  'twoFactor.methods': 'Verification method',
  'twoFactor.totp.tab': 'Authenticator',
  'twoFactor.totp.label': 'Six-digit code',
  'twoFactor.totp.hint': 'Codes refresh every 30 seconds.',
  'twoFactor.totp.submit': 'Verify and continue',
  'twoFactor.backup.tab': 'Backup code',
  'twoFactor.backup.label': 'Backup code',
  'twoFactor.backup.hint':
    'From the list you saved when you turned on two-factor. Each code works once.',
  'twoFactor.backup.submit': 'Use backup code',
  'twoFactor.submitting': 'Checking your code',
  'twoFactor.trust.label': 'Trust this device for 30 days',
  'twoFactor.trust.detail':
    'Skip this step on this browser until then. Only do this on a device that is yours alone.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'Email confirmed',
  'verify.done.heading': 'You are all set',
  'verify.done.description':
    'Your address is verified, so invitations, reminders and trip digests will reach you.',
  'verify.done.title': 'Verified',
  /** `{email}` is the confirmed address. */
  'verify.done.body': '{email} is confirmed on this account.',
  /** Stands in for the address when the session carries no email. */
  'verify.done.bodyUnknown': 'Your email address is confirmed on this account.',
  'verify.done.action': 'Go to your dashboard',

  'verify.pending.eyebrow': 'One last thing',
  'verify.pending.heading': 'Confirm your email address',
  /** `{email}` is emphasised in place inside the sentence. */
  'verify.pending.description':
    'We sent a confirmation link to {email}. Opening it keeps your account recoverable and lets trip-mates invite you.',
  'verify.pending.wrongAddress': 'Wrong address?',
  'verify.pending.changeIt': 'Change it in settings',
  'verify.pending.title': 'The link lasts 24 hours',
  'verify.pending.body':
    'Nothing in your inbox? Check spam, then send it again.',
  'verify.pending.resentTitle': 'Sent again just now',
  'verify.pending.resentBody':
    'Give it a minute, then check your inbox — and your spam folder.',
  'verify.pending.resend': 'Resend confirmation',
  'verify.pending.resending': 'Sending again',
  'verify.pending.continue': 'Continue anyway',

  'verify.request.eyebrow': 'Email confirmation',
  'verify.request.heading': 'Send a new confirmation link',
  'verify.request.description':
    'Confirmation links last 24 hours and work only once. Tell us your address and a fresh one is on its way.',
  'verify.request.submit': 'Send confirmation link',
  'verify.request.submitting': 'Sending your link',
  'verify.request.sentTitle': 'On its way',
  'verify.request.sentBody':
    'If that address has an account awaiting confirmation, the link is in its inbox now.',
  'verify.request.change': 'Use a different email',
  'verify.request.back': 'Back to sign in',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Workspace invitation',
  /** `{workspace}` is the workspace's own name, as its owner typed it. */
  'invitation.heading': 'Join {workspace}',
  'invitation.description':
    'Accepting adds you to this workspace and shares its trips, budgets and lists with you.',
  /** `{email}` is the address the invitation was sent to. */
  'invitation.invitedAs': 'Invited as {email}',
  'invitation.role': 'Your role',
  'invitation.means': 'Means',
  'invitation.invitedBy': 'Invited by',
  'invitation.expires': 'Expires',
  'invitation.accept': 'Accept invitation',
  'invitation.accepting': 'Joining the workspace',
  'invitation.decline': 'Decline',
  'invitation.declining': 'Declining',
  'invitation.reassurance':
    'You can leave a workspace at any time from its settings, and nothing you create outside it is ever shared.',

  /**
   * What each role means, as the product says it rather than as the database
   * spells it. `{role}` in the last one is a role name the server invented,
   * which no catalogue can carry.
   */
  'invitation.role.owner': 'Owner — full control, including billing',
  'invitation.role.admin': 'Admin — manage trips, members and settings',
  'invitation.role.member': 'Member — plan trips alongside everyone else',
  'invitation.role.other': '{role} — access set by the workspace owner',
  'invitation.role.badge.owner': 'Owner',
  'invitation.role.badge.admin': 'Admin',
  'invitation.role.badge.member': 'Member',

  'invitation.anonymous.heading': 'Sign in to see your invitation',
  'invitation.anonymous.description':
    'Invitations are tied to the email address they were sent to, so we need to know who you are before we can show you this one.',
  'invitation.anonymous.body':
    'Use the address the invitation was sent to. We will bring you straight back here afterwards.',
  'invitation.anonymous.action': 'Sign in to continue',
  'invitation.anonymous.noAccount': 'No account yet?',
  'invitation.anonymous.register': 'Create one with the invited address',

  'invitation.mismatch.heading': 'This invitation is for another address',
  'invitation.mismatch.description':
    'You are signed in as someone else, so this one is not yours to accept.',
  /** `{email}` is the address of the session, emphasised in place. */
  'invitation.mismatch.title': 'Signed in as {email}',
  'invitation.mismatch.body':
    'Sign out and back in with the address the invitation was sent to, or ask for a new invitation to this account.',
  'invitation.mismatch.action': 'Switch account',
  'invitation.mismatch.back': 'Back to sign in',

  'invitation.unverified.heading': 'Confirm your email to join',
  'invitation.unverified.description':
    'Workspaces only accept confirmed addresses, so nobody can be added by a typo.',
  /** `{email}` is the unconfirmed address. */
  'invitation.unverified.title': '{email} is not confirmed yet',
  'invitation.unverified.body':
    'Open the confirmation link in your inbox, then return to this page. The invitation will be waiting.',
  'invitation.unverified.action': 'Confirm my email',
  'invitation.unverified.resend': 'Resend the confirmation email',

  'invitation.unavailable.heading': 'This invitation is no longer available',
  'invitation.unavailable.description':
    'Invitations last seven days, and they retire the moment they are used or withdrawn.',
  'invitation.unavailable.title': 'Nothing to accept here',
  'invitation.unavailable.body':
    'Ask whoever invited you to send a fresh invitation, and this page will show it straight away.',
  'invitation.unavailable.dashboard': 'Go to your dashboard',

  'invitation.declined.eyebrow': 'Invitation declined',
  'invitation.declined.heading': 'No problem — nothing was shared',
  'invitation.declined.description':
    'The workspace owner has been told, and this link can no longer be used.',
  'invitation.declined.action': 'Go to your dashboard',

  /* ----------------------------------------------------------------- errors */
  /**
   * Every failure these screens can surface, as a headline and one quiet line
   * under it. `-lib/errors.ts` maps an auth API code onto a pair of these keys
   * and never onto a sentence, which is what keeps a server-authored English
   * message off a non-English screen (§8.6). A code with no entry lands on
   * `error.unexpected`, deliberately, rather than showing whatever the endpoint
   * happened to say.
   */
  'error.unexpected.title': 'Something went wrong',
  'error.unexpected.detail': 'That did not work. Please try again in a moment.',
  'error.rateLimited.title': 'Too many attempts',
  'error.rateLimited.detail':
    'For your security we have paused sign-in from this device for a few minutes. Try again shortly.',
  'error.offline.title': 'No connection',
  'error.offline.detail':
    'We could not reach planned.travel. Check your connection and try again.',

  'error.credentials.title': 'Those details do not match',
  'error.credentials.detail':
    'Check the email address and password and try again. If you signed up with Google or Apple, use that button instead.',
  'error.password.title': 'Those details do not match',
  'error.password.detail':
    'Check the email address and password and try again.',
  'error.noPassword.title': 'No password on this account',
  'error.noPassword.detail':
    'This account signs in with a social provider or a passkey. Use one of the options above.',
  'error.unverified.title': 'Confirm your email first',
  'error.unverified.detail':
    'We sent you a confirmation link when you signed up. Open it, then come back here.',
  'error.emailTaken.title': 'That email is already registered',
  'error.emailTaken.detail':
    'Sign in instead, or reset your password if you have forgotten it.',
  'error.noAccount.title': 'We could not find that account',
  'error.noAccount.detail': 'Check the address, or create a new account.',
  'error.passwordTooShort.title': 'Password too short',
  'error.passwordTooShort.detail': 'Choose a longer passphrase and try again.',
  'error.passwordTooLong.title': 'Password too long',
  'error.passwordTooLong.detail': 'Choose a shorter passphrase and try again.',
  'error.linkSpent.title': 'This link is no longer valid',
  'error.linkSpent.detail':
    'Password links can only be used once. Request a fresh one and we will email it straight away.',
  'error.linkExpired.title': 'This link has expired',
  'error.linkExpired.detail':
    'Request a new one and we will email it straight away.',
  'error.linkIncomplete.title': 'This link is incomplete',
  'error.linkIncomplete.detail':
    'Password reset links carry a one-time token. Open the most recent email, or request a fresh link.',
  'error.sessionExpired.title': 'Your session expired',
  'error.sessionExpired.detail': 'Sign in again to pick up where you left off.',
  'error.alreadyVerified.title': 'Already confirmed',
  'error.alreadyVerified.detail':
    'This email address is verified. You can sign in as normal.',
  'error.badCode.title': 'That code did not work',
  'error.badCode.detail':
    'Authenticator codes last 30 seconds. Wait for the next one and enter all six digits.',
  'error.badBackupCode.title': 'That backup code did not work',
  'error.badBackupCode.detail':
    'Each backup code works once. Try the next unused code from your list.',
  'error.locked.title': 'Account temporarily locked',
  'error.locked.detail':
    'Too many failed verification attempts. For your security this account is locked for a few minutes.',
  'error.twoFactorOn.title': 'Two-factor is already on',
  'error.twoFactorOn.detail':
    'Setting it up again would stop your current authenticator working, so nothing was changed. You can manage it here.',
  'error.noTwoFactor.title': 'Two-factor is not set up',
  'error.noTwoFactor.detail':
    'Sign in with your email and password to continue.',
  'error.twoFactorExpired.title': 'Start again from sign-in',
  'error.twoFactorExpired.detail':
    'This verification step expired. Enter your email and password once more.',
  'error.invitationGone.title': 'This invitation is no longer available',
  'error.invitationGone.detail':
    'It may have expired, been withdrawn, or already been used. Ask for a fresh invitation.',
  'error.invitationOther.title': 'This invitation is for someone else',
  'error.invitationOther.detail':
    'It was sent to a different email address. Sign in with that address to accept it.',
  'error.alreadyMember.title': 'You are already in this workspace',
  'error.alreadyMember.detail':
    'Nothing to accept — open it from the workspace switcher.',
  'error.workspaceFull.title': 'This workspace is full',
  'error.workspaceFull.detail':
    'It has reached its member limit. Ask an owner to free up a seat or upgrade the plan.',
  'error.verifyBeforeJoin.title': 'Confirm your email first',
  'error.verifyBeforeJoin.detail':
    'Open the confirmation link we emailed you, then return to this invitation.',

  'passkeyNotice.added': 'A passkey was added to your account',
  'passkeyNotice.removed': 'A passkey was removed from your account',
  'passkeyNotice.security': 'Security',
  'passkeyNotice.action': 'Manage passkeys',
  'passkeyNotice.recovery':
    'If you do not recognize this change, change your password and end unfamiliar sessions. A password reset does not remove passkeys. Review your passkeys and remove any you do not recognize.',
  'error.passwordAttemptsLocked.title': 'Password confirmation locked',
  'error.passwordAttemptsLocked.detail':
    'This session can no longer confirm your password. Sign out and sign in again.',
  'error.passwordResultUnknown.title': 'Check your security settings',
  'error.passwordResultUnknown.detail':
    'The change may have completed. Keep this session open until you can sign in again. If you changed your password, try the new one. If you replaced backup codes, the old set may no longer work; use your authenticator or another signed-in session to generate a new set.',
} as const satisfies NamespaceMessages

export default messages
