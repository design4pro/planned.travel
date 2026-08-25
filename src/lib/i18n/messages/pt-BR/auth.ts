/**
 * Everything the authentication screens say, in Brazilian Portuguese.
 *
 * Authored from `../en/auth.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Você» with the verb in the third person, as everywhere else in
 * the Brazilian catalogue. These are the only screens a traveller reaches with
 * no session, so the language comes from `Accept-Language` alone and every
 * validation message has to read as naturally as the headings do.
 *
 * **Plural.** `Intl.PluralRules('pt-BR')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Not translated, on purpose.** The `{provider}` of a social button is a
 * trademark; `planned.travel` is our own wordmark; and the reserved
 * `example.com` domain stays as it is while the local part becomes Portuguese.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Início do planned.travel',
  'shell.legal':
    'Ao continuar, você aceita os termos de serviço e o aviso de privacidade do planned.travel.',

  'panel.eyebrow': 'Planejem juntos',
  'panel.heading':
    'Cada viagem, do primeiro ponto no mapa ao último cartão-postal.',
  'panel.body':
    'Roteiros compartilhados sobre um mapa de verdade, orçamentos que fecham, listas de bagagem que lembram de tudo e um diário que vale guardar.',
  'panel.map.title': 'Um mapa, um roteiro',
  'panel.map.detail':
    'Cada parada, cada hospedagem e cada traslado em um único roteiro.',
  'panel.group.title': 'Todo mundo no mesmo ritmo',
  'panel.group.detail':
    'Edições, votos e comentários chegam na hora para o grupo inteiro.',
  'panel.costs.title': 'Contas que fecham',
  'panel.costs.detail':
    'Orçamentos compartilhados, saldos acertados e nenhuma planilha.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'ou',
  'divider.orEmail': 'ou use seu e-mail',

  'social.continue': 'Continuar com {provider}',
  'social.signUp': 'Criar conta com {provider}',
  'social.opening': 'Abrindo {provider}',

  'passkey.action': 'Entrar com uma chave de acesso',
  'passkey.waiting': 'Esperando seu dispositivo',

  'password.show': 'Mostrar a senha',
  'password.hide': 'Ocultar a senha',
  'password.showNew': 'Mostrar a nova senha',
  'password.hideNew': 'Ocultar a nova senha',
  'password.showConfirm': 'Mostrar a confirmação da senha',
  'password.hideConfirm': 'Ocultar a confirmação da senha',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Endereço de e-mail',
  'field.email.placeholder': 'voce@example.com',
  'field.password': 'Senha',
  'field.password.placeholder': 'Sua senha',
  'field.newPassword': 'Nova senha',
  'field.newPassword.placeholder': 'Uma frase da qual você vai lembrar',
  'field.confirmPassword': 'Confirmar a senha',
  'field.confirmNewPassword': 'Confirmar a nova senha',
  'field.confirmPassword.placeholder': 'Digite mais uma vez',
  'field.name': 'Seu nome',
  'field.name.hint': 'Aparece para quem planeja viagens com você.',
  'field.name.placeholder': 'Ana Ribeiro',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Escreva seu endereço de e-mail.',
  'validation.emailTooLong': 'Esse endereço de e-mail é longo demais.',
  'validation.emailInvalid': 'Isso não parece um endereço de e-mail.',
  'validation.passwordRequired': 'Escreva sua senha.',
  'validation.passwordShort': {
    one: 'Use pelo menos {value} caractere: uma frase curta vence uma palavra esperta.',
    many: 'Use pelo menos {value} caracteres: uma frase curta vence uma palavra esperta.',
    other:
      'Use pelo menos {value} caracteres: uma frase curta vence uma palavra esperta.',
  },
  'validation.passwordLong': {
    one: 'Fique abaixo de {value} caractere.',
    many: 'Fique abaixo de {value} caracteres.',
    other: 'Fique abaixo de {value} caracteres.',
  },
  'validation.passwordMismatch': 'Essas senhas não são iguais.',
  'validation.nameShort':
    'Escreva seu nome, para o pessoal da viagem saber quem é você.',
  'validation.nameTooLong': 'Esse nome é longo demais.',
  'validation.termsRequired': 'Aceite os termos para continuar.',
  'validation.codeLength': 'Os códigos do autenticador têm seis dígitos.',
  'validation.codeDigits': 'Os códigos do autenticador só têm dígitos.',
  'validation.backupShort': 'Esse código reserva parece curto demais.',
  'validation.backupLong': 'Esse código reserva parece longo demais.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Que bom te ver de novo',
  'login.heading': 'Entre no planned.travel',
  'login.description':
    'Retome seus roteiros, seus orçamentos e suas listas exatamente onde parou.',
  'login.newHere': 'É sua primeira vez?',
  'login.createAccount': 'Criar uma conta',
  'login.forgot': 'Esqueceu a senha?',
  'login.remember': 'Continuar conectado neste dispositivo',
  'login.submit': 'Entrar',
  'login.submitting': 'Entrando',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Crie sua conta',
  'register.heading': 'Comece a planejar em dois minutos',
  'register.description':
    'Uma conta só para todas as viagens, todos os companheiros de estrada e todas as listas.',
  'register.haveAccount': 'Já tem uma conta?',
  'register.signIn': 'Entrar',
  'register.terms': 'Aceito os termos de serviço e o aviso de privacidade.',
  'register.submit': 'Criar a conta',
  'register.submitting': 'Criando sua conta',

  'strength.hint': {
    one: 'Pelo menos {value} caractere. Uma frase curta vence uma palavra esperta.',
    many: 'Pelo menos {value} caracteres. Uma frase curta vence uma palavra esperta.',
    other:
      'Pelo menos {value} caracteres. Uma frase curta vence uma palavra esperta.',
  },
  'strength.tooShort': 'Força: curta demais',
  'strength.weak': 'Força: fraca',
  'strength.fair': 'Força: razoável',
  'strength.strong': 'Força: boa',
  'strength.excellent': 'Força: excelente',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Ajuda com a senha',
  'forgot.heading': 'Redefina sua senha',
  'forgot.description':
    'Diga o endereço da sua conta e mandamos por e-mail um link para escolher uma senha nova.',
  'forgot.submit': 'Mandar o link para mim',
  'forgot.submitting': 'Enviando seu link',
  'forgot.back': 'Voltar para o acesso',
  'forgot.sent.eyebrow': 'Olhe sua caixa',
  'forgot.sent.heading': 'Seu link está a caminho',
  'forgot.sent.description':
    'Se alguma conta usa {email}, o link para escolher uma senha nova já está nessa caixa.',
  'forgot.sent.title': 'O link serve uma vez, por uma hora',
  'forgot.sent.body':
    'Não chegou nada? Olhe no spam e mande de novo. Pedir um link novo aposenta o anterior sem avisar.',
  'forgot.sent.resend': 'Mandar de novo',
  'forgot.sent.resending': 'Mandando de novo',
  'forgot.sent.change': 'Usar outro e-mail',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Redefinição de senha',
  'reset.heading': 'Escolha uma senha nova',
  'reset.description': {
    one: 'Escolha algo com pelo menos {value} caractere. Uma frase curta é mais fácil de lembrar e mais difícil de adivinhar.',
    many: 'Escolha algo com pelo menos {value} caracteres. Uma frase curta é mais fácil de lembrar e mais difícil de adivinhar.',
    other:
      'Escolha algo com pelo menos {value} caracteres. Uma frase curta é mais fácil de lembrar e mais difícil de adivinhar.',
  },
  'reset.submit': 'Salvar a nova senha',
  'reset.submitting': 'Salvando sua senha',
  'reset.back': 'Voltar para o acesso',
  'reset.stale.heading': 'Este link não dá mais para usar',
  'reset.stale.description':
    'Os links vencem depois de uma hora e funcionam uma vez só: a troca mais segura possível.',
  'reset.stale.action': 'Pedir um link novo',
  'reset.done.heading': 'Sua nova senha está valendo',
  'reset.done.description':
    'Todas as outras sessões foram encerradas, então quem tinha a senha antiga não tem mais como entrar.',
  'reset.done.title': 'Desconectado em todo o resto',
  'reset.done.body': 'Entre com a nova senha e volte a planejar.',
  'reset.done.action': 'Entrar',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Verificação em duas etapas',
  'twoFactor.heading': 'Confirme que é você',
  'twoFactor.description':
    'Sua conta está protegida por um segundo fator. Digite o código que o aplicativo autenticador mostra agora.',
  'twoFactor.back': 'Começar de novo pelo acesso',
  'twoFactor.methods': 'Método de verificação',
  'twoFactor.totp.tab': 'Aplicativo',
  'twoFactor.totp.label': 'Código de seis dígitos',
  'twoFactor.totp.hint': 'Os códigos mudam a cada 30 segundos.',
  'twoFactor.totp.submit': 'Verificar e continuar',
  'twoFactor.backup.tab': 'Código reserva',
  'twoFactor.backup.label': 'Código reserva',
  'twoFactor.backup.hint':
    'Da lista que você guardou ao ligar a verificação em duas etapas. Cada código serve uma vez.',
  'twoFactor.backup.submit': 'Usar um código reserva',
  'twoFactor.submitting': 'Conferindo seu código',
  'twoFactor.trust.label': 'Confiar neste dispositivo por 30 dias',
  'twoFactor.trust.detail':
    'Até lá você pula esta etapa neste navegador. Faça isso só em um dispositivo que seja só seu.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'E-mail confirmado',
  'verify.done.heading': 'Está tudo pronto',
  'verify.done.description':
    'Seu endereço está verificado, então convites, lembretes e resumos de viagem vão chegar até você.',
  'verify.done.title': 'Verificado',
  'verify.done.body': '{email} está confirmado nesta conta.',
  'verify.done.bodyUnknown':
    'Seu endereço de e-mail está confirmado nesta conta.',
  'verify.done.action': 'Ir para o seu painel',

  'verify.pending.eyebrow': 'Uma última coisa',
  'verify.pending.heading': 'Confirme seu endereço de e-mail',
  'verify.pending.description':
    'Mandamos um link de confirmação para {email}. Abrir esse link mantém sua conta recuperável e deixa que te convidem para viagens.',
  'verify.pending.wrongAddress': 'Endereço errado?',
  'verify.pending.changeIt': 'Mude nas configurações',
  'verify.pending.title': 'O link vale 24 horas',
  'verify.pending.body': 'Nada na sua caixa? Olhe no spam e mande de novo.',
  'verify.pending.resentTitle': 'Mandado de novo agora',
  'verify.pending.resentBody':
    'Espere um minuto e confira sua caixa — e a pasta de spam.',
  'verify.pending.resend': 'Reenviar a confirmação',
  'verify.pending.resending': 'Mandando de novo',
  'verify.pending.continue': 'Continuar mesmo assim',

  'verify.request.eyebrow': 'Confirmação de e-mail',
  'verify.request.heading': 'Mandar um link de confirmação novo',
  'verify.request.description':
    'Os links de confirmação valem 24 horas e funcionam uma vez só. Diga seu endereço e sai um novo na hora.',
  'verify.request.submit': 'Mandar o link de confirmação',
  'verify.request.submitting': 'Enviando seu link',
  'verify.request.sentTitle': 'Está a caminho',
  'verify.request.sentBody':
    'Se esse endereço tiver uma conta esperando confirmação, o link já está na caixa dele.',
  'verify.request.change': 'Usar outro e-mail',
  'verify.request.back': 'Voltar para o acesso',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Convite para um espaço de trabalho',
  'invitation.heading': 'Entrar em {workspace}',
  'invitation.description':
    'Aceitar coloca você neste espaço de trabalho e compartilha com você as viagens, os orçamentos e as listas dele.',
  'invitation.invitedAs': 'Convite para {email}',
  'invitation.role': 'Seu papel',
  'invitation.means': 'Quer dizer',
  'invitation.invitedBy': 'Convite de',
  'invitation.expires': 'Vence',
  'invitation.accept': 'Aceitar o convite',
  'invitation.accepting': 'Entrando no espaço de trabalho',
  'invitation.decline': 'Recusar',
  'invitation.declining': 'Recusando',
  'invitation.reassurance':
    'Você pode sair de um espaço de trabalho quando quiser pelas configurações dele, e nada do que você cria fora é compartilhado ali.',

  'invitation.role.owner':
    'Proprietário — controle total, inclusive o pagamento',
  'invitation.role.admin':
    'Administrador — cuida de viagens, membros e configurações',
  'invitation.role.member': 'Membro — planeja viagens junto com todo mundo',
  'invitation.role.other':
    '{role} — acesso definido pelo proprietário do espaço',
  'invitation.role.badge.owner': 'Proprietário',
  'invitation.role.badge.admin': 'Administrador',
  'invitation.role.badge.member': 'Membro',

  'invitation.anonymous.heading': 'Entre para ver seu convite',
  'invitation.anonymous.description':
    'Os convites ficam ligados ao e-mail para onde foram mandados, então precisamos saber quem é você antes de mostrar este.',
  'invitation.anonymous.body':
    'Use o endereço que recebeu o convite. Depois trazemos você de volta para cá.',
  'invitation.anonymous.action': 'Entrar para continuar',
  'invitation.anonymous.noAccount': 'Ainda não tem conta?',
  'invitation.anonymous.register': 'Crie uma com o endereço convidado',

  'invitation.mismatch.heading': 'Este convite é para outro endereço',
  'invitation.mismatch.description':
    'Você entrou com outra conta, então este convite não é seu para aceitar.',
  'invitation.mismatch.title': 'Conectado como {email}',
  'invitation.mismatch.body':
    'Saia e entre com o endereço que recebeu o convite, ou peça um convite novo para esta conta.',
  'invitation.mismatch.action': 'Trocar de conta',
  'invitation.mismatch.back': 'Voltar para o acesso',

  'invitation.unverified.heading': 'Confirme seu e-mail para entrar',
  'invitation.unverified.description':
    'Espaços de trabalho só aceitam endereços confirmados, para ninguém entrar por causa de um erro de digitação.',
  'invitation.unverified.title': '{email} ainda não foi confirmado',
  'invitation.unverified.body':
    'Abra o link de confirmação na sua caixa e volte a esta página. O convite vai estar esperando.',
  'invitation.unverified.action': 'Confirmar meu e-mail',
  'invitation.unverified.resend': 'Reenviar o e-mail de confirmação',

  'invitation.unavailable.heading': 'Este convite não está mais disponível',
  'invitation.unavailable.description':
    'Os convites duram sete dias e saem de cena assim que são usados ou cancelados.',
  'invitation.unavailable.title': 'Não há nada para aceitar aqui',
  'invitation.unavailable.body':
    'Peça um convite novo para quem convidou você, e esta página mostra na hora.',
  'invitation.unavailable.dashboard': 'Ir para o seu painel',

  'invitation.declined.eyebrow': 'Convite recusado',
  'invitation.declined.heading': 'Tudo bem — nada foi compartilhado',
  'invitation.declined.description':
    'O proprietário do espaço de trabalho foi avisado, e este link não funciona mais.',
  'invitation.declined.action': 'Ir para o seu painel',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Algo deu errado',
  'error.unexpected.detail': 'Isso não funcionou. Tente de novo daqui a pouco.',
  'error.rateLimited.title': 'Tentativas demais',
  'error.rateLimited.detail':
    'Por segurança, pausamos o acesso deste dispositivo por alguns minutos. Tente de novo em breve.',
  'error.offline.title': 'Sem conexão',
  'error.offline.detail':
    'Não conseguimos falar com o planned.travel. Confira sua conexão e tente de novo.',

  'error.credentials.title': 'Esses dados não batem',
  'error.credentials.detail':
    'Confira o e-mail e a senha e tente de novo. Se você criou a conta com Google ou Apple, use aquele botão.',
  'error.password.title': 'Esses dados não batem',
  'error.password.detail': 'Confira o e-mail e a senha e tente de novo.',
  'error.noPassword.title': 'Esta conta não tem senha',
  'error.noPassword.detail':
    'Esta conta entra por um serviço externo ou por uma chave de acesso. Use uma das opções acima.',
  'error.unverified.title': 'Confirme seu e-mail primeiro',
  'error.unverified.detail':
    'Mandamos um link de confirmação quando você criou a conta. Abra o link e volte aqui.',
  'error.emailTaken.title': 'Esse e-mail já está cadastrado',
  'error.emailTaken.detail':
    'Entre com ele, ou redefina a senha se tiver esquecido.',
  'error.noAccount.title': 'Não achamos essa conta',
  'error.noAccount.detail': 'Confira o endereço, ou crie uma conta nova.',
  'error.passwordTooShort.title': 'Senha curta demais',
  'error.passwordTooShort.detail':
    'Escolha uma frase mais longa e tente de novo.',
  'error.passwordTooLong.title': 'Senha longa demais',
  'error.passwordTooLong.detail':
    'Escolha uma frase mais curta e tente de novo.',
  'error.linkSpent.title': 'Este link não vale mais',
  'error.linkSpent.detail':
    'Links de senha funcionam uma vez só. Peça um novo e mandamos na hora.',
  'error.linkExpired.title': 'Este link venceu',
  'error.linkExpired.detail': 'Peça um novo e mandamos na hora.',
  'error.linkIncomplete.title': 'Este link está incompleto',
  'error.linkIncomplete.detail':
    'Os links de redefinição levam um código de uso único. Abra o e-mail mais recente, ou peça um link novo.',
  'error.sessionExpired.title': 'Sua sessão venceu',
  'error.sessionExpired.detail': 'Entre de novo para continuar de onde parou.',
  'error.alreadyVerified.title': 'Já estava confirmado',
  'error.alreadyVerified.detail':
    'Este endereço de e-mail está verificado. Você pode entrar normalmente.',
  'error.badCode.title': 'Esse código não funcionou',
  'error.badCode.detail':
    'Um código dura 30 segundos. Espere o próximo e digite os seis dígitos.',
  'error.badBackupCode.title': 'Esse código reserva não funcionou',
  'error.badBackupCode.detail':
    'Cada código reserva serve uma vez. Tente o próximo ainda não usado da sua lista.',
  'error.locked.title': 'Conta bloqueada por um tempo',
  'error.locked.detail':
    'Verificações demais falharam. Por segurança, esta conta fica bloqueada por alguns minutos.',
  'error.noTwoFactor.title': 'A verificação em duas etapas não está ligada',
  'error.noTwoFactor.detail':
    'Entre com seu e-mail e sua senha para continuar.',
  'error.twoFactorExpired.title': 'Comece de novo pelo acesso',
  'error.twoFactorExpired.detail':
    'Esta etapa de verificação venceu. Digite outra vez seu e-mail e sua senha.',
  'error.invitationGone.title': 'Este convite não está mais disponível',
  'error.invitationGone.detail':
    'Ele pode ter vencido, sido cancelado ou já usado. Peça um convite novo.',
  'error.invitationOther.title': 'Este convite é de outra pessoa',
  'error.invitationOther.detail':
    'Ele foi mandado para outro endereço de e-mail. Entre com esse endereço para aceitar.',
  'error.alreadyMember.title': 'Você já está neste espaço de trabalho',
  'error.alreadyMember.detail':
    'Não há nada para aceitar — abra pelo seletor de espaços.',
  'error.workspaceFull.title': 'Este espaço de trabalho está cheio',
  'error.workspaceFull.detail':
    'Ele chegou ao limite de membros. Peça a um proprietário para liberar uma vaga ou mudar de plano.',
  'error.verifyBeforeJoin.title': 'Confirme seu e-mail primeiro',
  'error.verifyBeforeJoin.detail':
    'Abra o link de confirmação que mandamos e volte a este convite.',
} satisfies TranslationOf<typeof En>

export default messages
