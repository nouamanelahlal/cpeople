import type { JSX } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { SignInLayout } from '../components/SignInLayout';
import { MailIcon } from '../components/Icons';

/**
 * Keycloak's "we have told you something" page. In this flow it is almost always
 * the one after asking for a reset link, so it reads as "check your inbox" rather
 * than as a generic notice.
 */
export default function Info(
  props: { kcContext: Extract<KcContext, { pageId: 'info.ftl' }>; i18n: I18n },
): JSX.Element {
  const { kcContext, i18n } = props;
  const { url, message, actionUri, pageRedirectUri } = kcContext;
  const { msgStr } = i18n;

  const isResetEmail = /e-?mail|courriel|boîte/i.test(message.summary);
  const backHref = pageRedirectUri ?? actionUri ?? url.loginUrl;

  return (
    <SignInLayout
      kcContext={kcContext}
      i18n={i18n}
      badge={<MailIcon />}
      headline={isResetEmail ? msgStr('cpSentTitle') : msgStr('cpErrorGenericTitle')}
      subhead={isResetEmail ? msgStr('cpSentBody', expiry(kcContext)) : message.summary}
      back={{ href: url.loginUrl, label: msgStr('cpBackToSignIn') }}
      footnote={isResetEmail ? msgStr('cpSentHelp') : undefined}
    >
      {!isResetEmail && backHref !== undefined && (
        <a className="cp-button cp-button--primary" href={backHref}>
          {msgStr('cpBackToSignIn')}
        </a>
      )}
    </SignInLayout>
  );
}

/**
 * How long the link lasts, in the words Keycloak already uses for it, so the page
 * never promises a window the realm does not actually give.
 */
function expiry(kcContext: Extract<KcContext, { pageId: 'info.ftl' }>): string {
  const match = /\b(\d+)\s*(minutes?|hours?|minutes?|heures?)\b/i.exec(kcContext.message.summary);
  return match ? `${match[1]} ${match[2]}` : '30 min';
}
