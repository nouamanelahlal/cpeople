import type { JSX } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { SignInLayout } from '../components/SignInLayout';
import { PasswordField } from '../components/PasswordField';
import { PersonIcon } from '../components/Icons';
import { PageMessage } from './PageMessage';

/** The second step. The address is shown, with a way back to change it. */
export default function LoginPassword(
  props: { kcContext: Extract<KcContext, { pageId: 'login-password.ftl' }>; i18n: I18n },
): JSX.Element {
  const { kcContext, i18n } = props;
  const { url, realm, auth, messagesPerField } = kcContext;
  const { msgStr } = i18n;

  const signingInAs = auth?.attemptedUsername;

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
      <PageMessage kcContext={kcContext} i18n={i18n} />

      {signingInAs !== undefined && (
        <div className="cp-identity">
          <span>{signingInAs}</span>
          <a href={url.loginRestartFlowUrl}>{msgStr('cpChangeEmail')}</a>
        </div>
      )}

      <form className="cp-fields" action={url.loginAction} method="post">
        <PasswordField
          i18n={i18n}
          id="password"
          name="password"
          placeholder={msgStr('password')}
          autoComplete="current-password"
          invalid={messagesPerField.existsError('password')}
          autoFocus
        />

        {realm.resetPasswordAllowed && (
          <a className="cp-forgot" href={url.loginResetCredentialsUrl}>
            {msgStr('doForgotPassword')}
          </a>
        )}

        <button className="cp-button cp-button--primary" type="submit" name="login">
          {msgStr('doLogIn')}
        </button>
      </form>
    </SignInLayout>
  );
}
