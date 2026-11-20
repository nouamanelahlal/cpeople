import { getMessages } from '@cpeople/shared';
import { getSession } from '../../lib/auth';
import { format } from '../../lib/locale';
import { LocaleSync } from './locale-sync';

/**
 * The first signed-in screen (M02). The real home dashboard is a later feature;
 * this shows who is signed in, which tenant their token places them in, and what
 * they may do, which is exactly what sign-in has to prove.
 */
export default async function SignedInHome() {
  // The middleware already turned anonymous visitors away; this is the page's own
  // guard, so it cannot be reached unauthenticated if the matcher ever changes.
  const session = await getSession();
  if (!session) {
    return null;
  }

  const user = session;
  // Keycloak is where the language was chosen, so it wins from here on.
  const t = getMessages(user.locale);
  const roles = user.roles.filter((role) => !role.startsWith('default-roles') && role !== 'offline_access' && role !== 'uma_authorization');

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <LocaleSync locale={user.locale} />

      <section className="w-full max-w-xl rounded-2xl border border-card-border bg-white p-8 sm:p-12">
        <h1 className="text-3xl font-light text-navy sm:text-4xl">
          {format(t.home.greeting, { name: user.name ?? '' })}
        </h1>

        <p className="mt-4 text-sm text-body">
          {format(t.home.signedInAs, { email: user.email ?? '' })}
        </p>

        <dl className="mt-8 grid gap-4 text-sm">
          <div className="flex items-baseline justify-between gap-4 border-b border-card-border pb-3">
            <dt className="font-semibold text-navy">{t.home.tenant}</dt>
            <dd className="num text-body">{user.organization ?? '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-semibold text-navy">{t.home.roles}</dt>
            <dd className="flex flex-wrap justify-end gap-2">
              {roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-cyan px-3 py-1 text-xs font-semibold text-navy"
                >
                  {role}
                </span>
              ))}
            </dd>
          </div>
        </dl>

        <form action="/api/auth/sign-out" method="post" className="mt-10">
          <button
            type="submit"
            className="rounded-xl border border-card-border px-6 py-3 text-sm font-semibold text-navy transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out hover:border-blue hover:bg-tint motion-safe:hover:-translate-y-px"
          >
            {t.home.signOut}
          </button>
        </form>
      </section>
    </main>
  );
}
