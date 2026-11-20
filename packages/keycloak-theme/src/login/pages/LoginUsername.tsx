import type { JSX } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { Alert, SignInLayout } from '../components/SignInLayout';
import { IdentityProviders } from '../components/IdentityProviders';
import { MailIcon, PersonIcon } from '../components/Icons';
import { PageMessage } from './PageMessage';

/** The first step: an address and nothing else (M02 / HR-08). */
export default function LoginUsername(
  props: { kcContext: Extract<KcContext, { pageId: 'login-username.ftl' }>; i18n: I18n },
): JSX.Element {
  const { kcContext, i18n } = props;
  const { url, login, messagesPerField, realm, social } = kcContext;
  const { msgStr } = i18n;

  const providers = (social?.providers ?? []).map((provider) => ({
    alias: provider.alias,
    displayName: provider.displayName,
    loginUrl: provider.loginUrl,
  }));

  // After asking for a reset link Keycloak comes back here with a success message
  // rather than a page of its own, so this is where "check your inbox" belongs.
  if (kcContext.message?.type === 'success') {
    return (
      <SignInLayout
        kcContext={kcContext}
        i18n={i18n}
        badge={<MailIcon />}
        headline={msgStr('cpSentTitle')}
        subhead={kcContext.message.summary}
        back={{ href: url.loginUrl, label: msgStr('cpBackToSignIn') }}
        footnote={msgStr('cpSentHelp')}
      >
        <></>
      </SignInLayout>
    );
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
      <PageMessage kcContext={kcContext} i18n={i18n} />

      {messagesPerField.existsError('username') && (
        <Alert kind="error">{messagesPerField.getFirstError('username')}</Alert>
      )}

      <form className="cp-fields" action={url.loginAction} method="post">
        <IdentityProviders i18n={i18n} providers={providers} />

        <label className="cp-visually-hidden" htmlFor="username">
          {msgStr('cpWorkEmail')}
        </label>
        <input
          className="cp-input"
          id="username"
          name="username"
          type="email"
          autoComplete="username"
          placeholder={msgStr('cpWorkEmail')}
          defaultValue={login.username ?? ''}
          aria-invalid={messagesPerField.existsError('username')}
          autoFocus
        />

        {realm.rememberMe && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" name="rememberMe" defaultChecked={!!login.rememberMe} />
            {i18n.msgStr('rememberMe')}
          </label>
        )}

        <button className="cp-button cp-button--primary" type="submit" name="login">
          {msgStr('cpContinue')}
        </button>
      </form>
    </SignInLayout>
  );
}
