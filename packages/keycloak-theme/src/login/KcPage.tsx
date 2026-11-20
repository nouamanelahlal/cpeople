import { Suspense, lazy, type JSX } from 'react';
import type { ClassKey } from 'keycloakify/login';
import type { KcContext } from './KcContext';
import { useI18n } from './i18n';
import './theme.css';

const DefaultPage = lazy(() => import('keycloakify/login/DefaultPage'));
const UserProfileFormFields = lazy(
  () => import('keycloakify/login/UserProfileFormFields'),
);

const LoginUsername = lazy(() => import('./pages/LoginUsername'));
const LoginPassword = lazy(() => import('./pages/LoginPassword'));
const LoginOtp = lazy(() => import('./pages/LoginOtp'));
const LoginResetPassword = lazy(() => import('./pages/LoginResetPassword'));
const LoginUpdatePassword = lazy(() => import('./pages/LoginUpdatePassword'));
const Info = lazy(() => import('./pages/Info'));
const ErrorPage = lazy(() => import('./pages/ErrorPage'));

const doMakeUserConfirmPassword = true;

/**
 * Which component renders which Keycloak page.
 *
 * The pages of the CPeople sign-in flow are ours (M02 / HR-08, designs in
 * docs/design/login*.dc.html). Anything else a realm might reach — consent screens,
 * WebAuthn, account linking — falls through to Keycloakify's default page, so no
 * route is ever a blank screen.
 */
export default function KcPage(props: { kcContext: KcContext }): JSX.Element {
  const { kcContext } = props;
  const { i18n } = useI18n({ kcContext });

  return (
    <Suspense>
      {(() => {
        switch (kcContext.pageId) {
          case 'login-username.ftl':
            return <LoginUsername kcContext={kcContext} i18n={i18n} />;
          case 'login-password.ftl':
            return <LoginPassword kcContext={kcContext} i18n={i18n} />;
          case 'login-otp.ftl':
            return <LoginOtp kcContext={kcContext} i18n={i18n} />;
          case 'login-reset-password.ftl':
            return <LoginResetPassword kcContext={kcContext} i18n={i18n} />;
          case 'login-update-password.ftl':
            return <LoginUpdatePassword kcContext={kcContext} i18n={i18n} />;
          case 'info.ftl':
            return <Info kcContext={kcContext} i18n={i18n} />;
          case 'error.ftl':
          case 'login-page-expired.ftl':
            return <ErrorPage kcContext={kcContext} i18n={i18n} />;
          default:
            return (
              <DefaultPage
                kcContext={kcContext}
                i18n={i18n}
                classes={classes}
                Template={lazy(() => import('keycloakify/login/Template'))}
                doUseDefaultCss={true}
                UserProfileFormFields={UserProfileFormFields}
                doMakeUserConfirmPassword={doMakeUserConfirmPassword}
              />
            );
        }
      })()}
    </Suspense>
  );
}

const classes = {} satisfies { [key in ClassKey]?: string };
