import type { JSX } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { SignInLayout } from '../components/SignInLayout';
import { PasswordField } from '../components/PasswordField';
import { LockIcon } from '../components/Icons';
import { PageMessage } from './PageMessage';

/** Choosing a new password, after following the link from the e-mail. */
export default function LoginUpdatePassword(
  props: { kcContext: Extract<KcContext, { pageId: 'login-update-password.ftl' }>; i18n: I18n },
): JSX.Element {
  const { kcContext, i18n } = props;
  const { url, messagesPerField } = kcContext;
  const { msgStr } = i18n;

  return (
    <SignInLayout
      kcContext={kcContext}
      i18n={i18n}
      badge={<LockIcon />}
      headline={msgStr('cpNewPasswordTitle')}
      subhead={msgStr('cpNewPasswordSubtitle')}
    >
      <PageMessage kcContext={kcContext} i18n={i18n} />

      <form className="cp-fields" action={url.loginAction} method="post">
        <PasswordField
          i18n={i18n}
          id="password-new"
          name="password-new"
          placeholder={msgStr('cpNewPassword')}
          autoComplete="new-password"
          invalid={messagesPerField.existsError('password')}
          autoFocus
        />
        <PasswordField
          i18n={i18n}
          id="password-confirm"
          name="password-confirm"
          placeholder={msgStr('cpConfirmPassword')}
          autoComplete="new-password"
          invalid={messagesPerField.existsError('password-confirm')}
        />

        <button className="cp-button cp-button--primary" type="submit">
          {msgStr('cpNewPasswordSubmit')}
        </button>
      </form>
    </SignInLayout>
  );
}
