import type { JSX } from 'react';
import type { I18n } from '../i18n';
import { GoogleLogo, MicrosoftLogo } from './Icons';

interface Provider {
  alias: string;
  displayName: string;
  loginUrl: string;
}

/**
 * The buttons appear only for identity providers the realm actually has enabled —
 * Keycloak sends none, and nothing is rendered.
 *
 * Each provider's mark is theirs: used unaltered, never recoloured, beside the
 * wording each of them sanctions ("Continue with ..."), on the neutral button both
 * of their custom-button rules allow.
 */
export function IdentityProviders(props: { i18n: I18n; providers: Provider[] }): JSX.Element | null {
  const { i18n, providers } = props;

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="cp-providers">
      {providers.map((provider) => (
        <a key={provider.alias} className="cp-button cp-button--light" href={provider.loginUrl}>
          <ProviderLogo alias={provider.alias} />
          {i18n.msgStr('cpContinueWith', provider.displayName)}
        </a>
      ))}
      <div className="cp-separator">{i18n.msgStr('cpOr')}</div>
    </div>
  );
}

function ProviderLogo(props: { alias: string }): JSX.Element | null {
  const alias = props.alias.toLowerCase();

  if (alias.includes('microsoft') || alias.includes('azure') || alias.includes('entra')) {
    return <MicrosoftLogo />;
  }
  if (alias.includes('google')) {
    return <GoogleLogo />;
  }
  return null;
}
