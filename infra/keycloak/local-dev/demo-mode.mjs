// Puts the local realm into demo mode, and takes it back out again.
//
// Two things a workshop needs that normal development does not:
//
//  1. **No authenticator codes.** `mfa-required` is composed into the senior
//     roles, so Salma (HR) and Amina (Admin) are asked for a six-digit code. In
//     front of a client, with four browser windows, that is four phones and a
//     stopwatch. Demo mode takes the composite off those roles; `restore` puts it
//     back, and the sign-in flow itself is untouched either way — the step still
//     exists and still runs for anyone holding the role.
//
//  2. **Sessions that outlast the meeting.** The realm forgets an idle session
//     after thirty minutes, which is right for a working day and wrong for a
//     window left open while somebody else's screen is being shown.
//
// Nothing here changes a file. It changes the state of the realm running on this
// machine, and it refuses to run against anything that is not local: a deployed
// environment must never have its MFA switched off by a script.
//
//   node infra/keycloak/local-dev/demo-mode.mjs prepare   # before the workshop
//   node infra/keycloak/local-dev/demo-mode.mjs restore   # afterwards

const KEYCLOAK_URL = process.env.KEYCLOAK_URL?.trim() || 'http://localhost:8080';
const REALM = 'cpeople';

/** The roles the base realm composes `mfa-required` into (infra/keycloak/import). */
const MFA_ROLES = ['platform-admin', 'hr-admin', 'payroll-manager'];

/** Thirty minutes normally; four hours while a workshop is running. */
const IDLE_NORMAL = 1800;
const IDLE_DEMO = 4 * 60 * 60;

const what = process.argv[2];

if (what !== 'prepare' && what !== 'restore') {
  console.error('demo-mode: say which — "prepare" before the workshop, "restore" afterwards.');
  process.exit(1);
}

if (process.env.CPEOPLE_LOCAL_DEV !== 'true') {
  console.error(
    'demo-mode: refusing to run without CPEOPLE_LOCAL_DEV=true.\n' +
      'Switching two-step sign-in off is a thing you do to a laptop, never to an environment.',
  );
  process.exit(1);
}

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(KEYCLOAK_URL)) {
  console.error(
    `demo-mode: refusing to touch ${KEYCLOAK_URL}. This script is for the Keycloak on this machine.`,
  );
  process.exit(1);
}

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

async function json(path, init) {
  const response = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}${path}`, {
    headers,
    ...init,
  });

  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${response.status} ${await response.text()}`);
  }

  return response.status === 204 ? null : response.json();
}

const mfa = await json('/roles/mfa-required');
let changed = 0;

for (const name of MFA_ROLES) {
  const composites = await json(`/roles/${name}/composites`);
  const holds = composites.some((role) => role.name === 'mfa-required');

  if (what === 'prepare' && holds) {
    await json(`/roles/${name}/composites`, {
      method: 'DELETE',
      body: JSON.stringify([mfa]),
    });
    changed += 1;
  }

  if (what === 'restore' && !holds) {
    await json(`/roles/${name}/composites`, {
      method: 'POST',
      body: JSON.stringify([mfa]),
    });
    changed += 1;
  }
}

// The realm's own settings are a whole object: read it, change the one field,
// put it back.
const realm = await json('');
const idle = what === 'prepare' ? IDLE_DEMO : IDLE_NORMAL;

if (realm.ssoSessionIdleTimeout !== idle) {
  await json('', { method: 'PUT', body: JSON.stringify({ ...realm, ssoSessionIdleTimeout: idle }) });
}

if (what === 'prepare') {
  console.log(
    `demo-mode: two-step sign-in is OFF for ${MFA_ROLES.join(', ')} (${changed} role(s) changed).\n` +
      `demo-mode: idle sessions now last ${idle / 3600} hours, so no window signs out mid-meeting.\n` +
      'demo-mode: put it back afterwards with  pnpm demo:restore',
  );
} else {
  console.log(
    `demo-mode: two-step sign-in is back ON for ${MFA_ROLES.join(', ')} (${changed} role(s) changed).\n` +
      `demo-mode: idle sessions are back to ${idle / 60} minutes.`,
  );
}
