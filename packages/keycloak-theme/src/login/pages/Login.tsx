import { useRef, useState, type FormEvent, type JSX } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { Alert, SignInLayout } from '../components/SignInLayout';
import { IdentityProviders } from '../components/IdentityProviders';
import { PasswordField } from '../components/PasswordField';
import { PersonIcon } from '../components/Icons';
import { PageMessage } from './PageMessage';

/**
 * Sign-in: email, then password (M02 / HR-08).
 *
 * Two steps to look at, one submission to Keycloak. The email step is this page
 * asking a question — it sends nothing — and both fields go up together when the
 * password is submitted.
 *
 * That is what keeps the pages from saying whether an account exists. An
 * identifier-first flow has to answer the first step somehow, and whatever it
 * answers tells an attacker which addresses are real. Here there is nothing to
 * answer: an unknown address and a real one travel exactly the same path and meet
 * exactly the same message, because Keycloak sees them at the same moment it sees
 * a wrong password.
 *
 * Brute-force protection is unaffected — Keycloak counts the failed submission as
 * it always did — and the authenticator-code step still follows for the roles that
 * require it.
 */
export default function Login(
  props: { kcContext: Extract<KcContext, { pageId: 'login.ftl' }>; i18n: I18n },
): JSX.Element {
  const { kcContext, i18n } = props;
  const { url, realm, login, social, messagesPerField } = kcContext;
  const { msgStr } = i18n;

  const attemptedEmail = login.username ?? '';
  const somethingWentWrong =
    kcContext.message !== undefined || messagesPerField.existsError('username', 'password');

  // Coming back from a failed attempt, the person is on the password step: that is
  // where the message belongs and where they were when it happened.
  const [step, setStep] = useState<'email' | 'password'>(
    somethingWentWrong && attemptedEmail !== '' ? 'password' : 'email',
  );
  const [email, setEmail] = useState(attemptedEmail);
  const [emailProblem, setEmailProblem] = useState<string>();

  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const providers = (social?.providers ?? []).map((provider) => ({
    alias: provider.alias,
    displayName: provider.displayName,
    loginUrl: provider.loginUrl,
  }));

  function goToPassword(): void {
    const trimmed = email.trim();

    // Checked here only to save a pointless round trip. It says nothing about
    // whether the address belongs to anyone: this page could not know that.
    if (trimmed === '') {
      setEmailProblem(msgStr('cpErrorEmailRequired'));
      emailRef.current?.focus();
      return;
    }
    if (!trimmed.includes('@')) {
      setEmailProblem(msgStr('invalidEmailMessage'));
      emailRef.current?.focus();
      return;
    }

    setEmailProblem(undefined);
    setStep('password');
    // The field is revealed in the same tick, so focus it after the paint.
    requestAnimationFrame(() => passwordRef.current?.focus());
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    if (step === 'email') {
      // The email step is this page's own: it reveals the password field and sends
      // nothing. Keycloak hears about the address only when the password joins it.
      event.preventDefault();
      goToPassword();
      return;
    }

    // Nothing to submit without a password, and an empty attempt would spend one
    // of the tries the account is allowed before it locks.
    if ((passwordRef.current?.value ?? '') === '') {
      event.preventDefault();
      passwordRef.current?.focus();
    }
  }

  return (
    <SignInLayout
      kcContext={kcContext}
      i18n={i18n}
      badge={<PersonIcon />}
      headline={msgStr('cpWelcomeTitle')}
      subhead={msgStr('cpWelcomeSubtitle')}
      footnote={
        <>
          {msgStr('cpNoAccount')}
          <br />
          {msgStr('cpPrivacyNotice', msgStr('cpPrivacyPolicy'))}
        </>
      }
    >
      <PageMessage kcContext={kcContext} i18n={i18n} field="password" />

      {emailProblem !== undefined && <Alert kind="error">{emailProblem}</Alert>}

      <form className="cp-fields" action={url.loginAction} method="post" onSubmit={onSubmit}>
        {step === 'email' && <IdentityProviders i18n={i18n} providers={providers} />}

        {/* Always in the form, so one submission carries both. */}
        <div hidden={step !== 'email'}>
          <label className="cp-visually-hidden" htmlFor="username">
            {msgStr('cpWorkEmail')}
          </label>
          <input
            ref={emailRef}
            className="cp-input"
            id="username"
            name="username"
            type="email"
            autoComplete="username"
            placeholder={msgStr('cpWorkEmail')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailProblem !== undefined}
            autoFocus={step === 'email'}
          />
        </div>

        {step === 'password' && (
          <div className="cp-identity">
            <span>{email}</span>
            <button type="button" onClick={() => setStep('email')}>
              {msgStr('cpChangeEmail')}
            </button>
          </div>
        )}

        <div hidden={step !== 'password'}>
          <PasswordField
            ref={passwordRef}
            i18n={i18n}
            id="password"
            name="password"
            placeholder={msgStr('password')}
            autoComplete="current-password"
            invalid={messagesPerField.existsError('password')}
          />
        </div>

        {step === 'password' && realm.resetPasswordAllowed && (
          <a className="cp-forgot" href={url.loginResetCredentialsUrl}>
            {msgStr('doForgotPassword')}
          </a>
        )}

        {/* One button, always a submit button, whose label changes with the step.
            It must never *become* one: React reuses the element, so a button that
            turns into a submit button inside its own click handler is submitted by
            the browser on that very click — the default action reads the type after
            the handler has run. The email step is stopped in onSubmit instead,
            which also makes Enter behave the same way as the button. */}
        <button className="cp-button cp-button--primary" type="submit" name="login">
          {step === 'email' ? msgStr('cpContinue') : msgStr('doLogIn')}
        </button>
      </form>
    </SignInLayout>
  );
}
