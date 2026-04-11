// E1 — Home / Landing
// Public (no JWT required) — shows featured drops, trending songs, featured artists
import { useTranslations } from 'next-intl';

export default function HomePage() {
  // TODO Phase 5: fetch featured content, trending songs, personalized recommendations
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">My Music</h1>
      <p className="mt-2 text-muted-foreground">Your music, your way.</p>
    </main>
  );
}
