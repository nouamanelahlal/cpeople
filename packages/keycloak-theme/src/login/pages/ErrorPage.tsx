import type { JSX } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { SignInLayout } from '../components/SignInLayout';
import { ClockIcon, AlertIcon } from '../components/Icons';

/**
 * Errors that take over the page rather than sitting above a form: most often a
 * reset link that has been used already or has run out of time.
 */
export default function ErrorPage(
  props: {
    kcContext: Extract<KcContext, { pageId: 'error.ftl' | 'login-page-expired.ftl' }>;
    i18n: I18n;
  },
): JSX.Element {
  const { kcContext, i18n } = props;
  const { url } = kcContext;
  const { msgStr } = i18n;

  const summary = 'message' in kcContext ? (kcContext.message?.summary ?? '') : '';
  const expired = kcContext.pageId === 'login-page-expired.ftl' || /expir/i.test(summary);

  return (
    <SignInLayout
      kcContext={kcContext}
      i18n={i18n}
      badge={expired ? <ClockIcon /> : <AlertIcon />}
      headline={expired ? msgStr('cpErrorExpiredTitle') : msgStr('cpErrorGenericTitle')}
      subhead={expired ? msgStr('cpErrorExpiredBody') : summary}
    >
      <a className="cp-button cp-button--primary" href={url.loginRestartFlowUrl ?? url.loginUrl}>
        {expired ? msgStr('cpErrorExpiredAction') : msgStr('cpBackToSignIn')}
      </a>
    </SignInLayout>
  );
}
