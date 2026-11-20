import { describe, expect, it } from 'vitest';
import {
  OrganizationClaimError,
  tenantFromOrganizationClaim,
} from '../src/common/auth/organization-claim.js';
import { loadAppConfig } from '../src/common/config/app-config.js';

const TENANT_ID = '0193c0de-0000-7000-8000-000000000001';

/** The claim Keycloak actually emits, captured from the running realm. */
const keycloakClaim = [
  'smg-demo',
  { 'smg-demo': { tenantId: [TENANT_ID], id: 'f5259988-f309-43a3-8c1c-976460002ed0' } },
];

describe('M02 the tenant comes from the organisation claim', () => {
  it('reads the tenant id Keycloak puts in the token', () => {
    expect(tenantFromOrganizationClaim(keycloakClaim)).toEqual({
      tenantId: TENANT_ID,
      alias: 'smg-demo',
    });
  });

  it('accepts a single-valued attribute as well as a list', () => {
    expect(
      tenantFromOrganizationClaim([{ 'smg-demo': { tenantId: TENANT_ID } }]).tenantId,
    ).toBe(TENANT_ID);
  });

  it('refuses a token with no organisation', () => {
    expect(() => tenantFromOrganizationClaim(undefined)).toThrow(OrganizationClaimError);
    expect(() => tenantFromOrganizationClaim(null)).toThrow(/no organization claim/i);
    expect(() => tenantFromOrganizationClaim([])).toThrow(/no organisation details/i);
  });

  it('refuses an organisation with no tenant id', () => {
    // The mapper was configured without addOrganizationAttributes.
    expect(() => tenantFromOrganizationClaim(['smg-demo'])).toThrow(/no organisation details/i);
    expect(() => tenantFromOrganizationClaim([{ 'smg-demo': { id: 'abc' } }])).toThrow(
      /no tenantId attribute/i,
    );
  });

  it('refuses a tenant id that is not a UUID', () => {
    expect(() =>
      tenantFromOrganizationClaim([{ 'smg-demo': { tenantId: ["' OR 1=1 --"] } }]),
    ).toThrow(/not a UUID/i);
  });

  it('refuses a token naming more than one organisation', () => {
    // A user belongs to exactly one tenant, so an ambiguous token is a failure and
    // never a guess about whose payroll is being opened.
    expect(() =>
      tenantFromOrganizationClaim([
        'smg-demo',
        'atlas-demo',
        { 'smg-demo': { tenantId: [TENANT_ID] } },
        { 'atlas-demo': { tenantId: ['0193c0de-0000-7000-8000-000000000002'] } },
      ]),
    ).toThrow(/belongs to exactly one tenant/i);
  });

  it('ignores anything else in the claim', () => {
    expect(
      tenantFromOrganizationClaim(['smg-demo', 42, null, { 'smg-demo': { tenantId: [TENANT_ID] } }])
        .alias,
    ).toBe('smg-demo');
  });
});

describe('M02 the realm must be configured before the API starts', () => {
  const deployed = { DATABASE_URL: 'postgresql://user:pw@db.internal:5432/cpeople' };

  it('refuses to start in a deployed environment with no issuer', () => {
    expect(() => loadAppConfig(deployed)).toThrow(/KEYCLOAK_ISSUER is not set/);
  });

  it('refuses an issuer that is not https outside local development', () => {
    // Tokens and the keys that verify them must not travel in the clear.
    expect(() =>
      loadAppConfig({ ...deployed, KEYCLOAK_ISSUER: 'http://id.cpeople.ma/realms/cpeople' }),
    ).toThrow(/must be an https URL/i);
  });

  it('falls back to the local realm in a local checkout', () => {
    const config = loadAppConfig({ CPEOPLE_LOCAL_DEV: 'true' });

    expect(config.keycloakIssuer).toBe('http://localhost:8080/realms/cpeople');
    expect(config.keycloakAudience).toBe('cpeople-api');
  });

  it('trims a trailing slash, so the issuer matches the token exactly', () => {
    const config = loadAppConfig({
      ...deployed,
      KEYCLOAK_ISSUER: 'https://id.cpeople.ma/realms/cpeople/',
    });

    expect(config.keycloakIssuer).toBe('https://id.cpeople.ma/realms/cpeople');
  });
});
