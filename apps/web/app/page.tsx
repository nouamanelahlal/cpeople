import Image from 'next/image';
import { LOCALES } from '@cpeople/shared';
import wordmark from '../public/brand/cpeople-wordmark.png';
import { currentMessages } from '../lib/locale';
import { chooseLocale } from './actions';

export default async function HomePage() {
  const { locale, t } = await currentMessages();

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-card-border bg-white p-8 text-center sm:p-12">
        <Image
          src={wordmark}
          alt="CPeople by ConSAP"
          priority
          sizes="(min-width: 640px) 288px, 208px"
          className="mx-auto h-auto w-52 sm:w-72"
        />

        <h1 className="mt-10 text-3xl font-light text-navy sm:text-4xl">{t.landing.title}</h1>

        <form action="/api/auth/sign-in" method="get" className="mt-8">
          <input type="hidden" name="callbackUrl" value="/home" />
          <button
            type="submit"
            className="w-full rounded-xl bg-blue px-6 py-3 text-base font-semibold text-white transition-[background-color,box-shadow,transform] duration-200 ease-out hover:bg-navy hover:shadow-lg motion-safe:hover:-translate-y-px sm:w-auto sm:px-10"
          >
            {t.landing.signIn}
          </button>
        </form>

        <p className="mt-6 text-sm text-body">{t.landing.note}</p>

        <form action={chooseLocale} className="mt-8 flex items-center justify-center gap-2">
          <input type="hidden" name="returnTo" value="/" />
          <span className="text-xs uppercase tracking-wide text-body/70">{t.common.language}</span>
          {LOCALES.map((option) => (
            <button
              key={option}
              type="submit"
              name="locale"
              value={option}
              aria-current={option === locale ? 'true' : undefined}
              className={`rounded-lg px-3 py-1 text-sm font-semibold transition-colors duration-200 ease-out ${
                option === locale ? 'bg-tint text-navy' : 'text-blue hover:bg-tint hover:text-navy'
              }`}
            >
              {option === 'en' ? t.common.english : t.common.french}
            </button>
          ))}
        </form>
      </section>
    </main>
  );
}
