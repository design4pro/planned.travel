/**
 * Everything the authentication screens say, in French.
 *
 * Authored from `../en/auth.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §9 rule 9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Vouvoiement, as everywhere else in the French catalogue. These
 * are the only screens a traveller reaches with no session, so the language
 * comes from the visitor cookie, then `Accept-Language`, then English and every validation message has to read
 * as naturally as the headings do.
 *
 * **Plural.** `Intl.PluralRules('fr')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Typography.** A non-breaking space precedes every colon and question mark,
 * which is why those strings are not simply the English punctuation.
 *
 * **Not translated, on purpose.** The `{provider}` of a social button is a
 * trademark; `planned.travel` is our own wordmark; and the reserved
 * `example.com` domain stays as it is while the local part becomes French.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Accueil planned.travel',
  'shell.legal':
    'En continuant, vous acceptez les conditions d’utilisation et la politique de confidentialité de planned.travel.',

  'panel.eyebrow': 'Préparez à plusieurs',
  'panel.heading':
    'Chaque voyage, du premier point sur la carte à la dernière carte postale.',
  'panel.body':
    'Des itinéraires partagés sur une vraie carte, des budgets qui tombent juste, des listes de bagages qui se souviennent, et un journal qui mérite d’être gardé.',
  'panel.map.title': 'Une carte, un programme',
  'panel.map.detail':
    'Chaque étape, chaque hébergement et chaque transfert sur un seul itinéraire.',
  'panel.group.title': 'Tout le monde au même rythme',
  'panel.group.detail':
    'Les modifications, les votes et les commentaires arrivent en direct pour tout le groupe.',
  'panel.costs.title': 'Des comptes qui tombent juste',
  'panel.costs.detail':
    'Budgets partagés, soldes réglés, aucun tableur en vue.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'ou',
  'divider.orEmail': 'ou avec votre e-mail',

  'social.continue': 'Continuer avec {provider}',
  'social.signUp': 'S’inscrire avec {provider}',
  'social.opening': 'Ouverture de {provider}',

  'passkey.action': 'Se connecter avec une clé d’accès',
  'passkey.waiting': 'En attente de votre appareil',

  'password.show': 'Afficher le mot de passe',
  'password.hide': 'Masquer le mot de passe',
  'password.showNew': 'Afficher le nouveau mot de passe',
  'password.hideNew': 'Masquer le nouveau mot de passe',
  'password.showConfirm': 'Afficher la confirmation du mot de passe',
  'password.hideConfirm': 'Masquer la confirmation du mot de passe',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Adresse e-mail',
  'field.email.placeholder': 'vous@example.com',
  'field.password': 'Mot de passe',
  'field.password.placeholder': 'Votre mot de passe',
  'field.newPassword': 'Nouveau mot de passe',
  'field.newPassword.placeholder': 'Une phrase dont vous vous souviendrez',
  'field.confirmPassword': 'Confirmer le mot de passe',
  'field.confirmNewPassword': 'Confirmer le nouveau mot de passe',
  'field.confirmPassword.placeholder': 'Saisissez-la une seconde fois',
  'field.name': 'Votre nom',
  'field.name.hint':
    'Visible par les personnes avec qui vous préparez vos voyages.',
  'field.name.placeholder': 'Camille Lefèvre',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Saisissez votre adresse e-mail.',
  'validation.emailTooLong': 'Cette adresse e-mail est trop longue.',
  'validation.emailInvalid': 'Cela ne ressemble pas à une adresse e-mail.',
  'validation.passwordRequired': 'Saisissez votre mot de passe.',
  'validation.passwordShort': {
    one: 'Il faut au moins {value} caractère\u00a0: une phrase courte vaut mieux qu’un mot astucieux.',
    many: 'Il faut au moins {value} caractères\u00a0: une phrase courte vaut mieux qu’un mot astucieux.',
    other:
      'Il faut au moins {value} caractères\u00a0: une phrase courte vaut mieux qu’un mot astucieux.',
  },
  'validation.passwordLong': {
    one: 'Restez sous {value} caractère.',
    many: 'Restez sous {value} caractères.',
    other: 'Restez sous {value} caractères.',
  },
  'validation.passwordMismatch': 'Ces mots de passe ne correspondent pas.',
  'validation.nameShort':
    'Saisissez votre nom, pour que vos compagnons de voyage sachent qui vous êtes.',
  'validation.nameTooLong': 'Ce nom est trop long.',
  'validation.termsRequired': 'Acceptez les conditions pour continuer.',
  'validation.codeLength': 'Les codes de l’application comptent six chiffres.',
  'validation.codeDigits':
    'Les codes de l’application ne contiennent que des chiffres.',
  'validation.backupShort': 'Ce code de secours semble trop court.',
  'validation.backupLong': 'Ce code de secours semble trop long.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Content de vous revoir',
  'login.heading': 'Connectez-vous à planned.travel',
  'login.description':
    'Reprenez vos itinéraires, vos budgets et vos listes exactement où vous les avez laissés.',
  'login.newHere': 'C’est votre première fois\u00a0?',
  'login.createAccount': 'Créer un compte',
  'login.forgot': 'Mot de passe oublié\u00a0?',
  'login.remember': 'Rester connecté sur cet appareil',
  'login.submit': 'Se connecter',
  'login.submitting': 'Connexion en cours',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Créez votre compte',
  'register.heading': 'Commencez à préparer en deux minutes',
  'register.description':
    'Un seul compte pour tous vos voyages, tous vos compagnons de route et toutes vos listes.',
  'register.haveAccount': 'Vous avez déjà un compte\u00a0?',
  'register.signIn': 'Se connecter',
  'register.terms':
    'J’accepte les conditions d’utilisation et la politique de confidentialité.',
  'register.submit': 'Créer le compte',
  'register.submitting': 'Création de votre compte',

  'strength.hint': {
    one: 'Au moins {value} caractère. Une phrase courte vaut mieux qu’un mot astucieux.',
    many: 'Au moins {value} caractères. Une phrase courte vaut mieux qu’un mot astucieux.',
    other:
      'Au moins {value} caractères. Une phrase courte vaut mieux qu’un mot astucieux.',
  },
  'strength.tooShort': 'Robustesse\u00a0: trop court',
  'strength.weak': 'Robustesse\u00a0: faible',
  'strength.fair': 'Robustesse\u00a0: correcte',
  'strength.strong': 'Robustesse\u00a0: solide',
  'strength.excellent': 'Robustesse\u00a0: excellente',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Aide sur le mot de passe',
  'forgot.heading': 'Réinitialisez votre mot de passe',
  'forgot.description':
    'Indiquez l’adresse de votre compte et nous vous enverrons un lien pour en choisir un nouveau.',
  'forgot.submit': 'M’envoyer un lien',
  'forgot.submitting': 'Envoi de votre lien',
  'forgot.back': 'Retour à la connexion',
  'forgot.sent.eyebrow': 'Regardez votre boîte',
  'forgot.sent.heading': 'Votre lien est en route',
  'forgot.sent.description':
    'Si un compte utilise {email}, le lien pour choisir un nouveau mot de passe est déjà dans cette boîte.',
  'forgot.sent.title': 'Le lien sert une fois, pendant une heure',
  'forgot.sent.body':
    'Rien reçu\u00a0? Regardez dans les indésirables, puis renvoyez-le. Demander un nouveau lien retire discrètement le précédent.',
  'forgot.sent.resend': 'Le renvoyer',
  'forgot.sent.resending': 'Nouvel envoi',
  'forgot.sent.change': 'Utiliser une autre adresse',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Réinitialisation',
  'reset.heading': 'Choisissez un nouveau mot de passe',
  'reset.description': {
    one: 'Prenez quelque chose d’au moins {value} caractère. Une phrase courte se retient mieux et se devine moins bien.',
    many: 'Prenez quelque chose d’au moins {value} caractères. Une phrase courte se retient mieux et se devine moins bien.',
    other:
      'Prenez quelque chose d’au moins {value} caractères. Une phrase courte se retient mieux et se devine moins bien.',
  },
  'reset.submit': 'Enregistrer le mot de passe',
  'reset.submitting': 'Enregistrement de votre mot de passe',
  'reset.back': 'Retour à la connexion',
  'reset.stale.heading': 'Ce lien ne peut plus servir',
  'reset.stale.description':
    'Les liens expirent au bout d’une heure et ne servent qu’une fois\u00a0: le compromis le plus sûr qui soit.',
  'reset.stale.action': 'Demander un nouveau lien',
  'reset.done.heading': 'Votre nouveau mot de passe est en place',
  'reset.done.description':
    'Toutes les autres sessions ont été déconnectées\u00a0: qui avait l’ancien mot de passe n’a plus de porte d’entrée.',
  'reset.done.title': 'Déconnecté partout ailleurs',
  'reset.done.body':
    'Connectez-vous avec votre nouveau mot de passe pour continuer à préparer vos voyages.',
  'reset.done.action': 'Se connecter',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Vérification en deux étapes',
  'twoFactor.heading': 'Confirmez que c’est bien vous',
  'twoFactor.description':
    'Votre compte est protégé par un second facteur. Saisissez le code affiché en ce moment par votre application d’authentification.',
  'twoFactor.back': 'Recommencer depuis la connexion',
  'twoFactor.methods': 'Méthode de vérification',
  'twoFactor.totp.tab': 'Application',
  'twoFactor.totp.label': 'Code à six chiffres',
  'twoFactor.totp.hint': 'Les codes changent toutes les 30 secondes.',
  'twoFactor.totp.submit': 'Vérifier et continuer',
  'twoFactor.backup.tab': 'Code de secours',
  'twoFactor.backup.label': 'Code de secours',
  'twoFactor.backup.hint':
    'Dans la liste que vous avez enregistrée en activant la vérification en deux étapes. Chaque code ne sert qu’une fois.',
  'twoFactor.backup.submit': 'Utiliser un code de secours',
  'twoFactor.submitting': 'Vérification de votre code',
  'twoFactor.trust.label': 'Faire confiance à cet appareil pendant 30 jours',
  'twoFactor.trust.detail':
    'Cette étape sera passée sur ce navigateur jusque-là. À ne faire que sur un appareil qui n’appartient qu’à vous.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'Adresse confirmée',
  'verify.done.heading': 'Tout est prêt',
  'verify.done.description':
    'Votre adresse est vérifiée\u00a0: les invitations, les rappels et les récapitulatifs de voyage vous parviendront.',
  'verify.done.title': 'Vérifiée',
  'verify.done.body': '{email} est confirmée sur ce compte.',
  'verify.done.bodyUnknown':
    'Votre adresse e-mail est confirmée sur ce compte.',
  'verify.done.action': 'Aller à votre tableau de bord',

  'verify.pending.eyebrow': 'Un dernier point',
  'verify.pending.heading': 'Confirmez votre adresse e-mail',
  'verify.pending.description':
    'Nous avons envoyé un lien de confirmation à {email}. L’ouvrir garde votre compte récupérable et permet à vos compagnons de voyage de vous inviter.',
  'verify.pending.wrongAddress': 'Mauvaise adresse\u00a0?',
  'verify.pending.changeIt': 'Changez-la dans les réglages',
  'verify.pending.title': 'Le lien vaut 24 heures',
  'verify.pending.body':
    'Rien dans votre boîte\u00a0? Regardez les indésirables, puis renvoyez-le.',
  'verify.pending.resentTitle': 'Renvoyé à l’instant',
  'verify.pending.resentBody':
    'Laissez-lui une minute, puis regardez votre boîte — et les indésirables.',
  'verify.pending.resend': 'Renvoyer la confirmation',
  'verify.pending.resending': 'Nouvel envoi',
  'verify.pending.continue': 'Continuer quand même',

  'verify.request.eyebrow': 'Confirmation de l’adresse',
  'verify.request.heading': 'Envoyer un nouveau lien de confirmation',
  'verify.request.description':
    'Les liens de confirmation valent 24 heures et ne servent qu’une fois. Indiquez votre adresse et un nouveau part aussitôt.',
  'verify.request.submit': 'Envoyer le lien',
  'verify.request.submitting': 'Envoi de votre lien',
  'verify.request.sentTitle': 'En route',
  'verify.request.sentBody':
    'Si cette adresse a un compte en attente de confirmation, le lien est déjà dans sa boîte.',
  'verify.request.change': 'Utiliser une autre adresse',
  'verify.request.back': 'Retour à la connexion',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Invitation à un espace de travail',
  'invitation.heading': 'Rejoindre {workspace}',
  'invitation.description':
    'Accepter vous ajoute à cet espace de travail et partage avec vous ses voyages, ses budgets et ses listes.',
  'invitation.invitedAs': 'Invitation adressée à {email}',
  'invitation.role': 'Votre rôle',
  'invitation.means': 'C’est-à-dire',
  'invitation.invitedBy': 'Invitation de',
  'invitation.expires': 'Expire',
  'invitation.accept': 'Accepter l’invitation',
  'invitation.accepting': 'Entrée dans l’espace de travail',
  'invitation.decline': 'Refuser',
  'invitation.declining': 'Refus en cours',
  'invitation.reassurance':
    'Vous pouvez quitter un espace de travail à tout moment depuis ses réglages, et rien de ce que vous créez en dehors n’y est jamais partagé.',

  'invitation.role.owner':
    'Propriétaire — contrôle total, facturation comprise',
  'invitation.role.admin':
    'Administrateur — gère les voyages, les membres et les réglages',
  'invitation.role.member': 'Membre — prépare les voyages avec tout le monde',
  'invitation.role.other':
    '{role} — accès défini par le propriétaire de l’espace',
  'invitation.role.badge.owner': 'Propriétaire',
  'invitation.role.badge.admin': 'Administrateur',
  'invitation.role.badge.member': 'Membre',

  'invitation.anonymous.heading': 'Connectez-vous pour voir votre invitation',
  'invitation.anonymous.description':
    'Les invitations sont liées à l’adresse à laquelle elles ont été envoyées\u00a0: nous devons savoir qui vous êtes avant de vous montrer celle-ci.',
  'invitation.anonymous.body':
    'Utilisez l’adresse qui a reçu l’invitation. Nous vous ramenons ici juste après.',
  'invitation.anonymous.action': 'Se connecter pour continuer',
  'invitation.anonymous.noAccount': 'Pas encore de compte\u00a0?',
  'invitation.anonymous.register': 'En créer un avec l’adresse invitée',

  'invitation.mismatch.heading': 'Cette invitation vise une autre adresse',
  'invitation.mismatch.description':
    'Vous êtes connecté sous un autre compte\u00a0: celle-ci n’est pas à vous.',
  'invitation.mismatch.title': 'Connecté en tant que {email}',
  'invitation.mismatch.body':
    'Déconnectez-vous puis reconnectez-vous avec l’adresse qui a reçu l’invitation, ou demandez-en une nouvelle pour ce compte.',
  'invitation.mismatch.action': 'Changer de compte',
  'invitation.mismatch.back': 'Retour à la connexion',

  'invitation.unverified.heading': 'Confirmez votre adresse pour entrer',
  'invitation.unverified.description':
    'Les espaces de travail n’acceptent que des adresses confirmées, pour que personne n’y entre par une faute de frappe.',
  'invitation.unverified.title': '{email} n’est pas encore confirmée',
  'invitation.unverified.body':
    'Ouvrez le lien de confirmation dans votre boîte, puis revenez sur cette page. L’invitation vous y attendra.',
  'invitation.unverified.action': 'Confirmer mon adresse',
  'invitation.unverified.resend': 'Renvoyer l’e-mail de confirmation',

  'invitation.unavailable.heading': 'Cette invitation n’est plus disponible',
  'invitation.unavailable.description':
    'Les invitations durent sept jours et se retirent dès qu’elles sont utilisées ou annulées.',
  'invitation.unavailable.title': 'Rien à accepter ici',
  'invitation.unavailable.body':
    'Demandez à la personne qui vous a invité d’en envoyer une nouvelle\u00a0: cette page l’affichera aussitôt.',
  'invitation.unavailable.dashboard': 'Aller à votre tableau de bord',

  'invitation.declined.eyebrow': 'Invitation refusée',
  'invitation.declined.heading': 'Aucun souci — rien n’a été partagé',
  'invitation.declined.description':
    'Le propriétaire de l’espace de travail a été prévenu, et ce lien ne peut plus servir.',
  'invitation.declined.action': 'Aller à votre tableau de bord',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Quelque chose s’est mal passé',
  'error.unexpected.detail':
    'Cela n’a pas fonctionné. Réessayez dans un instant.',
  'error.rateLimited.title': 'Trop de tentatives',
  'error.rateLimited.detail':
    'Par sécurité, la connexion depuis cet appareil est suspendue quelques minutes. Réessayez bientôt.',
  'error.offline.title': 'Aucune connexion',
  'error.offline.detail':
    'Impossible de joindre planned.travel. Vérifiez votre connexion et réessayez.',

  'error.credentials.title': 'Ces informations ne correspondent pas',
  'error.credentials.detail':
    'Vérifiez l’adresse e-mail et le mot de passe, puis réessayez. Si vous vous êtes inscrit avec Google ou Apple, passez plutôt par ce bouton.',
  'error.password.title': 'Ces informations ne correspondent pas',
  'error.password.detail':
    'Vérifiez l’adresse e-mail et le mot de passe, puis réessayez.',
  'error.noPassword.title': 'Aucun mot de passe sur ce compte',
  'error.noPassword.detail':
    'Ce compte se connecte par un fournisseur externe ou une clé d’accès. Utilisez l’une des options ci-dessus.',
  'error.unverified.title': 'Confirmez d’abord votre adresse',
  'error.unverified.detail':
    'Un lien de confirmation vous a été envoyé à l’inscription. Ouvrez-le, puis revenez ici.',
  'error.emailTaken.title': 'Cette adresse est déjà inscrite',
  'error.emailTaken.detail':
    'Connectez-vous plutôt, ou réinitialisez votre mot de passe si vous l’avez oublié.',
  'error.noAccount.title': 'Ce compte reste introuvable',
  'error.noAccount.detail': 'Vérifiez l’adresse, ou créez un nouveau compte.',
  'error.passwordTooShort.title': 'Mot de passe trop court',
  'error.passwordTooShort.detail':
    'Choisissez une phrase plus longue, puis réessayez.',
  'error.passwordTooLong.title': 'Mot de passe trop long',
  'error.passwordTooLong.detail':
    'Choisissez une phrase plus courte, puis réessayez.',
  'error.linkSpent.title': 'Ce lien n’est plus valable',
  'error.linkSpent.detail':
    'Un lien de mot de passe ne sert qu’une fois. Demandez-en un nouveau, il part aussitôt.',
  'error.linkExpired.title': 'Ce lien a expiré',
  'error.linkExpired.detail':
    'Demandez-en un nouveau, il part aussitôt par e-mail.',
  'error.linkIncomplete.title': 'Ce lien est incomplet',
  'error.linkIncomplete.detail':
    'Un lien de réinitialisation porte un jeton à usage unique. Ouvrez l’e-mail le plus récent, ou demandez un nouveau lien.',
  'error.sessionExpired.title': 'Votre session a expiré',
  'error.sessionExpired.detail':
    'Reconnectez-vous pour reprendre où vous en étiez.',
  'error.alreadyVerified.title': 'Déjà confirmée',
  'error.alreadyVerified.detail':
    'Cette adresse e-mail est vérifiée. Vous pouvez vous connecter normalement.',
  'error.badCode.title': 'Ce code n’a pas fonctionné',
  'error.badCode.detail':
    'Un code vaut 30 secondes. Attendez le suivant et saisissez les six chiffres.',
  'error.badBackupCode.title': 'Ce code de secours n’a pas fonctionné',
  'error.badBackupCode.detail':
    'Chaque code de secours ne sert qu’une fois. Essayez le suivant, encore inutilisé.',
  'error.locked.title': 'Compte temporairement verrouillé',
  'error.locked.detail':
    'Trop de vérifications ont échoué. Par sécurité, ce compte est verrouillé quelques minutes.',
  'error.twoFactorOn.title':
    'L’authentification à deux facteurs est déjà activée',
  'error.twoFactorOn.detail':
    'La configurer à nouveau empêcherait votre application d’authentification actuelle de fonctionner. Rien n’a donc été modifié. Vous pouvez la gérer ici.',
  'error.noTwoFactor.title': 'La vérification en deux étapes n’est pas active',
  'error.noTwoFactor.detail':
    'Connectez-vous avec votre e-mail et votre mot de passe pour continuer.',
  'error.twoFactorExpired.title': 'Recommencez depuis la connexion',
  'error.twoFactorExpired.detail':
    'Cette étape de vérification a expiré. Saisissez de nouveau votre e-mail et votre mot de passe.',
  'error.invitationGone.title': 'Cette invitation n’est plus disponible',
  'error.invitationGone.detail':
    'Elle a pu expirer, être annulée ou avoir déjà servi. Demandez-en une nouvelle.',
  'error.invitationOther.title': 'Cette invitation vise quelqu’un d’autre',
  'error.invitationOther.detail':
    'Elle a été envoyée à une autre adresse e-mail. Connectez-vous avec celle-ci pour l’accepter.',
  'error.alreadyMember.title': 'Vous êtes déjà dans cet espace de travail',
  'error.alreadyMember.detail':
    'Rien à accepter — ouvrez-le depuis le sélecteur d’espaces.',
  'error.workspaceFull.title': 'Cet espace de travail est complet',
  'error.workspaceFull.detail':
    'Il a atteint sa limite de membres. Demandez à un propriétaire de libérer une place ou de changer de formule.',
  'error.verifyBeforeJoin.title': 'Confirmez d’abord votre adresse',
  'error.verifyBeforeJoin.detail':
    'Ouvrez le lien de confirmation que nous vous avons envoyé, puis revenez à cette invitation.',

  'passkeyNotice.added': 'Une clé d’accès a été ajoutée à votre compte',
  'passkeyNotice.removed': 'Une clé d’accès a été supprimée de votre compte',
  'passkeyNotice.security': 'Sécurité',
  'passkeyNotice.action': 'Gérer les clés d’accès',
  'passkeyNotice.recovery':
    'Si vous ne reconnaissez pas ce changement, modifiez votre mot de passe et fermez les sessions inconnues. La réinitialisation du mot de passe ne supprime pas les clés d’accès. Vérifiez-les et supprimez celles que vous ne reconnaissez pas.',
  'error.passwordAttemptsLocked.title': 'Confirmation du mot de passe bloquée',
  'error.passwordAttemptsLocked.detail':
    'Cette session ne peut plus confirmer votre mot de passe. Déconnectez-vous puis reconnectez-vous.',
  'error.passwordResultUnknown.title': 'Vérifiez vos paramètres de sécurité',
  'error.passwordResultUnknown.detail':
    'La modification a peut-être été enregistrée. Gardez cette session ouverte tant que vous ne pouvez pas vous reconnecter. Si vous avez changé de mot de passe, essayez le nouveau. Si vous avez remplacé les codes de secours, les anciens peuvent ne plus fonctionner ; utilisez votre application d’authentification ou une autre session connectée pour en générer de nouveaux.',
} satisfies TranslationOf<typeof En>

export default messages
