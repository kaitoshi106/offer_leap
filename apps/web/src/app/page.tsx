import { APP_NAME, APP_TAGLINE } from '@offerleap/shared';

export default function HomePage() {
  return (
    <main className="grid min-h-dvh place-content-center gap-2 p-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">{APP_NAME}</h1>
      <p className="text-lg text-gray-600">{APP_TAGLINE}</p>
    </main>
  );
}
