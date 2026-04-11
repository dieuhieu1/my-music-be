// C1 — Public Artist Profile (no JWT required)
export default function PublicArtistProfilePage({ params }: { params: { id: string } }) {
  // TODO Phase 3: fetch artist profile, show stage name, bio, LIVE songs, follow button
  return (
    <main className="p-8">
      <p className="text-muted-foreground">Artist profile — ID: {params.id}</p>
    </main>
  );
}
