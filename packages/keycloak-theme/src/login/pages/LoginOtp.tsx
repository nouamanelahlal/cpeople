import type { JSX } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { SignInLayout } from '../components/SignInLayout';
import { LockIcon } from '../components/Icons';
import { PageMessage } from './PageMessage';

/** The authenticator code, asked only of the roles that handle pay (M02). */
export default function LoginOtp(
  props: { kcContext: Extract<KcContext, { pageId: 'login-otp.ftl' }>; i18n: I18n },
): JSX.Element {
  const { kcContext, i18n } = props;
  const { url, messagesPerField } = kcContext;
  const { msgStr } = i18n;

  return (
    <SignInLayout
      kcContext={kcContext}
      i18n={i18n}
      badge={<LockIcon />}
      headline={msgStr('cpCodeTitle')}
      subhead={msgStr('cpCodeSubtitle')}
      back={{ href: url.loginRestartFlowUrl, label: msgStr('cpBack') }}
      footnote={msgStr('cpCodeHelp')}
    >
      <PageMessage kcContext={kcContext} field="totp" />

      <form className="cp-fields" action={url.loginAction} method="post">
        <label className="cp-visually-hidden" htmlFor="otp">
          {msgStr('cpCodePlaceholder')}
        </label>
        <input
          className="cp-input cp-code"
          id="otp"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder={msgStr('cpCodePlaceholder')}
          aria-invalid={messagesPerField.existsError('totp')}
          autoFocus
        />

        <button className="cp-button cp-button--primary" type="submit">
          {msgStr('cpCodeSubmit')}
        </button>
      </form>
    </SignInLayout>
  );
}
