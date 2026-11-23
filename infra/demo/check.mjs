// Is everything the workshop needs up and answering?
//
// One command, one line per thing, so a presenter can see at a glance whether to
// start the demo or call for help. It checks what has actually gone wrong on a
// morning: Docker asleep, a port taken by yesterday's server, the demo data not
// seeded, two-step sign-in still switched on.

const PROBES = [
  ['Sign-in (Keycloak)', 'http://localhost:8080/realms/cpeople'],
  ['Document service (Gotenberg)', 'http://localhost:3001/health'],
  ['File storage', 'http://localhost:9000/'],
  ['API', 'http://localhost:3100/api/health'],
  ['CPeople', 'http://localhost:3000/'],
];

let trouble = false;

for (const [name, url] of PROBES) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    // Any answer means the port is served: the file store answers a bare GET
    // with 403, which is still an answer.
    if (response.status >= 500) {
      console.log(`  DOWN  ${name}  (answered ${response.status})`);
      trouble = true;
    } else {
      console.log(`  ok    ${name}`);
    }
  } catch {
    console.log(`  DOWN  ${name}  (${url})`);
    trouble = true;
  }
}

// Whether anyone will be asked for an authenticator code today.
try {
  const token = await fetch('http://localhost:8080/realms/master/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'admin-cli',
      username: 'admin',
      password: 'admin_dev',
      grant_type: 'password',
    }),
    signal: AbortSignal.timeout(5000),
  });

  const { access_token: admin } = await token.json();

  const composites = await (
    await fetch('http://localhost:8080/admin/realms/cpeople/roles/hr-admin/composites', {
      headers: { Authorization: `Bearer ${admin}` },
    })
  ).json();

  if (composites.some((role) => role.name === 'mfa-required')) {
    console.log('  TODO  Two-step sign-in is ON: Salma and Amina will be asked for a code.');
    console.log('        Run:  pnpm demo:prepare');
    trouble = true;
  } else {
    console.log('  ok    Two-step sign-in is off for the workshop');
  }
} catch {
  console.log('  ?     Could not check whether two-step sign-in is on');
}

console.log(
  trouble
    ? '\nSomething needs attention. See "If something goes wrong" in docs/demo/HR-01-presenter-guide.md'
    : '\nEverything the workshop needs is up.',
);

process.exit(trouble ? 1 : 0);
