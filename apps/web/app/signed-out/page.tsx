import { currentMessages } from '../../lib/locale';
import { startSignIn } from '../actions';

export default async function SignedOutPage() {
  const { t } = await currentMessages();

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-card-border bg-white p-8 text-center sm:p-12">
        <h1 className="text-3xl font-light text-navy sm:text-4xl">{t.signedOut.title}</h1>
        <p className="mt-4 text-sm text-body">{t.signedOut.body}</p>

        <form action={startSignIn} className="mt-8">
          <button
            type="submit"
            className="rounded-xl bg-blue px-8 py-3 text-base font-semibold text-white transition-[background-color,box-shadow,transform] duration-200 ease-out hover:bg-navy hover:shadow-lg motion-safe:hover:-translate-y-px"
          >
            {t.signedOut.signInAgain}
          </button>
        </form>
      </section>
    </main>
  );
}
