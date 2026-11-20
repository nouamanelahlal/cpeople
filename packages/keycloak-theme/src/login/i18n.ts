import { i18nBuilder } from 'keycloakify/login';
import type { ThemeName } from '../kc.gen';

/**
 * Every string the sign-in pages show, in English and French (M23).
 *
 * Keys that exist in Keycloak's own message set are overridden here, so the wording
 * people meet is ours and not a translation of Keycloak's. Keys with a `cp` prefix
 * are new.
 *
 * French is written for HR staff in Morocco: "Adresse e-mail", not the Québécois
 * "Courriel"; "Se connecter", not a literal rendering of "sign in". Terms still to
 * be confirmed with the client are listed in the pull request.
 */
const { useI18n, ofTypeI18n: _ofTypeI18n } = i18nBuilder
  .withThemeName<ThemeName>()
  .withCustomTranslations({
    en: {
      // Shell
      cpBookADemo: 'Book a demo',
      cpNewToCPeople: 'New to CPeople?',
      cpHome: 'CPeople home',
      cpCopyright: '© {0} ConSAP',
      cpLanguage: 'Language: {0}',
      cpShowcaseAria: 'What CPeople does',
      cpShowcaseTitle: 'See your people.\nPay them right.',
      cpShowcaseBody: 'Employee files, leave, attendance and payroll in one place, posted straight to SAP.',
      cpActivityAria: 'Sample activity',
      cpActivityWorking: 'Working',
      cpActivityDone: 'Done',
      cpActivity1: 'Calculating November payroll for 148 employees',
      cpActivity2: 'Leave request approved by N+2',
      cpActivity3: 'Attendance imported from the kitchen device',
      cpActivity4: 'Payroll journal posted to SAP S/4HANA',
      cpActivity5: 'Payslips emailed to 148 employees',

      // Email step
      cpWelcomeTitle: 'Welcome back',
      cpWelcomeSubtitle: 'Sign in to continue to CPeople.',
      cpWorkEmail: 'Work email',
      cpContinue: 'Continue',
      cpNoAccount: 'No account? Your HR administrator sends you an invitation.',
      cpPrivacyNotice: 'By continuing, you accept the CPeople {0}.',
      cpPrivacyPolicy: 'Privacy Policy',
      cpOr: 'or',
      cpContinueWith: 'Continue with {0}',

      // Password step
      cpChangeEmail: 'Change',
      cpShowPassword: 'Show password',
      cpHidePassword: 'Hide password',

      // Code step
      cpCodeTitle: 'Enter your code',
      cpCodeSubtitle:
        'Payroll access needs a second step. Open your authenticator app and enter the 6-digit code for CPeople.',
      cpCodePlaceholder: '6-digit code',
      cpCodeSubmit: 'Verify and continue',
      cpCodeHelp: 'No access to your authenticator app? Ask your CPeople administrator to reset your second step.',
      cpBack: 'Back',

      // Reset password
      cpResetTitle: 'Reset your password',
      cpResetSubtitle: "Enter your work email and we'll send you a link to choose a new password.",
      cpResetSubmit: 'Send the link',
      cpBackToSignIn: 'Back to sign in',
      cpSentTitle: 'Check your inbox',
      cpSentBody: 'If that address belongs to a CPeople account, a link to choose a new password is on its way. It expires in {0}.',
      cpSentHelp: 'Nothing arrived? Check your spam folder, or ask your HR administrator.',

      // New password
      cpNewPasswordTitle: 'Choose a new password',
      cpNewPasswordSubtitle: 'It needs at least 12 characters, with an upper-case letter, a lower-case letter, a digit and a symbol.',
      cpNewPassword: 'New password',
      cpConfirmPassword: 'Confirm new password',
      cpNewPasswordSubmit: 'Save and sign in',

      // Errors, in plain words
      cpErrorCredentials: "That email and password don't match. Check them and try again.",
      cpErrorLocked: 'Too many attempts, so your account is locked for now. Try again later, or {0}.',
      cpErrorLockedLink: 'reset your password',
      cpErrorCode: "That code didn't work. Codes change every 30 seconds, so use the latest one.",
      cpErrorExpiredTitle: 'That link has expired',
      cpErrorExpiredBody: 'Password links last a short time for safety. Ask for a new one and it will arrive in a moment.',
      cpErrorExpiredAction: 'Send a new link',
      cpErrorGenericTitle: 'Something went wrong',
      cpErrorEmailRequired: 'Enter your work email.',
      cpErrorPasswordRequired: 'Enter your password.',
      cpErrorCodeRequired: 'Enter the 6-digit code.',

      // Keycloak's own keys, reworded
      doLogIn: 'Sign in',
      doSubmit: 'Continue',
      doCancel: 'Cancel',
      backToLogin: 'Back to sign in',
      emailForgotTitle: 'Reset your password',
      doForgotPassword: 'Forgot password?',
      invalidUserMessage: "That email and password don't match. Check them and try again.",
      invalidUsernameOrPasswordMessage: "That email and password don't match. Check them and try again.",
      invalidPasswordMessage: "That email and password don't match. Check them and try again.",
      accountTemporarilyDisabledMessage: 'Too many attempts, so your account is locked for now. Try again later, or reset your password.',
      invalidTotpMessage: "That code didn't work. Codes change every 30 seconds, so use the latest one.",
      missingTotpMessage: 'Enter the 6-digit code.',
      missingPasswordMessage: 'Enter your password.',
      missingUsernameMessage: 'Enter your work email.',
      notMatchPasswordMessage: 'Those two passwords are different. Type them again.',
      invalidPasswordMinLengthMessage: 'Your password needs at least {0} characters.',
      emailInstruction: "Enter your work email and we'll send you a link to choose a new password.",
      emailSentMessage: 'If that address belongs to a CPeople account, a link to choose a new password is on its way.',
      expiredActionTokenNoSessionMessage: 'That link has expired.',
      expiredActionTokenSessionExistsMessage: 'That link has expired.',
      pageExpiredTitle: 'This page has expired',
      updatePasswordTitle: 'Choose a new password',
    },
    fr: {
      // Shell
      cpBookADemo: 'Demander une démo',
      cpNewToCPeople: 'Vous découvrez CPeople ?',
      cpHome: 'Accueil CPeople',
      cpCopyright: '© {0} ConSAP',
      cpLanguage: 'Langue : {0}',
      cpShowcaseAria: 'Ce que fait CPeople',
      cpShowcaseTitle: 'Voyez vos équipes.\nPayez-les justement.',
      cpShowcaseBody: 'Dossiers du personnel, congés, pointage et paie au même endroit, comptabilisés directement dans SAP.',
      cpActivityAria: 'Activité, exemple',
      cpActivityWorking: 'En cours',
      cpActivityDone: 'Terminé',
      cpActivity1: 'Calcul de la paie de novembre pour 148 salariés',
      cpActivity2: 'Demande de congé validée par le N+2',
      cpActivity3: 'Pointages importés depuis la pointeuse de la cuisine',
      cpActivity4: 'Journal de paie comptabilisé dans SAP S/4HANA',
      cpActivity5: 'Bulletins de paie envoyés à 148 salariés',

      // Email step
      cpWelcomeTitle: 'Bon retour',
      cpWelcomeSubtitle: 'Connectez-vous pour accéder à CPeople.',
      cpWorkEmail: 'Adresse e-mail professionnelle',
      cpContinue: 'Continuer',
      cpNoAccount: "Pas de compte ? C'est votre responsable RH qui vous envoie une invitation.",
      cpPrivacyNotice: 'En continuant, vous acceptez la {0} de CPeople.',
      cpPrivacyPolicy: 'politique de confidentialité',
      cpOr: 'ou',
      cpContinueWith: 'Continuer avec {0}',

      // Password step
      cpChangeEmail: 'Modifier',
      cpShowPassword: 'Afficher le mot de passe',
      cpHidePassword: 'Masquer le mot de passe',

      // Code step
      cpCodeTitle: 'Saisissez votre code',
      cpCodeSubtitle:
        "L'accès à la paie demande une deuxième étape. Ouvrez votre application d'authentification et saisissez le code à 6 chiffres pour CPeople.",
      cpCodePlaceholder: 'Code à 6 chiffres',
      cpCodeSubmit: 'Vérifier et continuer',
      cpCodeHelp:
        "Vous n'avez plus accès à votre application d'authentification ? Demandez à votre administrateur CPeople de réinitialiser votre deuxième étape.",
      cpBack: 'Retour',

      // Reset password
      cpResetTitle: 'Réinitialisez votre mot de passe',
      cpResetSubtitle:
        'Saisissez votre adresse e-mail professionnelle et nous vous enverrons un lien pour choisir un nouveau mot de passe.',
      cpResetSubmit: 'Envoyer le lien',
      cpBackToSignIn: 'Retour à la connexion',
      cpSentTitle: 'Consultez votre boîte mail',
      cpSentBody:
        'Si cette adresse correspond à un compte CPeople, un lien pour choisir un nouveau mot de passe est en route. Il expire dans {0}.',
      cpSentHelp: "Rien reçu ? Vérifiez vos indésirables, ou demandez à votre responsable RH.",

      // New password
      cpNewPasswordTitle: 'Choisissez un nouveau mot de passe',
      cpNewPasswordSubtitle:
        'Il doit contenir au moins 12 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.',
      cpNewPassword: 'Nouveau mot de passe',
      cpConfirmPassword: 'Confirmez le nouveau mot de passe',
      cpNewPasswordSubmit: 'Enregistrer et se connecter',

      // Errors, in plain words
      cpErrorCredentials: 'Cette adresse e-mail et ce mot de passe ne correspondent pas. Vérifiez-les et réessayez.',
      cpErrorLocked: 'Trop de tentatives : votre compte est bloqué pour le moment. Réessayez plus tard, ou {0}.',
      cpErrorLockedLink: 'réinitialisez votre mot de passe',
      cpErrorCode: 'Ce code ne fonctionne pas. Les codes changent toutes les 30 secondes : utilisez le plus récent.',
      cpErrorExpiredTitle: 'Ce lien a expiré',
      cpErrorExpiredBody:
        'Par sécurité, les liens de mot de passe ne sont valables que peu de temps. Demandez-en un nouveau, il arrivera dans un instant.',
      cpErrorExpiredAction: 'Envoyer un nouveau lien',
      cpErrorGenericTitle: "Quelque chose s'est mal passé",
      cpErrorEmailRequired: 'Saisissez votre adresse e-mail professionnelle.',
      cpErrorPasswordRequired: 'Saisissez votre mot de passe.',
      cpErrorCodeRequired: 'Saisissez le code à 6 chiffres.',

      // Keycloak's own keys, reworded
      doLogIn: 'Se connecter',
      doSubmit: 'Continuer',
      doCancel: 'Annuler',
      backToLogin: 'Retour à la connexion',
      emailForgotTitle: 'Réinitialisez votre mot de passe',
      doForgotPassword: 'Mot de passe oublié ?',
      invalidUserMessage: 'Cette adresse e-mail et ce mot de passe ne correspondent pas. Vérifiez-les et réessayez.',
      invalidUsernameOrPasswordMessage: 'Cette adresse e-mail et ce mot de passe ne correspondent pas. Vérifiez-les et réessayez.',
      invalidPasswordMessage: 'Cette adresse e-mail et ce mot de passe ne correspondent pas. Vérifiez-les et réessayez.',
      accountTemporarilyDisabledMessage:
        'Trop de tentatives : votre compte est bloqué pour le moment. Réessayez plus tard, ou réinitialisez votre mot de passe.',
      invalidTotpMessage: 'Ce code ne fonctionne pas. Les codes changent toutes les 30 secondes : utilisez le plus récent.',
      missingTotpMessage: 'Saisissez le code à 6 chiffres.',
      missingPasswordMessage: 'Saisissez votre mot de passe.',
      missingUsernameMessage: 'Saisissez votre adresse e-mail professionnelle.',
      notMatchPasswordMessage: 'Ces deux mots de passe sont différents. Saisissez-les à nouveau.',
      invalidPasswordMinLengthMessage: 'Votre mot de passe doit contenir au moins {0} caractères.',
      emailInstruction:
        'Saisissez votre adresse e-mail professionnelle et nous vous enverrons un lien pour choisir un nouveau mot de passe.',
      emailSentMessage:
        'Si cette adresse correspond à un compte CPeople, un lien pour choisir un nouveau mot de passe est en route.',
      expiredActionTokenNoSessionMessage: 'Ce lien a expiré.',
      expiredActionTokenSessionExistsMessage: 'Ce lien a expiré.',
      pageExpiredTitle: 'Cette page a expiré',
      updatePasswordTitle: 'Choisissez un nouveau mot de passe',
    },
  })
  .build();

type I18n = typeof _ofTypeI18n;

export { useI18n, type I18n };
