import type { ExtendKcContext } from 'keycloakify/login';
import type { KcEnvName, ThemeName } from '../kc.gen';

export type KcContextExtension = {
  themeName: ThemeName;
  /** The theme's own settings, read from the Keycloak container's environment. */
  properties: Record<KcEnvName, string>;
};

/**
 * No extra fields on any single page yet. Keycloakify's contract wants an empty
 * object here; `Record<string, never>` would narrow every page's context to never.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type KcContextExtensionPerPage = {};

export type KcContext = ExtendKcContext<KcContextExtension, KcContextExtensionPerPage>;
