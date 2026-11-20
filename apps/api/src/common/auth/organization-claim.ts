/**
 * Reading the tenant out of Keycloak's `organization` claim.
 *
 * One organisation in Keycloak is one tenant in CPeople, and the organisation
 * carries the tenant's database id as an attribute. The token is the only place the
 * API will take a tenant from (M02 / HR-08): a request cannot name its own tenant.
 *
 * With `multivalued`, `addOrganizationAttributes` and `addOrganizationId` on the
 * membership mapper, Keycloak emits:
 *
 *   "organization": ["smg-demo", { "smg-demo": { "tenantId": ["0193…"], "id": "…" } }]
 *
 * — the aliases, then one object keyed by alias. Parsing is deliberately strict:
 * anything unexpected is refused rather than guessed at.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TokenOrganization {
  /** The tenant's id in Postgres, which the row-level-security policies match on. */
  readonly tenantId: string;
  /** The organisation alias, for logs and support ("smg-demo"). */
  readonly alias: string;
}

export class OrganizationClaimError extends Error {}

function attributeValue(details: Record<string, unknown>, key: string): string | undefined {
  const raw = details[key];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw.length === 1 && typeof raw[0] === 'string') return raw[0];
  return undefined;
}

/**
 * The single tenant this token belongs to.
 *
 * Throws when the token names no organisation, more than one, or one without a
 * usable tenant id — all of which mean the user's access cannot be scoped, and
 * serving the request would be worse than failing it.
 */
export function tenantFromOrganizationClaim(claim: unknown): TokenOrganization {
  if (claim === undefined || claim === null) {
    throw new OrganizationClaimError(
      'The token carries no organization claim, so there is no tenant to work in. ' +
        'Check that the cpeople-web client requests the organization scope.',
    );
  }

  const entries = Array.isArray(claim) ? claim : [claim];
  const detailsByAlias = new Map<string, Record<string, unknown>>();

  for (const entry of entries) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      for (const [alias, details] of Object.entries(entry as Record<string, unknown>)) {
        if (details && typeof details === 'object' && !Array.isArray(details)) {
          detailsByAlias.set(alias, details as Record<string, unknown>);
        }
      }
    }
  }

  if (detailsByAlias.size === 0) {
    throw new OrganizationClaimError(
      'The organization claim carries no organisation details. The membership mapper ' +
        'needs addOrganizationAttributes so the tenant id travels with it.',
    );
  }

  if (detailsByAlias.size > 1) {
    // One person, one tenant. Someone who works for two clients gets two accounts,
    // so a token can never be ambiguous about whose payroll is being touched.
    throw new OrganizationClaimError(
      `The token names ${detailsByAlias.size} organisations (${[...detailsByAlias.keys()].join(', ')}); ` +
        'a CPeople user belongs to exactly one tenant.',
    );
  }

  const [alias, details] = [...detailsByAlias.entries()][0]!;
  const tenantId = attributeValue(details, 'tenantId');

  if (!tenantId) {
    throw new OrganizationClaimError(
      `Organisation "${alias}" has no tenantId attribute. Set it on the organisation in ` +
        'infra/keycloak/import/cpeople-realm.json to match the tenant row in Postgres.',
    );
  }

  if (!UUID.test(tenantId)) {
    throw new OrganizationClaimError(
      `Organisation "${alias}" has a tenantId that is not a UUID.`,
    );
  }

  return { tenantId, alias };
}
