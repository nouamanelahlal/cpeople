// Puts the fake local users into their organisations.
//
// Organisations are structural — one per tenant, carrying the tenant id — so they
// live in the base realm that every environment imports. Who belongs to one is
// environment data, and for a local checkout that means the fake users in
// ../import-local-dev. Realm import cannot express it: the organisations are read
// before the user file is, so a `members` list there refers to users that do not
// exist yet.
//
// No mapping to maintain: a user belongs to the organisation whose domain matches
// the domain of their e-mail address, which is how both files already read.
//
// Local development and CI only. Deployed environments provision their own people.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const KEYCLOAK_URL = process.env.KEYCLOAK_URL?.trim() || 'http://localhost:8080';
const REALM = 'cpeople';

if (process.env.CPEOPLE_LOCAL_DEV !== 'true') {
  console.error(
    'join-organisations: refusing to run without CPEOPLE_LOCAL_DEV=true.\n' +
      'Deployed environments decide their own organisation membership.',
  );
  process.exit(1);
}

const realm = JSON.parse(readFileSync(resolve(here, '../import/cpeople-realm.json'), 'utf8'));
const { users } = JSON.parse(
  readFileSync(resolve(here, '../import-local-dev/cpeople-users-0.json'), 'utf8'),
);

async function adminToken() {
  const response = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'admin-cli',
      username: process.env.KEYCLOAK_ADMIN?.trim() || 'admin',
      password: process.env.KEYCLOAK_ADMIN_PASSWORD?.trim() || 'admin_dev',
      grant_type: 'password',
    }),
  });
  if (!response.ok) {
    throw new Error(`Could not sign in to Keycloak (${response.status}). Is the stack up?`);
  }
  return (await response.json()).access_token;
}

const token = await adminToken();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const organisations = await (
  await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/organizations`, { headers })
).json();

const byDomain = new Map();
for (const organisation of organisations) {
  const declared = realm.organizations.find((o) => o.alias === organisation.alias);
  for (const domain of declared?.domains ?? []) {
    byDomain.set(domain.name.toLowerCase(), organisation);
  }
}

let joined = 0;
let alreadyIn = 0;

for (const user of users) {
  const domain = user.email.split('@')[1]?.toLowerCase();
  const organisation = byDomain.get(domain);
  if (!organisation) {
    console.warn(`join-organisations: no organisation claims the domain "${domain}", skipping ${user.email}`);
    continue;
  }

  const [found] = await (
    await fetch(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${encodeURIComponent(user.username)}&exact=true`,
      { headers },
    )
  ).json();

  if (!found) {
    console.warn(`join-organisations: ${user.username} is not in the realm, skipping`);
    continue;
  }

  const response = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/organizations/${organisation.id}/members`,
    { method: 'POST', headers, body: JSON.stringify(found.id) },
  );

  if (response.status === 201) {
    joined += 1;
  } else if (response.status === 409) {
    // Already a member: this script is meant to be run again and again.
    alreadyIn += 1;
  } else {
    throw new Error(
      `Could not add ${user.username} to ${organisation.alias}: ${response.status} ${await response.text()}`,
    );
  }
}

console.log(
  `join-organisations: ${joined} added, ${alreadyIn} already there, across ${organisations.length} organisations`,
);
