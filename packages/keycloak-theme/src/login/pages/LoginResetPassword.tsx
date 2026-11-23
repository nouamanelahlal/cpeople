import type { JSX } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { SignInLayout } from '../components/SignInLayout';
import { KeyIcon } from '../components/Icons';
import { PageMessage } from './PageMessage';

/** Asking for a reset link. */
export default function LoginResetPassword(
  props: { kcContext: Extract<KcContext, { pageId: 'login-reset-password.ftl' }>; i18n: I18n },
): JSX.Element {
  const { kcContext, i18n } = props;
  const { url, auth, messagesPerField } = kcContext;
  const { msgStr } = i18n;

  return (
    <SignInLayout
      kcContext={kcContext}
      i18n={i18n}
      badge={<KeyIcon />}
      headline={msgStr('cpResetTitle')}
      subhead={msgStr('cpResetSubtitle')}
      back={{ href: url.loginUrl, label: msgStr('cpBackToSignIn') }}
    >
      <PageMessage kcContext={kcContext} field="username" />

      <form className="cp-fields" action={url.loginAction} method="post">
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
          defaultValue={auth?.attemptedUsername ?? ''}
          aria-invalid={messagesPerField.existsError('username')}
          autoFocus
        />

        <button className="cp-button cp-button--primary" type="submit">
          {msgStr('cpResetSubmit')}
        </button>
      </form>
    </SignInLayout>
  );
}
