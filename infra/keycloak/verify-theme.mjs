// Deploy check: is this Keycloak actually serving the CPeople sign-in pages?
//
// Keycloak falls back to its own pages when a theme is missing — no error, no log
// line worth noticing, just an unbranded sign-in screen. That is tolerable on a
// laptop and not in Dev, Test or Prod, so this fails the deploy instead.
//
// Usage:  node infra/keycloak/verify-theme.mjs [issuer]
//   e.g.  node infra/keycloak/verify-theme.mjs https://id.cpeople.ma/realms/cpeople

const issuer = (
  process.argv[2] ??
  process.env.KEYCLOAK_ISSUER ??
  'http://localhost:8080/realms/cpeople'
).replace(/\/$/, '');
const clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'cpeople-web';

function fail(message) {
  console.error(`verify-theme: ${message}`);
  // exitCode rather than exit(): the process still has a finished fetch to unwind.
  process.exitCode = 1;
}

const authUrl =
  `${issuer}/protocol/openid-connect/auth` +
  `?client_id=${encodeURIComponent(clientId)}&response_type=code&scope=openid` +
  `&redirect_uri=${encodeURIComponent('http://localhost:3000/api/auth/callback')}` +
  '&state=verify-theme' +
  '&code_challenge=0PJEjl-DC4_fpLRsFZZcIHyCoFbqcHPWM7FQNRTbFLc&code_challenge_method=S256';

let html;

try {
  const response = await fetch(authUrl, { redirect: 'follow' });
  if (!response.ok) {
    fail(`the sign-in page answered ${response.status}. Is the realm imported?`);
  } else {
    html = await response.text();
  }
} catch (error) {
  fail(`could not reach ${issuer}: ${error.message}`);
}

if (html !== undefined) {
  // The theme's resources come from a path that names it, and Keycloakify writes the
  // theme name into the page. Either one missing means Keycloak fell back to its own
  // pages. Slashes may be JSON-escaped, hence the optional backslash.
  const servesThemeResources = /login\\?\/cpeople/.test(html);
  const namesTheme = /themeName\s*=\s*"cpeople"/.test(html);

  if (servesThemeResources && namesTheme) {
    console.log(`verify-theme: ${issuer} is serving the CPeople sign-in theme`);
  } else {
    fail(
      'this Keycloak is not serving the CPeople sign-in theme — it has fallen back to ' +
        'the stock pages.\n' +
        '  Build it and put it in the image:  pnpm kc:theme && pnpm kc:image\n' +
        `  Checked: ${authUrl}`,
    );
  }
}
