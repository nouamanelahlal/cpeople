import Image from 'next/image';
import logo from '../public/brand/cpeople-logo-lockup-white.png';

export default function HomePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-card-border bg-white p-8 text-center sm:p-12">
        <Image
          src={logo}
          alt="CPeople by ConSAP — see your people, pay them right"
          priority
          sizes="(min-width: 640px) 384px, 256px"
          className="mx-auto h-auto w-64 sm:w-96"
        />

        <h1 className="mt-10 text-3xl font-light text-navy sm:text-4xl">
          HR and payroll for Morocco
        </h1>

        <p className="mt-6 text-sm text-body">
          Platform scaffold. The first screens arrive with the organisation and employee
          modules.
        </p>
      </section>
    </main>
  );
}
